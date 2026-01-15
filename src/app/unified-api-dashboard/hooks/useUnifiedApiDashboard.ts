'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { UnifiedApiSectionId } from '../components/UnifiedApiSidebar';
import { extractErrorMessage, type AsyncState, tryParseJson } from '../lib/unifiedApiDashboardUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useClientValue } from '../../hooks/useClientValue';
import { AuthStorage } from '../../lib/storage/auth';
import { UnifiedAPI } from '../../lib/api/unified';
import type { UnifiedApiBindResponse, UnifiedApiTokenListResponse } from '../../lib/types/unified-api';

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

export type UnifiedApiDashboardModel = {
  isAuthenticated: boolean;
  isLoading: boolean;
  activeSection: UnifiedApiSectionId;
  handleSectionChange: (sectionId: UnifiedApiSectionId) => void;

  siteUserIdState: AsyncState<string>;

  token: string;
  setToken: (value: string) => void;
  showToken: boolean;
  setShowToken: React.Dispatch<React.SetStateAction<boolean>>;

  isGlobal: boolean;
  setIsGlobal: (value: boolean) => void;

  bindState: AsyncState<UnifiedApiBindResponse>;
  tokenListState: AsyncState<UnifiedApiTokenListResponse>;

  apiUserId: string;
  setApiUserId: (value: string) => void;
  apiToken: string;
  setApiToken: (value: string) => void;
  showApiToken: boolean;
  setShowApiToken: React.Dispatch<React.SetStateAction<boolean>>;

  copyHint: string | null;
  copyText: (value: string, label?: string) => Promise<void>;

  baseAuthReady: boolean;
  listAuthReady: boolean;
  authedReady: boolean;
  internalId: string;
  isBusy: boolean;

  authedPayload: {
    platform: string;
    platform_id: string;
    token: string;
    api_user_id: string;
    api_token: string;
  };

  handleBind: () => Promise<void>;
  handleRefreshList: () => Promise<void>;
};

export function useUnifiedApiDashboard(): UnifiedApiDashboardModel {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 说明：与 /dashboard 保持一致，以 query 参数作为“单一来源”。
  const activeSection = useMemo<UnifiedApiSectionId>(() => {
    const tab = searchParams.get('tab');
    return tab && isUnifiedApiSectionId(tab) ? tab : 'bind';
  }, [searchParams]);

  const handleSectionChange = (sectionId: UnifiedApiSectionId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sectionId === 'bind') {
      params.delete('tab');
    } else {
      params.set('tab', sectionId);
    }

    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  // 说明：作为“另一个仪表盘”，这里与 /dashboard 保持一致的鉴权行为：未登录直接跳转 /login。
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const [siteUserIdState, setSiteUserIdState] = useState<AsyncState<string>>({
    loading: false,
    error: null,
    data: null,
  });

  const [token, setToken] = useState('');
  const [apiUserId, setApiUserId] = useState('');
  const [apiToken, setApiToken] = useState('');

  // 说明：默认跟随 TapTap 版本（localStorage），但允许用户手动勾选覆盖。
  const isGlobalFromStorage = useClientValue(() => AuthStorage.getTapTapVersion() === 'global', false);
  const [isGlobalOverride, setIsGlobalOverride] = useState<boolean | null>(null);
  const isGlobal = isGlobalOverride ?? isGlobalFromStorage;
  const setIsGlobal = (value: boolean) => setIsGlobalOverride(value);

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

  // 说明：敏感字段“明文显示”增加防误触兜底 —— 显示后短时间自动回隐藏
  useEffect(() => {
    if (!showToken) return;
    const timer = window.setTimeout(() => setShowToken(false), 15_000);
    return () => window.clearTimeout(timer);
  }, [showToken]);

  useEffect(() => {
    if (!showApiToken) return;
    const timer = window.setTimeout(() => setShowApiToken(false), 15_000);
    return () => window.clearTimeout(timer);
  }, [showApiToken]);

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

  const baseAuthReady = useMemo(() => !!(siteUserIdState.data?.trim() && token.trim()), [siteUserIdState.data, token]);

  const internalId = bindState.data?.data?.internal_id ? String(bindState.data.data.internal_id) : '';

  const listAuthReady = useMemo(() => !!(token.trim() && apiUserId.trim() && apiToken.trim()), [token, apiUserId, apiToken]);

  const authedReady = useMemo(() => {
    // 说明：需要“已登录 + 已绑定 + 已填写联合API Token”的功能（如：我的榜单/单曲排名）
    return !!(isAuthenticated && siteUserIdState.data?.trim() && token.trim() && apiUserId.trim() && apiToken.trim());
  }, [apiToken, apiUserId, isAuthenticated, siteUserIdState.data, token]);

  const authedPayload = useMemo(
    () => ({
      platform: SITE_PLATFORM,
      platform_id: siteUserIdState.data?.trim() || '',
      token: token.trim(),
      api_user_id: apiUserId.trim(),
      api_token: apiToken.trim(),
    }),
    [apiToken, apiUserId, siteUserIdState.data, token],
  );

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

  return {
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
  };
}
