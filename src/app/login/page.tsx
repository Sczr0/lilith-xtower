'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthMethod } from '../lib/types/auth';
import { QRCodeLogin } from './components/QRCodeLogin';
import { ManualLogin } from './components/ManualLogin';
import { APILogin } from './components/APILogin';
import { PlatformLogin } from './components/PlatformLogin';
import { ThemeToggle } from '../components/ThemeToggle';
import { AuthStatusBanner } from '../components/AuthStatusBanner';
import { AuthDetailsModal } from '../components/AuthDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [activeMethod, setActiveMethod] = useState<AuthMethod>('qrcode');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { isAuthenticated, isLoading, credential, logout } = useAuth();
  const router = useRouter();
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  // 读取是否已同意用户协议，仅在同意后才自动跳转至仪表盘
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('phigros_agreement_accepted') === 'true';
      setAgreementAccepted(accepted);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && agreementAccepted) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router, agreementAccepted]);

  const loginMethods = [
    {
      id: 'qrcode' as AuthMethod,
      name: '扫码登录',
      description: '使用 TapTap App 扫码登录',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      )
    },
    {
      id: 'manual' as AuthMethod,
      name: '手动登录',
      description: '输入 SessionToken',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      )
    },
    {
      id: 'api' as AuthMethod,
      name: '联合查分 API',
      description: '使用 API 凭证登录',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      )
    },
    {
      id: 'platform' as AuthMethod,
      name: '联合查分平台',
      description: '使用平台账号登录',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
  ];

  const renderLoginForm = () => {
    switch (activeMethod) {
      case 'qrcode':
        return <QRCodeLogin />;
      case 'manual':
        return <ManualLogin />;
      case 'api':
        return <APILogin />;
      case 'platform':
        return <PlatformLogin />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 text-gray-900 dark:text-gray-50">
      {/* Header */}
      <header className="relative z-10 px-4 lg:px-6 h-16 flex items-center justify-between backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-b border-gray-200/50 dark:border-gray-700/50">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-xl font-bold">Phigros 查询</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/qa"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            常见问题
          </Link>
          <Link
            href="/about"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            关于
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 min-h-[calc(100vh-8rem)]">
        <div className="w-full max-w-5xl mx-auto">
          <div className="text-center mb-6 sm:mb-8 lg:mb-10">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 sm:mb-4 tracking-tight">
              登录 Phigros 查询服务
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-2">
              选择登录方式，开始查询您的 Phigros 成绩
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
            {/* 登录方式选择 */}
            <div className="lg:col-span-4">
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">选择登录方式</h2>
                <div className="space-y-2 sm:space-y-3">
                  {loginMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setActiveMethod(method.id)}
                      className={`w-full text-left p-3 sm:p-4 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                        activeMethod === method.id
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className={`p-1.5 sm:p-2 rounded-lg ${
                          activeMethod === method.id
                            ? 'bg-white/20'
                            : 'bg-gray-200 dark:bg-gray-600'
                        }`}>
                          {method.icon}
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm sm:text-base font-semibold ${activeMethod === method.id ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                            {method.name}
                          </div>
                          <div className={`text-xs sm:text-sm mt-0.5 sm:mt-1 ${activeMethod === method.id ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                            {method.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 登录表单 */}
            <div className="lg:col-span-8">
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
                {isAuthenticated && credential && (
                  <AuthStatusBanner
                    credential={credential}
                    onShowDetails={() => setShowDetailsModal(true)}
                    onLogout={logout}
                  />
                )}
                {renderLoginForm()}
              </div>
            </div>
          </div>

          <div className="text-center mt-6 sm:mt-8">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-2">
              登录即表示您同意我们的
              <a href="/agreement" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                用户协议
              </a>
              。
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2024 Phigros Query. All Rights Reserved.
        </p>
      </footer>

      {/* Auth Details Modal */}
      {isAuthenticated && credential && (
        <AuthDetailsModal
          credential={credential}
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}