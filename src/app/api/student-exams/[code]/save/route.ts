import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const body = await request.json();
    const { questionId, answer } = body;

    if (!questionId || typeof answer !== 'string') {
      return NextResponse.json(
        { message: 'Invalid request data' },
        { status: 400 }
      );
    }

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
        { message: 'Only students can save exam progress' },
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

    // Verify the question belongs to the exam
    const question = exam.questions.find(q => q.id === questionId);
    if (!question) {
      return NextResponse.json(
        { message: 'Question not found in exam' },
        { status: 404 }
      );
    }

    // Get the exam attempt
    const attempt = await prisma.examAttempt.findFirst({
      where: {
        examId: exam.id,
        userId: user.id,
        status: 'IN_PROGRESS'
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { message: 'No active attempt found for this exam' },
        { status: 404 }
      );
    }

    // Extract test results and language if they're embedded in the code
    let processedAnswer = answer;
    const testResultsMatch = answer.match(/\/\/\s*TEST_RESULTS:\s*(.*)/);
    const languageMatch = answer.match(/\/\/\s*LANGUAGE:\s*(.*)/);
    
    let testResults = null;
    let language = null;
    
    // Extract test results
    if (testResultsMatch && testResultsMatch[1]) {
      testResults = testResultsMatch[1];
      processedAnswer = processedAnswer.replace(/\/\/\s*TEST_RESULTS:\s*.*/, '').trim();
      console.log('Extracted test results from answer:', testResults);
    }
    
    // Extract language
    if (languageMatch && languageMatch[1]) {
      language = languageMatch[1].trim();
      processedAnswer = processedAnswer.replace(/\/\/\s*LANGUAGE:\s*.*/, '').trim();
      console.log('Extracted language from answer:', language);
    }

    // Save the answer with test results and language
    const result = await prisma.answer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: question.id
        }
      },
      update: {
        answer: processedAnswer,
        testResults: testResults,
        language: language
      },
      create: {
        attemptId: attempt.id,
        questionId: question.id,
        answer: processedAnswer,
        testResults: testResults,
        language: language,
        isCorrect: false,
        marksObtained: 0
      }
    });

    return NextResponse.json({
      message: 'Progress saved successfully',
      answer: result
    });
  } catch (error) {
    console.error('Error saving exam progress:', error);
    return NextResponse.json(
      { message: 'Error saving exam progress' },
      { status: 500 }
    );
  }
}