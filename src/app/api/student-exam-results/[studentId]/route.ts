import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const examId = request.nextUrl.searchParams.get('examId');
    
    if (!examId) {
      return NextResponse.json(
        { message: 'Missing examId query parameter' },
        { status: 400 }
      );
    }
    
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is a teacher or the student themselves
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

    // Only allow teachers or the student themselves to view the result
    if (user.role !== Role.TEACHER && user.id !== params.studentId) {
      return NextResponse.json(
        { message: 'Forbidden: You do not have permission to view this result' },
        { status: 403 }
      );
    }

    const studentId = params.studentId;

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

    // Fetch the student's attempt
    const attempt = await prisma.examAttempt.findFirst({
      where: { 
        examId, 
        userId: studentId 
      },
      include: {
        answers: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { message: 'No attempt found for this student' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exam,
      attempt
    });
  } catch (error) {
    console.error('Error fetching student exam result:', error);
    return NextResponse.json(
      { message: 'Failed to fetch student exam result' },
      { status: 500 }
    );
  }
} 