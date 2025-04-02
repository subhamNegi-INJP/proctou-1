import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role, ExamAttempt } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Get the exam ID from the query parameter
    const examId = request.nextUrl.searchParams.get('examId');
    
    if (!examId) {
      return NextResponse.json(
        { message: 'Missing examId parameter' },
        { status: 400 }
      );
    }
    
    console.log('Debug route: examId from query:', examId);
    
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is a teacher (only teachers can view all results)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { role: true }
    });

    if (user?.role !== Role.TEACHER) {
      return NextResponse.json(
        { message: 'Forbidden: Only teachers can view all exam results' },
        { status: 403 }
      );
    }

    // Fetch the exam to confirm it exists
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, totalMarks: true }
    });

    if (!exam) {
      return NextResponse.json(
        { message: 'Exam not found' },
        { status: 404 }
      );
    }

    // Fetch all attempts for this exam with student information
    const attempts = await prisma.examAttempt.findMany({
      where: { examId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    // Format the results
    const results = attempts.map((attempt: ExamAttempt & { 
      user: { 
        id: string; 
        name: string | null; 
        email: string 
      } 
    }) => ({
      id: attempt.id,
      studentId: attempt.userId,
      studentName: attempt.user.name || 'Unknown',
      studentEmail: attempt.user.email,
      score: attempt.score || 0,
      totalMarks: exam.totalMarks,
      submittedAt: attempt.endedAt || attempt.updatedAt,
      status: attempt.status,
    }));

    return NextResponse.json({
      examId: exam.id,
      examTitle: exam.title,
      results
    });
  } catch (error) {
    console.error('Error fetching exam results:', error);
    return NextResponse.json(
      { message: 'Failed to fetch exam results' },
      { status: 500 }
    );
  }
} 