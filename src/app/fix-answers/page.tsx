'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FixAnswersPage() {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; fixedCount?: number } | null>(null);

  const handleFixAnswers = async () => {
    try {
      setIsFixing(true);
      setResult(null);
      
      const response = await fetch('/api/debug-exams', {
        method: 'PATCH',
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Fix Exam Answers Format</h1>
      
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
        <p className="mb-4">
          This tool will fix any questions that have the wrong answer format. 
          It will convert letter answers (A, B, C, D) to the actual option text.
        </p>
        
        <button
          onClick={handleFixAnswers}
          disabled={isFixing}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFixing ? 'Fixing Answers...' : 'Fix Answers'}
        </button>
        
        {result && (
          <div className={`mt-4 p-4 rounded-md ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <p className="font-medium">{result.message}</p>
            {result.success && result.fixedCount !== undefined && (
              <p className="mt-2">
                {result.fixedCount > 0 
                  ? `Fixed ${result.fixedCount} questions. You should now be able to see correct scores when taking exams.` 
                  : 'No questions needed to be fixed.'}
              </p>
            )}
          </div>
        )}
      </div>
      
      <div className="flex justify-between">
        <Link 
          href="/debug" 
          className="text-blue-600 hover:underline"
        >
          Return to Debug Page
        </Link>
        
        <Link 
          href="/dashboard" 
          className="text-blue-600 hover:underline"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
} 