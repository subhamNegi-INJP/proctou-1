'use client';

import { useState } from 'react';

export default function PublishExamPage() {
  const [examCode, setExamCode] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; exam?: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/debug-update-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ examCode }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Publish Exam</h1>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="examCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Exam Code
            </label>
            <input
              type="text"
              id="examCode"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter the exam code to publish"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
          >
            {isLoading ? 'Publishing...' : 'Publish Exam'}
          </button>
        </form>

        {result && (
          <div className={`mt-4 p-4 rounded-md ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <p className="font-medium">{result.message}</p>
            {result.success && result.exam && (
              <div className="mt-2 text-sm">
                <p><strong>Exam Code:</strong> {result.exam.examCode}</p>
                <p><strong>Title:</strong> {result.exam.title}</p>
                <p><strong>Status:</strong> {result.exam.status}</p>
                <p><strong>Start Date:</strong> {new Date(result.exam.startDate).toLocaleString()}</p>
                <p><strong>End Date:</strong> {new Date(result.exam.endDate).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Enter the exam code that you want to publish</li>
          <li>Click "Publish Exam" to update the exam status to PUBLISHED</li>
          <li>This will also update the exam dates to start now and end 7 days from now</li>
          <li>Once published, students will be able to join the exam using the code</li>
        </ol>
      </div>
    </div>
  );
} 