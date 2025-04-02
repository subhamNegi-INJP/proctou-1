import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExamType, QuestionType } from '@prisma/client';
import { toast } from 'react-hot-toast';

const testCaseSchema = z.object({
  input: z.string().min(1, 'Input is required'),
  output: z.string().min(1, 'Output is required'),
  isHidden: z.boolean().default(false),
});

const questionSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  content: z.string().min(1, 'Question content is required'),
  answer: z.string().min(1, 'Answer template is required'),
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
    return !isNaN(parsed.getTime());
  }, 'Invalid date format'),
  endDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid date format'),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate > startDate;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

type ExamFormData = z.infer<typeof examSchema>;
type QuestionFormData = z.infer<typeof questionSchema>;

interface CodingExamFormProps {
  onSuccess?: () => void;
}

export function CodingExamForm({ onSuccess }: CodingExamFormProps) {
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      duration: 120,
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
      content: '',
      answer: '',
      marks: 1,
      testCases: [],
    },
  });

  const onSubmitQuestion = (data: QuestionFormData) => {
    try {
      if (data.testCases.length === 0) {
        toast.error('Please add at least one test case');
        return;
      }

      setQuestions(prev => [...prev, data]);
      questionForm.reset({
        question: '',
        content: '',
        answer: '',
        marks: 1,
        testCases: [],
      });
      toast.success('Question added successfully');
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error('Failed to add question');
    }
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    toast.success('Question removed');
  };

  const onSubmit = async (data: z.infer<typeof examSchema>) => {
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          type: ExamType.CODING,
          questions: questions.map(q => ({
            type: QuestionType.CODING,
            question: q.question,
            content: q.content,
            answer: q.answer,
            marks: q.marks,
            testCases: q.testCases,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create exam');
      }

      toast.success('Exam created successfully');
      onSuccess?.();
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error('Failed to create exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            {...form.register('title')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          {form.formState.errors.title && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
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
            <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              type="number"
              {...form.register('duration', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {form.formState.errors.duration && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.duration.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Total Marks</label>
            <input
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
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="datetime-local"
              {...form.register('startDate')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {form.formState.errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.startDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input
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
            {questions.map((q, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{q.question}</p>
                    <p className="text-sm text-gray-500">Marks: {q.marks}</p>
                    <p className="text-sm text-gray-500">Test Cases: {q.testCases.length}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-medium text-gray-900">Add Question</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Question Title</label>
              <input
                type="text"
                {...questionForm.register('question')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              {questionForm.formState.errors.question && (
                <p className="mt-1 text-sm text-red-600">{questionForm.formState.errors.question.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Question Content</label>
              <textarea
                {...questionForm.register('content')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={4}
                placeholder="Enter the coding question description, including any constraints or requirements..."
              />
              {questionForm.formState.errors.content && (
                <p className="mt-1 text-sm text-red-600">{questionForm.formState.errors.content.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Answer Template</label>
              <textarea
                {...questionForm.register('answer')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                rows={6}
                placeholder="Enter the template code that students will use as a starting point..."
              />
              {questionForm.formState.errors.answer && (
                <p className="mt-1 text-sm text-red-600">{questionForm.formState.errors.answer.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Test Cases</label>
              <div className="mt-2 space-y-4">
                {questionForm.watch('testCases')?.map((_, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-sm font-medium text-gray-700">Test Case {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => {
                          const currentTestCases = questionForm.watch('testCases') || [];
                          const newTestCases = currentTestCases.filter((_, i) => i !== index);
                          questionForm.setValue('testCases', newTestCases);
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Input</label>
                        <textarea
                          {...questionForm.register(`testCases.${index}.input`)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Expected Output</label>
                        <textarea
                          {...questionForm.register(`testCases.${index}.output`)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                          rows={2}
                        />
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          {...questionForm.register(`testCases.${index}.isHidden`)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-700">Hidden Test Case</label>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const currentTestCases = questionForm.watch('testCases') || [];
                    questionForm.setValue('testCases', [
                      ...currentTestCases,
                      { input: '', output: '', isHidden: false }
                    ]);
                  }}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
    </div>
  );
} 