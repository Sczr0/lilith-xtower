'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { UnifiedApiDashboardShell } from './components/UnifiedApiDashboardShell';
import { UnifiedApiToolsSection } from './components/sections/UnifiedApiToolsSection';
import type { UnifiedApiSectionId } from './components/UnifiedApiSidebar';
import { extractErrorMessage, type AsyncState, tryParseJson } from './lib/unifiedApiDashboardUtils';
import { buttonStyles, cardStyles, cx, inputStyles } from '../components/ui/styles';
import { RotatingTips } from '../components/RotatingTips';
import { useAuth } from '../contexts/AuthContext';
import { AuthStorage } from '../lib/storage/auth';
import { UnifiedAPI } from '../lib/api/unified';
import type {
  UnifiedApiBindResponse,
  UnifiedApiTokenListResponse,
} from '../lib/types/unified-api';

const DEFAULT_API_TOKEN = 'pgrTk';
const SITE_PLATFORM = 'PhigrosQuery';

type UserIdResponse = { userId: string; userKind?: string | null };

const isUnifiedApiSectionId = (value: string): value is UnifiedApiSectionId =>
  value === 'bind' || value === 'accounts' || value === 'tools';

async function fetchSiteUserId(): Promise<string> {
  const res = await fetch('/api/auth/user-id', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  const payload = tryParseJson(text);

  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, `请求失败（${res.status}）`));
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('返回格式异常：缺少 userId');
  }

  const p = payload as Partial<UserIdResponse>;
  if (typeof p.userId !== 'string' || !p.userId.trim()) {
    throw new Error('返回格式异常：缺少 userId');
  }

  return p.userId.trim();
}

