'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Exam, Question, QuestionType } from '@prisma/client';
import { format } from 'date-fns';

interface ExamViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
}

type ExamWithQuestions = Exam & {
  questions: Question[];
};

export function ExamViewDialog({ isOpen, onClose, examId }: ExamViewDialogProps) {
  const [exam, setExam] = useState<ExamWithQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExamDetails = async () => {
      if (!isOpen || !examId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/exam/${examId}/details`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch exam details');
        }
        
        const data = await response.json();
        setExam(data.exam);
      } catch (error) {
        console.error('Error fetching exam details:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchExamDetails();
  }, [isOpen, examId]);

  const getQuestionTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'MULTIPLE_CHOICE': return 'Multiple Choice';
      case 'SINGLE_CHOICE': return 'Single Choice';
      case 'TRUE_FALSE': return 'True/False';
      case 'SHORT_ANSWER': return 'Short Answer';
      case 'LONG_ANSWER': return 'Long Answer';
      case 'CODING': return 'Coding';
      default: return type;
    }
  };
  
  // Helper function to safely format dates
  const formatDate = (dateInput: string | Date) => {
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
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
                  {loading ? 'Loading Exam Details...' : `Exam Details${exam ? ': ' + exam.title : ''}`}
                </Dialog.Title>
                
                <div className="mt-4">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : error ? (
                    <div className="text-red-500 text-center py-4">{error}</div>
                  ) : exam ? (
                    <div>
                      {/* Exam Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Exam Code</h4>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{exam.examCode}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</h4>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{exam.type}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</h4>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{exam.duration} minutes</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Marks</h4>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{exam.totalMarks}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</h4>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatDate(exam.startDate)}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">End Date</h4>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatDate(exam.endDate)}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h4>
                          <p className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                            exam.status === 'PUBLISHED' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : exam.status === 'DRAFT'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {exam.status}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Questions</h4>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{exam.questions.length}</p>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Description</h4>
                        <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                          {exam.description}
                        </p>
                      </div>
                      
                      {/* Questions */}
                      <div>
                        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Questions</h4>
                        <div className="space-y-6">
                          {exam.questions.map((question, index) => (
                            <div 
                              key={question.id} 
                              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900 dark:text-white">
                                  Question {index + 1}
                                </h5>
                                <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                                  {getQuestionTypeLabel(question.type)}
                                </span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 mb-4">{question.question}</p>
                              
                              {/* Show options for multiple choice questions */}
                              {['MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'TRUE_FALSE'].includes(question.type) && (
                                <div className="ml-4 space-y-2">
                                  {question.options.map((option, optIndex) => (
                                    <div 
                                      key={optIndex} 
                                      className={`flex items-start p-2 rounded-md ${
                                        option === question.correctAnswer 
                                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                                          : ''
                                      }`}
                                    >
                                      <span className="w-6 flex-shrink-0 font-medium">
                                        {String.fromCharCode(65 + optIndex)}.
                                      </span>
                                      <span className={option === question.correctAnswer 
                                        ? 'text-green-700 dark:text-green-400 font-medium' 
                                        : 'text-gray-700 dark:text-gray-300'
                                      }>
                                        {option}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Show correct answer for other question types */}
                              {!['MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'TRUE_FALSE'].includes(question.type) && 
                               question.correctAnswer && (
                                <div>
                                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">
                                    Answer:
                                  </p>
                                  <div className="ml-4 mt-1 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                                    <p className="text-green-700 dark:text-green-400">{question.correctAnswer}</p>
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                                Marks: {question.marks}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      No exam data found
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