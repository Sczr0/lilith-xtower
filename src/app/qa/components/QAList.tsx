'use client';

import { useState } from 'react';
import { Markdown } from '../../components/Markdown';

interface QAItem {
  id: string;
  question: string;
  answer: string;
  category: 'login' | 'usage' | 'technical' | 'security';
}

interface QAListProps {
  qaData: QAItem[];
}

const categories = {
  login: { name: '登录相关', color: 'blue' },
  usage: { name: '使用指南', color: 'green' },
  technical: { name: '技术问题', color: 'purple' },
  security: { name: '安全隐私', color: 'red' },
};

/**
 * QA 列表客户端组件
 * 处理分类筛选和展开/折叠交互
 */
export function QAList({ qaData }: QAListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredQA = selectedCategory
    ? qaData.filter((item) => item.category === selectedCategory)
    : qaData;

  const getCategoryColor = (category: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[category as keyof typeof colors] || colors.blue;
  };

  return (
    <>
      {/* Category Filter */}
      <div className="mb-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            全部
          </button>
          {Object.entries(categories).map(([key, { name }]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* QA List */}
      <div className="space-y-4">
        {filteredQA.map((item) => (
          <div
            key={item.id}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden transition-all duration-200 hover:shadow-lg"
          >
            <button
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="w-full px-6 py-4 flex items-start justify-between gap-4 text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(
                      categories[item.category].color
                    )}`}
                  >
                    {categories[item.category].name}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {item.question}
                </h3>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform ${
                  expandedId === item.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {expandedId === item.id && (
              <div className="px-6 pb-4">
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                    <Markdown>{item.answer}</Markdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}