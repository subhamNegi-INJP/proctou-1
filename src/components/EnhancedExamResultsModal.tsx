'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import Link from 'next/link';

interface StudentResult {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  totalMarks: number;
  submittedAt: string;
  status: string;
}

interface EnhancedExamResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  examTitle: string;
}

export function EnhancedExamResultsModal({ isOpen, onClose, examId, examTitle }: EnhancedExamResultsModalProps) {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof StudentResult>('submittedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      if (!isOpen || !examId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/exam/${examId}/results`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch results');
        }
        
        const data = await response.json();
        setResults(data.results);
      } catch (error) {
        console.error('Error fetching results:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [isOpen, examId]);

  const handleSort = (column: keyof StudentResult) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  const filteredResults = sortedResults.filter(result => 
    result.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateAverageScore = () => {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, result) => sum + (result.score / result.totalMarks * 100), 0);
    return (totalScore / results.length).toFixed(1);
  };

  const getSortIcon = (column: keyof StudentResult) => {
    if (sortBy !== column) return null;
    
    return sortDirection === 'asc' 
      ? '↑' 
      : '↓';
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                <Dialog.Title
                  as="h3"
                  className="text-xl font-medium leading-6 text-gray-900 dark:text-white"
                >
                  {examTitle} - Results
                </Dialog.Title>
                
                <div className="mt-4">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : error ? (
                    <div className="text-red-500 text-center py-4">{error}</div>
                  ) : (
                    <div>
                      {/* Summary Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Submissions</h4>
                          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{results.length}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</h4>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{calculateAverageScore()}%</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed Attempts</h4>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {results.filter(r => r.status === 'COMPLETED').length}
                          </p>
                        </div>
                      </div>
                      
                      {/* Search Box */}
                      <div className="mb-6">
                        <input
                          type="text"
                          placeholder="Search by student name or email..."
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-indigo-500"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      
                      {/* Results Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                                onClick={() => handleSort('studentName')}
                              >
                                Student {getSortIcon('studentName')}
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                                onClick={() => handleSort('score')}
                              >
                                Score {getSortIcon('score')}
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                                onClick={() => handleSort('submittedAt')}
                              >
                                Date {getSortIcon('submittedAt')}
                              </th>
                              <th 
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                                onClick={() => handleSort('status')}
                              >
                                Status {getSortIcon('status')}
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredResults.length > 0 ? (
                              filteredResults.map((result) => {
                                const percentage = (result.score / result.totalMarks) * 100;
                                return (
                                  <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white">{result.studentName}</div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">{result.studentEmail}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="text-sm font-medium">
                                          <span className={
                                            percentage >= 70 
                                              ? 'text-green-600 dark:text-green-400' 
                                              : percentage >= 40 
                                              ? 'text-yellow-600 dark:text-yellow-400'
                                              : 'text-red-600 dark:text-red-400'
                                          }>
                                            {result.score} / {result.totalMarks}
                                          </span>
                                        </div>
                                        <div className="ml-2 w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                                          <div 
                                            className={`h-2.5 rounded-full ${
                                              percentage >= 70 
                                                ? 'bg-green-500' 
                                                : percentage >= 40 
                                                ? 'bg-yellow-500'
                                                : 'bg-red-500'
                                            }`}
                                            style={{width: `${percentage}%`}}
                                          ></div>
                                        </div>
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {percentage.toFixed(1)}%
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                      {result.submittedAt ? format(new Date(result.submittedAt), 'MMM d, yyyy h:mm a') : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        result.status === 'COMPLETED' 
                                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                          : result.status === 'TIMED_OUT' 
                                          ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                      }`}>
                                        {result.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <Link 
                                        href={`/exam/result/${examId}/${result.studentId}`}
                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-2"
                                        onClick={onClose}
                                      >
                                        View Details
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                                  No results found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 