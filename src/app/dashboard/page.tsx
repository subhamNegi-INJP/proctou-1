'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Role, ExamType, Exam, ExamAttempt } from '@prisma/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ExamTypeDialog } from '@/components/ExamTypeDialog';
import { QuizExamForm } from '@/components/QuizExamForm';
import { CodingExamForm } from '@/components/CodingExamForm';
import { format } from 'date-fns';
import EnterExamCode from '@/components/EnterExamCode';
import { EnhancedExamResultsModal } from '@/components/EnhancedExamResultsModal';
import { ExamViewDialog } from '@/components/ExamViewDialog';
import { ExamInstructionsDialog } from '@/components/ExamInstructionsDialog';

// Mock data - Replace with actual data from your backend
const studentData = {
  upcomingExams: [
    { id: 1, title: 'JavaScript Basics', date: '2024-03-25', type: 'Quiz' },
    { id: 2, title: 'Python Programming', date: '2024-03-28', type: 'Coding Test' },
  ],
  previousExams: [
    { id: 3, title: 'HTML & CSS', date: '2024-03-15', score: 85, type: 'Quiz' },
    { id: 4, title: 'Java Programming', date: '2024-03-10', score: 92, type: 'Coding Test' },
  ],
  recentResults: [
    { id: 3, title: 'HTML & CSS', score: 85, total: 100, date: '2024-03-15' },
    { id: 4, title: 'Java Programming', score: 92, total: 100, date: '2024-03-10' },
  ],
};

const teacherData = {
  recentExams: [
    { id: 1, title: 'JavaScript Basics', date: '2024-03-25', type: 'Quiz', students: 25 },
    { id: 2, title: 'Python Programming', date: '2024-03-28', type: 'Coding Test', students: 30 },
  ],
  examCategories: [
    { type: 'Quiz', count: 5 },
    { type: 'Coding Test', count: 3 },
    { type: 'Assignment', count: 2 },
  ],
  studentResults: [
    { examId: 1, title: 'JavaScript Basics', averageScore: 85, totalStudents: 25 },
    { examId: 2, title: 'Python Programming', averageScore: 78, totalStudents: 30 },
  ],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
};

type ExamWithAttempts = Exam & {
  attempts: ExamAttempt[];
  questions: any[];
};

type ExamStat = {
  id: string;
  title: string;
  description: string;
  examCode: string;
  startDate: string;
  endDate: string;
  duration: number;
  status: string;
  type?: string;
  questionCount: number;
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  averageScore: number;
  createdAt: string;
  updatedAt: string;
};

type RecentActivity = {
  id: string;
  user: {
    name: string | null;
    email: string;
  };
  exam: {
    title: string;
    examCode: string;
  };
  status: string;
  score: number | null;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
};

