'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { SimpleHeader } from '../components/SimpleHeader';
import { buttonStyles, cardStyles, inputStyles } from '../components/ui/styles';
import { useAuth } from '../contexts/AuthContext';
import type { AuthCredential } from '../lib/types/auth';
import { buildAuthRequestBody } from '../lib/api/auth';
import { AuthStorage } from '../lib/storage/auth';
import { UnifiedAPI } from '../lib/api/unified';
import type { UnifiedApiBindResponse, UnifiedApiTokenListResponse } from '../lib/types/unified-api';

type AsyncState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

const DEFAULT_API_TOKEN = 'pgrTk';
const SITE_PLATFORM = 'PhigrosQuery';

type UserIdResponse = { userId: string; userKind?: string | null };

const tryParseJson = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback;
  const p = payload as Record<string, unknown>;
  const error = typeof p.error === 'string' ? p.error : undefined;
  const message = typeof p.message === 'string' ? p.message : undefined;
  return error || message || fallback;
};

async function fetchSiteUserId(credential: AuthCredential): Promise<string> {
  const res = await fetch('/api/auth/user-id', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(buildAuthRequestBody(credential)),
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

export default function UnifiedApiPage() {
  const { credential, isAuthenticated } = useAuth();

  const [siteUserIdState, setSiteUserIdState] = useState<AsyncState<string>>({
    loading: false,
    error: null,
    data: null,
  });

  const [token, setToken] = useState('');
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

  useEffect(() => {
    // 说明：当前登录为 session 时，尽量把 SessionToken 回填到 token 输入框（不覆盖用户已输入的内容）
    if (!credential || token.trim()) return;
    if (credential.type !== 'session') return;
    setToken(credential.token);
  }, [credential, token]);

  useEffect(() => {
    // 说明：根据本站登录凭证，向本站后端请求生成去敏 userId（本站ID）
    if (!credential) {
      setSiteUserIdState({ loading: false, error: '请先登录本站以生成 userId', data: null });
      return;
    }

    let cancelled = false;
    setSiteUserIdState({ loading: true, error: null, data: null });
    fetchSiteUserId(credential)
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
  }, [credential]);

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
    return !!(token.trim() && internalId.trim() && apiToken.trim());
  }, [token, internalId, apiToken]);

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

      const haveApiToken = res?.data?.haveApiToken;
      const shouldAutoFillDefaultApiToken = haveApiToken === 1 && !apiToken.trim();
      if (shouldAutoFillDefaultApiToken) {
        setApiToken(DEFAULT_API_TOKEN);
      }

      const apiUserIdForList = res?.data?.internal_id ? String(res.data.internal_id).trim() : '';
      const apiTokenForList = (apiToken.trim() || (shouldAutoFillDefaultApiToken ? DEFAULT_API_TOKEN : '')).trim();
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
    const api_user_id = internalId.trim();
    const api_token = apiToken.trim();

    if (!tokenForList || !api_user_id || !api_token) {
      setTokenListState({ loading: false, error: '请先补全 token / internal_id / api_token', data: null });
      return;
    }

    await runTokenList({ token: tokenForList, api_user_id, api_token });
  };

  const isBusy = bindState.loading || tokenListState.loading;

  return (
    <PageShell variant="gradient" header={<SimpleHeader />} containerClassName="mx-auto max-w-6xl">
      <div className="space-y-6">
        <section className={cardStyles({ tone: 'glass', padding: 'md' })}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">联合API 绑定</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                将本站后端生成的去敏 userId（本站ID）绑定到第三方「联合查分 API」，并展示你已绑定的所有平台账号。
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                说明：本站通过 <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-900">/api/unified</code> 代理转发请求（默认上游：phib19.top:8080），不会把你填写的凭证写入数据库。
              </p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className={cardStyles({ tone: 'glass' })}>
            <h2 className="text-lg font-semibold mb-2">本站 userId（去敏）</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              本站会根据你当前的登录凭证，在后端生成稳定的去敏 userId。绑定时会把它作为联合API里的 <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-900">platform_id</code>。
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
                  <div className="text-xs text-gray-500 dark:text-gray-400">userId</div>
                  <div className="mt-1 font-mono text-sm break-all">{siteUserIdState.data}</div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    将使用 platform=<span className="font-mono">{SITE_PLATFORM}</span> 进行绑定。
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">暂无数据</p>
              )}
            </div>
          </section>

          <section className={cardStyles({ tone: 'glass' })}>
            <h2 className="text-lg font-semibold mb-2">联合API 绑定</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              绑定需要联合API文档中的 <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-900">token</code> 字段（敏感信息）。绑定成功后会返回 internal_id（用于查询已绑定账号列表）。
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">token（PhigrosToken / SessionToken）</label>
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
              {credential?.type !== 'session' && isAuthenticated && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  当前登录方式不是 SessionToken：如无法确定 token，请手动填写。
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input id="isGlobal" type="checkbox" className="h-4 w-4" checked={!!isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} />
              <label htmlFor="isGlobal" className="text-sm text-gray-700 dark:text-gray-300">
                国际服（isGlobal）
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className={buttonStyles({ variant: 'primary' })} onClick={handleBind} disabled={isBusy || !baseAuthReady || !isAuthenticated}>
                {bindState.loading ? '绑定中...' : '绑定（本站 userId → 联合API）'}
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">internal_id</div>
                    <div className="mt-1 font-mono text-sm break-all">{bindState.data.data.internal_id}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-neutral-950/30 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">haveApiToken</div>
                    <div className="mt-1 font-mono text-sm">{bindState.data.data.haveApiToken}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">0=未设置，1=默认 {DEFAULT_API_TOKEN}，2=已自定义</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold">已绑定平台账号</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    查询需要 <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-900">internal_id + api_token</code>；internal_id 将由绑定接口返回。
                  </p>
                </div>
                <button className={buttonStyles({ variant: 'secondary', size: 'sm' })} onClick={handleRefreshList} disabled={isBusy || !listAuthReady}>
                  {tokenListState.loading ? '刷新中...' : '刷新列表'}
                </button>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">api_token（用于 /token/list）</label>
                <div className="flex gap-2">
                  <input
                    className={inputStyles({ className: 'flex-1' })}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    type={showApiToken ? 'text' : 'password'}
                    placeholder={DEFAULT_API_TOKEN}
                    autoComplete="off"
                    disabled={!internalId}
                  />
                  <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => setShowApiToken((v) => !v)}>
                    {showApiToken ? '隐藏' : '显示'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  提示：haveApiToken=1 时默认是 {DEFAULT_API_TOKEN}；haveApiToken=0/2 时请按联合API侧的实际值填写。
                </p>
              </div>

              {tokenListState.data?.data?.platform_data?.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="py-2 pr-3">platform</th>
                        <th className="py-2 pr-3">platform_id</th>
                        <th className="py-2 pr-3">authentication</th>
                        <th className="py-2 pr-3">update_at</th>
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
      </div>
    </PageShell>
  );
}
