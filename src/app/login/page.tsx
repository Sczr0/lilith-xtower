'use client';

import { useEffect, useRef, useState } from 'react';
import type { AuthMethod, TapTapVersion } from '../lib/types/auth';
import dynamic from 'next/dynamic';
import { AuthStatusBanner } from '../components/AuthStatusBanner';
import { AuthDetailsModal } from '../components/AuthDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AuthStorage } from '../lib/storage/auth';
import { preloadTapTapQr, runWhenIdle, shouldPreload } from '../lib/utils/preload';
import { SiteHeader } from '../components/SiteHeader';
import { RadioGroup } from '../components/ui/RadioGroup';
import { LoginMethodSelector } from './components/LoginMethodSelector';

function LoginMethodLoading(props: { error?: Error | null; isLoading?: boolean; pastDelay?: boolean }) {
  // 说明：dynamic 的 loading 会注入状态参数；这里不需要使用，但要避免 eslint unused-vars。
  void props;
  return (
    <div className="flex items-center justify-center py-10">
      <span className="text-sm text-gray-600 dark:text-gray-400">正在加载…</span>
    </div>
  );
}

const QRCodeLogin = dynamic<{ taptapVersion: TapTapVersion }>(
  () => import('./components/QRCodeLogin').then((m) => m.QRCodeLogin),
  { ssr: false, loading: LoginMethodLoading }
);

const ManualLogin = dynamic(
  () => import('./components/ManualLogin').then((m) => m.ManualLogin),
  { ssr: false, loading: LoginMethodLoading }
);

const APILogin = dynamic(
  () => import('./components/APILogin').then((m) => m.APILogin),
  { ssr: false, loading: LoginMethodLoading }
);

const PlatformLogin = dynamic(
  () => import('./components/PlatformLogin').then((m) => m.PlatformLogin),
  { ssr: false, loading: LoginMethodLoading }
);

export default function LoginPage() {
  const [activeMethod, setActiveMethod] = useState<AuthMethod>('qrcode');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { isAuthenticated, isLoading, credential, logout } = useAuth();
  const router = useRouter();
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [taptapVersion, setTaptapVersion] = useState<TapTapVersion>('cn');
  const userSelectedVersionRef = useRef(false);

  // 读取TapTap版本配置并预加载二维码
  useEffect(() => {
    const savedVersion = AuthStorage.getTapTapVersion();
    setTaptapVersion(savedVersion);
    
    // 预加载二维码数据（在空闲时执行）
    if (shouldPreload()) {
      runWhenIdle(() => {
        preloadTapTapQr(savedVersion);
        // 预取 dashboard 页面（使用 Next Router 预取机制）
        void router.prefetch('/dashboard');
      });
    }
  }, [router]);

  // 保存TapTap版本配置并预加载对应版本的二维码
  const handleVersionChange = (version: 'cn' | 'global') => {
    userSelectedVersionRef.current = true;
    setTaptapVersion(version);
    AuthStorage.saveTapTapVersion(version);
    
    // 切换版本时预加载新版本的二维码
    if (shouldPreload()) {
      preloadTapTapQr(version);
    }
  };

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
        return <QRCodeLogin key={taptapVersion} taptapVersion={taptapVersion} />;
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
      <SiteHeader showLogin={false} />

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
                <h2 id="login-methods-title" className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">选择登录方式</h2>
                <LoginMethodSelector
                  titleId="login-methods-title"
                  methods={loginMethods}
                  value={activeMethod}
                  onValueChange={setActiveMethod}
                />
              </div>
            </div>

            {/* 登录表单 */}
            <div className="lg:col-span-8">
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
                {/* TapTap版本选择 */}
                <div className="mb-6">
                  <h3 id="taptap-version-title" className="text-base sm:text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">
                    选择TapTap版本
                  </h3>
                  <RadioGroup.Root
                    aria-labelledby="taptap-version-title"
                    orientation="horizontal"
                    className="flex gap-4"
                    value={taptapVersion}
                    onValueChange={(v) => handleVersionChange(v as TapTapVersion)}
                  >
                    <RadioGroup.Item
                      value="cn"
                      className={`flex-1 py-3 px-4 rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        taptapVersion === 'cn'
                          ? 'bg-blue-500 text-white shadow-lg border-2 border-blue-600'
                          : 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="font-medium">国内版</span>
                    </RadioGroup.Item>
                    <RadioGroup.Item
                      value="global"
                      className={`flex-1 py-3 px-4 rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        taptapVersion === 'global'
                          ? 'bg-blue-500 text-white shadow-lg border-2 border-blue-600'
                          : 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="font-medium">国际版</span>
                    </RadioGroup.Item>
                  </RadioGroup.Root>
                </div>
                
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
              {' '}和{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                隐私协议
              </a>
              。
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2025 Phigros Query. All Rights Reserved.
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