type TeacherDashboardData = {
  exams: ExamStat[];
  recentActivity: RecentActivity[];
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [exams, setExams] = useState<ExamWithAttempts[]>([]);
  const [error, setError] = useState('');
  const [showResultsModal, setShowResultsModal] = useState(false);  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedExam, setSelectedExam] = useState<{id: string; title: string} | null>(null);
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [publishingExamId, setPublishingExamId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{success: boolean; message: string} | null>(null);
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false);
  const [selectedExamCode, setSelectedExamCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/user/role');
        if (!response.ok) {
          throw new Error('Failed to fetch user role');
        }
        const data = await response.json();
        setUserRole(data.role);
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchExams = async () => {
      try {
        setIsLoading(true);
        
        if (userRole === Role.TEACHER) {
          // Use teacher-dashboard endpoint for teacher data
          const response = await fetch('/api/teacher-dashboard');
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch dashboard data');
          }
          
          setDashboardData(data);
        } else {
          // For student, use regular exam endpoint
        const response = await fetch('/api/exam');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch exams');
        }

          setExams(data.exams || []);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchUserRole();
        fetchExams();
    }
  }, [status, userRole]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading' || isLoading) {
  return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  const handleCreateExam = () => {
    setShowTypeDialog(true);
  };

  const handleTypeSelect = (type: ExamType) => {
    setShowTypeDialog(false);
    // Navigate to the appropriate exam creation page
    if (type === ExamType.QUIZ) {
      router.push('/dashboard/exams/create/quiz');
    } else if (type === ExamType.CODING) {
      router.push('/dashboard/exams/create/coding');
    }
  };

  const handleClose = () => {
    setShowTypeDialog(false);
  };

  const handleShowResults = (examId: string, examTitle: string) => {
    setSelectedExam({id: examId, title: examTitle});
    setShowResultsModal(true);
  };

  const handleCloseResultsModal = () => {
    setShowResultsModal(false);
    setSelectedExam(null);
  };

  const handleViewExam = (examId: string, examTitle: string) => {
    setSelectedExam({id: examId, title: examTitle});
    setShowViewDialog(true);
  };

  const handleCloseViewDialog = () => {
    setShowViewDialog(false);
    setSelectedExam(null);
  };

  const handlePublishExam = async (examId: string, examCode: string) => {
    try {
      setPublishingExamId(examId);
      
      const response = await fetch('/api/debug-update-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ examCode }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update the exam's status in the local state
        setDashboardData(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            exams: prev.exams.map(exam => 
              exam.id === examId 
              ? { ...exam, status: 'PUBLISHED' } 
              : exam
            )
          };
        });
        
        setPublishResult({
          success: true,
          message: `Exam "${examCode}" published successfully!`
        });
        
        // Clear the success message after 3 seconds
        setTimeout(() => {
          setPublishResult(null);
        }, 3000);
      } else {
        setPublishResult({
          success: false,
          message: data.message || 'Failed to publish exam'
        });
      }
    } catch (error) {
      console.error('Error publishing exam:', error);
      setPublishResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setPublishingExamId(null);
    }
  };
  const handleStartExam = (examCode: string) => {
    setSelectedExamCode(examCode);
    setShowInstructionsDialog(true);
  };

  const handleCloseInstructionsDialog = () => {
    setShowInstructionsDialog(false);
    setSelectedExamCode(null);
  };

  const renderExamsTable = () => {
    if (!dashboardData || dashboardData.exams.length === 0) {
      return (
        <div className="text-center text-gray-600 dark:text-gray-300 py-8">
          No exams created yet. Click "Create Exam" to get started.
                  </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Exam Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Questions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {dashboardData.exams.map((exam) => (
              <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {exam.title}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {exam.description}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {exam.type || 'Unknown'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono text-gray-900 dark:text-white">
                    {exam.examCode}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {exam.questionCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {exam.duration} min
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {format(new Date(exam.startDate), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    exam.status === 'PUBLISHED'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {exam.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleViewExam(exam.id, exam.title)}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleShowResults(exam.id, exam.title)}
                    className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    Results
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
                </div>
    );
  };

  const renderDashboardContent = () => {
    switch (userRole) {
      case Role.ADMIN:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Management</h3>
              <p className="text-gray-600 dark:text-gray-300">Manage users, roles, and permissions</p>
              </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Settings</h3>
              <p className="text-gray-600 dark:text-gray-300">Configure system-wide settings</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analytics</h3>
              <p className="text-gray-600 dark:text-gray-300">View system-wide analytics</p>
                  </div>
                </div>
        );
      case Role.TEACHER:
        return (
          <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
              <button
                onClick={() => setShowTypeDialog(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create Exam
              </button>
            </div>
            
            {/* Show publish result message if exists */}
            {publishResult && (
              <div className={`mb-4 p-4 rounded-md ${
                publishResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <p>{publishResult.message}</p>
              </div>
            )}
            
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Total Exams</h2>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dashboardData?.exams.length}</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Active Exams</h2>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {dashboardData?.exams.filter(exam => 
                    exam.status === 'PUBLISHED' && 
                    new Date(exam.endDate) > new Date()
                  ).length}
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Total Attempts</h2>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {dashboardData?.exams.reduce((sum, exam) => sum + exam.totalAttempts, 0)}
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Avg. Score</h2>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {dashboardData?.exams && dashboardData.exams.length > 0
                    ? Math.round(dashboardData.exams.reduce((sum, exam) => 
                        sum + (exam.completedAttempts > 0 ? exam.averageScore : 0), 0) / 
                        dashboardData.exams.length)
                    : 0
                  }%
                </p>
              </div>
            </div>
            
            {/* Exams Table */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <h2 className="text-xl font-semibold p-6 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">Your Exams</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Attempts</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Avg. Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {dashboardData?.exams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{exam.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{exam.questionCount} questions</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {exam.examCode}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            exam.status === 'PUBLISHED' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : exam.status === 'COMPLETED' 
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          }`}>
                            {exam.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{format(new Date(exam.startDate), 'MMM d, yyyy')}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{format(new Date(exam.startDate), 'h:mm a')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {exam.completedAttempts} / {exam.totalAttempts}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {exam.averageScore.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <button
                            onClick={() => handleViewExam(exam.id, exam.title)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleShowResults(exam.id, exam.title)}
                            className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            Results
                          </button>
                          {exam.status !== 'PUBLISHED' && (
                            <button 
                              onClick={() => handlePublishExam(exam.id, exam.examCode)}
                              disabled={publishingExamId === exam.id}
                              className="text-amber-600 hover:text-amber-900 disabled:opacity-50"
                            >
                              {publishingExamId === exam.id ? 'Publishing...' : 'Publish'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dashboardData?.exams.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No exams created yet. Create your first exam!</p>
                  <button
                    onClick={() => router.push('/exam/create')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Create Exam
                  </button>
                </div>
              )}
            </div>
            
            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mt-8">
              <h2 className="text-xl font-semibold p-6 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">Recent Activity</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Exam</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {dashboardData?.recentActivity.map((activity) => (
                      <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{activity.user.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{activity.user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{activity.exam.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Code: {activity.exam.examCode}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            activity.status === 'COMPLETED' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : activity.status === 'TIMED_OUT' 
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          }`}>
                            {activity.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {activity.score !== null ? `${activity.score}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{format(new Date(activity.updatedAt), 'MMM d, yyyy')}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{format(new Date(activity.updatedAt), 'h:mm a')}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dashboardData?.recentActivity.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>
        );
      case Role.STUDENT:
        return (
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-8">Dashboard</h1>
            
            {/* Welcome message */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Welcome, {session?.user?.name}!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                You are logged in as a student.
                            </p>
                          </div>

            {/* Join Exam Section */}
            <div className="mb-8">
              <EnterExamCode />
                        </div>

            {/* Completed Exams Section */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Your Exam Results
              </h2>
              {exams.filter(exam => exam.attempts && exam.attempts.length > 0 && 
                 exam.attempts.some(attempt => attempt.status === 'COMPLETED')).length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">You haven't completed any exams yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Exam
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date Completed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {exams
                        .filter(exam => exam.attempts && exam.attempts.length > 0 && 
                                exam.attempts.some(attempt => attempt.status === 'COMPLETED'))
                        .map((exam) => {
                          const attempt = exam.attempts.find(a => a.status === 'COMPLETED');
                          const percentage = attempt && attempt.score !== null ? 
                                            (attempt.score / exam.totalMarks * 100).toFixed(1) : 'N/A';
                          
                          return (
                            <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {exam.title}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {exam.description}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {attempt?.endedAt ? new Date(attempt.endedAt).toLocaleString() : 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {attempt?.score || 0} / {exam.totalMarks}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {percentage}%
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                  ${parseFloat(percentage as string) >= 70 
                                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                    : parseFloat(percentage as string) >= 40
                                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                                  {parseFloat(percentage as string) >= 70 
                                    ? 'Excellent' 
                                    : parseFloat(percentage as string) >= 40
                                    ? 'Satisfactory'
                                    : 'Needs Improvement'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleShowResults(exam.id, exam.title)}
                                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                  View Results
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
                        </div>

            {/* Available Exams Section */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Available Exams
              </h2>
              {exams.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No exams available at the moment.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {exams.map((exam) => {
                    const hasAttempted = exam.attempts && exam.attempts.length > 0;
                    const isActive = new Date() >= new Date(exam.startDate) && new Date() <= new Date(exam.endDate);
                    
                    return (
                      <div
                        key={exam.id}
                        className="border rounded-lg p-4 dark:border-gray-700"
                      >
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {exam.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {exam.description}
                        </p>
                        <div className="mt-4 space-y-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Duration: {exam.duration} minutes
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Total Marks: {exam.totalMarks}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Start: {new Date(exam.startDate).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            End: {new Date(exam.endDate).toLocaleString()}
                          </p>                        </div>
                        <div className="mt-4">
                          {hasAttempted ? (
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Completed
                              </span>
                              <Link
                                href={`/exam/result/${exam.id}`}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                              >
                                View Results
                              </Link>
                            </div>
                          ) : isActive ? (
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Active
                              </span>
                              <button
                                onClick={() => handleStartExam(exam.examCode)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                              >
                                Start Exam
                              </button>
                            </div>
                          ) : new Date() < new Date(exam.startDate) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Upcoming
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Ended
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                      </div>
                    </div>
        );
      default:
        return (
          <div className="text-center text-gray-600 dark:text-gray-300">
            <p>Loading dashboard content...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome, {session?.user?.name}!
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Role: {userRole?.toLowerCase() || 'Loading...'}
          </p>
        </div>
        {renderDashboardContent()}
        <ExamTypeDialog
          isOpen={showTypeDialog}
          onClose={handleClose}
          onSelect={handleTypeSelect}
        />
      </div>
      
      {selectedExam && (
        <>
          <EnhancedExamResultsModal
            isOpen={showResultsModal}
            onClose={handleCloseResultsModal}
            examId={selectedExam.id}
            examTitle={selectedExam.title}
          />
          
          <ExamViewDialog
            isOpen={showViewDialog}
            onClose={handleCloseViewDialog}
            examId={selectedExam.id}
          />
        </>
      )}      {/* Exam Instructions Dialog - New component for showing exam instructions */}
      {selectedExamCode && (
        <ExamInstructionsDialog
          isOpen={showInstructionsDialog}
          onClose={handleCloseInstructionsDialog}
          examCode={selectedExamCode}
        />
      )}
    </div>
  );
}