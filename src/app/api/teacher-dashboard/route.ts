import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * GET - Fetch all exams created by the logged-in teacher with stats
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

    if (user.role !== Role.TEACHER) {
      return NextResponse.json(
        { message: 'Forbidden - Only teachers can access this resource' },
        { status: 403 }
      );
    }

    // Get all exams created by the teacher
    const exams = await prisma.exam.findMany({
      where: {
        userId: user.id
      },
      include: {
        _count: {
          select: {
            attempts: true,
            questions: true
          }
        },
        attempts: {
          select: {
            status: true,
            score: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate statistics for each exam
    const examStats = exams.map(exam => {
      const totalAttempts = exam._count.attempts;
      const completedAttempts = exam.attempts.filter(a => a.status === 'COMPLETED').length;
      const averageScore = exam.attempts.length > 0
        ? exam.attempts.reduce((sum, a) => sum + (a.score || 0), 0) / exam.attempts.length
        : 0;
      
      return {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        examCode: exam.examCode,
        startDate: exam.startDate,
        endDate: exam.endDate,
        duration: exam.duration,
        status: exam.status,
        type: exam.type,
        questionCount: exam._count.questions,
        totalAttempts,
        completedAttempts,
        inProgressAttempts: totalAttempts - completedAttempts,
        averageScore,
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt
      };
    });

    // Get recent activity (last 10 exam attempts)
    const recentActivity = await prisma.examAttempt.findMany({
      where: {
        exam: {
          userId: user.id
        }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        exam: {
          select: {
            title: true,
            examCode: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 10
    });

    return NextResponse.json({
      exams: examStats,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching teacher dashboard data:', error);
    return NextResponse.json(
      { message: 'Error fetching teacher dashboard data' },
      { status: 500 }
    );
  }
} 