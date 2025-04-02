import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role, AttemptStatus } from '@prisma/client';

/**
 * POST - Submit exam answers
 */
export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    console.log(`Processing exam submission for code: ${params.code}`);

    // Parse the request body
    const body = await request.json();
    const { answers } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { message: 'Invalid answers format' },
        { status: 400 }
      );
    }

    console.log(`Received answers:`, answers);

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
        { message: 'Only students can submit exams' },
        { status: 403 }
      );
    }

    // Get the exam
    const exam = await prisma.exam.findFirst({
      where: { 
        examCode: params.code,
        status: 'PUBLISHED'  
      },
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

    console.log('Found exam:', exam.id, exam.title);
    console.log('Questions:', exam.questions.map(q => ({ 
      id: q.id, 
      question: q.question, 
      correctAnswer: q.correctAnswer 
    })));

    // Get the exam attempt
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id,
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { message: 'No active attempt found for this exam' },
        { status: 404 }
      );
    }

    if (attempt.status === AttemptStatus.COMPLETED) {
      return NextResponse.json(
        { message: 'This exam attempt has already been completed' },
        { status: 400 }
      );
    }

    // Calculate the score
    let totalScore = 0;
    const answersData: {
      questionId: string;
      attemptId: string;
      answer: string;
      isCorrect: boolean;
      marksObtained: number;
    }[] = [];

    // Calculate marks per question (evenly distributed)
    const totalQuestions = exam.questions.length;
    const marksPerQuestion = totalQuestions > 0 ? Math.floor(exam.totalMarks / totalQuestions) : 0;
    console.log(`Exam total marks: ${exam.totalMarks}, Questions: ${totalQuestions}, Marks per question: ${marksPerQuestion}`);
    
    for (const question of exam.questions) {
      const userAnswer = answers[question.id];
      
      if (userAnswer) {
        // Normalize both answers for comparison
        const normalizedUserAnswer = String(userAnswer).trim().toLowerCase();
        const normalizedCorrectAnswer = question.correctAnswer 
          ? String(question.correctAnswer).trim().toLowerCase() 
          : '';
        
        // Case-insensitive comparison
        const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
        
        console.log(`
          Question: ${question.id}
          Question text: "${question.question}"
          User answer: "${userAnswer}" (normalized: "${normalizedUserAnswer}")
          Correct answer: "${question.correctAnswer}" (normalized: "${normalizedCorrectAnswer}")
          Is correct: ${isCorrect}
        `);
        
        // Use the calculated marks per question instead of the question's marks
        const marksObtained = isCorrect ? marksPerQuestion : 0;
        totalScore += marksObtained;

        answersData.push({
          questionId: question.id,
          attemptId: attempt.id,
          answer: userAnswer,
          isCorrect,
          marksObtained
        });
      }
    }

    console.log(`Total score: ${totalScore}, Total answers: ${answersData.length}`);

    // Create the answers and update the attempt in a transaction
    await prisma.$transaction(async (tx) => {
      // Create answers
      for (const answerData of answersData) {
        await tx.answer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId: answerData.questionId
            }
          },
          update: {
            answer: answerData.answer,
            isCorrect: answerData.isCorrect,
            marksObtained: answerData.marksObtained
          },
          create: answerData
        });
      }

      // Update the attempt
      await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.COMPLETED,
          score: totalScore,
          endedAt: new Date()
        }
      });
    });

    return NextResponse.json({
      message: 'Exam submitted successfully',
      score: totalScore,
      totalQuestions: exam.questions.length,
      answeredQuestions: answersData.length
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    return NextResponse.json(
      { message: 'Error submitting exam' },
      { status: 500 }
    );
  }
} 