'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Exam, Question, QuestionType, ExamAttempt } from '@prisma/client';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from 'react-hot-toast';

// Special characters for separating test cases and outputs
const TEST_CASE_SEPARATOR = '⏹'; // U+23F9
const OUTPUT_SEPARATOR = '⏺'; // U+23FA

// Add supported languages
const SUPPORTED_LANGUAGES = [
  { id: 'nodejs', name: 'JavaScript (Node.js)', version: '4', comment: '// JavaScript' },
  { id: 'python3', name: 'Python 3', version: '4', comment: '# Python' },
  { id: 'java', name: 'Java', version: '4', comment: '// Java' },
  { id: 'cpp', name: 'C++', version: '5', comment: '// C++' },
  { id: 'c', name: 'C', version: '5', comment: '// C' },
];

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock = ({ inline, className, children, ...props }: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || '');
  return !inline && match ? (
    <SyntaxHighlighter
      language={match[1]}
      PreTag="div"
      style={vscDarkPlus}
      {...props}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

// Type definition for exam with details
type ExamWithDetails = Exam & {
  questions: Question[];
  attempts?: ExamAttempt[];
};

export default function ExamPage({ params }: { params: { code: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [exam, setExam] = useState<ExamWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('nodejs');
  const [languageChangeTimestamp, setLanguageChangeTimestamp] = useState<number>(Date.now());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptedQuestions, setAttemptedQuestions] = useState<Set<number>>(new Set());
  const [testResults, setTestResults] = useState<Array<{
    input: string;
    output: string;
    expectedOutput: string;
    passed: boolean;
  }>>([]);
  const editorRef = useRef<Editor | null>(null);

  // Auto-save functionality
  const autoSave = useCallback(() => {
    if (!exam) return;
    
    const saveData = {
      examId: exam.id,
      answers,
      currentQuestionIndex,
      attemptedQuestions: Array.from(attemptedQuestions),
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(`exam-${params.code}`, JSON.stringify(saveData));
  }, [exam, answers, currentQuestionIndex, attemptedQuestions, params.code]);

  // Load saved data
  useEffect(() => {
    if (!exam) return;
    
    const savedData = localStorage.getItem(`exam-${params.code}`);
    console.log('Loading saved data from localStorage:', savedData);
    
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        console.log('Parsed saved data:', data);
        
        if (data.examId === exam.id) {
          console.log('Setting answers from saved data:', data.answers);
          setAnswers(data.answers || {});
          setCurrentQuestionIndex(data.currentQuestionIndex || 0);
          setAttemptedQuestions(new Set(data.attemptedQuestions || []));
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    }
  }, [exam, params.code]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [autoSave]);

  // Handle question navigation
  const handleQuestionChange = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < (exam?.questions.length || 0)) {
      setCurrentQuestionIndex(newIndex);
      // Mark question as attempted if it has an answer
      if (answers[exam?.questions[newIndex].id || '']) {
        setAttemptedQuestions(prev => new Set([...prev, newIndex]));
      }
    }
  };

  // Update handleAnswerChange to mark questions as attempted
  const handleAnswerChange = (questionId: string, answer: string) => {
    console.log('Updating answer for question:', questionId);
    console.log('New answer:', answer);
    
    setAnswers((prev) => {
      const newAnswers = {
        ...prev,
        [questionId]: answer,
      };
      console.log('Updated answers:', newAnswers);
      return newAnswers;
    });
    
    // Mark current question as attempted
    setAttemptedQuestions(prev => new Set([...prev, currentQuestionIndex]));
    setHasUnsavedChanges(true);
  };

  // Fetch exam data
  const fetchExam = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First, try to join the exam to create an attempt
      const joinResponse = await fetch('/api/join-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ examCode: params.code }),
      });

      if (!joinResponse.ok) {
        const errorData = await joinResponse.json();
        throw new Error(errorData.message || 'Failed to join exam');
      }

      // Then fetch the exam data
      const response = await fetch(`/api/student-exams/${params.code}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch exam');
      }
      const data = await response.json();
      
      console.log('Fetched exam data:', data);
      
      if (!data || !data.id) {
        throw new Error('Invalid exam data');
      }
      
      setExam(data);
      // Set time left based on duration for coding or endDate for quiz
      if (data.type === 'CODING') {
        setTimeLeft(data.duration * 60);
      } else {
        const endTime = new Date(data.endDate).getTime();
        const now = new Date().getTime();
        setTimeLeft(Math.max(0, Math.floor((endTime - now) / 1000)));
      }

      // If there are existing answers in the exam data, load them
      if (data.answers) {
        console.log('Loading existing answers:', data.answers);
        setAnswers(data.answers);
      }
    } catch (error) {
      console.error('Error fetching exam:', error);
      setError(error instanceof Error ? error.message : 'Failed to load exam');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    fetchExam();
  }, [session, status, router, params.code]);

  useEffect(() => {
    if (!exam || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exam, timeLeft]);

  // Update handleCodeChange to add proper language comment based on selection
  const handleCodeChange = (value: string | undefined) => {
    if (!exam || !value) return;
    const currentQuestion = exam.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    console.log('Code changed for question:', currentQuestion.id);
    
    // Find the language for current question
    const language = SUPPORTED_LANGUAGES.find(lang => lang.id === selectedLanguage);
    if (!language) return;

    // Check if the code already starts with the language comment
    const codeLines = value.split('\n');
    if (!codeLines[0]?.trim().startsWith(language.comment)) {
      // Add language comment if not present
      const newValue = `${language.comment}\n${value}`;
      console.log(`Adding ${language.name} comment to code:`, language.comment);
      handleAnswerChange(currentQuestion.id, newValue);
    } else {
      handleAnswerChange(currentQuestion.id, value);
    }
    setHasUnsavedChanges(true);
  };

  // Update runTests function with better error handling and logging
  const runTests = async () => {
    if (!exam) return;
    const currentQuestion = exam.questions[currentQuestionIndex];
    if (!currentQuestion || currentQuestion.type !== 'CODING') return;
    
    setIsRunningTests(true);
    setTestResults([]);
    
    try {
      const code = answers[currentQuestion.id] || '';
      const language = SUPPORTED_LANGUAGES.find(lang => lang.id === selectedLanguage);
      if (!language) {
        throw new Error('Unsupported programming language');
      }
      
      console.log(`Running tests with language: ${language.id}`);
      console.log(`Test cases:`, currentQuestion.options);
      
      const results = await Promise.all(
        currentQuestion.options.map(async (option: string, index: number) => {
          const [input = '', expectedOutput = ''] = option.split(TEST_CASE_SEPARATOR);
          try {
            // Format input properly based on language
            let formattedInput = input;
            
            // Handle multiple inputs by splitting on commas and joining with newlines
            if (input.includes(',')) {
              formattedInput = input.split(',').map(i => i.trim()).join('\n');
              console.log(`Test ${index+1}: Formatted input with multiple values for ${language.id}: "${formattedInput}"`);
            }
            
            const submission = {
              clientId: '18eb17b5d5a7a906e0e72129b3f8818',
              clientSecret: '380e2946e62defce630b4af45150dbf656392da53dc9a0a3de8d5cbb65682718',
              script: code,
              stdin: formattedInput,
              language: language.id,
              versionIndex: language.version
            };
            
            console.log(`Test ${index+1}: Submitting code to JDoodle`);
            
            // Use local proxy endpoint for JDoodle API call
            const response = await fetch('/api/jdoodle-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(submission)
            });
            
            if (!response.ok) {
              console.error(`Test ${index+1}: JDoodle API error:`, response.status, response.statusText);
              const errorData = await response.text();
              throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData}`);
            }
            
            const result = await response.json();
            console.log(`Test ${index+1} result:`, result);
            
            if (result.error) {
              console.error(`Test ${index+1}: Execution error:`, result.error);
              return {
                input,
                output: String(result.error || 'Execution error'),
                expectedOutput: expectedOutput.trim(),
                passed: false,
              };
            }
            
            const actualOutput = result.output?.trim() || '';
            const passed = actualOutput === expectedOutput.trim();
            
            console.log(`Test ${index+1}: Input="${input}", Expected="${expectedOutput}", Got="${actualOutput}", Passed=${passed}`);
            
            return {
              input,
              output: actualOutput,
              expectedOutput: expectedOutput.trim(),
              passed,
            };
          } catch (error) {
            console.error(`Test ${index+1} failed with error:`, error);
            return {
              input,
              output: error instanceof Error ? error.message : 'Execution error',
              expectedOutput: expectedOutput.trim(),
              passed: false,
            };
          }
        })
      );
      
      console.log(`All test results:`, results);
      setTestResults(results);
      setAttemptedQuestions(new Set([...attemptedQuestions, currentQuestionIndex]));
      
      const passedCount = results.filter(r => r.passed).length;
      toast.success(`Tests run: ${passedCount}/${results.length} passed`);
      
      // Save the test results so they'll be available when submitting
      if (results.length > 0) {
        // Format the results for storage to match the submit API format
        const formattedTestResults = results.map(r => 
          `${r.input}${TEST_CASE_SEPARATOR}${r.expectedOutput}${OUTPUT_SEPARATOR}${r.output}`
        ).join('||');
        
        const currentQuestion = exam.questions[currentQuestionIndex];
        const existingCode = answers[currentQuestion.id] || '';
        
        // Create a special comment that includes test results AND selected language
        const codeWithResults = existingCode + 
          `\n\n// TEST_RESULTS: ${formattedTestResults}\n// LANGUAGE: ${selectedLanguage}`;
        
        handleSave(codeWithResults);
      }
    } catch (error) {
      console.error('Error running tests:', error);
      toast.error(error instanceof Error ? error.message : 'Error running tests');
    } finally {
      setIsRunningTests(false);
    }
  };

  // Update handleSave to accept an optional code parameter
  const handleSave = async (codeToSave?: string) => {
    if (!exam || !session?.user) return;

    try {
      setIsSaving(true);
      const currentQuestion = exam.questions[currentQuestionIndex];
      const currentAnswer = codeToSave || answers[currentQuestion.id] || '';

      console.log('Saving answer for question:', currentQuestion.id);
      console.log('Answer:', currentAnswer);

      // Save to database
      const response = await fetch(`/api/student-exams/${params.code}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: currentAnswer,
        }),
      });

      const data = await response.json();
      console.log('Save response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save progress');
      }

      // Update local state
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: currentAnswer,
      }));

      // Mark question as attempted
      setAttemptedQuestions(prev => new Set([...prev, currentQuestionIndex]));

      // Save to localStorage
      const savedData = {
        examId: exam.id,
        answers: {
          ...answers,
          [currentQuestion.id]: currentAnswer,
        },
        currentQuestionIndex,
        attemptedQuestions: Array.from(attemptedQuestions),
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(`exam-${params.code}`, JSON.stringify(savedData));

      setHasUnsavedChanges(false);
      toast.success('Progress saved successfully');
    } catch (error) {
      console.error('Error saving progress:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save progress');
    } finally {
      setIsSaving(false);
    }
  };

  // Update handleSubmit to process answers and extract test results
  const handleSubmit = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (hasUnsavedChanges && exam?.type === 'CODING') {
      const shouldSubmit = window.confirm(
        'You have unsaved changes. Are you sure you want to submit the exam?'
      );
      if (!shouldSubmit) {
        return;
      }
    }

    if (!exam) return;
    
    setIsSubmitting(true);
    try {
      let processedAnswers = { ...answers };
      
      // Process answers to append language comments for coding exams
      if (exam.type === 'CODING') {
        exam.questions.forEach(question => {
          if (question.type === QuestionType.CODING && processedAnswers[question.id]) {
            const code = processedAnswers[question.id];
            
            // Extract test results and language if they're embedded in the code
            const testResultsMatch = code.match(/\/\/\s*TEST_RESULTS:\s*(.*)/);
            const languageMatch = code.match(/\/\/\s*LANGUAGE:\s*(.*)/);
            
            let questionLanguage = selectedLanguage; // Default to current language
            
            // If we found a language in the code, use that instead
            if (languageMatch && languageMatch[1]) {
              questionLanguage = languageMatch[1].trim();
              console.log(`Using language from code comment: ${questionLanguage}`);
            } else {
              console.log(`Using current selected language: ${questionLanguage}`);
            }
            
            if (testResultsMatch && testResultsMatch[1]) {
              // Extract the test results and use them instead of the code
              // Also include the language information
              console.log('Found test results in code, using these for submission');
              processedAnswers[question.id] = {
                code: code.replace(/\/\/\s*TEST_RESULTS:\s*.*/, '')
                         .replace(/\/\/\s*LANGUAGE:\s*.*/, '')
                         .trim(),
                results: testResultsMatch[1],
                language: questionLanguage
              };
            } else {
              // If no test results, just add language comment if needed
              const language = SUPPORTED_LANGUAGES.find(lang => lang.id === questionLanguage);
              if (language) {
                const codeLines = code.split('\n');
                let codeToSubmit = code;
                
                if (!codeLines[0]?.trim().startsWith(language.comment)) {
                  codeToSubmit = `${language.comment}\n${code}`;
                }
                
                processedAnswers[question.id] = {
                  code: codeToSubmit,
                  language: questionLanguage
                };
              }
            }
          }
        });
      }

      console.log('Submitting exam answers with language info:', processedAnswers);
      
      const response = await fetch(`/api/student-exams/${params.code}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          answers: processedAnswers,
          currentLanguage: selectedLanguage // Also send current language as a fallback
        }),
      });

      console.log(`Submit response status: ${response.status}`);
      const data = await response.json();
      console.log('Submit response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit exam');
      }

      // Clear saved data after successful submission
      localStorage.removeItem(`exam-${params.code}`);
      
      // Redirect to results page
      router.push(`/exam/result/${exam.id}/${session?.user?.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add beforeunload event listener
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Add navigation prompt
  useEffect(() => {
    const handleBeforeRouteChange = (e: PopStateEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        if (window.confirm('You have unsaved changes. Do you want to save before leaving?')) {
          handleSave();
        }
      }
    };

    window.addEventListener('popstate', handleBeforeRouteChange);
    return () => window.removeEventListener('popstate', handleBeforeRouteChange);
  }, [hasUnsavedChanges]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600">{error || 'Exam not found'}</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Render Quiz Interface
  if (exam.type === 'QUIZ') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {exam.title}
            </h1>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              Time Left: {formatTime(timeLeft)}
            </div>
          </div>

          <div className="space-y-6">
            {exam.questions.map((question, index) => (
              <div key={question.id} className="border-b dark:border-gray-700 pb-6">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-semibold mr-3">
                    {index + 1}
                  </span>
                  <div className="flex-grow">
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {question.question}
                    </p>
                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <label
                          key={optionIndex}
                          className="flex items-center space-x-3 p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-gray-700 dark:text-gray-300">
                            {option}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Coding Exam Interface (original UI)
  const currentQuestion = exam.questions[currentQuestionIndex];
  
  // Update language selection handler to reset editor when language changes
  const handleLanguageChange = (newLanguage: string) => {
    const currentQuestion = exam?.questions[currentQuestionIndex];
    if (!currentQuestion) return;
    
    console.log(`Changing language from ${selectedLanguage} to ${newLanguage}`);
    setSelectedLanguage(newLanguage);
    setLanguageChangeTimestamp(Date.now()); // Update timestamp to track language changes
    
    // Get current code without the language comment
    const currentCode = answers[currentQuestion.id] || '';
    const codeLines = currentCode.split('\n');
    let codeWithoutComment = currentCode;
    
    // Remove existing language comment if present
    SUPPORTED_LANGUAGES.forEach(lang => {
      if (codeLines[0]?.trim().startsWith(lang.comment)) {
        codeWithoutComment = currentCode.substring(currentCode.indexOf('\n') + 1);
      }
    });
    
    // Add new language comment
    const language = SUPPORTED_LANGUAGES.find(lang => lang.id === newLanguage);
    if (language) {
      const newCode = `${language.comment}\n${codeWithoutComment}`;
      handleAnswerChange(currentQuestion.id, newCode);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {exam?.title}
              </h1>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Question {currentQuestionIndex + 1} of {exam?.questions.length}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                Time Left: {formatTime(timeLeft)}
              </div>
              <button
                onClick={handleSubmit}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8">
          {/* Question Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Question {currentQuestionIndex + 1}
                </h2>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {currentQuestion.marks} marks
                </div>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  {currentQuestion.question}
                </h3>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description:</h4>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: CodeBlock,
                    }}
                  >
                      {currentQuestion.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          {/* Code Editor Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between w-full mb-4">
              <div className="flex-1">
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-4 ml-4">
                <button
                  onClick={handleSave}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Save Progress
                </button>
                <button
                  onClick={runTests}
                  disabled={isRunningTests}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isRunningTests ? 'Running Tests...' : 'Run Tests'}
                </button>
              </div>
            </div>
            <div className="h-[600px]">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                theme="vs-dark"
                value={answers[currentQuestion.id] || ''}
                onChange={handleCodeChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          {/* Test Results Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Test Results
              </h3>
            </div>
            {testResults.length > 0 ? (
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      result.passed
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${
                        result.passed
                          ? 'text-green-800 dark:text-green-200'
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        Test Case {index + 1}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        result.passed
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {result.passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Input:</span>
                        <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm overflow-x-auto">
                          {result.input}
                        </pre>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Output:</span>
                        <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm overflow-x-auto">
                          {result.expectedOutput}
                        </pre>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Output:</span>
                        <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm overflow-x-auto">
                          {result.output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No test results yet. Click "Run Tests" to check your code.</p>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <button
              onClick={() => handleQuestionChange(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Previous Question
            </button>
            <div className="flex items-center space-x-2">
              {exam?.questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleQuestionChange(index)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    attemptedQuestions.has(index)
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  } ${
                    currentQuestionIndex === index
                      ? 'ring-2 ring-indigo-500'
                      : ''
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleQuestionChange(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex === (exam?.questions.length || 0) - 1}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Next Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}