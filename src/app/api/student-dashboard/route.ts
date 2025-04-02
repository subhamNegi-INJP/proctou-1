import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * GET - Fetch all exams and results for the logged-in student's dashboard
 */
export async function GET() {
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
        { message: 'Forbidden - Only students can access this resource' },
        { status: 403 }
      );
    }

    // Get all the student's exam attempts
    const attempts = await prisma.examAttempt.findMany({
      where: {
        userId: user.id,
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            description: true,
            examCode: true,
            startDate: true,
            endDate: true,
            duration: true,
            status: true,
            questions: {
              select: {
                id: true
              }
            }
          }
        },
        answers: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Find published exams the student hasn't attempted yet
    const availableExams = await prisma.exam.findMany({
      where: {
        status: 'PUBLISHED',
        endDate: {
          gte: new Date()
        },
        startDate: {
          lte: new Date()
        },
        // Exclude exams that the student has already completed
        NOT: {
          attempts: {
            some: {
              userId: user.id,
              status: 'COMPLETED'
            }
          }
        }
      },
      select: {
        id: true,
        title: true,
        description: true,
        examCode: true,
        startDate: true,
        endDate: true,
        duration: true,
        questions: {
          select: {
            id: true
          }
        }
      }
    });

    // Filter out available exams that student has already attempted but not completed
    const attemptedExamIds = attempts.map(attempt => attempt.examId);
    const trulyAvailableExams = availableExams.filter(
      exam => !attemptedExamIds.includes(exam.id)
    );

    return NextResponse.json({
      attempts,
      availableExams: trulyAvailableExams
    });
  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json(
      { message: 'Error fetching student dashboard data' },
      { status: 500 }
    );
  }
} 