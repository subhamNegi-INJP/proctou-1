import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role, AttemptStatus, QuestionType } from '@prisma/client';

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

    const TEST_CASE_SEPARATOR = '⏹'; // U+23F9
    const OUTPUT_SEPARATOR = '⏺'; // U+23FA

    console.log(`Exam total marks: ${exam.totalMarks}, Questions: ${exam.questions.length}`);
    
    for (const question of exam.questions) {
      const userAnswer = answers[question.id];
      if (userAnswer) {
        if (question.type === QuestionType.CODING) {
          // Process coding question: run each test case via JDoodle API
          const testCases = question.options; // Each test case formatted as "input⏹expectedOutput"
          const numCases = testCases.length;
          let questionScore = 0;
          let testCaseResults = [];
          for (const testCaseString of testCases) {
            const [input = '', expectedOutput = ''] = testCaseString.split(TEST_CASE_SEPARATOR);
            // Prepare submission for JDoodle (using default values for language)
            const submission = {
              clientId: 'c686aa69cddc1b0bc04764cf8d1e0eea', // your JDoodle clientId
              clientSecret: '2449878da09acf502d1fae5bc48acecbd1c476a992c117f14b83bd5a24ba3640', // your JDoodle clientSecret
              script: userAnswer,
              stdin: input,
              language: 'nodejs',
              versionIndex: '4'
            };
            try {
              const jdoodleResponse = await fetch('https://api.jdoodle.com/v1/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submission)
              });
              const jdoodleResult = await jdoodleResponse.json();
              const actualOutput = String(jdoodleResult.output || '').trim();
              const passed = actualOutput === expectedOutput.trim();
              if (passed) {
                questionScore += question.marks / numCases;
              }
              testCaseResults.push(`${input}${TEST_CASE_SEPARATOR}${expectedOutput}${OUTPUT_SEPARATOR}${actualOutput}`);
            } catch (err) {
              testCaseResults.push(`${input}${TEST_CASE_SEPARATOR}${expectedOutput}${OUTPUT_SEPARATOR}Error`);
            }
          }
          totalScore += questionScore;
          answersData.push({
            questionId: question.id,
            attemptId: attempt.id,
            answer: testCaseResults.join('||'), // Concatenated results for each test case
            isCorrect: questionScore === question.marks,
            marksObtained: questionScore
          });
        } else {
          // ...existing code for non-coding questions...
          const normalizedUserAnswer = String(userAnswer).trim().toLowerCase();
          const normalizedCorrectAnswer = question.correctAnswer
            ? String(question.correctAnswer).trim().toLowerCase()
            : '';
          const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
          const marksObtained = isCorrect ? question.marks : 0;
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