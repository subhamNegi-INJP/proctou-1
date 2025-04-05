import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExamType, QuestionType } from '@prisma/client';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useRouter } from 'next/navigation';

// Special characters for separating test cases and outputs
const TEST_CASE_SEPARATOR = '⏹'; // U+23F9
const OUTPUT_SEPARATOR = '⏺'; // U+23FA

const testCaseSchema = z.object({
  input: z.string().min(1, 'Input is required'),
  output: z.string().min(1, 'Output is required'),
});

const codingQuestionSchema = z.object({
  question: z.string().min(1, 'Question title is required'),
  content: z.string().min(1, 'Question content is required'),
  testCases: z.array(testCaseSchema).min(1, 'At least one test case is required'),
  marks: z.number().min(1, 'Marks must be at least 1'),
});

const examSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.nativeEnum(ExamType),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  totalMarks: z.number().min(1, 'Total marks must be at least 1'),
  startDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !Number.isNaN(parsed.getTime());
  }, 'Invalid date format'),
  endDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !Number.isNaN(parsed.getTime());
  }, 'Invalid date format'),
  questions: z.array(codingQuestionSchema).min(1, 'At least one question is required'),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate > startDate;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

type ExamFormData = z.infer<typeof examSchema>;
type TestCaseFormData = z.infer<typeof testCaseSchema>;
type CodingQuestionFormData = z.infer<typeof codingQuestionSchema>;

// Remove unused types
type QuestionFormData = {
  question: string;
  description: string;
  marks: number;
  language: string;
  testCases: Array<{
    input: string;
    expectedOutput: string;
  }>;
};

interface CodingExamFormProps {
  onSuccess?: () => void;
}

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
      style={{ 'pre[class*="language-"]': {} } as { [key: string]: React.CSSProperties }}
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

const questionSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  description: z.string().min(1, 'Description is required'),
  marks: z.number().min(1, 'Marks must be at least 1'),
  language: z.string().min(1, 'Language is required'),
  testCases: z.array(z.object({
    input: z.string().min(1, 'Input is required'),
    expectedOutput: z.string().min(1, 'Expected output is required'),
  })).min(1, 'At least one test case is required'),
});

