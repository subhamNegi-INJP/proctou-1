'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Exam, Question, ExamAttempt, Answer } from '@prisma/client';

type ExamWithDetails = Exam & {
  questions: Question[];
  attempts: (ExamAttempt & {
    answers: Answer[];
  })[];
};

export default function ExamResultsPage({ params }: { params: { code: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<ExamWithDetails | null>(null);
  const [userAttempt, setUserAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(0);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    const fetchExamResults = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/student-exams/${params.code}/results`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch exam results');
        }
        
        const data = await response.json();
        console.log("Retrieved data:", data);
        
        setExam(data.exam);
        setUserAttempt(data.attempt);
        setAnswers(data.attempt?.answers || []);
        
        // Calculate marks per question
        if (data.exam && data.exam.questions.length > 0) {
          const calculatedMarksPerQuestion = Math.floor(data.exam.totalMarks / data.exam.questions.length);
          setMarksPerQuestion(calculatedMarksPerQuestion);
        }
      } catch (error) {
        console.error('Error fetching exam results:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchExamResults();
  }, [session, status, router, params.code]);  // Helper function to check if an answer is correct
  const checkIfAnswerIsCorrect = (userAnswer: any, correctAnswer: string | null | undefined) => {
    // First check if we have a valid user answer
    if (userAnswer === undefined || userAnswer === null) return false;
    
    // If correctAnswer is null/undefined and we still have a userAnswer, 
    // it could be a coding question where correctness is determined differently
    if (!correctAnswer && typeof userAnswer === 'string') {
      // For coding questions, look for test results in the answer string
      if (userAnswer.includes('||') && userAnswer.includes('⏹') && userAnswer.includes('⏺')) {
        // This is likely a coding question with test case results
        // We'll consider it correct if any test cases passed (some marks were obtained)
        return userAnswer.includes('true') || userAnswer.includes('passed');
      }
    }
    
    // For coding questions, the answer might be stored as a JSON string
    if (typeof userAnswer === 'string' && userAnswer.startsWith('{') && userAnswer.endsWith('}')) {
      try {
        const parsedUserAnswer = JSON.parse(userAnswer);
        // If isCorrect is explicitly defined in the parsed answer, use that
        if ('isCorrect' in parsedUserAnswer) {
          return Boolean(parsedUserAnswer.isCorrect);
        }
        // For test results
        if (parsedUserAnswer.testResults && Array.isArray(parsedUserAnswer.testResults)) {
          return parsedUserAnswer.testResults.some((test: any) => test.passed);
        }
        // If there's a results field with test outcomes
        if (parsedUserAnswer.results && typeof parsedUserAnswer.results === 'string') {
          return parsedUserAnswer.results.includes('passed') || parsedUserAnswer.results.includes('true');
        }
      } catch (e) {
        // If JSON parsing fails, continue with string comparison
      }
    }
    
    // If we have a correctAnswer, do a string comparison for quiz questions
    if (correctAnswer) {
      const normalizedUserAnswer = String(userAnswer).trim().toLowerCase();
      const normalizedCorrectAnswer = String(correctAnswer).trim().toLowerCase();
      return normalizedUserAnswer === normalizedCorrectAnswer;
    }
    
    // If we reach here and have no way to determine correctness, default to false
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !exam || !userAttempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Result not found'}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {exam.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {exam.description}
          </p>
        </div>

        {/* Score Summary */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Your Results
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Score</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {userAttempt.score || 0} / {exam.totalMarks}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Percentage</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {((userAttempt.score || 0) / exam.totalMarks * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {userAttempt.status}
              </p>
            </div>
          </div>
        </div>

        {/* Question Review */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Question Review
          </h2>
          <div className="space-y-4">
            {exam.questions.map((question, index) => {              const answer = answers && Array.isArray(answers) 
                ? answers.find(a => a.questionId === question.id) 
                : undefined;
                // Check if the answer is correct - prioritize stored isCorrect flag
              const isCorrect = answer?.isCorrect !== undefined 
                ? answer.isCorrect 
                : checkIfAnswerIsCorrect(answer?.answer, question.correctAnswer);
              
              // Display status based on answer correctness
              const statusColor = isCorrect
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                : answer 
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/20';
              
              return (
                <div
                  key={question.id}
                  className={`border rounded-lg p-4 ${statusColor}`}
                >
                  <div className="flex items-start">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-semibold mr-3">
                      {index + 1}
                    </span>
                    <div className="flex-grow">
                      <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {question.question}
                      </p>
                      <div className="space-y-2">                        {question.options && Array.isArray(question.options) && question.options.map((option, optionIndex) => {
                          // Check if this option was selected by the user
                          const isSelected = answer?.answer === option;
                          // Check if this is the correct answer according to the question
                          const isCorrectAnswer = question.correctAnswer === option;
                          
                          // Determine styling based on correctness and selection
                          let optionStyle = 'border-gray-200 dark:border-gray-700';
                          let dotColor = 'bg-gray-300 dark:bg-gray-600';
                          
                          if (isSelected) {
                            // User selected this option
                            if (isCorrectAnswer) {
                              // User selected correctly
                              optionStyle = 'border-green-500 bg-green-50 dark:bg-green-900/20';
                              dotColor = 'bg-green-500';
                            } else {
                              // User selected incorrectly
                              optionStyle = 'border-red-500 bg-red-50 dark:bg-red-900/20';
                              dotColor = 'bg-red-500';
                            }
                          } else if (isCorrectAnswer) {
                            // This is the correct answer but wasn't selected
                            optionStyle = 'border-green-500 bg-green-50 dark:bg-green-900/20';
                            dotColor = 'bg-green-500';
                          }
                          
                          return (
                            <div
                              key={optionIndex}
                              className={`p-3 rounded-lg border ${optionStyle}`}
                            >
                              <div className="flex items-center">
                                <span className={`w-4 h-4 rounded-full mr-2 ${dotColor}`} />
                                <span className={`${(isSelected || isCorrectAnswer) ? 'font-medium' : ''}`}>
                                  {option}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Marks: {answer ? (answer.marksObtained || 0) : 0} / {question.marks || marksPerQuestion}
                        </p>
                        <p className={`text-sm font-medium ${
                          isCorrect
                            ? 'text-green-600 dark:text-green-400'
                            : answer 
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {answer 
                            ? (isCorrect ? 'Correct' : 'Incorrect') 
                            : 'Not Answered'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
} 