'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Problem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  starterCode: string;
  testCases: {
    input: string;
    output: string;
  }[];
}

const sampleProblems: Problem[] = [
  {
    id: '1',
    title: 'Two Sum',
    difficulty: 'easy',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers in nums such that they add up to target.
You may assume that each input would have exactly one solution, and you may not use the same element twice.`,
    starterCode: `function twoSum(nums, target) {
  // Your code here
}`,
    testCases: [
      { input: '[2,7,11,15], 9', output: '[0,1]' },
      { input: '[3,2,4], 6', output: '[1,2]' },
      { input: '[3,3], 6', output: '[0,1]' },
    ],
  },
  {
    id: '2',
    title: 'Reverse Linked List',
    difficulty: 'easy',
    description: `Given the head of a singly linked list, reverse the list, and return the reversed list.`,
    starterCode: `class ListNode {
  constructor(val, next) {
    this.val = val;
    this.next = next;
  }
}

function reverseList(head) {
  // Your code here
}`,
    testCases: [
      { input: '[1,2,3,4,5]', output: '[5,4,3,2,1]' },
      { input: '[1,2]', output: '[2,1]' },
      { input: '[]', output: '[]' },
    ],
  },
  {
    id: '3',
    title: 'Longest Palindromic Substring',
    difficulty: 'medium',
    description: `Given a string s, return the longest palindromic substring in s.
A palindrome is a string that reads the same backward as forward, e.g., "madam" or "racecar".`,
    starterCode: `function longestPalindrome(s) {
  // Your code here
}`,
    testCases: [
      { input: '"babad"', output: '"bab"' },
      { input: '"cbbd"', output: '"bb"' },
      { input: '"a"', output: '"a"' },
    ],
  },
  {
    id: '4',
    title: 'Add Two Numbers',
    difficulty: 'medium',
    description: `You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.`,
    starterCode: `class ListNode {
  constructor(val, next) {
    this.val = val;
    this.next = next;
  }
}

function addTwoNumbers(l1, l2) {
  // Your code here
}`,
    testCases: [
      { input: '[2,4,3], [5,6,4]', output: '[7,0,8]' },
      { input: '[0], [0]', output: '[0]' },
      { input: '[9,9,9,9,9,9,9], [9,9,9,9]', output: '[8,9,9,9,0,0,0,1]' },
    ],
  },
  {
    id: '5',
    title: 'Merge K Sorted Lists',
    difficulty: 'hard',
    description: `You are given an array of k linked-lists lists, each linked-list is sorted in ascending order.
Merge all the linked-lists into one sorted linked-list and return it.`,
    starterCode: `class ListNode {
  constructor(val, next) {
    this.val = val;
    this.next = next;
  }
}

function mergeKLists(lists) {
  // Your code here
}`,
    testCases: [
      { input: '[[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' },
      { input: '[]', output: '[]' },
      { input: '[[]]', output: '[]' },
    ],
  },
  {
    id: '6',
    title: 'Longest Valid Parentheses',
    difficulty: 'hard',
    description: `Given a string containing just the characters '(' and ')', find the length of the longest valid (well-formed) parentheses substring.`,
    starterCode: `function longestValidParentheses(s) {
  // Your code here
}`,
    testCases: [
      { input: '"(()"', output: '2' },
      { input: '")()())"', output: '4' },
      { input: '""', output: '0' },
    ],
  },
];

export default function Practice() {
  const [selectedProblem, setSelectedProblem] = useState<Problem>(sampleProblems[0]);
  const [code, setCode] = useState(selectedProblem.starterCode);
  const [output, setOutput] = useState<string | null>(null);

  const handleRunCode = async () => {
    // In a real application, this would send the code to a backend service
    // For now, we'll just show a mock output
    setOutput('Running tests...\nAll test cases passed!');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Practice Problems</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Problems List */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Problems</h2>
                <div className="space-y-2">
                  {sampleProblems.map((problem) => (
                    <button
                      key={problem.id}
                      onClick={() => {
                        setSelectedProblem(problem);
                        setCode(problem.starterCode);
                        setOutput(null);
                      }}
                      className={`w-full text-left px-4 py-2 rounded-md ${
                        selectedProblem.id === problem.id
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{problem.title}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          problem.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                          problem.difficulty === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                          'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}>
                          {problem.difficulty}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Code Editor and Output */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {selectedProblem.title}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedProblem.description}
                    </p>
                  </div>

                  <div className="mb-4">
                    <MonacoEditor
                      height="400px"
                      defaultLanguage="javascript"
                      value={code}
                      onChange={(value) => setCode(value || '')}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyond: false,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      onClick={handleRunCode}
                      className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-800"
                    >
                      Run Code
                    </button>
                  </div>

                  {output && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Output</h3>
                      <pre className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {output}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 