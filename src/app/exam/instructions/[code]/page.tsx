'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Exam } from '@prisma/client';
import { toast } from 'react-hot-toast';

export default function ExamInstructionsPage({ params }: { params: { code: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [startingExam, setStartingExam] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    const fetchExamDetails = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/student-exams/${params.code}/details`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch exam details');
        }
        
        const data = await response.json();
        setExam(data);
      } catch (error) {
        console.error('Error fetching exam details:', error);
        setError(error instanceof Error ? error.message : 'Failed to load exam details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExamDetails();
  }, [session, status, router, params.code]);
  const handleStartExam = async () => {
    if (!agreed) {
      toast.error('Please agree to the exam rules before proceeding');
      return;
    }

    try {
      setStartingExam(true);
      
      // Join the exam to create an attempt
      const joinResponse = await fetch('/api/join-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ examCode: params.code }),
      });

      if (!joinResponse.ok) {
        const errorData = await joinResponse.json();
        throw new Error(errorData.message || 'Failed to join exam');
      }

      // First redirect to the exam page to show it immediately
      router.push(`/exam/${params.code}`);
      
      // Request fullscreen after a brief delay to allow the page to load
      setTimeout(async () => {
        try {
          const element = document.documentElement;
          
          if (element.requestFullscreen) {
            await element.requestFullscreen();
          } else if ((element as any).webkitRequestFullscreen) {
            await (element as any).webkitRequestFullscreen();
          } else if ((element as any).mozRequestFullScreen) {
            await (element as any).mozRequestFullScreen();
          } else if ((element as any).msRequestFullscreen) {
            await (element as any).msRequestFullscreen(); 
          }
          
          // Store exam info for monitoring
          sessionStorage.setItem('examCode', params.code);
          sessionStorage.setItem('examStartTime', new Date().toISOString());
        } catch (error) {
          console.warn('Could not enter fullscreen mode:', error);
          // Don't block the exam if fullscreen fails
        }
      }, 500);
      
    } catch (error) {
      console.error('Error starting exam:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start exam');
      setStartingExam(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exam details...</p>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600">{error || 'Exam not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-indigo-600 px-6 py-4">
          <h1 className="text-2xl font-bold text-white">{exam.title}</h1>
          <p className="text-indigo-100 mt-1">Exam Instructions</p>
        </div>
        
        <div className="p-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Exam Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Duration:</p>
                <p className="font-medium">{exam.duration} minutes</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Marks:</p>
                <p className="font-medium">{exam.totalMarks}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type:</p>
                <p className="font-medium capitalize">{exam.type.toLowerCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">End Date:</p>
                <p className="font-medium">{new Date(exam.endDate).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Exam Rules</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              <li>You must complete the exam within the allotted time.</li>
              <li>The timer will start as soon as you begin the exam.</li>
              <li>Do not refresh the page or navigate away during the exam, as it may lead to loss of answers.</li>
              <li>Ensure you have a stable internet connection.</li>
              <li>For coding questions, you can test your code before submitting.</li>
              <li>Make sure to save your progress regularly, especially for coding questions.</li>
              <li>You must submit your exam before the time limit expires.</li>
              <li>Automatically submits when the time limit is reached.</li>
              <li>Academic dishonesty will result in disqualification.</li>
            </ul>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Description</h2>
            <p className="text-gray-700 whitespace-pre-line">{exam.description}</p>
          </div>

          <div className="mb-8">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="agreement"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="agreement" className="ml-2 block text-gray-700">
                I have read and agree to follow the exam rules. I understand that any violation of these rules may result in disqualification.
              </label>
            </div>
          </div>          <div className="flex justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
            <button
              onClick={handleStartExam}
              disabled={!agreed || startingExam}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {startingExam ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting Exam...
                </>
              ) : (
                'Start Exam'
              )}
            </button>
          </div>
          
          {startingExam && (
            <div className="mt-4 p-4 bg-blue-50 rounded-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Preparing your exam session... The exam will open momentarily and enter fullscreen mode.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
