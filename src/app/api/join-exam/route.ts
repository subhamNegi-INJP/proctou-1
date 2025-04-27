import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role, AttemptStatus, Prisma } from '@prisma/client';

/**
 * POST - Join an exam by code
 */
export async function POST(
  request: Request
) {
  console.log('[API] POST /api/join-exam - Request received');
  try {
    const { examCode } = await request.json();
    
    console.log(`[API] POST /api/join-exam - Exam code: ${examCode}`);
    
    if (!examCode) {
      console.log('[API] POST /api/join-exam - Missing exam code');
      return NextResponse.json(
        { message: 'Exam code is required' },
        { status: 400 }
      );
    }
    
    const session = await getServerSession();
    
    console.log(`[API] POST /api/join-exam - Session:`, session?.user?.email || 'No session');
    
    if (!session?.user?.email) {
      console.log('[API] POST /api/join-exam - Unauthorized (no session)');
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

    console.log(`[API] POST /api/join-exam - User:`, user?.id || 'User not found', 'Role:', user?.role || 'No role');

    if (!user || user.role !== Role.STUDENT) {
      console.log('[API] POST /api/join-exam - Not a student');
      return NextResponse.json(
        { message: 'Only students can join exams' },
        { status: 403 }
      );
    }

    // First, try to find any exam with this code regardless of status
    console.log(`[API] POST /api/join-exam - Checking if any exam exists with code: ${examCode}`);
    const anyExam = await prisma.exam.findFirst({
      where: { 
        examCode
      }
    });

    if (!anyExam) {
      console.log(`[API] POST /api/join-exam - No exam found with code: ${examCode}`);
      return NextResponse.json(
        { message: 'Exam code is invalid' },
        { status: 404 }
      );
    }

    console.log(`[API] POST /api/join-exam - Found exam with ID: ${anyExam.id}, Status: ${anyExam.status}`);

    // Now find the exam by code and published status
    console.log(`[API] POST /api/join-exam - Finding published exam with code: ${examCode}`);
    const exam = await prisma.exam.findFirst({
      where: { 
        examCode,
        status: 'PUBLISHED'  
      }
    });

    console.log(`[API] POST /api/join-exam - Published exam found:`, exam?.id || 'Exam not found', 'Status:', exam?.status || 'N/A');

    if (!exam) {
      console.log('[API] POST /api/join-exam - Exam not published or not available');
      return NextResponse.json(
        { message: 'Exam is not available for taking' },
        { status: 404 }
      );
    }

    // Check if exam is active
    const now = new Date();
    console.log(`[API] POST /api/join-exam - Current time: ${now.toISOString()}`);
    console.log(`[API] POST /api/join-exam - Exam start: ${exam.startDate.toISOString()}`);
    console.log(`[API] POST /api/join-exam - Exam end: ${exam.endDate.toISOString()}`);
    
    if (now < exam.startDate) {
      console.log('[API] POST /api/join-exam - Exam has not started yet');
      return NextResponse.json(
        { message: 'Exam has not started yet' },
        { status: 400 }
      );
    }

    if (now > exam.endDate) {
      console.log('[API] POST /api/join-exam - Exam has already ended');
      return NextResponse.json(
        { message: 'Exam has already ended' },
        { status: 400 }
      );
    }

    // Modify to check if there's an in-progress attempt and continue it
    // rather than always creating a new one
    const existingAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (existingAttempt) {
      console.log(`Continuing existing attempt ${existingAttempt.id} for exam ${exam.id}`);
      return NextResponse.json({
        message: 'Continuing existing exam attempt',
        attemptId: existingAttempt.id
      });
    }

    // Check if student has already attempted this exam
    const completedAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id,
        status: AttemptStatus.COMPLETED
      }
    });

    if (completedAttempt) {
      return NextResponse.json(
        { message: 'You have already completed this exam' },
        { status: 400 }
      );
    }

    // Create an attempt if doesn't exist
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        userId: user.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date()
      }
    });

    console.log('[API] POST /api/join-exam - Successfully joined exam');
    return NextResponse.json({
      message: 'Exam attempt created successfully',
      attemptId: attempt.id,
      isNewAttempt: true
    });
  } catch (error) {
    console.error('[API] POST /api/join-exam - Error:', error);
    return NextResponse.json(
      { message: 'Error joining exam' },
      { status: 500 }
    );
  }
}