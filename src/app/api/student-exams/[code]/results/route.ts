import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * GET - Fetch student's own exam results by exam code
 */
export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
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

    // Find the exam by code
    const exam = await prisma.exam.findFirst({
      where: { examCode: params.code },
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

    // Get the student's attempt for this exam
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id,
      },
      include: {
        answers: true
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { message: 'No attempt found for this exam' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exam,
      attempt
    });
  } catch (error) {
    console.error('Error fetching exam result:', error);
    return NextResponse.json(
      { message: 'Error fetching exam result' },
      { status: 500 }
    );
  }
} 