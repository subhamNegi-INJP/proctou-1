'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExamStatus, QuestionType } from '@prisma/client';
import { Exam, Question, ExamAttempt, Answer } from '@prisma/client';
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
  params: { examId: string; studentId: string } 
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<ExamWithDetails | null>(null);
  const [attempt, setAttempt] = useState<AttemptWithDetails | null>(null);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(0);
  const [codingStats, setCodingStats] = useState({
    totalQuestions: 0,
    totalTestCases: 0,
    passedTestCases: 0,
    totalCodingScore: 0,
    maxPossibleCodingScore: 0,
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    const fetchExamResult = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/exam/${params.examId}/student/${params.studentId}`);
        
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
  }, [session, status, router, params.examId, params.studentId]);

  // Calculate coding stats when exam and attempt data is available
  useEffect(() => {
    if (!exam || !attempt || !attempt.answers) return;
    
    // Find coding questions
    const codingQuestions = exam.questions.filter(q => q.type === 'CODING');
    
    let totalCases = 0;
    let passedCases = 0;
    let totalScore = 0;
    let maxScore = 0;
    
    codingQuestions.forEach(question => {
      const answer = attempt.answers.find(a => a.questionId === question.id);
      if (!answer) return;
      
      const testCaseResults = answer.answer.split('||').filter(tr => tr.trim() !== '');
      totalCases += testCaseResults.length;
      maxScore += question.marks;
      
      const scorePerCase = testCaseResults.length > 0 ? question.marks / testCaseResults.length : 0;
      
      testCaseResults.forEach(tr => {
        const [testCasePart, actualOutput = ''] = tr.split('⏺');
        const [input = '', expectedOutput = ''] = testCasePart.split('⏹');
        const passed = actualOutput.trim() === expectedOutput.trim();
        if (passed) {
          passedCases++;
          totalScore += scorePerCase;
        }
      });
    });
    
    setCodingStats({
      totalQuestions: codingQuestions.length,
      totalTestCases: totalCases,
      passedTestCases: passedCases,
      totalCodingScore: Math.round(totalScore * 100) / 100,
      maxPossibleCodingScore: maxScore,
    });
  }, [exam, attempt]);

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

  // Calculate scores and percentages both overall and for coding questions
  // Calculate the total score from the attempt
  const totalScore = attempt?.score || 0;
  
  // Calculate the score for coding questions based on test case results
  // This is already handled in the codingStats calculation in the useEffect
  const percentage = exam?.totalMarks ? (totalScore / exam.totalMarks) * 100 : 0;
  
  // Calculate coding-specific percentages
  const codingPercentage = codingStats.maxPossibleCodingScore > 0 
    ? (codingStats.totalCodingScore / codingStats.maxPossibleCodingScore) * 100 
    : 0;
    
  // Calculate non-coding score (total score minus coding score)
  const nonCodingScore = totalScore - codingStats.totalCodingScore;
  const nonCodingMaxScore = exam?.totalMarks ? exam.totalMarks - codingStats.maxPossibleCodingScore : 0;
  const nonCodingPercentage = nonCodingMaxScore > 0
    ? (nonCodingScore / nonCodingMaxScore) * 100
    : 0;

  // Helper function to calculate coding question scores consistently
  const calculateCodingScores = (question: Question, answerString: string) => {
    const testCaseResults = answerString.split('||').filter(tr => tr.trim() !== '');
    const scorePerCase = testCaseResults.length > 0 ? question.marks / testCaseResults.length : 0;
    
    let questionScore = 0;
    const parsedResults = testCaseResults.map(tr => {
      const [testCasePart, actualOutput = ''] = tr.split('⏺');
      const [input = '', expectedOutput = ''] = testCasePart.split('⏹');
      const passed = actualOutput.trim() === expectedOutput.trim();
      if (passed) questionScore += scorePerCase;
      
      return {
        input,
        expectedOutput,
        actualOutput,
        passed
      };
    });
    
    return {
      score: questionScore,
      details: parsedResults,
      testCaseCount: testCaseResults.length
    };
  };

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
            Your Results
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
              {codingStats.totalQuestions > 0 ? (
              <p className={`text-2xl font-bold ${
                codingPercentage >= 70 
                ? 'text-green-600 dark:text-green-400' 
                : codingPercentage >= 40 
                ? 'text-yellow-600 dark:text-yellow-400' 
                : 'text-red-600 dark:text-red-400'
              }`}>
                {codingPercentage.toFixed(1)}% <span className="text-sm">(Coding)</span>
              </p>
              ) : (
              <p className={`text-2xl font-bold ${
                percentage >= 70 
                ? 'text-green-600 dark:text-green-400' 
                : percentage >= 40 
                ? 'text-yellow-600 dark:text-yellow-400' 
                : 'text-red-600 dark:text-red-400'
              }`}>
                {percentage.toFixed(1)}%
              </p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {attempt.status}
              </p>
            </div>
          </div>
          
          {/* Statistics summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                Overall Statistics
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Questions Attempted:</span>
                  <span className="text-sm font-medium">{attempt.answers.length} / {exam.questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Correct Questions:</span>
                  <span className="text-sm font-medium">{attempt.answers.filter(a => a.isCorrect).length} / {exam.questions.length}</span>
                </div>
                {codingStats.totalQuestions > 0 && nonCodingMaxScore > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Non-Coding Score:</span>
                    <span className="text-sm font-medium">{nonCodingScore.toFixed(1)} / {nonCodingMaxScore} ({nonCodingPercentage.toFixed(1)}%)</span>
                  </div>
                )}
              </div>
            </div>
            
            {codingStats.totalQuestions > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                  Coding Performance
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Test Cases Passed:</span>
                    <span className="text-sm font-medium">{codingStats.passedTestCases} / {codingStats.totalTestCases}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pass Rate:</span>
                    <span className={`text-sm font-medium ${
                      (codingStats.passedTestCases / Math.max(codingStats.totalTestCases, 1)) * 100 >= 70
                        ? 'text-green-600 dark:text-green-400'
                        : (codingStats.passedTestCases / Math.max(codingStats.totalTestCases, 1)) * 100 >= 40
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {codingStats.totalTestCases > 0 
                        ? ((codingStats.passedTestCases / codingStats.totalTestCases) * 100).toFixed(1) 
                        : '0.0'}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Coding Score:</span>
                    <span className="text-sm font-medium">
                      {codingStats.totalCodingScore.toFixed(1)} / {codingStats.maxPossibleCodingScore}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
                          {question.type === 'CODING' ? (
                            <>
                              <p className="font-medium mb-2">Coding Test Breakdown:</p>
                              {(() => {
                                const studentAnswer = answer?.answer || '';
                                const { score, details, testCaseCount } = calculateCodingScores(question, studentAnswer);
                                
                                return (
                                  <div>
                                    <div className="mb-2 p-2 border-b">
                                      <p className="text-sm font-medium">
                                        Summary: {details.filter(d => d.passed).length} of {testCaseCount} test cases passed
                                        ({((details.filter(d => d.passed).length / Math.max(testCaseCount, 1)) * 100).toFixed(0)}%)
                                      </p>
                                    </div>
                                    
                                    {details.map((result, idx) => (
                                      <div 
                                        key={idx} 
                                        className={`mb-2 p-2 border rounded ${
                                          result.passed 
                                            ? 'border-green-200 bg-green-50/30' 
                                            : 'border-red-200 bg-red-50/30'
                                        }`}
                                      >
                                        <p className="text-sm">
                                          <span className="font-medium">Test Case {idx + 1}:</span>
                                          <span className={`float-right px-2 py-0.5 text-xs rounded-full ${
                                            result.passed
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-red-100 text-red-800'
                                          }`}>
                                            {result.passed ? 'PASS' : 'FAIL'}
                                          </span>
                                        </p>
                                        <p className="text-sm"><span className="font-medium">Input:</span> {result.input}</p>
                                        <p className="text-sm"><span className="font-medium">Expected Output:</span> {result.expectedOutput}</p>
                                        <p className="text-sm"><span className="font-medium">Your Output:</span> {result.actualOutput}</p>
                                      </div>
                                    ))}
                                    
                                    <p className="font-medium mt-2">
                                      Total Score for this question: {score.toFixed(2)} / {question.marks}
                                    </p>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <>
                              <p className="font-medium mb-2">Student's Answer:</p>
                              <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-sm overflow-auto">
                                {answer?.answer || 'No answer provided'}
                              </pre>
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