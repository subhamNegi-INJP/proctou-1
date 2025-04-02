'use client';

import { useRouter } from 'next/navigation';
import { CodingExamForm } from '@/components/CodingExamForm';

export default function CreateCodingExamPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Coding Exam</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Create a new coding exam with programming questions and test cases
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <CodingExamForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
} 