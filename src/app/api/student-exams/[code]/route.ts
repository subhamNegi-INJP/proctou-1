import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * GET - Fetch exam by code for students
 * This route is used when students access an exam using the exam code
 */
export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    console.log(`Fetching exam with code: ${params.code}`);
    
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user and ensure they are a student
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

    // Students can only access published exams
    const exam = await prisma.exam.findFirst({
      where: { 
        examCode: params.code,
        status: 'PUBLISHED'
      },
      include: {
        questions: true,
        attempts: {
          where: { userId: user.id }
        }
      }
    });

    if (!exam) {
      return NextResponse.json(
        { message: 'Exam not found or not available' },
        { status: 404 }
      );
    }

    // Check if the exam is active
    const now = new Date();
    if (now < exam.startDate) {
      return NextResponse.json(
        { message: 'This exam has not started yet' },
        { status: 403 }
      );
    }

    if (now > exam.endDate) {
      return NextResponse.json(
        { message: 'This exam has already ended' },
        { status: 403 }
      );
    }

    return NextResponse.json(exam);
  } catch (error) {
    console.error('Error fetching exam:', error);
    return NextResponse.json(
      { message: 'Error fetching exam' },
      { status: 500 }
    );
  }
} 