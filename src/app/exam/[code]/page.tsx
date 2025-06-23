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
      style={vscDarkPlus as any}
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
  const [selectedLanguage, setSelectedLanguage] = useState('nodejs');  const [languageChangeTimestamp, setLanguageChangeTimestamp] = useState<number>(Date.now());  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptedQuestions, setAttemptedQuestions] = useState<Set<number>>(new Set());  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenWarningCount, setFullscreenWarningCount] = useState(0);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [warningTimeLeft, setWarningTimeLeft] = useState(10);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [fullscreenMonitoringEnabled, setFullscreenMonitoringEnabled] = useState(true);
  const [testResults, setTestResults] = useState<Array<{
    input: string;
    output: string;
    expectedOutput: string;
    passed: boolean;
  }>>([]);
  const editorRef = useRef<any>(null);

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

  // Fetch exam data - modify to not create an attempt here since it's already created in instructions page
  const fetchExam = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // No need to join exam here anymore since it's already done in the instructions page
      // Just fetch the exam data directly
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
  }, [exam, timeLeft]);  // Fullscreen monitoring and warning system
  useEffect(() => {
    if (!exam || !fullscreenMonitoringEnabled) return; // Don't monitor if disabled or exam isn't loaded yet

    console.log('Setting up fullscreen monitoring...');

    // Helper function to check if we're actually in fullscreen
    const checkFullscreenStatus = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      // Additional check: verify that the viewport dimensions match screen dimensions
      // This helps detect cases where browser reports fullscreen but it's not truly fullscreen
      const isViewportFullscreen = window.innerHeight === screen.height && 
                                   window.innerWidth === screen.width;
      
      console.log('Fullscreen element check:', isCurrentlyFullscreen);
      console.log('Viewport fullscreen check:', isViewportFullscreen);
      console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
      console.log('Screen dimensions:', screen.width, 'x', screen.height);
      
      // For more reliable detection, require both conditions
      // However, be lenient on viewport check due to browser UI variations
      return isCurrentlyFullscreen;
    };

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = checkFullscreenStatus();
      
      console.log('Fullscreen changed:', isCurrentlyFullscreen);
      console.log('Previous state:', isFullscreen);
      
      setIsFullscreen(isCurrentlyFullscreen);
      
      // If user returns to fullscreen while warning is showing
      if (isCurrentlyFullscreen) {
        console.log('User returned to fullscreen - clearing warning and timer');
        
        // Clear any existing timer immediately
        if (warningTimerRef.current) {
          console.log('Clearing warning timer on fullscreen restore');
          clearInterval(warningTimerRef.current);
          warningTimerRef.current = null;
        }
        
        // Hide warning immediately when fullscreen is restored
        setShowFullscreenWarning(false);
        setWarningTimeLeft(10); // Reset timer for next time
        
        toast.success('Fullscreen restored. Continue with your exam.');
      } else {
        // User exited fullscreen - show warning immediately
        console.log('User exited fullscreen - showing warning immediately');
        
        // Clear any existing timer first
        if (warningTimerRef.current) {
          console.log('Clearing existing timer before starting new one');
          clearInterval(warningTimerRef.current);
          warningTimerRef.current = null;
        }
        
        // Use functional updates to avoid stale state
        setFullscreenWarningCount((prevCount) => {
          const newCount = prevCount + 1;
          console.log(`Fullscreen warning count: ${newCount}`);
          
          // If already reached max warnings, auto-submit immediately
          if (newCount > 3) {
            console.log('Maximum warnings reached - submitting exam');
            toast.error('Maximum fullscreen violations reached. Exam is being submitted.');
            // Use setTimeout to avoid calling handleSubmit during render
            setTimeout(() => {
              handleSubmit();
            }, 100);
            return newCount;
          }

          // Show warning and start timer for non-terminal warnings
          setShowFullscreenWarning(true);
          setWarningTimeLeft(10);

          // Start countdown timer using React state properly
          warningTimerRef.current = setInterval(() => {
            setWarningTimeLeft((prevTime) => {
              const newTime = prevTime - 1;
              console.log(`Warning timer: ${newTime}`);
              
              if (newTime <= 0) {
                // Time's up - submit exam
                console.log('Warning timer expired - submitting exam');
                if (warningTimerRef.current) {
                  clearInterval(warningTimerRef.current);
                  warningTimerRef.current = null;
                }
                setShowFullscreenWarning(false);
                toast.error('Fullscreen warning timeout. Exam is being submitted.');
                // Use setTimeout to avoid calling handleSubmit during render
                setTimeout(() => {
                  handleSubmit();
                }, 100);
                return 0;
              }
              
              return newTime;
            });
          }, 1000);

          return newCount;
        });
      }
    };

    // Add event listeners for fullscreen changes (all browser variants)
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initial check with delay to allow page to fully load
    setTimeout(() => {
      const isCurrentlyFullscreen = checkFullscreenStatus();
      console.log('Initial fullscreen check after delay:', isCurrentlyFullscreen);
      setIsFullscreen(isCurrentlyFullscreen);
      
      // If not in fullscreen initially, don't trigger a warning immediately
      // Give user a chance to enter fullscreen via the instructions dialog
      if (!isCurrentlyFullscreen) {
        console.log('Not in fullscreen initially - user should enter fullscreen mode');
      }
    }, 2000); // Increased delay to 2 seconds for better reliability

    // Cleanup
    return () => {
      console.log('Cleaning up fullscreen monitoring');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);      if (warningTimerRef.current) {
        clearInterval(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [exam, fullscreenMonitoringEnabled]); // Depend on monitoring enabled state

  const requestFullscreen = async () => {
    try {
      console.log('Attempting to request fullscreen...');
      const element = document.documentElement;
      
      // Check if fullscreen is supported
      if (!document.fullscreenEnabled && 
          !(document as any).webkitFullscreenEnabled && 
          !(document as any).mozFullScreenEnabled && 
          !(document as any).msFullscreenEnabled) {
        throw new Error('Fullscreen mode is not supported by this browser');
      }
      
      // Try different fullscreen methods based on browser support
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      } else {
        throw new Error('No fullscreen method available');
      }
      
      console.log('Fullscreen request successful');
    } catch (error) {
      console.warn('Could not enter fullscreen mode:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('gesture') || errorMessage.includes('user activation')) {
          toast.error('Please click the fullscreen button to enable fullscreen mode');
        } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
          toast.error('Fullscreen permission denied. Please allow fullscreen access in your browser settings.');
        } else if (errorMessage.includes('not supported')) {
          toast.error('Fullscreen not supported. Please press F11 key manually.');
        } else {
          toast.error('Unable to enter fullscreen. Please press F11 key or check browser permissions.');
        }
      } else {
        toast.error('Please manually enable fullscreen mode (press F11 key)');
      }
    }
  };

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
              processedAnswers[question.id] = JSON.stringify({
                code: code.replace(/\/\/\s*TEST_RESULTS:\s*.*/, '')
                         .replace(/\/\/\s*LANGUAGE:\s*.*/, '')
                         .trim(),
                results: testResultsMatch[1],
                language: questionLanguage
              });
            } else {
              // If no test results, just add language comment if needed
              const language = SUPPORTED_LANGUAGES.find(lang => lang.id === questionLanguage);
              if (language) {
                const codeLines = code.split('\n');
                let codeToSubmit = code;
                
                if (!codeLines[0]?.trim().startsWith(language.comment)) {
                  codeToSubmit = `${language.comment}\n${code}`;
                }
                
                processedAnswers[question.id] = JSON.stringify({
                  code: codeToSubmit,
                  language: questionLanguage
                });
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
  // Additional proctoring monitoring (non-fullscreen related)
  useEffect(() => {
    if (!exam) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        toast.error('Browser tab was switched - This may be flagged as suspicious behavior');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent common cheating key combinations
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'x')) ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') || // Developer tools
        e.key === 'F12' || // Developer tools
        (e.ctrlKey && e.shiftKey && e.key === 'C') || // Developer tools
        (e.ctrlKey && e.key === 'u') || // View source
        e.key === 'F5' || // Refresh
        (e.ctrlKey && e.key === 'r') // Refresh
      ) {
        e.preventDefault();
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C'))) {
          toast.error('Developer tools access is not allowed during the exam');
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Disable right-click context menu
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [exam]);

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
      <div className="container mx-auto px-4 py-8">        {/* Exam Status Indicator */}
        <div className="mb-4">
          {isFullscreen ? (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Exam mode active - You are securely monitored during this exam.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Please enable fullscreen mode for secure exam taking.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">      {/* Exam Status Indicator */}
      <div className="container mx-auto px-4 py-4">        {/* Debug Info */}
        <div className="mb-2 p-2 bg-gray-100 rounded text-xs">
          <div className="flex items-center justify-between">
            <div>
              <strong>Debug:</strong> isFullscreen: {isFullscreen ? 'YES' : 'NO'} | 
              Warning Count: {fullscreenWarningCount} | 
              Showing Warning: {showFullscreenWarning ? 'YES' : 'NO'} | 
              Timer: {warningTimeLeft}s | 
              Timer Ref: {warningTimerRef.current ? 'ACTIVE' : 'NULL'} | 
              FS Enabled: {typeof document !== 'undefined' && document.fullscreenEnabled ? 'YES' : 'NO'} |
              Monitoring: {fullscreenMonitoringEnabled ? 'ON' : 'OFF'} |
              Screen: {typeof window !== 'undefined' ? `${screen.width}x${screen.height}` : 'N/A'} |
              Window: {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setFullscreenMonitoringEnabled(!fullscreenMonitoringEnabled)}
                className={`px-2 py-1 text-white text-xs rounded hover:opacity-80 ${
                  fullscreenMonitoringEnabled ? 'bg-red-500' : 'bg-green-500'
                }`}
                title={fullscreenMonitoringEnabled ? 'Disable monitoring' : 'Enable monitoring'}
              >
                {fullscreenMonitoringEnabled ? 'Disable Monitor' : 'Enable Monitor'}
              </button>
              
              <button
                onClick={() => {
                  console.log('Testing warning system manually');
                  
                  // Clear any existing timer first
                  if (warningTimerRef.current) {
                    clearInterval(warningTimerRef.current);
                    warningTimerRef.current = null;
                  }
                  
                  setFullscreenWarningCount(prev => {
                    const newCount = prev + 1;
                    console.log(`Manual test - new warning count: ${newCount}`);
                    return newCount;
                  });
                  setShowFullscreenWarning(true);
                  setWarningTimeLeft(10);
                  
                  // Start countdown timer using proper React state management
                  warningTimerRef.current = setInterval(() => {
                    setWarningTimeLeft((prevTime) => {
                      const newTime = prevTime - 1;
                      console.log(`Manual test timer: ${newTime}`);
                      
                      if (newTime <= 0) {
                        console.log('Manual test timer expired');
                        if (warningTimerRef.current) {
                          clearInterval(warningTimerRef.current);
                          warningTimerRef.current = null;
                        }
                        setShowFullscreenWarning(false);
                        toast.error('Test timer expired!');
                        return 0;
                      }
                      
                      return newTime;
                    });
                  }, 1000);
                }}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >
                Test Warning
              </button>
              
              <button
                onClick={() => {
                  console.log('Manually clearing warning');
                  if (warningTimerRef.current) {
                    clearInterval(warningTimerRef.current);
                    warningTimerRef.current = null;
                  }
                  setShowFullscreenWarning(false);
                  setWarningTimeLeft(10);
                  toast.success('Warning cleared manually');
                }}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                Clear Warning
              </button>
              
              <button
                onClick={() => {
                  console.log('Resetting warning count');
                  setFullscreenWarningCount(0);
                  toast.success('Warning count reset to 0');
                }}
                className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
              >
                Reset Count
              </button>
              
              <button
                onClick={() => {
                  console.log('Simulating fullscreen exit');
                  // Simulate fullscreen exit by setting isFullscreen to false
                  setIsFullscreen(false);
                  // Trigger the warning logic manually
                  if (warningTimerRef.current) {
                    clearInterval(warningTimerRef.current);
                    warningTimerRef.current = null;
                  }
                  
                  setFullscreenWarningCount(prev => {
                    const newCount = prev + 1;
                    console.log(`Simulated exit - new warning count: ${newCount}`);
                    
                    if (newCount > 3) {
                      console.log('Simulated max warnings reached');
                      toast.error('Simulated max warnings - would submit exam');
                      return newCount;
                    }
                    
                    setShowFullscreenWarning(true);
                    setWarningTimeLeft(10);
                    
                    warningTimerRef.current = setInterval(() => {
                      setWarningTimeLeft((prevTime) => {
                        const newTime = prevTime - 1;
                        console.log(`Simulated warning timer: ${newTime}`);
                        
                        if (newTime <= 0) {
                          if (warningTimerRef.current) {
                            clearInterval(warningTimerRef.current);
                            warningTimerRef.current = null;
                          }
                          setShowFullscreenWarning(false);
                          toast.error('Simulated timer expired!');
                          return 0;
                        }
                        
                        return newTime;
                      });
                    }, 1000);
                    
                    return newCount;
                  });
                }}
                className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
              >
                Simulate Exit FS
              </button>
              
              <button
                onClick={() => {
                  console.log('Simulating fullscreen restore');
                  // Simulate fullscreen restore by setting isFullscreen to true
                  setIsFullscreen(true);
                  
                  // Clear warning and timer if they exist
                  if (warningTimerRef.current) {
                    console.log('Clearing warning timer on simulated fullscreen restore');
                    clearInterval(warningTimerRef.current);
                    warningTimerRef.current = null;
                  }
                  
                  // Hide warning immediately when fullscreen is restored
                  setShowFullscreenWarning(false);
                  setWarningTimeLeft(10); // Reset timer for next time
                  
                  toast.success('Simulated fullscreen restored!');
                }}
                className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
              >
                Simulate Enter FS
              </button>
            </div>          </div>
        </div>
        
        {fullscreenMonitoringEnabled ? (
          isFullscreen ? (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Exam mode active - You are securely monitored during this exam.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Please enable fullscreen mode for secure exam taking.
                  </p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      requestFullscreen();
                    }}
                    className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                  >
                    Enter Fullscreen
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Fullscreen monitoring disabled.</strong> Enable monitoring for secure exam proctoring.
                </p>
                <button
                  onClick={() => setFullscreenMonitoringEnabled(true)}
                  className="mt-2 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Enable Monitoring
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
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
            </div>            <div className="flex items-center space-x-4">
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
              <div className="flex items-center space-x-4 ml-4">                <button
                  onClick={() => handleSave()}
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
            </div>            <button
              onClick={() => handleQuestionChange(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex === (exam?.questions.length || 0) - 1}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Next Question
            </button>
          </div>
        </div>
      </div>        {/* Fullscreen Warning Overlay */}
      {showFullscreenWarning && !isFullscreen && (
        <div 
          className="fixed inset-0 bg-red-900 bg-opacity-95 flex items-center justify-center" 
          style={{ zIndex: 9999 }}
        >
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center shadow-2xl border-4 border-red-500 animate-pulse">
            <div className="mb-6">
              <svg className="h-16 w-16 text-red-600 mx-auto mb-4 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h2 className="text-2xl font-bold text-red-600 mb-2">⚠️ FULLSCREEN VIOLATION</h2>
              <p className="text-gray-800 font-semibold mb-4">
                You have exited fullscreen mode during the exam!
              </p>
              <div className="bg-red-50 p-4 rounded-lg mb-4 border-2 border-red-200">
                <p className="text-red-800 font-bold text-lg">
                  Warning {fullscreenWarningCount} of 3
                </p>
                <p className="text-red-700 text-sm mt-1">
                  After 3 warnings, your exam will be automatically submitted.
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="text-5xl font-bold text-red-600 mb-2 animate-pulse">
                {warningTimeLeft}
              </div>
              <p className="text-gray-700 font-semibold">
                Seconds remaining to return to fullscreen
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                <p className="text-yellow-800 font-semibold mb-2">
                  🎯 How to return to fullscreen:
                </p>
                <div className="text-left text-yellow-700 text-sm space-y-1">
                  <p><strong>Method 1:</strong> Press <kbd className="bg-yellow-200 px-2 py-1 rounded font-mono font-bold">F11</kbd> key (most reliable)</p>
                  <p><strong>Method 2:</strong> Click the button below</p>
                  <p><strong>Method 3:</strong> Press <kbd className="bg-yellow-200 px-2 py-1 rounded font-mono font-bold">Escape</kbd> then <kbd className="bg-yellow-200 px-2 py-1 rounded font-mono font-bold">F11</kbd></p>
                </div>
              </div>
              
              <button
                onClick={(e) => {
                  // Ensure this is a user gesture by preventing default and stopping propagation
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('User clicked fullscreen button from warning overlay');
                  requestFullscreen();
                }}
                className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2 text-lg shadow-lg transform hover:scale-105 transition-all"
              >
                🖥️ Enter Fullscreen Mode Now
              </button>
              
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">
                  If the button doesn't work:
                </p>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <p className="text-gray-700 text-sm font-medium">
                    Press <kbd className="bg-gray-200 px-2 py-1 rounded font-mono font-bold text-xs">F11</kbd> key
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    (Most reliable method for all browsers)
                  </p>
                </div>
              </div>
              
              <div className="text-center text-xs text-gray-500 bg-gray-50 p-2 rounded">
                <p><strong>Browser Issues?</strong></p>
                <p className="mt-1">Try: Refresh page → F11 → Continue exam</p>
                <p>Or allow fullscreen permissions in browser settings</p>
              </div>
              
              <p className="text-red-600 text-sm font-bold animate-pulse">
                ⏰ Exam will auto-submit if timer reaches zero!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}