import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role, AttemptStatus } from '@prisma/client';

/**
 * POST - Join an exam by code
 */
export async function POST(
  request: Request
) {
  console.log('[API] POST /api/exam/join - Request received');
  try {
    const { examCode } = await request.json();
    
    console.log(`[API] POST /api/exam/join - Exam code: ${examCode}`);
    
    if (!examCode) {
      console.log('[API] POST /api/exam/join - Missing exam code');
      return NextResponse.json(
        { message: 'Exam code is required' },
        { status: 400 }
      );
    }
    
    const session = await getServerSession();
    
    console.log(`[API] POST /api/exam/join - Session:`, session?.user?.email || 'No session');
    
    if (!session?.user?.email) {
      console.log('[API] POST /api/exam/join - Unauthorized (no session)');
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

    console.log(`[API] POST /api/exam/join - User:`, user?.id || 'User not found', 'Role:', user?.role || 'No role');

    if (!user || user.role !== Role.STUDENT) {
      console.log('[API] POST /api/exam/join - Not a student');
      return NextResponse.json(
        { message: 'Only students can join exams' },
        { status: 403 }
      );
    }

    // Find the exam by code
    console.log(`[API] POST /api/exam/join - Finding exam with code: ${examCode}`);
    const exam = await prisma.exam.findFirst({
      where: { 
        examCode,
        status: 'PUBLISHED'  
      }
    });

    console.log(`[API] POST /api/exam/join - Exam found:`, exam?.id || 'Exam not found');

    if (!exam) {
      console.log('[API] POST /api/exam/join - Exam not found or not available');
      return NextResponse.json(
        { message: 'Exam not found or not available' },
        { status: 404 }
      );
    }

    // Check if exam is active
    const now = new Date();
    if (now < exam.startDate) {
      return NextResponse.json(
        { message: 'Exam has not started yet' },
        { status: 400 }
      );
    }

    if (now > exam.endDate) {
      return NextResponse.json(
        { message: 'Exam has already ended' },
        { status: 400 }
      );
    }

    // Check if student has already attempted this exam
    const existingAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id
      }
    });

    if (existingAttempt && existingAttempt.status === AttemptStatus.COMPLETED) {
      return NextResponse.json(
        { message: 'You have already completed this exam' },
        { status: 400 }
      );
    }

    // Create an attempt if doesn't exist
    if (!existingAttempt) {
      await prisma.examAttempt.create({
        data: {
          examId: exam.id,
          userId: user.id,
          status: AttemptStatus.IN_PROGRESS,
          startedAt: new Date()
        }
      });
    }

    return NextResponse.json({
      message: 'Successfully joined exam',
      examCode: exam.examCode
    });
  } catch (error) {
    console.error('Error joining exam:', error);
    return NextResponse.json(
      { message: 'Error joining exam' },
      { status: 500 }
    );
  }
} 