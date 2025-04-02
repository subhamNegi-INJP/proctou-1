import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * GET - Fetch all student results for a specific exam (teacher only)
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

    // Get the user and check if they're a teacher
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user || user.role !== Role.TEACHER) {
      return NextResponse.json(
        { message: 'Forbidden - Only teachers can access this resource' },
        { status: 403 }
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

    // Get all attempts for this exam
    const attempts = await prisma.examAttempt.findMany({
      where: {
        examId: exam.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        answers: true
      }
    });

    return NextResponse.json({
      exam,
      attempts
    });
  } catch (error) {
    console.error('Error fetching exam results:', error);
    return NextResponse.json(
      { message: 'Error fetching exam results' },
      { status: 500 }
    );
  }
} 