export default function UnifiedApiDashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<UnifiedApiSectionId>('bind');

  const syncSectionToUrl = (sectionId: UnifiedApiSectionId) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', sectionId);
      history.replaceState(null, '', url.toString());
    } catch {}
  };

  const handleSectionChange = (sectionId: UnifiedApiSectionId) => {
    setActiveSection(sectionId);
    syncSectionToUrl(sectionId);
  };

  // 说明：作为“另一个仪表盘”，这里与 /dashboard 保持一致的鉴权行为：未登录直接跳转 /login。
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // 说明：支持通过 query 直达指定分组，例如：/unified-api-dashboard?tab=tools
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get('tab');
      if (tab && isUnifiedApiSectionId(tab)) {
        setActiveSection(tab);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      try {
        const p = new URLSearchParams(window.location.search);
        const tab = p.get('tab');
        const nextSection = tab && isUnifiedApiSectionId(tab) ? tab : 'bind';
        setActiveSection(nextSection);
      } catch {}
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const [siteUserIdState, setSiteUserIdState] = useState<AsyncState<string>>({
    loading: false,
    error: null,
    data: null,
  });

  const [token, setToken] = useState('');
  const [apiUserId, setApiUserId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isGlobal, setIsGlobal] = useState(() => {
    // 说明：避免在构建/SSR 阶段访问 localStorage
    if (typeof window === 'undefined') return false;
    return AuthStorage.getTapTapVersion() === 'global';
  });

  const [bindState, setBindState] = useState<AsyncState<UnifiedApiBindResponse>>({
    loading: false,
    error: null,
    data: null,
  });
  const [tokenListState, setTokenListState] = useState<AsyncState<UnifiedApiTokenListResponse>>({
    loading: false,
    error: null,
    data: null,
  });

  const [showToken, setShowToken] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);

  // 说明：复制提示（轻量提示，不引入 toast 依赖）
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const copyText = async (value: string, label?: string) => {
    const text = value.trim();
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 说明：兼容性兜底（旧浏览器）
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', 'true');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopyHint(`已复制${label ? `：${label}` : ''}`);
    } catch {
      setCopyHint('复制失败，请手动复制');
    } finally {
      window.setTimeout(() => setCopyHint(null), 1600);
    }
  };

  useEffect(() => {
    // 说明：绑定成功后把 internal_id 回填到 api_user_id（不覆盖用户已手动输入的内容）
    const internalId = bindState.data?.data?.internal_id ? String(bindState.data.data.internal_id).trim() : '';
    if (!internalId) return;
    setApiUserId((prev) => (prev.trim() ? prev : internalId));
  }, [bindState.data?.data?.internal_id]);

  useEffect(() => {
    // 说明：根据本站登录凭证，向本站后端请求生成去敏 userId（本站ID）
    if (!isAuthenticated) {
      setSiteUserIdState({ loading: false, error: '请先登录本站以生成 userId', data: null });
      return;
    }

    let cancelled = false;
    setSiteUserIdState({ loading: true, error: null, data: null });
    fetchSiteUserId()
      .then((userId) => {
        if (cancelled) return;
        setSiteUserIdState({ loading: false, error: null, data: userId });
      })
      .catch((err) => {
        if (cancelled) return;
        setSiteUserIdState({
          loading: false,
          error: err instanceof Error ? err.message : '生成 userId 失败',
          data: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    // 说明：同步 TapTap 版本（是否国际服）；当用户切换版本后，userId 也可能不同
    if (typeof window === 'undefined') return;
    setIsGlobal(AuthStorage.getTapTapVersion() === 'global');
  }, []);

  const baseAuthReady = useMemo(() => {
    return !!(siteUserIdState.data?.trim() && token.trim());
  }, [siteUserIdState.data, token]);

  const internalId = bindState.data?.data?.internal_id ? String(bindState.data.data.internal_id) : '';

  const listAuthReady = useMemo(() => {
    return !!(token.trim() && apiUserId.trim() && apiToken.trim());
  }, [token, apiUserId, apiToken]);

  const authedReady = useMemo(() => {
    // 说明：需要“已登录 + 已绑定 + 已填写联合API Token”的功能（如：我的榜单/单曲排名）
    return !!(isAuthenticated && siteUserIdState.data?.trim() && token.trim() && apiUserId.trim() && apiToken.trim());
  }, [apiToken, apiUserId, isAuthenticated, siteUserIdState.data, token]);

  const authedPayload = useMemo(() => {
    return {
      platform: SITE_PLATFORM,
      platform_id: siteUserIdState.data?.trim() || '',
      token: token.trim(),
      api_user_id: apiUserId.trim(),
      api_token: apiToken.trim(),
    };
  }, [apiToken, apiUserId, siteUserIdState.data, token]);

  const runTokenList = async (args: { token: string; api_user_id: string; api_token: string }) => {
    setTokenListState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.tokenList({
        token: args.token,
        api_user_id: args.api_user_id,
        api_token: args.api_token,
      });
      setTokenListState({ loading: false, error: null, data: res });
    } catch (err) {
      setTokenListState({ loading: false, error: err instanceof Error ? err.message : '查询失败', data: null });
    }
  };

  const handleBind = async () => {
    if (!siteUserIdState.data?.trim()) {
      setBindState({ loading: false, error: '本站 userId 尚未就绪，请稍后重试或重新登录', data: null });
      return;
    }
    if (!token.trim()) {
      setBindState({ loading: false, error: '请填写 token（PhigrosToken / SessionToken）', data: null });
      return;
    }

    setBindState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.bind({
        platform: SITE_PLATFORM,
        platform_id: siteUserIdState.data.trim(),
        token: token.trim(),
        isGlobal: !!isGlobal,
      });

      setBindState({ loading: false, error: null, data: res });

      const apiUserIdForList = res?.data?.internal_id ? String(res.data.internal_id).trim() : '';
      if (apiUserIdForList && !apiUserId.trim()) {
        setApiUserId(apiUserIdForList);
      }
      const apiTokenForList = apiToken.trim();
      const tokenForList = token.trim();

      if (tokenForList && apiUserIdForList && apiTokenForList) {
        await runTokenList({ token: tokenForList, api_user_id: apiUserIdForList, api_token: apiTokenForList });
      }
    } catch (err) {
      setBindState({ loading: false, error: err instanceof Error ? err.message : '绑定失败', data: null });
    }
  };

  const handleRefreshList = async () => {
    const tokenForList = token.trim();
    const api_user_id = apiUserId.trim();
    const api_token = apiToken.trim();

    if (!tokenForList || !api_user_id || !api_token) {
      setTokenListState({ loading: false, error: '请先补全 token / internal_id / api_token', data: null });
      return;
    }

    await runTokenList({ token: tokenForList, api_user_id, api_token });
  };

  const isBusy = bindState.loading || tokenListState.loading;

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

  if (!isAuthenticated) return null;

  return (
    <UnifiedApiDashboardShell
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
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
              {copyHint && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{copyHint}</p>}
              {!isAuthenticated && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  当前未登录本站：无法生成本站 userId，无法完成绑定；请先登录。
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

        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md p-1">
            <button
              type="button"
              className={cx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeSection === 'bind'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-700/50'
              )}
              onClick={() => handleSectionChange('bind')}
            >
              绑定
            </button>
            <button
              type="button"
              className={cx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeSection === 'accounts'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-700/50'
              )}
              onClick={() => handleSectionChange('accounts')}
            >
              账号
            </button>
            <button
              type="button"
              className={cx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeSection === 'tools'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-700/50'
              )}
              onClick={() => handleSectionChange('tools')}
            >
              查询工具
            </button>
          </div>
        </div>

        {activeSection !== 'tools' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className={cardStyles({ tone: 'glass' })}>
            <h2 className="text-lg font-semibold mb-2">本站识别码（匿名）</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              登录后，本站会生成一个稳定的匿名识别码，用来在联合API中识别你（不包含昵称等信息）。
            </p>

            <div className="mt-4">
              {siteUserIdState.loading ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">生成中...</p>
              ) : siteUserIdState.error ? (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                  {siteUserIdState.error}
                </div>
              ) : siteUserIdState.data ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-neutral-950/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400">userId</div>
                      <div className="mt-1 font-mono text-sm break-all">{siteUserIdState.data}</div>
                    </div>
                    <button
                      type="button"
                      className={buttonStyles({ variant: 'outline', size: 'sm' })}
                      onClick={() => void copyText(siteUserIdState.data || '', 'userId')}
                      disabled={!siteUserIdState.data}
                    >
                      复制
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    绑定时会自动使用固定的平台标识（无需修改）。
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">暂无数据</p>
              )}
            </div>
          </section>

          <section className={cardStyles({ tone: 'glass' })}>
            <div className={activeSection === 'bind' ? 'block' : 'hidden'}>
              <h2 className="text-lg font-semibold mb-2">联合API 绑定</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              需要你提供 token（登录凭证，敏感信息）。绑定成功后会生成“联合API用户ID”（internal_id），后续查询会用到。
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">token（登录凭证）</label>
              <div className="flex gap-2">
                <input
                  className={inputStyles({ className: 'flex-1' })}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type={showToken ? 'text' : 'password'}
                  placeholder="token"
                  autoComplete="off"
                  disabled={!isAuthenticated}
                />
                <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => setShowToken((v) => !v)}>
                  {showToken ? '隐藏' : '显示'}
                </button>
              </div>
              {isAuthenticated && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  如果你不确定 token，可按文档获取后手动填写。出于安全考虑，本站不会在前端自动回填 SessionToken。
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input id="isGlobal" type="checkbox" className="h-4 w-4" checked={!!isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} />
              <label htmlFor="isGlobal" className="text-sm text-gray-700 dark:text-gray-300">
                国际服账号（可选）
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className={buttonStyles({ variant: 'primary' })} onClick={handleBind} disabled={isBusy || !baseAuthReady || !isAuthenticated}>
                {bindState.loading ? '绑定中...' : '绑定到联合API'}
              </button>
            </div>

            {(bindState.error || tokenListState.error) && (
              <div className="mt-4 space-y-2">
                {bindState.error && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                    绑定失败：{bindState.error}
                  </div>
                )}
                {tokenListState.error && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                    列表查询失败：{tokenListState.error}
                  </div>
                )}
              </div>
            )}

            {bindState.data && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
                  {bindState.data.message || '绑定成功'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-neutral-950/30 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">联合API用户ID（internal_id）</div>
                    <div className="mt-1 font-mono text-sm break-all">{bindState.data.data.internal_id}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-neutral-950/30 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">API Token 状态（haveApiToken）</div>
                    <div className="mt-1 font-mono text-sm">{bindState.data.data.haveApiToken}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">0=未设置；1=可用默认值；2=已自定义</div>
                  </div>
                </div>
              </div>
            )}

            </div>

            <div className={cx(activeSection === 'accounts' ? 'block' : 'hidden')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                  <h3 className="text-base font-semibold">已绑定平台账号</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      想查看你在联合API里绑定过哪些账号，需要填写：联合API用户ID（internal_id）与 API Token（api_token）。
                   </p>
                 </div>
                  <button className={buttonStyles({ variant: 'secondary', size: 'sm' })} onClick={handleRefreshList} disabled={isBusy || !listAuthReady}>
                    {tokenListState.loading ? '刷新中...' : '刷新列表'}
                  </button>
                </div>

                {tokenListState.error && (
                  <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                    列表查询失败：{tokenListState.error}
                  </div>
                )}

                {!listAuthReady && (
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                    提示：请补全{' '}
                    {[
                      token.trim() ? null : 'token（登录凭证）',
                      apiUserId.trim() ? null : '联合API用户ID（internal_id）',
                      apiToken.trim() ? null : 'API Token（api_token）',
                    ]
                      .filter((value): value is string => !!value)
                      .join(' / ')}
                    。
                    {bindState.data?.data?.haveApiToken === 1 && !apiToken.trim() ? (
                      <span className="ml-1">haveApiToken=1 时可直接点击「填入默认值」。</span>
                    ) : null}
                  </p>
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">联合API用户ID（api_user_id / internal_id）</label>
                  <div className="flex gap-2">
                    <input
                      id="unified-api-apiUserId"
                      className={inputStyles({ className: 'flex-1 font-mono' })}
                      value={apiUserId}
                      onChange={(e) => setApiUserId(e.target.value)}
                      placeholder={internalId || 'internal_id'}
                      autoComplete="off"
                      disabled={!isAuthenticated}
                    />
                    <button
                      type="button"
                      className={buttonStyles({ variant: 'outline', size: 'sm' })}
                      onClick={() => void copyText(apiUserId || internalId || '', 'api_user_id')}
                      disabled={!((apiUserId || internalId).trim())}
                      title="复制 api_user_id"
                    >
                      复制
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">提示：绑定成功后会自动回填；也支持手动填写（不会写入数据库）。</p>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">API Token（api_token）</label>
                  <div className="flex gap-2">
                    <input
                      id="unified-api-apiToken"
                      className={inputStyles({ className: 'flex-1' })}
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      type={showApiToken ? 'text' : 'password'}
                      placeholder="api_token"
                      autoComplete="off"
                      disabled={!isAuthenticated}
                    />
                    {!apiToken.trim() && (
                      <button
                        type="button"
                        className={buttonStyles({ variant: 'outline', size: 'sm' })}
                        onClick={() => setApiToken(DEFAULT_API_TOKEN)}
                        disabled={!isAuthenticated}
                        title={`填入默认值（${DEFAULT_API_TOKEN}）`}
                      >
                        填入默认值
                      </button>
                    )}
                    <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => setShowApiToken((v) => !v)}>
                      {showApiToken ? '隐藏' : '显示'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    提示：若上方 haveApiToken=1，可点击「填入默认值」使用 {DEFAULT_API_TOKEN}；否则请按联合API侧的实际值填写。
                  </p>
              </div>

              {tokenListState.data?.data?.platform_data?.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="py-2 pr-3">平台</th>
                        <th className="py-2 pr-3">平台ID</th>
                        <th className="py-2 pr-3">认证类型</th>
                        <th className="py-2 pr-3">更新时间</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {tokenListState.data.data.platform_data.map((p) => (
                        <tr key={`${p.platform_name}:${p.platform_id}`} className="border-t border-gray-200/70 dark:border-neutral-800/70">
                          <td className="py-2 pr-3">{p.platform_name}</td>
                          <td className="py-2 pr-3 font-mono break-all">{p.platform_id}</td>
                          <td className="py-2 pr-3 font-mono">{p.authentication}</td>
                          <td className="py-2 pr-3 font-mono break-all">{p.update_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {tokenListState.loading ? '加载中...' : '暂无数据（请先绑定或刷新列表）。'}
                </p>
              )}
            </div>
          </section>
        </div>
        )}

        {activeSection === 'tools' && (
          <UnifiedApiToolsSection
            authedReady={authedReady}
            authedPayload={authedPayload}
            onNeedCredentials={() => {
              handleSectionChange('accounts');
              if (typeof window === 'undefined') return;
              window.setTimeout(() => {
                const el = document.getElementById('unified-api-apiToken');
                if (el instanceof HTMLInputElement) {
                  el.focus();
                }
              }, 0);
            }}
            copyText={copyText}
          />
        )}
      </div>
    </UnifiedApiDashboardShell>
  );
}
