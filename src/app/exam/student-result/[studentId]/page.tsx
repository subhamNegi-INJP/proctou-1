'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Exam, Question, ExamAttempt, Answer, QuestionType } from '@prisma/client';
import { format } from 'date-fns';

type ExamWithDetails = Exam & {
  questions: Question[];
};

type AttemptWithDetails = ExamAttempt & { 
  answers: Answer[];
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

export default function StudentExamResultPage({ 
  params 
}: { 
  params: { studentId: string } 
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const examId = searchParams.get('examId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<ExamWithDetails | null>(null);
  const [attempt, setAttempt] = useState<AttemptWithDetails | null>(null);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(0);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    const fetchExamResult = async () => {
      if (!examId) {
        setError('Missing exam ID');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(`/api/student-exam-results/${params.studentId}?examId=${examId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch exam result');
        }
        
        const data = await response.json();
        
        setExam(data.exam);
        setAttempt(data.attempt);
        
        // Calculate marks per question
        if (data.exam && data.exam.questions.length > 0) {
          const calculatedMarksPerQuestion = Math.floor(data.exam.totalMarks / data.exam.questions.length);
          setMarksPerQuestion(calculatedMarksPerQuestion);
        }
      } catch (error) {
        console.error('Error fetching exam result:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchExamResult();
  }, [session, status, router, params.studentId, examId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !exam || !attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Result not found'}</div>
      </div>
    );
  }

  const totalScore = attempt.score || 0;
  const percentage = (totalScore / exam.totalMarks) * 100;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {exam.title} - Detailed Results
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {exam.description}
          </p>
        </div>

        {/* Student Information */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Student Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Name:</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {attempt.user?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email:</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {attempt.user?.email || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Score Summary */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Score Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Score</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalScore} / {exam.totalMarks}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Percentage</p>
              <p className={`text-2xl font-bold ${
                percentage >= 70 
                  ? 'text-green-600 dark:text-green-400' 
                  : percentage >= 40 
                  ? 'text-yellow-600 dark:text-yellow-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {percentage.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {attempt.status}
              </p>
            </div>
          </div>
        </div>

        {/* Time Information */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Time Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Started:</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(attempt.startedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completed:</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {attempt.endedAt ? new Date(attempt.endedAt).toLocaleString() : 'Not completed'}
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
            {exam.questions.map((question, index) => {
              const answer = attempt && attempt.answers && Array.isArray(attempt.answers)
                ? attempt.answers.find(a => a.questionId === question.id)
                : undefined;
              const isCorrect = answer?.isCorrect ?? false;
              
              return (
                <div
                  key={question.id}
                  className={`border rounded-lg p-4 ${
                    isCorrect
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-start">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 font-semibold mr-3">
                      {index + 1}
                    </span>
                    <div className="flex-grow">
                      <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {question.question}
                      </p>
                      
                      {question.type === QuestionType.MULTIPLE_CHOICE ? (
                        <div className="space-y-2">
                          {question.options && Array.isArray(question.options) && question.options.map((option, optionIndex) => {
                            const isSelected = answer?.answer === option;
                            const isCorrectAnswer = question.correctAnswer === option;
                            
                            return (
                              <div
                                key={optionIndex}
                                className={`p-3 rounded-lg border ${
                                  isSelected
                                    ? isCorrect
                                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                      : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                    : isCorrectAnswer
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                    : 'border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                <div className="flex items-center">
                                  <span className={`w-4 h-4 rounded-full mr-2 ${
                                    isSelected
                                      ? isCorrect
                                        ? 'bg-green-500'
                                        : 'bg-red-500'
                                      : isCorrectAnswer
                                      ? 'bg-green-500'
                                      : 'bg-gray-300 dark:bg-gray-600'
                                  }`} />
                                  <span className={`${
                                    isSelected || isCorrectAnswer
                                      ? 'font-medium'
                                      : ''
                                  }`}>
                                    {option}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="border p-3 rounded-lg">
                          <p className="font-medium mb-2">Student's Answer:</p>
                          <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm overflow-auto">
                            {answer?.answer || 'No answer provided'}
                          </pre>
                          
                          {question.type === 'CODING' && (
                            <>
                              <p className="font-medium mt-4 mb-2">Correct Answer:</p>
                              <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm overflow-auto">
                                {question.answer || 'No answer provided'}
                              </pre>
                            </>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-4 flex justify-between items-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Marks: {answer?.marksObtained || 0} / {marksPerQuestion}
                        </p>
                        <p className={`text-sm font-medium ${
                          isCorrect
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
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