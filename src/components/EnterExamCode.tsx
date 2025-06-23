'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ExamInstructionsDialog } from './ExamInstructionsDialog';

export default function EnterExamCode() {
  const [examCode, setExamCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false);
  const [validatedExamCode, setValidatedExamCode] = useState<string | null>(null);  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!examCode.trim()) {
      toast.error('Please enter an exam code');
      return;
    }
    
    try {
      setLoading(true);
      
      // First, validate the exam code by checking if the exam exists
      const response = await fetch(`/api/student-exams/${examCode.trim()}/details`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid exam code');
      }

      // If exam exists, show the instructions dialog
      setValidatedExamCode(examCode.trim());
      setShowInstructionsDialog(true);
      
    } catch (error) {
      console.error('Error validating exam code:', error);
      toast.error(error instanceof Error ? error.message : 'Invalid exam code');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseInstructionsDialog = () => {
    setShowInstructionsDialog(false);
    setValidatedExamCode(null);
  };
  return (
    <>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Join an Exam
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="examCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Enter Exam Code
            </label>
            <input
              type="text"
              id="examCode"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter the code provided by your instructor"
              disabled={loading}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Note: The exam will open in fullscreen mode. Exiting fullscreen will terminate your exam.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Validating...
              </>
            ) : (
              'Start Exam'
            )}
          </button>
        </form>
      </div>

      {/* Exam Instructions Dialog */}
      {validatedExamCode && (
        <ExamInstructionsDialog
          isOpen={showInstructionsDialog}
          onClose={handleCloseInstructionsDialog}
          examCode={validatedExamCode}
        />
      )}
    </>
  );
}
