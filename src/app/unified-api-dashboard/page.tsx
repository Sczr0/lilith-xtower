'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { UnifiedApiDashboardShell } from './components/UnifiedApiDashboardShell';
import type { UnifiedApiSectionId } from './components/UnifiedApiSidebar';
import { buttonStyles, cardStyles, cx, inputStyles } from '../components/ui/styles';
import { RotatingTips } from '../components/RotatingTips';
import { useAuth } from '../contexts/AuthContext';
import { AuthStorage } from '../lib/storage/auth';
import { UnifiedAPI } from '../lib/api/unified';
import type {
  UnifiedApiBindResponse,
  UnifiedApiLevelKind,
  UnifiedApiPlayerIdListResponse,
  UnifiedApiRanklistResponse,
  UnifiedApiScoreListOrderBy,
  UnifiedApiScoreListUserResponse,
  UnifiedApiTokenListResponse,
} from '../lib/types/unified-api';

type AsyncState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

const DEFAULT_API_TOKEN = 'pgrTk';
const SITE_PLATFORM = 'PhigrosQuery';

type UserIdResponse = { userId: string; userKind?: string | null };

const isUnifiedApiSectionId = (value: string): value is UnifiedApiSectionId =>
  value === 'bind' || value === 'accounts' || value === 'tools';

