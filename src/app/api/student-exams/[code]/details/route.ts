import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

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

    if (user.role !== Role.STUDENT) {
      return NextResponse.json(
        { message: 'Only students can access exam details' },
        { status: 403 }
      );
    }

    // Get basic exam details without questions to display on the instructions page
    const exam = await prisma.exam.findFirst({
      where: { 
        examCode: params.code,
        status: 'PUBLISHED'  
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        duration: true,
        totalMarks: true,
        startDate: true,
        endDate: true,
        status: true,
        _count: {
          select: {
            questions: true
          }
        }
      }
    });

    if (!exam) {
      return NextResponse.json(
        { message: 'Exam not found' },
        { status: 404 }
      );
    }    // Check if there's an existing attempt that's already COMPLETED
    const completedAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id,
        OR: [
          { status: 'COMPLETED' },
          { status: 'completed' as any }  // Handle possible case variations
        ]
      }
    });

    if (completedAttempt) {
      console.log(`Student with ID ${user.id} has already completed exam with ID ${exam.id}`);
      return NextResponse.json(
        { message: 'You have already completed this exam' },
        { status: 400 }
      );
    }

    // Return the basic exam details needed for the instructions page
    return NextResponse.json({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      type: exam.type,
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      startDate: exam.startDate,
      endDate: exam.endDate,
      questionsCount: exam._count.questions
    });
  } catch (error) {
    console.error('Error fetching exam details:', error);
    return NextResponse.json(
      { message: 'Error fetching exam details' },
      { status: 500 }
    );
  }
}
