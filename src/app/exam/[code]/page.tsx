'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Exam, Question, ExamAttempt } from '@prisma/client';

type ExamWithDetails = Exam & {
  questions: Question[];
  attempts: ExamAttempt[];
};

export default function ExamPage({ params }: { params: { code: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [exam, setExam] = useState<ExamWithDetails | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const response = await fetch(`/api/student-exams/${params.code}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch exam');
        }

        setExam(data);
        // Set initial time left (in seconds)
        const endTime = new Date(data.endDate).getTime();
        const now = new Date().getTime();
        setTimeLeft(Math.max(0, Math.floor((endTime - now) / 1000)));
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch exam');
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchExam();
    }
  }, [status, params.code]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmit = async () => {
    if (!exam) return;
    
    setIsSubmitting(true);
    try {
      console.log('Submitting exam answers:', answers);
      
      const response = await fetch(`/api/student-exams/${params.code}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });

      console.log(`Submit response status: ${response.status}`);
      const data = await response.json();
      console.log('Submit response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit exam');
      }

      // Redirect to results page
      router.push(`/exam/result/${exam.id}/${session?.user?.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Exam not found'}</div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {exam.title}
          </h1>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            Time Left: {formatTime(timeLeft)}
          </div>
        </div>

        <div className="space-y-6">
          {exam.questions.map((question, index) => (
            <div key={question.id} className="border-b dark:border-gray-700 pb-6">
              <div className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-semibold mr-3">
                  {index + 1}
                </span>
                <div className="flex-grow">
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {question.question}
                  </p>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <label
                        key={optionIndex}
                        className="flex items-center space-x-3 p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </div>
    </div>
  );
} 