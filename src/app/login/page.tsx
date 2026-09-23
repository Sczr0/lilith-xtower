'use client';

import { useEffect, useState } from 'react';
import type { AuthMethod, TapTapVersion } from '../lib/types/auth';
import { AuthStatusBanner } from '../components/AuthStatusBanner';
import { AuthDetailsModal } from '../components/AuthDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AuthStorage } from '../lib/storage/auth';
import { runWhenIdle, shouldPreload } from '../lib/utils/preload';
import { SiteHeader } from '../components/SiteHeader';
import { PageShell } from '../components/PageShell';
import { cardStyles } from '../components/ui/styles';
import { RadioGroup } from '../components/ui/RadioGroup';
import { LoginMethodSelector } from './components/LoginMethodSelector';
import { useClientValue } from '../hooks/useClientValue';
import { LOGIN_METHODS } from './loginMethods';
import { LoginFormPanel } from './components/LoginFormPanel';
import { initCap } from '../lib/cap/client';

export default function LoginPage() {
  const [activeMethod, setActiveMethod] = useState<AuthMethod>('qrcode');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { isAuthenticated, isLoading, credential, logout, consentRequired } = useAuth();
  const router = useRouter();

  // Cap 验证码：页面加载时立即启动后台解题（程序化模式，无可见 UI）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const endpoint =
      process.env.NEXT_PUBLIC_CAP_ENDPOINT || 'https://cap.xtower.site/904b5b0099/';
    initCap(endpoint);
  }, []);

  // 客户端挂载后才渲染登录面板：
  // hydration 之前只能拿到服务端默认值 'cn'，若此时就挂载 QRCodeLogin，国际版用户会先以
  // 'cn' 拉一次二维码、再因 key 变化重挂载拉第二次 —— 既浪费一次 device_code（撞限流），
  // 又可能让用户扫到错误版本的二维码。延后到客户端版本号就绪后一次性挂载即可杜绝。
  const isClient = useClientValue(() => true, false);
  const storedTapTapVersion = useClientValue(() => AuthStorage.getTapTapVersion(), 'cn');
  const [taptapVersionOverride, setTaptapVersionOverride] = useState<TapTapVersion | null>(null);
  const taptapVersion = taptapVersionOverride ?? storedTapTapVersion;

  // 空闲时预取 dashboard 路由（Next Router 预取，不涉及任何二维码/device_code 请求）
  useEffect(() => {
    if (!shouldPreload()) return;
    runWhenIdle(() => {
      void router.prefetch('/dashboard');
    });
  }, [router]);

  // 保存 TapTap 版本配置（二维码由登录面板按当前版本自行获取，无需额外预加载）
  const handleVersionChange = (version: 'cn' | 'global') => {
    setTaptapVersionOverride(version);
    AuthStorage.saveTapTapVersion(version);
  };

  useEffect(() => {
    // 已认证且无需重新同意协议时，自动进入面板；
    // 若服务端要求重新同意，则保持在本页等待协议弹窗确认。
    if (!isLoading && isAuthenticated && !consentRequired) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router, consentRequired]);

  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader showLogin={false} />}
      footerVariant="none"
      mainClassName="relative z-10 flex-1 flex items-start justify-center p-4 sm:p-6 pt-8 sm:pt-12 lg:pt-16"
      containerClassName="w-full max-w-5xl mx-auto"
      afterMain={(
        <footer className="relative z-10 flex items-center justify-center h-16 backdrop-blur-sm bg-white/30 dark:bg-neutral-900/50 border-t border-gray-200/50 dark:border-neutral-800/60">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © 2025-2026 Phigros Query. All Rights Reserved.
          </p>
        </footer>
      )}
    >
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 tracking-tight">
          登录 Phigros 查询服务
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-2">
          选择登录方式，开始查询您的 Phigros 成绩
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 w-full max-w-5xl">
        {/* 登录方式选择 */}
        <div className="lg:col-span-5">
          <div className={cardStyles({ tone: 'glass', rounded: '2xl' })}>
            <h2 id="login-methods-title" className="text-lg sm:text-xl font-bold mb-5 sm:mb-6">选择登录方式</h2>
            <LoginMethodSelector
              titleId="login-methods-title"
              methods={LOGIN_METHODS}
              value={activeMethod}
              onValueChange={setActiveMethod}
            />
          </div>
        </div>

        {/* 登录表单 */}
        <div className="lg:col-span-7">
          <div className={cardStyles({ tone: 'glass', rounded: '2xl', className: 'lg:p-8' })}>
            {/* TapTap版本选择 */}
            <div className="mb-6">
              <h3 id="taptap-version-title" className="text-sm sm:text-base font-medium mb-3 text-gray-900 dark:text-gray-100">
                选择TapTap版本
              </h3>
              <RadioGroup.Root
                aria-labelledby="taptap-version-title"
                orientation="horizontal"
                className="flex gap-3 sm:gap-4"
                value={taptapVersion}
                onValueChange={(v) => handleVersionChange(v as TapTapVersion)}
              >
                <RadioGroup.Item
                  value="cn"
                  className={`flex-1 py-2.5 px-4 rounded-xl transition-[color,background-color,border-color,box-shadow] duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    taptapVersion === 'cn'
                      ? 'bg-blue-600 text-white shadow-lg border-2 border-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="font-medium">国内版</span>
                </RadioGroup.Item>
                <RadioGroup.Item
                  value="global"
                  className={`flex-1 py-2.5 px-4 rounded-xl transition-[color,background-color,border-color,box-shadow] duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    taptapVersion === 'global'
                      ? 'bg-blue-600 text-white shadow-lg border-2 border-blue-700'
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
            {isClient ? (
              <LoginFormPanel activeMethod={activeMethod} taptapVersion={taptapVersion} />
            ) : (
              <div className="flex items-center justify-center py-10">
                <span className="text-sm text-gray-600 dark:text-gray-400">正在加载…</span>
              </div>
            )}

            {/* 协议提示 — 放在表单卡片内，确保始终可见 */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 text-center">
              登录即表示您同意我们的
              <a href="/agreement" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                用户协议
              </a>
              {' '}和{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                隐私协议
              </a>
            </p>
          </div>
        </div>
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
