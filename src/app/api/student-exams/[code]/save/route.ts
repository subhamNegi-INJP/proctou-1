import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role, AttemptStatus } from '@prisma/client';

/**
 * POST - Save student's exam progress
 */
export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    console.log(`Saving exam progress for code: ${params.code}`);

    // Parse the request body
    const body = await request.json();
    const { questionId, answer } = body;

    if (!questionId || !answer) {
      return NextResponse.json(
        { message: 'Question ID and answer are required' },
        { status: 400 }
      );
    }

    console.log(`Received answer for question: ${questionId}`);

    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== Role.STUDENT) {
      return NextResponse.json(
        { message: 'Only students can save exam progress' },
        { status: 403 }
      );
    }

    // Get the exam
    const exam = await prisma.exam.findFirst({
      where: { 
        examCode: params.code,
        status: 'PUBLISHED'  
      },
      include: {
        questions: true
      }
    });

    if (!exam) {
      return NextResponse.json(
        { message: 'Exam not found' },
        { status: 404 }
      );
    }

    // Get the exam attempt
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id,
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { message: 'No active attempt found for this exam' },
        { status: 404 }
      );
    }

    if (attempt.status === AttemptStatus.COMPLETED) {
      return NextResponse.json(
        { message: 'This exam attempt has already been completed' },
        { status: 400 }
      );
    }

    // Save the answer
    await prisma.answer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: questionId
        }
      },
      update: {
        answer: answer
      },
      create: {
        attemptId: attempt.id,
        questionId: questionId,
        answer: answer
      }
    });

    return NextResponse.json({
      message: 'Progress saved successfully'
    });
  } catch (error) {
    console.error('Error saving exam progress:', error);
    return NextResponse.json(
      { message: 'Error saving exam progress' },
      { status: 500 }
    );
  }
} 