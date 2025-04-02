import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST - Debug endpoint to create a test exam
 */
export async function POST(request: Request) {
  try {
    console.log('[API] POST /api/debug-create-exam - Creating test exam');
    
    // Get the current session
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      console.log('[API] POST /api/debug-create-exam - No authenticated user');
      return NextResponse.json({
        success: false,
        message: 'You must be logged in to create an exam'
      }, { status: 401 });
    }
    
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });
    
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found in database'
      }, { status: 404 });
    }
    
    // Create a test exam
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // 7 days from now
    
    const testExamCode = `TEST${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    const exam = await prisma.exam.create({
      data: {
        examCode: testExamCode,
        title: 'Test Exam',
        description: 'This is a test exam created for debugging purposes.',
        type: 'QUIZ',
        duration: 60, // 60 minutes
        totalMarks: 100,
        status: 'PUBLISHED', // Important - set to PUBLISHED
        startDate,
        endDate,
        userId: user.id,
        questions: {
          create: [
            {
              type: 'MULTIPLE_CHOICE',
              question: 'What is 2+2?',
              options: ['3', '4', '5', '6'],
              correctAnswer: '4',
              marks: 10
            },
            {
              type: 'MULTIPLE_CHOICE',
              question: 'What is the capital of France?',
              options: ['London', 'Berlin', 'Paris', 'Madrid'],
              correctAnswer: 'Paris',
              marks: 10
            }
          ]
        }
      }
    });
    
    console.log(`[API] POST /api/debug-create-exam - Created exam with ID: ${exam.id}, Code: ${exam.examCode}`);
    
    return NextResponse.json({
      success: true,
      message: 'Test exam created successfully',
      exam: {
        id: exam.id,
        examCode: exam.examCode,
        title: exam.title,
        status: exam.status,
        startDate: exam.startDate,
        endDate: exam.endDate
      }
    });
  } catch (error) {
    console.error('[API] POST /api/debug-create-exam - Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating test exam',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}