const LEVEL_KINDS: UnifiedApiLevelKind[] = ['EZ', 'HD', 'IN', 'AT'];
const SCORE_LIST_ORDER_BY: UnifiedApiScoreListOrderBy[] = ['acc', 'score', 'fc', 'updated_at'];
const RESULT_MAX_ROWS = 50;

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

      const haveApiToken = res?.data?.haveApiToken;
      const shouldAutoFillDefaultApiToken = haveApiToken === 1 && !apiToken.trim();
      if (shouldAutoFillDefaultApiToken) {
        setApiToken(DEFAULT_API_TOKEN);
      }

      const apiUserIdForList = res?.data?.internal_id ? String(res.data.internal_id).trim() : '';
      if (apiUserIdForList && !apiUserId.trim()) {
        setApiUserId(apiUserIdForList);
      }
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
    const api_user_id = apiUserId.trim();
    const api_token = apiToken.trim();

    if (!tokenForList || !api_user_id || !api_token) {
      setTokenListState({ loading: false, error: '请先补全 token / internal_id / api_token', data: null });
      return;
    }

    await runTokenList({ token: tokenForList, api_user_id, api_token });
  };

  const isBusy = bindState.loading || tokenListState.loading;

  // -------------------------
  // 实用工具：用户名检索 / 排行榜 / 单曲排名
  // -------------------------
  const [playerIdKeyword, setPlayerIdKeyword] = useState('');
  const [playerIdMaxLength, setPlayerIdMaxLength] = useState('20');
  const [playerIdListState, setPlayerIdListState] = useState<AsyncState<UnifiedApiPlayerIdListResponse>>({
    loading: false,
    error: null,
    data: null,
  });

  const [rankQuery, setRankQuery] = useState('1');
  const [ranklistByRankState, setRanklistByRankState] = useState<AsyncState<UnifiedApiRanklistResponse>>({
    loading: false,
    error: null,
    data: null,
  });
  const [ranklistByUserState, setRanklistByUserState] = useState<AsyncState<UnifiedApiRanklistResponse>>({
    loading: false,
    error: null,
    data: null,
  });

  const [songId, setSongId] = useState('');
  const [songRank, setSongRank] = useState<UnifiedApiLevelKind>('IN');
  const [songOrderBy, setSongOrderBy] = useState<UnifiedApiScoreListOrderBy>('acc');
  const [scoreListUserState, setScoreListUserState] = useState<AsyncState<UnifiedApiScoreListUserResponse>>({
    loading: false,
    error: null,
    data: null,
  });

  const handleSearchPlayerId = async () => {
    const keyword = playerIdKeyword.trim();
    if (!keyword) {
      setPlayerIdListState({ loading: false, error: '请填写要检索的用户名（playerId）', data: null });
      return;
    }

    const maxLengthNumber = Number(playerIdMaxLength);
    const maxLength = Number.isFinite(maxLengthNumber) && maxLengthNumber > 0 ? maxLengthNumber : undefined;

    setPlayerIdListState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.searchPlayerIdList({ playerId: keyword, maxLength });
      setPlayerIdListState({ loading: false, error: null, data: res });
    } catch (err) {
      setPlayerIdListState({ loading: false, error: err instanceof Error ? err.message : '检索失败', data: null });
    }
  };

  const handleRanklistByRank = async () => {
    const rankNumber = Number(rankQuery);
    if (!Number.isFinite(rankNumber) || rankNumber <= 0) {
      setRanklistByRankState({ loading: false, error: '名次必须是大于 0 的数字', data: null });
      return;
    }

    setRanklistByRankState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.getRanklistByRank({ request_rank: Math.floor(rankNumber) });
      setRanklistByRankState({ loading: false, error: null, data: res });
    } catch (err) {
      setRanklistByRankState({ loading: false, error: err instanceof Error ? err.message : '查询失败', data: null });
    }
  };

  const handleRanklistByUser = async () => {
    if (!authedReady) {
      setRanklistByUserState({
        loading: false,
        error: '请先登录本站并完成绑定，然后填写“联合API用户ID”和“API Token”。',
        data: null,
      });
      return;
    }

    setRanklistByUserState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.getRanklistByUser(authedPayload);
      setRanklistByUserState({ loading: false, error: null, data: res });
    } catch (err) {
      setRanklistByUserState({ loading: false, error: err instanceof Error ? err.message : '查询失败', data: null });
    }
  };

  const handleScoreListByUser = async () => {
    const songIdValue = songId.trim();
    if (!authedReady) {
      setScoreListUserState({
        loading: false,
        error: '请先登录本站并完成绑定，然后填写“联合API用户ID”和“API Token”。',
        data: null,
      });
      return;
    }
    if (!songIdValue) {
      setScoreListUserState({ loading: false, error: '请填写歌曲ID（songId）（例如：光.姜米條.0）', data: null });
      return;
    }

    setScoreListUserState({ loading: true, error: null, data: null });
    try {
      const res = await UnifiedAPI.getScoreListByUser({
        ...authedPayload,
        songId: songIdValue,
        rank: songRank,
        orderBy: songOrderBy,
      });
      setScoreListUserState({ loading: false, error: null, data: res });
    } catch (err) {
      setScoreListUserState({ loading: false, error: err instanceof Error ? err.message : '查询失败', data: null });
    }
  };

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
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">0=未设置；1=可用默认值 {DEFAULT_API_TOKEN}；2=已自定义</div>
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
                      placeholder={DEFAULT_API_TOKEN}
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
                    提示：若上方 haveApiToken=1，通常可直接使用默认值 {DEFAULT_API_TOKEN}；否则请按联合API侧的实际值填写。
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
          <>
            <section className={cardStyles({ tone: 'glass', padding: 'md' })}>
          <div>
            <h2 className="text-lg font-semibold">查询工具</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              这里提供一些常用查询：搜用户名、查排行榜、查单曲排名。
              需要“我的数据”的功能，请先完成绑定并填好“联合API用户ID”和“API Token”。
            </p>
            {!authedReady && (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  当前缺少凭证信息，部分查询将不可用。
                </p>
                <button
                  type="button"
                  className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                  onClick={() => {
                    handleSectionChange('accounts');
                    if (typeof window === 'undefined') return;
                    window.setTimeout(() => {
                      const el = document.getElementById('unified-api-apiToken');
                      if (el instanceof HTMLInputElement) {
                        el.focus();
                      }
                    }, 0);
                  }}
                >
                  去填写凭证
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className={cardStyles({ tone: 'glass' })}>
            <h3 className="text-base font-semibold">搜索用户名</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              输入用户名关键词，可返回可能的候选列表与对应的联合API ID（apiId）。
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">用户名（关键词）</label>
                <input
                  className={inputStyles({})}
                  value={playerIdKeyword}
                  onChange={(e) => setPlayerIdKeyword(e.target.value)}
                  placeholder="例如：Lilith"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">最多返回条数（可选）</label>
                <input
                  className={inputStyles({ className: 'font-mono' })}
                  value={playerIdMaxLength}
                  onChange={(e) => setPlayerIdMaxLength(e.target.value)}
                  placeholder="20"
                  inputMode="numeric"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={buttonStyles({ variant: 'primary' })} onClick={handleSearchPlayerId} disabled={playerIdListState.loading || !playerIdKeyword.trim()}>
                  {playerIdListState.loading ? '检索中...' : '检索'}
                </button>
                <button
                  className={buttonStyles({ variant: 'secondary' })}
                  onClick={() => {
                    setPlayerIdListState({ loading: false, error: null, data: null });
                    setPlayerIdKeyword('');
                  }}
                  disabled={playerIdListState.loading}
                >
                  清空
                </button>
              </div>

              {playerIdListState.error && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                  {playerIdListState.error}
                </div>
              )}

              {playerIdListState.data?.data?.length ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="py-2 pr-3">用户名</th>
                        <th className="py-2 pr-3">联合API ID</th>
                        <th className="py-2 pr-3">操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {playerIdListState.data.data.slice(0, RESULT_MAX_ROWS).map((item) => (
                        <tr key={`${item.apiId}:${item.playerId}`} className="border-t border-gray-200/70 dark:border-neutral-800/70">
                          <td className="py-2 pr-3 break-all">{item.playerId}</td>
                          <td className="py-2 pr-3 font-mono break-all">{item.apiId}</td>
                          <td className="py-2 pr-3">
                            <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => void copyText(item.apiId, 'apiId')}>
                              复制 apiId
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {playerIdListState.data.data.length > RESULT_MAX_ROWS && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">仅展示前 {RESULT_MAX_ROWS} 条结果。</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{playerIdListState.loading ? '加载中...' : '暂无数据'}</p>
              )}

              {playerIdListState.data && (
                <details className="mt-4">
                  <summary className="cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400">查看原始响应 JSON</summary>
                  <pre className="mt-3 p-3 rounded bg-gray-100/70 dark:bg-gray-900/50 overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
                    <code>{JSON.stringify(playerIdListState.data, null, 2)}</code>
                  </pre>
                </details>
              )}
            </div>
          </section>

          <section className={cardStyles({ tone: 'glass' })}>
            <h3 className="text-base font-semibold">排行榜查询</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              可以按名次查看榜单，也可以查询“我”的榜单信息（需要先绑定并填写 Token）。
            </p>

            <div className="mt-4 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">按名次查询</div>
                  <button className={buttonStyles({ variant: 'primary', size: 'sm' })} onClick={handleRanklistByRank} disabled={ranklistByRankState.loading || !rankQuery.trim()}>
                    {ranklistByRankState.loading ? '查询中...' : '查询'}
                  </button>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-2">名次（例如：1）</label>
                  <input className={inputStyles({ className: 'font-mono' })} value={rankQuery} onChange={(e) => setRankQuery(e.target.value)} placeholder="1" inputMode="numeric" />
                </div>

                {ranklistByRankState.error && (
                  <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                    {ranklistByRankState.error}
                  </div>
                )}

                {ranklistByRankState.data?.data?.users?.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 dark:text-gray-400">
                          <th className="py-2 pr-3">名次</th>
                          <th className="py-2 pr-3">用户名</th>
                          <th className="py-2 pr-3">RKS</th>
                          <th className="py-2 pr-3">挑战名次</th>
                          <th className="py-2 pr-3">更新时间</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-800 dark:text-gray-200">
                        {ranklistByRankState.data.data.users.slice(0, RESULT_MAX_ROWS).map((row) => (
                          <tr key={`${row.index}:${row.saveInfo?.PlayerId ?? ''}`} className="border-t border-gray-200/70 dark:border-neutral-800/70">
                            <td className="py-2 pr-3 font-mono">{row.index}</td>
                            <td className="py-2 pr-3 break-all">{row.saveInfo?.PlayerId || '-'}</td>
                            <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.rankingScore ?? '-'}</td>
                            <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.challengeModeRank ?? '-'}</td>
                            <td className="py-2 pr-3 font-mono break-all">{row.saveInfo?.modifiedAt?.iso ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{ranklistByRankState.loading ? '加载中...' : '暂无数据'}</p>
                )}

                {ranklistByRankState.data && (
                  <details className="mt-3">
                    <summary className="cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400">查看原始响应 JSON</summary>
                    <pre className="mt-3 p-3 rounded bg-gray-100/70 dark:bg-gray-900/50 overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
                      <code>{JSON.stringify(ranklistByRankState.data, null, 2)}</code>
                    </pre>
                  </details>
                )}
              </div>

              <div className="border-t border-gray-200/60 dark:border-neutral-800/60 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">查我的榜单信息</div>
                  <button className={buttonStyles({ variant: 'primary', size: 'sm' })} onClick={handleRanklistByUser} disabled={ranklistByUserState.loading || !authedReady}>
                    {ranklistByUserState.loading ? '查询中...' : '查询'}
                  </button>
                </div>
                {!authedReady && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    需要登录信息：请先完成绑定，并填写“联合API用户ID”和“API Token”。
                  </p>
                )}

                {ranklistByUserState.error && (
                  <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                    {ranklistByUserState.error}
                  </div>
                )}

                {ranklistByUserState.data?.data?.users?.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 dark:text-gray-400">
                          <th className="py-2 pr-3">名次</th>
                          <th className="py-2 pr-3">用户名</th>
                          <th className="py-2 pr-3">RKS</th>
                          <th className="py-2 pr-3">挑战名次</th>
                          <th className="py-2 pr-3">更新时间</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-800 dark:text-gray-200">
                        {ranklistByUserState.data.data.users.slice(0, RESULT_MAX_ROWS).map((row) => (
                          <tr key={`${row.index}:${row.saveInfo?.PlayerId ?? ''}`} className="border-t border-gray-200/70 dark:border-neutral-800/70">
                            <td className="py-2 pr-3 font-mono">{row.index}</td>
                            <td className="py-2 pr-3 break-all">{row.saveInfo?.PlayerId || '-'}</td>
                            <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.rankingScore ?? '-'}</td>
                            <td className="py-2 pr-3 font-mono">{row.saveInfo?.summary?.challengeModeRank ?? '-'}</td>
                            <td className="py-2 pr-3 font-mono break-all">{row.saveInfo?.modifiedAt?.iso ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ranklistByUserState.data.data.users.length > RESULT_MAX_ROWS && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">仅展示前 {RESULT_MAX_ROWS} 条结果。</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{ranklistByUserState.loading ? '加载中...' : '暂无数据'}</p>
                )}

                {ranklistByUserState.data && (
                  <details className="mt-3">
                    <summary className="cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400">查看原始响应 JSON</summary>
                    <pre className="mt-3 p-3 rounded bg-gray-100/70 dark:bg-gray-900/50 overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
                      <code>{JSON.stringify(ranklistByUserState.data, null, 2)}</code>
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </section>

          <section className={cardStyles({ tone: 'glass' })}>
            <h3 className="text-base font-semibold">单曲成绩排名</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              输入歌曲ID与难度，可查询你在该谱面的名次与附近榜单片段（需要先绑定并填写 Token）。
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">歌曲ID（songId）</label>
                <input className={inputStyles({ className: 'font-mono' })} value={songId} onChange={(e) => setSongId(e.target.value)} placeholder="例如：光.姜米條.0" autoComplete="off" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">难度（rank）</label>
                  <select className={inputStyles({ className: 'bg-white dark:bg-neutral-950' })} value={songRank} onChange={(e) => setSongRank(e.target.value as UnifiedApiLevelKind)}>
                    {LEVEL_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">排序方式（orderBy）</label>
                  <select
                    className={inputStyles({ className: 'bg-white dark:bg-neutral-950' })}
                    value={songOrderBy}
                    onChange={(e) => setSongOrderBy(e.target.value as UnifiedApiScoreListOrderBy)}
                  >
                    {SCORE_LIST_ORDER_BY.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={buttonStyles({ variant: 'primary' })} onClick={handleScoreListByUser} disabled={scoreListUserState.loading || !songId.trim() || !authedReady}>
                  {scoreListUserState.loading ? '查询中...' : '查询'}
                </button>
                <button
                  className={buttonStyles({ variant: 'secondary' })}
                  onClick={() => {
                    setScoreListUserState({ loading: false, error: null, data: null });
                    setSongId('');
                  }}
                  disabled={scoreListUserState.loading}
                >
                  清空
                </button>
              </div>

              {!authedReady && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  需要登录信息：请先完成绑定，并填写“联合API用户ID”和“API Token”。
                </p>
              )}

              {scoreListUserState.error && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                  {scoreListUserState.error}
                </div>
              )}

              {scoreListUserState.data?.data?.users?.length ? (
                <div className="mt-2 space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    总人数：{scoreListUserState.data.data.totDataNum}，你的名次：{scoreListUserState.data.data.userRank}（userRank）
                    <button
                      type="button"
                      className={buttonStyles({ variant: 'outline', size: 'sm', className: 'ml-2' })}
                      onClick={() => void copyText(String(scoreListUserState.data?.data?.userRank ?? ''), 'userRank')}
                      disabled={scoreListUserState.data.data.userRank == null}
                    >
                      复制名次
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 dark:text-gray-400">
                          <th className="py-2 pr-3">名次</th>
                          <th className="py-2 pr-3">用户名</th>
                          <th className="py-2 pr-3">分数</th>
                          <th className="py-2 pr-3">准确率</th>
                          <th className="py-2 pr-3">FC</th>
                          <th className="py-2 pr-3">更新时间</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-800 dark:text-gray-200">
                        {scoreListUserState.data.data.users.slice(0, RESULT_MAX_ROWS).map((row) => (
                          <tr key={`${row.index}:${row.gameuser?.PlayerId ?? ''}`} className="border-t border-gray-200/70 dark:border-neutral-800/70">
                            <td className="py-2 pr-3 font-mono">{row.index}</td>
                            <td className="py-2 pr-3 break-all">{row.gameuser?.PlayerId || '-'}</td>
                            <td className="py-2 pr-3 font-mono">{row.record?.score ?? '-'}</td>
                            <td className="py-2 pr-3 font-mono">{row.record?.acc ?? '-'}</td>
                            <td className="py-2 pr-3 font-mono">{row.record?.fc ?? '-'}</td>
                            <td className="py-2 pr-3 font-mono break-all">{row.record?.updated_at ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {scoreListUserState.data.data.users.length > RESULT_MAX_ROWS && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">仅展示前 {RESULT_MAX_ROWS} 条结果。</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{scoreListUserState.loading ? '加载中...' : '暂无数据'}</p>
              )}

              {scoreListUserState.data && (
                <details className="mt-4">
                  <summary className="cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400">查看原始响应 JSON</summary>
                  <pre className="mt-3 p-3 rounded bg-gray-100/70 dark:bg-gray-900/50 overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
                    <code>{JSON.stringify(scoreListUserState.data, null, 2)}</code>
                  </pre>
                </details>
              )}
            </div>
          </section>
        </div>
          </>
        )}
      </div>
    </UnifiedApiDashboardShell>
  );
}
