'use client';

import Link from 'next/link';

export default function DebugPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Debugging Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* API Endpoints */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">API Endpoints</h2>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/api/debug-exams" 
                target="_blank"
                className="text-blue-600 hover:underline"
              >
                View All Exams
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Lists all exams in the database with their status and codes
              </p>
            </li>
            <li>
              <Link 
                href="/api/debug-user" 
                target="_blank"
                className="text-blue-600 hover:underline"
              >
                Check Current User
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Shows info about the currently logged in user
              </p>
            </li>
          </ul>
        </div>

        {/* Debug Pages */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Debug Pages</h2>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/publish-exam" 
                className="text-blue-600 hover:underline"
              >
                Publish Exam
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Update an exam's status to PUBLISHED
              </p>
            </li>
            <li>
              <Link 
                href="/fix-answers" 
                className="text-blue-600 hover:underline"
              >
                Fix Exam Answers
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Fix the format of correct answers in exams
              </p>
            </li>
            <li>
              <Link 
                href="/" 
                className="text-blue-600 hover:underline"
              >
                Home Page
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Return to the main application
              </p>
            </li>
          </ul>
        </div>

        {/* Debug APIs */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 col-span-1 md:col-span-2">
          <h2 className="text-xl font-bold mb-4">Create Test Exam</h2>
          <p className="mb-4">
            To create a test exam, make a POST request to <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/api/debug-create-exam</code>
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
            <pre>{`fetch('/api/debug-create-exam', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})`}</pre>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            This will create a new exam with a random code, set to PUBLISHED and ready to use.
          </p>
        </div>
      </div>
    </div>
  );
} 