import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is a teacher
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== Role.TEACHER) {
      return NextResponse.json(
        { message: 'Forbidden: Only teachers can view detailed exam information' },
        { status: 403 }
      );
    }

    const examId = params.examId;

    // Fetch the exam with questions
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
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

    // Make sure the teacher is the creator of the exam
    if (exam.userId !== user.id) {
      return NextResponse.json(
        { message: 'Forbidden: You are not authorized to view this exam' },
        { status: 403 }
      );
    }

    // Return the exam directly without nesting
    return NextResponse.json(exam);
  } catch (error) {
    console.error('Error fetching exam details:', error);
    return NextResponse.json(
      { message: 'Failed to fetch exam details' },
      { status: 500 }
    );
  }
} 