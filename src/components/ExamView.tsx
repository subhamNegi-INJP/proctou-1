// src/components/ExamInterface.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

const ExamInterface: React.FC = () => {
  const router = useRouter();
  const [isExamTerminated, setIsExamTerminated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const terminateExam = useCallback(async (reason: string) => {
    if (isExamTerminated) return; // Prevent multiple terminations
    
    setIsExamTerminated(true);
    toast.error(`Exam terminated: ${reason}`);

    try {
      const examCode = sessionStorage.getItem('examCode');
      // Make API call to mark exam as terminated
      await fetch('/api/terminate-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examCode,
          reason,
          timestamp: new Date().toISOString(),
          examStartTime: sessionStorage.getItem('examStartTime'),
        }),
      });
    } catch (error) {
      console.error('Failed to record exam termination:', error);
    }

    // Clear session storage
    sessionStorage.removeItem('examCode');
    sessionStorage.removeItem('examStartTime');

    // Exit fullscreen if still in it
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }

    // Force immediate redirect
    window.location.href = '/dashboard';
  }, [isExamTerminated]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        terminateExam('ESC key pressed');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [terminateExam]);

  // Monitor fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isExamTerminated) {
        terminateExam('Fullscreen mode was exited');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' && !isExamTerminated) {
        terminateExam('Browser tab was changed');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange, true);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange, true);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange, true);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange, true);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);

    // Check if we have exam data
    const examCode = sessionStorage.getItem('examCode');
    if (!examCode) {
      terminateExam('No exam in progress');
      return;
    }

    // Check initial fullscreen state
    if (!document.fullscreenElement) {
      terminateExam('Not in fullscreen mode');
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange, true);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange, true);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    };
  }, [isExamTerminated, terminateExam]);

  const handleSubmitExam = async () => {
    try {
      setIsSubmitting(true);
      const examCode = sessionStorage.getItem('examCode');
      
      const response = await fetch('/api/submit-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examCode,
          submittedAt: new Date().toISOString(),
          examStartTime: sessionStorage.getItem('examStartTime'),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit exam');
      }

      await terminateExam('Exam submitted successfully');
    } catch (error) {
      toast.error('Failed to submit exam. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isExamTerminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 rounded-lg bg-white shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Exam Terminated
          </h1>
          <p className="text-gray-600">
            Your exam has been terminated. You will be redirected to your dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50 max-w-lg">
        <p className="font-medium">
          You are in exam mode. Press ESC to terminate the exam, or use the Submit button when finished.
        </p>
      </div>
      
      <div className="mt-16">
        {/* Your actual exam content goes here */}
        <div className="p-4 border rounded bg-white">
          Exam Content Goes Here
        </div>

        <div className="fixed bottom-4 right-4">
          <button
            onClick={handleSubmitExam}
            disabled={isSubmitting}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition duration-200 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit Exam'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;
```

```tsx
// src/components/ExamView.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import ExamInterface from './ExamInterface';

const ExamView: React.FC = () => {
  const router = useRouter();
  const [isExamTerminated, setIsExamTerminated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const terminateExam = useCallback(async (reason: string) => {
    setIsExamTerminated(true);
    setIsFullscreen(false);
    
    const examCode = sessionStorage.getItem('examCode');
    const examStartTime = sessionStorage.getItem('examStartTime');
    
    sessionStorage.removeItem('examCode');
    sessionStorage.removeItem('examStartTime');

    toast.error(`Exam terminated: ${reason}`);
    router.push('/dashboard');

    try {
      await fetch('/api/terminate-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examCode,
          reason,
          timestamp: new Date().toISOString(),
          examStartTime,
        }),
      });
    } catch (error) {
      console.error('Failed to record exam termination:', error);
    }
  }, [router]);

  useEffect(() => {
    const examCode = sessionStorage.getItem('examCode');
    const examStartTime = sessionStorage.getItem('examStartTime');

    if (!examCode || !examStartTime) {
      router.push('/dashboard');
      return;
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isExamTerminated) {
        terminateExam('Fullscreen mode was exited');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' && !isExamTerminated) {
        terminateExam('Browser tab was changed');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExamTerminated) {
        e.preventDefault();
        terminateExam('ESC key was pressed');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown, true);

    if (!document.fullscreenElement) {
      terminateExam('Not in fullscreen mode');
      return;
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [terminateExam, isExamTerminated, router]);

  const handleSubmitExam = async () => {
    if (isExamTerminated || !isFullscreen) {
      return;
    }

    try {
      setIsSubmitting(true);
      const examCode = sessionStorage.getItem('examCode');
      const examStartTime = sessionStorage.getItem('examStartTime');
      
      sessionStorage.removeItem('examCode');
      sessionStorage.removeItem('examStartTime');

      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      const response = await fetch('/api/submit-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examCode,
          submittedAt: new Date().toISOString(),
          examStartTime,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit exam');
      }

      toast.success('Exam submitted successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to submit exam. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isExamTerminated || !isFullscreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 rounded-lg bg-white shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Exam Terminated
          </h1>
          <p className="text-gray-600">
            Your exam has been terminated because you exited fullscreen mode.
            You will be redirected to your dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <ExamInterface
        handleSubmitExam={() => setShowConfirmDialog(true)}
        isSubmitting={isSubmitting}
      />
      
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Submission</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit your exam? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  handleSubmitExam();
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamView;
