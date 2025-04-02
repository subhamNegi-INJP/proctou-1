import { useState } from 'react';
import { QuestionType } from '@prisma/client';

interface Question {
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  marks: number;
  content?: string;
  answer?: string;
}

interface QuestionManagerProps {
  examType: string;
  onQuestionsChange: (questions: Question[]) => void;
}

export default function QuestionManager({ examType, onQuestionsChange }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);

  const addQuestion = () => {
    const newQuestion: Question = {
      type: 'MULTIPLE_CHOICE',
      question: '',
      options: [''],
      marks: 1,
    };
    setQuestions([...questions, newQuestion]);
    onQuestionsChange([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value,
    };
    setQuestions(updatedQuestions);
    onQuestionsChange(updatedQuestions);
  };

  const addOption = (questionIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options = [
      ...(updatedQuestions[questionIndex].options || []),
      '',
    ];
    setQuestions(updatedQuestions);
    onQuestionsChange(updatedQuestions);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuestions = [...questions];
    if (!updatedQuestions[questionIndex].options) {
      updatedQuestions[questionIndex].options = [];
    }
    updatedQuestions[questionIndex].options![optionIndex] = value;
    setQuestions(updatedQuestions);
    onQuestionsChange(updatedQuestions);
  };

  const removeQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);
    onQuestionsChange(updatedQuestions);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options = updatedQuestions[questionIndex].options?.filter(
      (_, i) => i !== optionIndex
    );
    setQuestions(updatedQuestions);
    onQuestionsChange(updatedQuestions);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Questions</h3>
        <button
          onClick={addQuestion}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Add Question
        </button>
      </div>

      {questions.map((question, questionIndex) => (
        <div
          key={questionIndex}
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Question {questionIndex + 1}
            </h4>
            <button
              onClick={() => removeQuestion(questionIndex)}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Remove
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Question Type
              </label>
              <select
                value={question.type}
                onChange={(e) => updateQuestion(questionIndex, 'type', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="TRUE_FALSE">True/False</option>
                <option value="SHORT_ANSWER">Short Answer</option>
                <option value="LONG_ANSWER">Long Answer</option>
                <option value="CODING">Coding</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Question
              </label>
              <textarea
                value={question.question}
                onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            {(question.type === 'MULTIPLE_CHOICE') && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Options
                  </label>
                  <button
                    onClick={() => addOption(questionIndex)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Add Option
                  </button>
                </div>
                {question.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                    <button
                      onClick={() => removeOption(questionIndex, optionIndex)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Correct Answer
              </label>
              <input
                type="text"
                value={question.correctAnswer || ''}
                onChange={(e) => updateQuestion(questionIndex, 'correctAnswer', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Marks
              </label>
              <input
                type="number"
                value={question.marks}
                onChange={(e) => updateQuestion(questionIndex, 'marks', parseInt(e.target.value))}
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 