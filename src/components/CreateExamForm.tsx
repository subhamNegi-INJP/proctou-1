import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExamType, QuestionType } from '@prisma/client';
import { toast } from 'react-hot-toast';

const questionSchema = z.object({
  type: z.nativeEnum(QuestionType),
  question: z.string().min(1, 'Question is required'),
  options: z.array(z.string()).optional(),
  optionA: z.string().optional(),
  optionB: z.string().optional(),
  optionC: z.string().optional(),
  optionD: z.string().optional(),
  correctAnswer: z.string().optional(),
  marks: z.number().min(1, 'Marks must be at least 1'),
  content: z.string().optional(),
  answer: z.string().optional(),
  testCases: z.array(z.object({
    input: z.string(),
    output: z.string(),
    isHidden: z.boolean().default(false),
  })).optional(),
});

const examSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.nativeEnum(ExamType),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  totalMarks: z.number().min(1, 'Total marks must be at least 1'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
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

export function CreateExamForm() {
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
  });

  const examType = watch('type');

  const {
    register: registerQuestion,
    handleSubmit: handleQuestionSubmit,
    reset: resetQuestion,
    formState: { errors: questionErrors },
    watch: watchQuestion,
    setValue,
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      type: QuestionType.MULTIPLE_CHOICE,
      marks: 1,
      options: [],
      testCases: [],
    },
  });

  const questionType = watchQuestion('type');

  // Update question type when exam type changes
  useEffect(() => {
    if (examType === ExamType.QUIZ) {
      setValue('type', QuestionType.MULTIPLE_CHOICE);
    }
  }, [examType, setValue]);

  // Reset form when question type changes
  useEffect(() => {
    resetQuestion({
      type: questionType,
      marks: 1,
      options: [],
      testCases: [],
      question: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: '',
      content: '',
      answer: '',
    });
  }, [questionType, resetQuestion]);

  // Update form fields based on question type
  useEffect(() => {
    if (questionType === QuestionType.CODING) {
      setValue('content', '');
      setValue('answer', '');
      setValue('testCases', []);
      setValue('optionA', '');
      setValue('optionB', '');
      setValue('optionC', '');
      setValue('optionD', '');
    } else if (questionType === QuestionType.MULTIPLE_CHOICE) {
      setValue('optionA', '');
      setValue('optionB', '');
      setValue('optionC', '');
      setValue('optionD', '');
      setValue('correctAnswer', '');
      setValue('content', '');
      setValue('answer', '');
      setValue('testCases', []);
    } else {
      setValue('correctAnswer', '');
      setValue('optionA', '');
      setValue('optionB', '');
      setValue('optionC', '');
      setValue('optionD', '');
      setValue('content', '');
      setValue('answer', '');
      setValue('testCases', []);
    }
  }, [questionType, setValue]);

  const onSubmitQuestion = (data: QuestionFormData) => {
    try {
      // For multiple choice questions, ensure we have options
      if (data.type === QuestionType.MULTIPLE_CHOICE) {
        const options = [
          data.optionA,
          data.optionB,
          data.optionC,
          data.optionD,
        ].filter((option): option is string => Boolean(option)); // Type guard to ensure string[]

        if (options.length < 2) {
          toast.error('Please provide at least 2 options for multiple choice questions');
          return;
        }

        data.options = options;
      }

      setQuestions(prev => [...prev, data]);
      resetQuestion();
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

  const onSubmit = async (data: ExamFormData) => {
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          questions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create exam');
      }

      const result = await response.json();
      toast.success('Exam created successfully!');
      reset();
      setQuestions([]);
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error('Failed to create exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            {...register('title')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            {...register('description')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows={3}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              {...register('type')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value={ExamType.QUIZ}>Quiz</option>
              <option value={ExamType.CODING}>Coding</option>
              <option value={ExamType.EXAM}>Exam</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              type="number"
              {...register('duration', { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {errors.duration && (
              <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="datetime-local"
              {...register('startDate')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="datetime-local"
              {...register('endDate')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Total Marks</label>
          <input
            type="number"
            {...register('totalMarks', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          {errors.totalMarks && (
            <p className="mt-1 text-sm text-red-600">{errors.totalMarks.message}</p>
          )}
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-medium text-gray-900">Questions</h3>
          <div className="mt-4 space-y-4">
            {questions.map((q, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{q.question}</p>
                    <p className="text-sm text-gray-500">Type: {q.type}</p>
                    <p className="text-sm text-gray-500">Marks: {q.marks}</p>
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
              <label className="block text-sm font-medium text-gray-700">Question Type</label>
              <select
                {...registerQuestion('type')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                disabled={examType === ExamType.QUIZ}
              >
                {examType === ExamType.QUIZ ? (
                  <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                ) : (
                  <>
                    <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                    <option value={QuestionType.SHORT_ANSWER}>Short Answer</option>
                    <option value={QuestionType.CODING}>Coding</option>
                  </>
                )}
              </select>
              {questionErrors.type && (
                <p className="mt-1 text-sm text-red-600">{questionErrors.type.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Question</label>
              <textarea
                {...registerQuestion('question')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                rows={2}
              />
              {questionErrors.question && (
                <p className="mt-1 text-sm text-red-600">{questionErrors.question.message}</p>
              )}
            </div>

            {questionType === QuestionType.MULTIPLE_CHOICE && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Option A</label>
                  <input
                    type="text"
                    {...registerQuestion('optionA')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {questionErrors.optionA && (
                    <p className="mt-1 text-sm text-red-600">{questionErrors.optionA.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Option B</label>
                  <input
                    type="text"
                    {...registerQuestion('optionB')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {questionErrors.optionB && (
                    <p className="mt-1 text-sm text-red-600">{questionErrors.optionB.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Option C</label>
                  <input
                    type="text"
                    {...registerQuestion('optionC')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {questionErrors.optionC && (
                    <p className="mt-1 text-sm text-red-600">{questionErrors.optionC.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Option D</label>
                  <input
                    type="text"
                    {...registerQuestion('optionD')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {questionErrors.optionD && (
                    <p className="mt-1 text-sm text-red-600">{questionErrors.optionD.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        {...registerQuestion('correctAnswer')}
                        value="A"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <label className="ml-3 block text-sm font-medium text-gray-700">Option A</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        {...registerQuestion('correctAnswer')}
                        value="B"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <label className="ml-3 block text-sm font-medium text-gray-700">Option B</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        {...registerQuestion('correctAnswer')}
                        value="C"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <label className="ml-3 block text-sm font-medium text-gray-700">Option C</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        {...registerQuestion('correctAnswer')}
                        value="D"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <label className="ml-3 block text-sm font-medium text-gray-700">Option D</label>
                    </div>
                  </div>
                  {questionErrors.correctAnswer && (
                    <p className="mt-1 text-sm text-red-600">{questionErrors.correctAnswer.message}</p>
                  )}
                </div>
              </div>
            )}

            {questionType === QuestionType.CODING && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Question Content</label>
                  <textarea
                    {...registerQuestion('content')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    rows={4}
                    placeholder="Enter the coding question description, including any constraints or requirements..."
                  />
                  {questionErrors.content && (
                    <p className="mt-1 text-sm text-red-600">{questionErrors.content.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Answer Template</label>
                  <textarea
                    {...registerQuestion('answer')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                    rows={6}
                    placeholder="Enter the template code that students will use as a starting point..."
                  />
                  {questionErrors.answer && (
                    <p className="mt-1 text-sm text-red-600">{questionErrors.answer.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Test Cases</label>
                  <div className="mt-2 space-y-4">
                    {watchQuestion('testCases')?.map((_, index) => (
                      <div key={index} className="rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="text-sm font-medium text-gray-700">Test Case {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => {
                              const currentTestCases = watchQuestion('testCases') || [];
                              const newTestCases = currentTestCases.filter((_, i) => i !== index);
                              setValue('testCases', newTestCases);
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
                              {...registerQuestion(`testCases.${index}.input`)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Expected Output</label>
                            <textarea
                              {...registerQuestion(`testCases.${index}.output`)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                              rows={2}
                            />
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              {...registerQuestion(`testCases.${index}.isHidden`)}
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
                        const currentTestCases = watchQuestion('testCases') || [];
                        setValue('testCases', [
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
              </div>
            )}

            {questionType !== QuestionType.MULTIPLE_CHOICE && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
                <input
                  type="text"
                  {...registerQuestion('correctAnswer')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                {questionErrors.correctAnswer && (
                  <p className="mt-1 text-sm text-red-600">{questionErrors.correctAnswer.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Marks</label>
              <input
                type="number"
                {...registerQuestion('marks', { valueAsNumber: true })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              {questionErrors.marks && (
                <p className="mt-1 text-sm text-red-600">{questionErrors.marks.message}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleQuestionSubmit(onSubmitQuestion)}
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
            {isSubmitting ? 'Creating...' : 'Create Exam'}
          </button>
        </div>
      </form>
    </div>
  );
} 