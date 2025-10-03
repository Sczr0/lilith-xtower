import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import { ThemeToggle } from '../components/ThemeToggle';

// 读取 Markdown 文件内容
async function getAgreementContent() {
  const filePath = path.join(process.cwd(), 'src', 'app', 'agreement', 'agreement.md');
  const content = fs.readFileSync(filePath, 'utf8');
  return content;
}

export default async function AgreementPage() {
  const content = await getAgreementContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 text-gray-900 dark:text-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 lg:px-6 h-16 flex items-center justify-between backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <a className="flex items-center justify-center" href="/">
              <span className="text-lg font-bold">用户协议</span>
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            返回登录
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* 标题区域 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">「塔弦」空间站 - Phigros 成绩查询与图片生成器 用户协议</h1>
            <p className="text-gray-600 dark:text-gray-400">
              请仔细阅读我们的服务条款和隐私政策
            </p>
          </div>

          {/* 协议内容 */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-6 md:p-10 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2024 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}