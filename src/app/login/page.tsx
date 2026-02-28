'use client';

import { useEffect, useState } from 'react';
import type { AuthMethod, TapTapVersion } from '../lib/types/auth';
import { AuthStatusBanner } from '../components/AuthStatusBanner';
import { AuthDetailsModal } from '../components/AuthDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AuthStorage } from '../lib/storage/auth';
import { getPreloadPolicy, preloadTapTapQr, runWhenIdle, shouldPreload } from '../lib/utils/preload';
import { SiteHeader } from '../components/SiteHeader';
import { PageShell } from '../components/PageShell';
import { RadioGroup } from '../components/ui/RadioGroup';
import { LoginMethodSelector } from './components/LoginMethodSelector';
import { useClientValue } from '../hooks/useClientValue';
import { LOGIN_METHODS } from './loginMethods';
import { LoginFormPanel } from './components/LoginFormPanel';
import { AGREEMENT_ACCEPTED_KEY } from '../lib/constants/storageKeys';

export default function LoginPage() {
  const [activeMethod, setActiveMethod] = useState<AuthMethod>('qrcode');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { isAuthenticated, isLoading, credential, logout } = useAuth();
  const router = useRouter();
  const agreementAccepted = useClientValue(
    () => localStorage.getItem(AGREEMENT_ACCEPTED_KEY) === 'true',
    false
  );

  const storedTapTapVersion = useClientValue(() => AuthStorage.getTapTapVersion(), 'cn');
  const [taptapVersionOverride, setTaptapVersionOverride] = useState<TapTapVersion | null>(null);
  const taptapVersion = taptapVersionOverride ?? storedTapTapVersion;

  // 预加载二维码数据（在空闲时执行），并预取 dashboard 页面（使用 Next Router 预取机制）
  useEffect(() => {
    if (shouldPreload()) {
      const policy = getPreloadPolicy();
      runWhenIdle(() => {
        preloadTapTapQr(taptapVersion);
        void router.prefetch('/dashboard');
      }, policy.loginIdleTimeout);
    }
  }, [router, taptapVersion]);

  // 保存TapTap版本配置并预加载对应版本的二维码
  const handleVersionChange = (version: 'cn' | 'global') => {
    setTaptapVersionOverride(version);
    AuthStorage.saveTapTapVersion(version);
    
    // 切换版本时预加载新版本的二维码
    if (shouldPreload()) {
      preloadTapTapQr(version);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && agreementAccepted) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router, agreementAccepted]);

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader showLogin={false} />}
      footerVariant="none"
      mainClassName="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 min-h-[calc(100vh-8rem)]"
      containerClassName="w-full max-w-5xl mx-auto"
      afterMain={(
        <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 border-t border-gray-200/50 dark:border-gray-700/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © 2025-2026 Phigros Query. All Rights Reserved.
          </p>
        </footer>
      )}
    >
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
              methods={LOGIN_METHODS}
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
            <LoginFormPanel activeMethod={activeMethod} taptapVersion={taptapVersion} />
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

      {/* Auth Details Modal */}
      {isAuthenticated && credential && (
        <AuthDetailsModal
          credential={credential}
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </PageShell>
  );
}
