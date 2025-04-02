import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET - Debug endpoint to list all exams
 */
export async function GET() {
  try {
    console.log('[API] GET /api/debug-exams - Attempting to list all exams');
    
    // Count total exams
    const totalExams = await prisma.exam.count();
    console.log(`[API] GET /api/debug-exams - Total exams in database: ${totalExams}`);
    
    // Get a list of all exams with basic info
    const exams = await prisma.exam.findMany({
      select: {
        id: true,
        examCode: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true
      }
    });
    
    console.log(`[API] GET /api/debug-exams - Retrieved ${exams.length} exams`);
    
    return NextResponse.json({
      success: true,
      totalExams,
      exams
    });
  } catch (error) {
    console.error('[API] GET /api/debug-exams - Error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error fetching exams',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Debug endpoint to fix incorrect answer formats
 * Converts letter answers to actual option text if needed
 */
export async function PATCH() {
  try {
    console.log('[API] PATCH /api/debug-exams - Attempting to fix exam answers');
    
    // Get all exams with questions
    const exams = await prisma.exam.findMany({
      include: {
        questions: true
      }
    });
    
    console.log(`[API] PATCH /api/debug-exams - Retrieved ${exams.length} exams with questions`);
    
    let fixedCount = 0;
    
    // Process each exam
    for (const exam of exams) {
      // Track if we've made changes to this exam
      let examUpdated = false;
      
      for (const question of exam.questions) {
        // Check if the correct answer is a letter (A, B, C, D)
        const correctAnswer = question.correctAnswer || '';
        if (['A', 'B', 'C', 'D'].includes(correctAnswer) && question.options.length > 0) {
          console.log(`Found letter answer format in question ${question.id}: ${correctAnswer}`);
          
          // Map the letter to the corresponding option
          const index = correctAnswer.charCodeAt(0) - 'A'.charCodeAt(0);
          
          // Make sure the index is valid
          if (index >= 0 && index < question.options.length) {
            const correctOption = question.options[index];
            console.log(`Fixing question ${question.id}: ${correctAnswer} -> ${correctOption}`);
            
            // Update the question
            await prisma.question.update({
              where: { id: question.id },
              data: { correctAnswer: correctOption }
            });
            
            fixedCount++;
            examUpdated = true;
          }
        }
      }
      
      // If we updated any questions, update the exam status to trigger a refresh
      if (examUpdated) {
        await prisma.exam.update({
          where: { id: exam.id },
          data: {
            status: exam.status, // Update with same status to trigger timestamp change
            updatedAt: new Date()
          }
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} questions with incorrect answer formats`,
      fixedCount
    });
  } catch (error) {
    console.error('[API] PATCH /api/debug-exams - Error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error fixing exam answers',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 