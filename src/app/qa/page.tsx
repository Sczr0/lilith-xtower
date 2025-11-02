'use client';

import Link from 'next/link';
import { ThemeToggle } from '../components/ThemeToggle';
import { useState, useEffect } from 'react';
import { Markdown } from '../components/Markdown';
import { useAuth } from '../contexts/AuthContext';

interface QAItem {
  id: string;
  question: string;
  answer: string;
  category: 'login' | 'usage' | 'technical' | 'security';
}

// 默认的 QA 数据（作为回退）
const defaultQAData: QAItem[] = [
  {
    id: 'q1',
    question: '如何获取 SessionToken？',
    answer: 'Phigros 游戏内没有直接获取 SessionToken 的方式。你可以通过其他查分方式（如扫码登录、联合查分 API）登录后，在调试页面查看获取到的 SessionToken。',
    category: 'login',
  },
  {
    id: 'q2',
    question: '支持哪些登录方式？',
    answer: '我们支持多种登录方式：\n1. 扫码登录：使用 TapTap App 扫码登录\n2. 手动登录：输入 SessionToken\n3. 联合查分 API：使用 API 凭证登录\n4. 联合查分平台：使用平台账号登录',
    category: 'login',
  },
  {
    id: 'q3',
    question: '登录凭证会保存多久？',
    answer: '您的登录凭证会保存在浏览器的本地存储中，除非您主动退出登录或清除浏览器数据，否则会一直保持登录状态。',
    category: 'security',
  },
  {
    id: 'q4',
    question: '如何生成 Best N 成绩图片？',
    answer: '登录后，在侧边栏选择"BN 图片生成"，选择您想要的主题（深色/白色）和歌曲数量，点击生成即可。生成的图片可以直接下载或分享。',
    category: 'usage',
  },
  {
    id: 'q5',
    question: '什么是 RKS？',
    answer: 'RKS (Ranking Score) 是 Phigros 中衡量玩家水平的指标。它基于玩家最佳 N 首歌曲的成绩计算得出。您可以在"RKS 成绩列表"中查看详细的 RKS 计算信息。',
    category: 'usage',
  },
  {
    id: 'q6',
    question: '我的数据安全吗？',
    answer: '您的所有数据都存储在浏览器本地，我们不会在服务器端保存您的任何个人信息或游戏数据。所有的数据处理都在您的设备上完成。',
    category: 'security',
  },
  {
    id: 'q7',
    question: '为什么我的成绩数据没有更新？',
    answer: '成绩数据来自 Phigros 官方服务器。如果您刚完成游戏，可能需要等待一段时间才会同步到服务器。您可以尝试退出登录后重新登录来刷新数据。',
    category: 'technical',
  },
  {
    id: 'q8',
    question: '支持哪些浏览器？',
    answer: '我们建议使用最新版本的 Chrome、Firefox、Safari 或 Edge 浏览器以获得最佳体验。部分功能可能不支持较旧的浏览器版本。',
    category: 'technical',
  },
  {
    id: 'q9',
    question: '如何查看调试信息？',
    answer: '登录后，在登录页面会显示当前登录状态，点击"查看详情"按钮即可查看完整的凭证信息。您也可以访问独立的调试页面 /debug-auth 查看详细信息。',
    category: 'technical',
  },
  {
    id: 'q10',
    question: '可以同时使用多个账号吗？',
    answer: '目前不支持同时登录多个账号。如果您需要切换账号，请先退出当前账号，然后使用新的凭证登录。',
    category: 'usage',
  },
];

const categories = {
  login: { name: '登录相关', color: 'blue' },
  usage: { name: '使用指南', color: 'green' },
  technical: { name: '技术问题', color: 'purple' },
  security: { name: '安全隐私', color: 'red' },
};

export default function QAPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qaData, setQaData] = useState<QAItem[]>(defaultQAData);
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // 从 API 加载 QA 数据
    fetch('/api/qa')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          setQaData(data);
        }
      })
      .catch(err => {
        console.error('Failed to load QA data:', err);
        // 使用默认数据
      })
      .finally(() => {});
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950">
      {/* Header */}
      <header className="relative z-10 px-4 lg:px-6 h-16 flex items-center justify-between backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-b border-gray-200/50 dark:border-gray-700/50">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-xl font-bold">Phigros 查询</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/about"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            关于
          </Link>
          {!isLoading && (
            isAuthenticated ? (
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              >
                仪表盘
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              >
                登录
              </Link>
            )
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              常见问题
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
              快速找到您需要的答案
            </p>
          </div>

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

          {/* Contact Section */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
              没有找到答案？
            </h2>
            <p className="text-blue-700 dark:text-blue-300 mb-4">
              如果您的问题没有在这里找到答案，欢迎通过以下方式联系我们：
            </p>
          <div className="mb-4 text-sm">
          </div>
            <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://qm.qq.com/q/pbbOzU72aA"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              加入官方群聊 空间站「索终」
            </a>
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                查看关于页面
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-medium rounded-lg border border-blue-600 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
              >
                返回主页
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50 mt-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2025 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
