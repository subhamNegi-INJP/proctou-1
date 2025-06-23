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
    const { answers, currentLanguage } = body;

    console.log(`Received currentLanguage:`, currentLanguage);
    
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
      type: q.type,
      question: q.question, 
      correctAnswer: q.correctAnswer,
      options: q.options 
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
          // Check if the answer has the new format with language info
          let codeToExecute = '';
          let languageToUse = currentLanguage || 'nodejs'; // Default to nodejs if not specified
          
          if (typeof userAnswer === 'object' && userAnswer !== null) {
            // New format with language and code separated
            console.log(`Question ${question.id} has structured answer with language: ${userAnswer.language}`);
            codeToExecute = userAnswer.code || '';
            languageToUse = userAnswer.language || languageToUse;
            
            // If there are already results, use those instead of running the tests again
            if (userAnswer.results) {
              console.log(`Using precomputed results for question ${question.id}`);
              
              // Use the results directly
              const testCaseResults = userAnswer.results.split('||');
              totalScore += calculateScoreFromResults(testCaseResults, question.marks);
              
              answersData.push({
                questionId: question.id,
                attemptId: attempt.id,
                answer: userAnswer.results,
                isCorrect: false, // We'll determine this later
                marksObtained: 0 // We'll calculate this later
              });
              
              continue; // Skip the test execution
            }
          } else {
            // Original format (string)
            codeToExecute = userAnswer;
          }
          
          // Validate that question.options contains properly formatted test cases
          if (!question.options || question.options.length === 0) {
            console.warn(`Question ${question.id} has no test cases`);
            continue;
          }
          
          console.log(`Processing coding question ${question.id} with ${question.options.length} test cases:`, question.options);
          
          // Ensure each test case is properly formatted and contains actual content
          const testCases = question.options
            .filter(tc => tc && tc.includes(TEST_CASE_SEPARATOR))
            .filter(tc => {
              const [input, output] = tc.split(TEST_CASE_SEPARATOR);
              return (input && input.trim()) || (output && output.trim());
            });
            
          if (testCases.length === 0) {
            console.warn(`Question ${question.id} has no valid test cases`);
            continue;
          }
          
          const numCases = testCases.length;
          let questionScore = 0;
          let testCaseResults = [];
          
          for (const testCaseString of testCases) {
            const [input = '', expectedOutput = ''] = testCaseString.split(TEST_CASE_SEPARATOR);
            
            console.log(`Running test case - Input: "${input}", Expected: "${expectedOutput}"`);
            
            // Format input properly based on language
            let formattedInput = input;
            
            // Use the language that was provided with the answer
            console.log(`Using language for test execution: ${languageToUse}`);
            
            // Handle multiple inputs for all languages
            if (input.includes(',')) {
              formattedInput = input.split(',').map(i => i.trim()).join('\n');
              console.log(`Formatted input with multiple values for ${languageToUse}: "${formattedInput}"`);
            }
            
            // Prepare submission for JDoodle with properly formatted input
            const submission = {
              clientId: 'c686aa69cddc1b0bc04764cf8d1e0eea', // your JDoodle clientId
              clientSecret: '2449878da09acf502d1fae5bc48acecbd1c476a992c117f14b83bd5a24ba3640', // your JDoodle clientSecret
              script: codeToExecute,
              stdin: formattedInput,
              language: languageToUse,
              versionIndex: '4'  // Use latest version for all languages
            };
            console.log(`Submitting to JDoodle with language: ${languageToUse}`);
            try {
              const jdoodleResponse = await fetch('https://api.jdoodle.com/v1/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submission)
              });
              
              if (!jdoodleResponse.ok) {
                const errorText = await jdoodleResponse.text();
                console.error(`JDoodle API error (${jdoodleResponse.status}):`, errorText);
                testCaseResults.push(`${input}${TEST_CASE_SEPARATOR}${expectedOutput}${OUTPUT_SEPARATOR}Error: API request failed`);
                continue;
              }
              
              const jdoodleResult = await jdoodleResponse.json();
              console.log('JDoodle response:', jdoodleResult);
              
              // Check if there was an execution error
              if (jdoodleResult.error) {
                console.error('JDoodle execution error:', jdoodleResult.error);
                testCaseResults.push(`${input}${TEST_CASE_SEPARATOR}${expectedOutput}${OUTPUT_SEPARATOR}Error: ${jdoodleResult.error}`);
                continue;
              }
              
              const actualOutput = String(jdoodleResult.output || '').trim();
              console.log(`Test result - Input: "${input}", Expected: "${expectedOutput}", Got: "${actualOutput}"`);
              
              const passed = actualOutput === expectedOutput.trim();
              if (passed) {
                questionScore += question.marks / numCases;
                console.log(`Test passed! Adding ${question.marks / numCases} points. Current score: ${questionScore}`);
              } else {
                console.log(`Test failed. Expected: "${expectedOutput.trim()}", Got: "${actualOutput}"`);
              }
              
              // Add the test result with BOTH expected and actual output
              testCaseResults.push(`${input}${TEST_CASE_SEPARATOR}${expectedOutput}${OUTPUT_SEPARATOR}${actualOutput}`);
            } catch (err) {
              console.error('Error executing code:', err);
              testCaseResults.push(`${input}${TEST_CASE_SEPARATOR}${expectedOutput}${OUTPUT_SEPARATOR}Error: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          
          // Log the final testCaseResults for debugging
          console.log('All test case results:', testCaseResults);
          
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

    console.log(`Total score: ${totalScore}, Total answers: ${answersData.length}`);    // Create the answers and update the attempt in a transaction
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
    }, {
      timeout: 15000, // 15 seconds timeout for exam submission
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

// Helper function to calculate score from test results
function calculateScoreFromResults(testCaseResults: string[], totalMarks: number): number {
  if (testCaseResults.length === 0) return 0;
  
  const TEST_CASE_SEPARATOR = '⏹';
  const OUTPUT_SEPARATOR = '⏺';
  
  let passedCount = 0;
  
  for (const result of testCaseResults) {
    const parts = result.split(OUTPUT_SEPARATOR);
    if (parts.length < 2) continue;
    
    const testCase = parts[0];
    const actualOutput = parts[1];
    
    const expectedOutput = testCase.split(TEST_CASE_SEPARATOR)[1]?.trim();
    if (expectedOutput && actualOutput.trim() === expectedOutput) {
      passedCount++;
    }
  }
  
  return (passedCount / testCaseResults.length) * totalMarks;
}