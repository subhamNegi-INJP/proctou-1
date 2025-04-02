import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role, AttemptStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const session = await getServerSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email as string,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }
    
    if (user.role !== Role.TEACHER) {
      return NextResponse.json(
        { message: 'Access denied. Only teachers can view exam results.' },
        { status: 403 }
      );
    }
    
    const { examId } = params;
    
    // Check if the exam belongs to the teacher
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        userId: user.id, // Teacher who created the exam
      },
    });
    
    if (!exam) {
      return NextResponse.json(
        { message: 'Exam not found or you do not have permission to view it' },
        { status: 404 }
      );
    }
    
    // Fetch exam attempts and related student data
    const examAttempts = await prisma.examAttempt.findMany({
      where: {
        examId: examId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        answers: true,
      },
      orderBy: {
        endedAt: 'desc',
      },
    });
    
    // Format the results
    const results = examAttempts.map((attempt) => {
      // Calculate the score based on answers
      const totalMarks = attempt.answers.reduce((total: number, answer: any) => {
        return total + (answer.marksObtained || 0);
      }, 0);
      
      return {
        id: attempt.id,
        studentId: attempt.userId,
        studentName: attempt.user?.name || 'Unknown Student',
        studentEmail: attempt.user?.email || 'No Email',
        score: totalMarks,
        totalMarks: attempt.answers.length, // Assuming 1 mark per question
        submittedAt: attempt.endedAt || attempt.updatedAt,
        status: attempt.status,
      };
    });
    
    return NextResponse.json({
      examId: examId,
      title: exam.title,
      results: results,
    });
    
  } catch (error) {
    console.error('Error fetching exam results:', error);
    return NextResponse.json(
      { message: 'Failed to fetch exam results' },
      { status: 500 }
    );
  }
} 