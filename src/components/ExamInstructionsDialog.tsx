'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { Exam } from '@prisma/client';
import { toast } from 'react-hot-toast';

interface ExamInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  examCode: string;
}

export function ExamInstructionsDialog({ isOpen, onClose, examCode }: ExamInstructionsDialogProps) {
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch exam details when dialog opens
  useEffect(() => {
    if (isOpen && examCode) {
      fetchExamDetails();
    }
  }, [isOpen, examCode]);

  // Request fullscreen when dialog opens
  useEffect(() => {
    if (isOpen) {
      requestFullscreen();
    }
  }, [isOpen]);

  // Monitor fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initial check
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  const requestFullscreen = async () => {
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
    } catch (error) {
      console.warn('Could not enter fullscreen mode:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('gesture') || errorMessage.includes('user activation')) {
          toast.error('Please click the fullscreen button to enable fullscreen mode');
        } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
          toast.error('Fullscreen permission denied. Please allow fullscreen access in your browser settings.');
        } else if (errorMessage.includes('not supported')) {
          toast.error('Fullscreen not supported. Please press F11 key manually.');
        } else {
          toast.error('Unable to enter fullscreen. Please press F11 key or check browser permissions.');
        }
      } else {
        toast.error('Please manually enable fullscreen mode (press F11 key)');
      }
    }
  };

  const fetchExamDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
        const response = await fetch(`/api/student-exams/${examCode}/details`);
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If the exam was already completed, show a more specific error
        if (errorData.message && errorData.message.includes('already completed')) {
          throw new Error('You have already completed this exam. Check your results in the dashboard.');
        }
        
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
  const handleJoinExam = async () => {
    if (!agreed) {
      toast.error('Please agree to the exam rules before proceeding');
      return;
    }

    if (!isFullscreen) {
      toast.error('Fullscreen mode is required to start the exam');
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
        body: JSON.stringify({ examCode }),
      });      if (!joinResponse.ok) {
        const errorData = await joinResponse.json();
        
        // If the exam was already completed, show a more specific error
        if (errorData.message && errorData.message.includes('already completed')) {
          throw new Error('You have already completed this exam. Check your results in the dashboard.');
        }
        
        throw new Error(errorData.message || 'Failed to join exam');
      }

      // Store exam info for monitoring
      sessionStorage.setItem('examCode', examCode);
      sessionStorage.setItem('examStartTime', new Date().toISOString());

      // Close dialog and navigate to exam
      onClose();
      router.push(`/exam/${examCode}`);
        } catch (error) {
      console.error('Error starting exam:', error);
      
      // Improved error handling with specific messages
      let errorMessage = 'Failed to start exam';
      
      if (error instanceof Error) {
        if (error.message.includes('already completed')) {
          errorMessage = 'You have already completed this exam. Check your results in the dashboard.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      setStartingExam(false);
    }
  };

  const handleClose = async () => {
    // Exit fullscreen when closing dialog
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
    
    setAgreed(false);
    setStartingExam(false);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full h-full transform bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="bg-indigo-600 px-8 py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Dialog.Title as="h3" className="text-3xl font-bold text-white">
                        {exam?.title || 'Exam Instructions'}
                      </Dialog.Title>
                      <p className="text-indigo-100 mt-2 text-lg">Please read carefully before starting</p>
                    </div>
                    
                    {/* Fullscreen Status Indicator */}
                    <div className="flex items-center space-x-2">
                      {isFullscreen ? (
                        <div className="flex items-center text-green-200 bg-green-800 px-4 py-2 rounded-lg">
                          <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold">Secure Mode Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-yellow-200 bg-yellow-800 px-4 py-2 rounded-lg animate-pulse">
                          <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold">Enable Fullscreen Required</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto">
                  {isLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="mt-6 text-gray-600 text-lg">Loading exam details...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-12">
                      <div className="text-red-600 text-2xl mb-4">Error</div>
                      <p className="text-gray-600 text-lg">{error}</p>
                    </div>
                  ) : exam ? (
                    <div className="max-w-4xl mx-auto space-y-8">
                      {/* Fullscreen Warning */}
                      {!isFullscreen && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-8">
                          <div className="flex items-center">
                            <svg className="h-8 w-8 text-red-600 mr-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <h3 className="text-lg font-bold text-red-800">⚠️ FULLSCREEN MODE REQUIRED</h3>
                              <p className="text-red-700 mt-1">You must enable fullscreen mode to start the exam. This ensures security and prevents cheating.</p>
                              <button
                                onClick={requestFullscreen}
                                className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold"
                              >
                                Enable Fullscreen Now
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Exam Details */}
                      <div className="bg-blue-50 rounded-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                          <svg className="h-6 w-6 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          Exam Details
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white p-4 rounded-lg">
                            <span className="text-gray-500 text-sm font-medium">Duration:</span>
                            <span className="ml-2 font-bold text-lg text-indigo-600">{exam.duration} minutes</span>
                          </div>
                          <div className="bg-white p-4 rounded-lg">
                            <span className="text-gray-500 text-sm font-medium">Total Marks:</span>
                            <span className="ml-2 font-bold text-lg text-indigo-600">{exam.totalMarks}</span>
                          </div>
                          <div className="bg-white p-4 rounded-lg">
                            <span className="text-gray-500 text-sm font-medium">Type:</span>
                            <span className="ml-2 font-bold text-lg text-indigo-600 capitalize">{exam.type.toLowerCase()}</span>
                          </div>
                          <div className="bg-white p-4 rounded-lg">
                            <span className="text-gray-500 text-sm font-medium">End Date:</span>
                            <span className="ml-2 font-bold text-lg text-indigo-600">{new Date(exam.endDate).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Important Security Rules */}
                      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                          <svg className="h-6 w-6 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          🔒 CRITICAL SECURITY REQUIREMENTS
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-start">
                            <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">!</span>
                            <p className="text-gray-800 font-semibold">FULLSCREEN MODE is MANDATORY - Exiting fullscreen will immediately terminate your exam</p>
                          </div>
                          <div className="flex items-start">
                            <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">!</span>
                            <p className="text-gray-800 font-semibold">DO NOT switch tabs, minimize the window, or open other applications</p>
                          </div>
                          <div className="flex items-start">
                            <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">!</span>
                            <p className="text-gray-800 font-semibold">DO NOT refresh the page or use browser navigation buttons</p>
                          </div>
                          <div className="flex items-start">
                            <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">!</span>
                            <p className="text-gray-800 font-semibold">Your activity is being monitored - any suspicious behavior will be flagged</p>
                          </div>
                        </div>
                      </div>

                      {/* Exam Rules */}
                      <div className="bg-gray-50 rounded-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                          <svg className="h-6 w-6 mr-2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                          Additional Exam Rules
                        </h3>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                          <li className="text-base">You must complete the exam within the allotted time</li>
                          <li className="text-base">The timer will start as soon as you begin the exam</li>
                          <li className="text-base">Ensure you have a stable internet connection</li>
                          <li className="text-base">For coding questions, you can test your code before submitting</li>
                          <li className="text-base">Make sure to save your progress regularly</li>
                          <li className="text-base">You must submit your exam before the time limit expires</li>
                          <li className="text-base">The exam will auto-submit when time expires</li>
                          <li className="text-base">Academic dishonesty will result in disqualification</li>
                        </ul>
                      </div>

                      {/* Description */}
                      {exam.description && (
                        <div className="bg-green-50 rounded-lg p-6">
                          <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <svg className="h-6 w-6 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Exam Description
                          </h3>
                          <p className="text-gray-700 whitespace-pre-line text-base leading-relaxed">{exam.description}</p>
                        </div>
                      )}

                      {/* Agreement */}
                      <div className="border-2 border-indigo-200 bg-indigo-50 rounded-lg p-6">
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="agreement"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="mt-2 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label htmlFor="agreement" className="ml-3 block text-gray-800 font-semibold text-base">
                            ✅ I have read and understand all exam rules and security requirements. I agree to follow them and understand that any violation may result in disqualification or academic penalties.
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>                {/* Footer */}
                <div className="bg-gray-100 px-8 py-6 border-t-2 border-gray-200">
                  {startingExam ? (
                    <div className="flex items-center justify-center py-4">
                      <svg className="animate-spin -ml-1 mr-4 h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-indigo-600 text-xl font-semibold">Starting secure exam session...</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        className="inline-flex items-center px-6 py-3 border-2 border-gray-300 bg-white text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-lg"
                        onClick={handleClose}
                      >
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Cancel
                      </button>
                      
                      <div className="flex items-center space-x-4">
                        {!isFullscreen && (
                          <button
                            onClick={requestFullscreen}
                            className="inline-flex items-center px-6 py-3 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 text-lg animate-pulse"
                          >
                            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 4a1 1 0 000 2h.01a1 1 0 100-2H3zM6 4a1 1 0 000 2h.01a1 1 0 100-2H6zM9 4a1 1 0 000 2h.01a1 1 0 100-2H9zM2 7a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zM2 10a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zM2 13a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            Enable Fullscreen
                          </button>
                        )}
                        
                        <button
                          type="button"
                          disabled={!agreed || !exam || !isFullscreen}
                          className="inline-flex items-center px-8 py-4 border border-transparent bg-indigo-600 text-white font-bold text-xl rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
                          onClick={handleJoinExam}
                        >
                          {!isFullscreen ? (
                            <>
                              <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              Fullscreen Required
                            </>
                          ) : (
                            <>
                              <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              🚀 START EXAM
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Status Message */}
                  <div className="mt-4 text-center">
                    {!isFullscreen ? (
                      <p className="text-red-600 font-semibold text-lg">
                        ⚠️ Fullscreen mode must be enabled to start the exam
                      </p>
                    ) : agreed ? (
                      <p className="text-green-600 font-semibold text-lg">
                        ✅ Ready to start! Click "START EXAM" when you're prepared
                      </p>
                    ) : (
                      <p className="text-orange-600 font-semibold text-lg">
                        📋 Please read all instructions and check the agreement box
                      </p>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