const SUPPORTED_LANGUAGES = [
  { id: 'nodejs', name: 'JavaScript (Node.js)' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
];

export function CodingExamForm({ onSuccess }: CodingExamFormProps) {
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const router = useRouter();

  // Format date for datetime-local input
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: '',
      description: '',
      type: ExamType.CODING,
      duration: 60,
      totalMarks: 100,
      startDate: formatDateForInput(new Date()),
      endDate: formatDateForInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      questions: [],
    },
  });

  const questionForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      question: '',
      description: '',
      marks: 1,
      language: 'nodejs',
      testCases: [],
    },
  });

  const onSubmitQuestion = (data: QuestionFormData) => {
    const newQuestion = {
      question: data.question,
      description: data.description,
      marks: data.marks,
      language: data.language,
      testCases: data.testCases,
    };

    setQuestions([...questions, newQuestion]);
    questionForm.reset({
      question: '',
      description: '',
      marks: 0,
      language: 'nodejs',
      testCases: [{ input: '', expectedOutput: '' }],
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    toast.success('Question removed');
  };

  const onSubmit = async (data: z.infer<typeof examSchema>) => {
    try {
      setIsSubmitting(true);
      
      if (questions.length === 0) {
        toast.error('Please add at least one question');
        setIsSubmitting(false);
        return;
      }

      // Calculate total marks from questions
      const totalQuestionMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      
      // Check if total marks match
      if (totalQuestionMarks !== data.totalMarks) {
        toast.error(`Total marks (${data.totalMarks}) does not match the sum of question marks (${totalQuestionMarks})`);
        setIsSubmitting(false);
        return;
      }

      // Format dates to ISO string
      const startDate = new Date(data.startDate).toISOString();
      const endDate = new Date(data.endDate).toISOString();

      // Convert test cases to the expected format with the separator
      const formattedQuestions = questions.map(q => {
        // Process test cases into the correct format
        const formattedOptions = q.testCases.map(testCase => {
          // Use the separator to format the test case
          return `${testCase.input}${TEST_CASE_SEPARATOR}${testCase.expectedOutput}`;
        });

        return {
          type: QuestionType.CODING,
          question: q.question,
          content: q.description,
          marks: q.marks,
          language: q.language,
          // Store test cases in the options array
          options: formattedOptions,
        };
      });

      console.log('Formatted questions with test cases:', formattedQuestions);

      const formData = {
        ...data,
        type: ExamType.CODING,
        startDate,
        endDate,
        questions: formattedQuestions,
      };

      const response = await fetch('/api/exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create exam');
      }

      toast.success('Exam created successfully');
      form.reset();
      setQuestions([]);
      onSuccess?.();
      router.push('/dashboard');
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Validate the form first
    const isValid = form.trigger();
    if (!isValid) {
      return;
    }

    // Get the form data
    const formData = form.getValues();
    onSubmit(formData);
  };

  const updateQuestion = (index: number, field: 'question' | 'description' | 'marks' | 'language', value: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value,
    };
    setQuestions(updatedQuestions);
  };

  const updateTestCase = (questionIndex: number, testCaseIndex: number, field: 'input' | 'expectedOutput', value: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].testCases[testCaseIndex] = {
      ...updatedQuestions[questionIndex].testCases[testCaseIndex],
      [field]: value,
    };
    setQuestions(updatedQuestions);
  };

  const removeTestCase = (questionIndex: number, testCaseIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].testCases = newQuestions[questionIndex].testCases.filter((_, i) => i !== testCaseIndex);
    setQuestions(newQuestions);
  };

  const addTestCase = (questionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].testCases.push({ input: '', output: '' });
    setQuestions(newQuestions);
  };

  const renderTestCases = (questionIndex: number) => {
    return questions[questionIndex].testCases.map((testCase, testCaseIndex) => (
      <div key={testCaseIndex} className="mt-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={testCase.input}
              onChange={(e) => updateTestCase(questionIndex, testCaseIndex, 'input', e.target.value)}
              placeholder="Input (use commas for multiple inputs)"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">For multiple inputs in any language, separate values with commas</p>
          </div>
          <input
            type="text"
            value={testCase.expectedOutput}
            onChange={(e) => updateTestCase(questionIndex, testCaseIndex, 'expectedOutput', e.target.value)}
            placeholder="Expected Output"
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => removeTestCase(questionIndex, testCaseIndex)}
            className="text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <a 
          href="https://www.jdoodle.com/compiler/IDE-online-editor/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800"
        >
          Run your code here for the test cases to get the corresponding output →
        </a>
      </div>

      <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleSubmitClick(e as unknown as React.MouseEvent);
      }} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
          <input
            id="title"
            type="text"
            {...form.register('title')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          {form.formState.errors.title && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            id="description"
            {...form.register('description')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows={3}
          />
          {form.formState.errors.description && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              id="duration"
              type="number"
              {...form.register('duration', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {form.formState.errors.duration && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.duration.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="totalMarks" className="block text-sm font-medium text-gray-700">Total Marks</label>
            <input
              id="totalMarks"
              type="number"
              {...form.register('totalMarks', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {form.formState.errors.totalMarks && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.totalMarks.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              id="startDate"
              type="datetime-local"
              {...form.register('startDate')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {form.formState.errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.startDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              id="endDate"
              type="datetime-local"
              {...form.register('endDate')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {form.formState.errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.endDate.message}</p>
            )}
          </div>
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-medium text-gray-900">Questions</h3>
          <div className="mt-4 space-y-4">
            {questions.map((q, index) => {
              const questionId = `${q.question}-${q.description}-${index}`;
              const uniqueId = `${questionId}-${Date.now()}`;
              return (
                <div key={uniqueId} className="mb-4 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">Question {index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={`Remove question ${index + 1}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor={`${questionId}-title`} className="block text-sm font-medium text-gray-700">
                        Question Title
                      </label>
                      <input
                        type="text"
                        id={`${questionId}-title`}
                        value={q.question}
                        onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor={`${questionId}-description`} className="block text-sm font-medium text-gray-700">
                        Question Description (Markdown)
                      </label>
                      <textarea
                        id={`${questionId}-description`}
                        value={q.description}
                        onChange={(e) => updateQuestion(index, 'description', e.target.value)}
                        rows={4}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setPreviewContent(q.description)}
                          className="text-sm text-indigo-600 hover:text-indigo-900"
                          aria-label={`Preview question ${index + 1} description`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`${questionId}-marks`} className="block text-sm font-medium text-gray-700">
                        Marks
                      </label>
                      <input
                        type="number"
                        id={`${questionId}-marks`}
                        value={q.marks}
                        onChange={(e) => updateQuestion(index, 'marks', Number.parseInt(e.target.value, 10))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test Cases
                      </label>
                      {renderTestCases(index)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-medium text-gray-900">Add Question</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Question</label>
              <textarea
                {...questionForm.register('question')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={2}
              />
              {questionForm.formState.errors.question && (
                <p className="mt-1 text-sm text-red-600">{questionForm.formState.errors.question.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                {...questionForm.register('description')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={3}
              />
              {questionForm.formState.errors.description && (
                <p className="mt-1 text-sm text-red-600">{questionForm.formState.errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Language</label>
              <select
                {...questionForm.register('language')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
              {questionForm.formState.errors.language && (
                <p className="mt-1 text-sm text-red-600">{questionForm.formState.errors.language.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Test Cases</label>
              <div className="mt-2 space-y-4">
                {questionForm.watch('testCases')?.map((_: any, index: number) => (
                  <div key={index} className="flex space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">Input</label>
                      <input
                        type="text"
                        {...questionForm.register(`testCases.${index}.input`)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">Expected Output</label>
                      <input
                        type="text"
                        {...questionForm.register(`testCases.${index}.expectedOutput`)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const testCases = questionForm.getValues('testCases');
                        questionForm.setValue(
                          'testCases',
                          testCases.filter((_: any, i: number) => i !== index)
                        );
                      }}
                      className="mt-6 text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const testCases = questionForm.getValues('testCases');
                    questionForm.setValue('testCases', [
                      ...testCases,
                      { input: '', expectedOutput: '' }
                    ]);
                  }}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  Add Test Case
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Marks</label>
              <input
                type="number"
                {...questionForm.register('marks', { valueAsNumber: true })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              {questionForm.formState.errors.marks && (
                <p className="mt-1 text-sm text-red-600">{questionForm.formState.errors.marks.message}</p>
              )}
            </div>

            <button
              type="button"
              onClick={questionForm.handleSubmit(onSubmitQuestion)}
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Add Question
            </button>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting || questions.length === 0}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Coding Exam'}
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Preview</h3>
              <button
                type="button"
                onClick={() => setPreviewContent(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                }}
              >
                {previewContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}