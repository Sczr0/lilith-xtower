'use client';

import { buttonStyles, cardStyles } from '../components/ui/styles';
import { RotatingTips } from '../components/RotatingTips';

import { UnifiedApiDashboardShell } from './components/UnifiedApiDashboardShell';
import { UnifiedApiMobileTabs } from './components/UnifiedApiMobileTabs';
import { UnifiedApiAccountsSection } from './components/sections/UnifiedApiAccountsSection';
import { UnifiedApiBindSection } from './components/sections/UnifiedApiBindSection';
import { UnifiedApiSiteUserIdSection } from './components/sections/UnifiedApiSiteUserIdSection';
import { UnifiedApiToolsSection } from './components/sections/UnifiedApiToolsSection';
import { useUnifiedApiDashboard } from './hooks/useUnifiedApiDashboard';

const DEFAULT_API_TOKEN = 'pgrTk';

export default function UnifiedApiDashboardPage() {
  const {
    isAuthenticated,
    isLoading,
    activeSection,
    handleSectionChange,
    siteUserIdState,
    token,
    setToken,
    showToken,
    setShowToken,
    isGlobal,
    setIsGlobal,
    bindState,
    tokenListState,
    apiUserId,
    setApiUserId,
    apiToken,
    setApiToken,
    showApiToken,
    setShowApiToken,
    copyHint,
    copyText,
    baseAuthReady,
    listAuthReady,
    authedReady,
    internalId,
    isBusy,
    authedPayload,
    handleBind,
    handleRefreshList,
  } = useUnifiedApiDashboard();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <h1 className="sr-only">正在加载联合API仪表盘 - Phigros Query</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <RotatingTips />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // 说明：鉴权失败会在 hook 内触发 router.replace('/login')。
    // 这里返回占位 UI，避免短暂白屏直到跳转完成。
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">正在跳转到登录页…</div>
      </div>
    );
  }

  return (
    <UnifiedApiDashboardShell activeSection={activeSection} onSectionChange={handleSectionChange}>
      <div className="space-y-6">
        <section className={cardStyles({ tone: 'glass', padding: 'md' })}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">联合API 接入</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                按“绑定 / 账号 / 查询工具”分组操作（本站不会保存你填写的凭证）。
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                说明：所有请求都会通过本站服务器转发（避免浏览器限制），不会把你填写的 token / API Token 写入数据库。
              </p>
              {copyHint && (
                <p
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-2 text-xs text-emerald-700 dark:text-emerald-300"
                >
                  {copyHint}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
                href="https://s.apifox.cn/67f5ad8d-931b-429e-b456-e9dea1161e77/llms.txt"
                target="_blank"
                rel="noreferrer"
              >
                查看联合API文档
              </a>
            </div>
          </div>
        </section>

        <UnifiedApiMobileTabs activeSection={activeSection} onSectionChange={handleSectionChange} />

        {activeSection !== 'tools' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UnifiedApiSiteUserIdSection siteUserIdState={siteUserIdState} copyText={copyText} />
            {activeSection === 'bind' ? (
              <UnifiedApiBindSection
                isAuthenticated={isAuthenticated}
                token={token}
                setToken={setToken}
                showToken={showToken}
                setShowToken={setShowToken}
                isGlobal={isGlobal}
                setIsGlobal={setIsGlobal}
                baseAuthReady={baseAuthReady}
                isBusy={isBusy}
                bindState={bindState}
                tokenListState={tokenListState}
                handleBind={handleBind}
              />
            ) : (
              <UnifiedApiAccountsSection
                isAuthenticated={isAuthenticated}
                token={token}
                apiUserId={apiUserId}
                setApiUserId={setApiUserId}
                apiToken={apiToken}
                setApiToken={setApiToken}
                showApiToken={showApiToken}
                setShowApiToken={setShowApiToken}
                internalId={internalId}
                defaultApiToken={DEFAULT_API_TOKEN}
                copyText={copyText}
                bindState={bindState}
                tokenListState={tokenListState}
                listAuthReady={listAuthReady}
                isBusy={isBusy}
                handleRefreshList={handleRefreshList}
              />
            )}
          </div>
        ) : (
          <UnifiedApiToolsSection
            authedReady={authedReady}
            authedPayload={authedPayload}
            onNeedCredentials={() => {
              handleSectionChange('accounts');
              window.setTimeout(() => {
                const el = document.getElementById('unified-api-apiToken');
                if (el instanceof HTMLInputElement) el.focus();
              }, 0);
            }}
            copyText={copyText}
          />
        )}
      </div>
    </UnifiedApiDashboardShell>
  );
}
