import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST - Debug endpoint to update an exam status to PUBLISHED
 */
export async function POST(request: Request) {
  try {
    const { examCode } = await request.json();
    
    console.log(`[API] POST /api/debug-update-exam - Updating exam status for code: ${examCode}`);
    
    if (!examCode) {
      console.log('[API] POST /api/debug-update-exam - Missing exam code');
      return NextResponse.json(
        { message: 'Exam code is required' },
        { status: 400 }
      );
    }
    
    // First check if the exam exists
    const existingExam = await prisma.exam.findFirst({
      where: { examCode },
      select: { id: true, status: true }
    });
    
    if (!existingExam) {
      console.log(`[API] POST /api/debug-update-exam - No exam found with code: ${examCode}`);
      return NextResponse.json(
        { message: 'Exam not found' },
        { status: 404 }
      );
    }
    
    console.log(`[API] POST /api/debug-update-exam - Found exam: ${existingExam.id}, current status: ${existingExam.status}`);
    
    // Update the exam status to PUBLISHED
    const updatedExam = await prisma.exam.update({
      where: { id: existingExam.id },
      data: {
        status: 'PUBLISHED',
        // Also update dates to ensure the exam is active
        startDate: new Date(), // Start now
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // End 7 days from now
      },
      select: {
        id: true,
        examCode: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true
      }
    });
    
    console.log(`[API] POST /api/debug-update-exam - Updated exam status: ${updatedExam.status}`);
    
    return NextResponse.json({
      success: true,
      message: 'Exam status updated to PUBLISHED',
      exam: updatedExam
    });
  } catch (error) {
    console.error('[API] POST /api/debug-update-exam - Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error updating exam status',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 