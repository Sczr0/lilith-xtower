'use client';

import { useCallback, useEffect, useState } from 'react';
import { Github, LogOut, RefreshCw } from 'lucide-react';
import { buttonStyles } from '../../components/ui/styles';
import { extractProblemMessage, parseDeveloperMeResponse, type OpenPlatformDeveloper } from '../lib/auth';

type AuthPanelState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; developer: OpenPlatformDeveloper }
  | { status: 'error'; message: string };

const GITHUB_LOGIN_HREF = '/api/auth/github/login';

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  return response.json().catch(() => null);
}

/**
 * 开放平台登录面板：
 * - 统一展示 GitHub 登录入口
 * - 检查当前开发者会话状态
 * - 支持主动退出登录
 */
export function OpenPlatformAuthPanel() {
  const [state, setState] = useState<AuthPanelState>({ status: 'loading' });
  const [isBusy, setIsBusy] = useState(false);

  const refreshMe = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await readPayload(response);

      if (response.status === 401) {
        setState({ status: 'unauthenticated' });
        return;
      }

      if (!response.ok) {
        const message = extractProblemMessage(payload) ?? `获取登录状态失败（${response.status}）`;
        setState({ status: 'error', message });
        return;
      }

      const developer = parseDeveloperMeResponse(payload);
      if (!developer) {
        setState({ status: 'error', message: '登录状态响应格式不正确，请检查后端返回。' });
        return;
      }

      setState({ status: 'authenticated', developer });
    } catch {
      setState({ status: 'error', message: '网络异常，无法获取登录状态。' });
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsBusy(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
    } finally {
      setIsBusy(false);
      await refreshMe();
    }
  }, [refreshMe]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  return (
    <section className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">开发者登录</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            使用 GitHub 登录后可申请和管理开放平台 API Key。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshMe()}
          disabled={isBusy}
          className={buttonStyles({ size: 'sm', variant: 'outline' })}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          刷新状态
        </button>
      </div>

      {state.status === 'loading' && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
          正在检查开发者登录状态...
        </div>
      )}

      {state.status === 'unauthenticated' && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between rounded-lg border border-gray-200 dark:border-neutral-800 px-4 py-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">当前未登录开发者账户。</p>
          <a href={GITHUB_LOGIN_HREF} className={buttonStyles({ size: 'sm', variant: 'primary' })}>
            <Github className="h-4 w-4" aria-hidden="true" />
            使用 GitHub 登录
          </a>
        </div>
      )}

      {state.status === 'authenticated' && (
        <div className="space-y-4 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-4">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">已登录开发者账号。</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">GitHub</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">@{state.developer.githubLogin}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">邮箱</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{state.developer.email ?? '未公开'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">角色</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{state.developer.role}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">状态</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{state.developer.status}</dd>
            </div>
          </dl>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="/unified-api-dashboard" className={buttonStyles({ size: 'sm', variant: 'primary' })}>
              前往开发者仪表盘
            </a>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isBusy}
              className={buttonStyles({ size: 'sm', variant: 'danger' })}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              退出登录
            </button>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {state.message}
        </div>
      )}
    </section>
  );
}
