'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';

import { RotatingTips } from '../components/RotatingTips';
import { SessionExpiredModal } from '../components/SessionExpiredModal';
import { AuthAPI } from '../lib/api/auth';
import {
  detectGlobalBanFromResponse,
  shouldInspectBanForRequest,
} from '../lib/auth/banGuard';
import type { AuthCredentialSummary } from '../lib/auth/credentialSummary';
import { resolveAuthGuardAction } from '../lib/auth/authGuard';
import {
  fetchSessionStatus,
  isTransientSessionStatusError,
} from '../lib/auth/sessionStatus';
import { AGREEMENT_ACCEPTED_KEY, BANNED_DETAIL_KEY } from '../lib/constants/storageKeys';
import { getCapToken } from '../lib/cap/client';
import { AuthStorage } from '../lib/storage/auth';
import type { AuthCredential } from '../lib/types/auth';
import { useServiceReachability } from '../hooks/useServiceReachability';

const AgreementModal = dynamic(
  () => import('../components/AgreementModal').then((m) => m.AgreementModal),
  { ssr: false, loading: () => null },
);

type AuthState = {
  isAuthenticated: boolean;
  credential: AuthCredentialSummary | null;
  isLoading: boolean;
  error: string | null;
  /** 服务端判定需要重新同意协议时为 true，前端据此弹出协议确认。 */
  consentRequired: boolean;
  /**
   * 本次状态是否已由服务端确认（权威判定）。
   * false 表示「暂时查不到」（超时/网络错误/5xx），此时 isAuthenticated 仅沿用本地登录缓存，
   * 守卫不应据此把用户踢到登录页——这正是「先闪登录页再被弹回仪表盘」的成因。
   */
  isSessionVerified: boolean;
};

interface AuthContextType extends AuthState {
  login: (credential: AuthCredential, capToken?: string) => Promise<void>;
  logout: () => void;
  validateCurrentCredential: () => Promise<boolean>;
  /** 重新查询会话状态（服务器抽风/超时后的显式重试）。 */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const DEFAULT_BANNED_DETAIL = '用户已被全局封禁';

function triggerPostLoginPreload(): void {
  void import('../lib/utils/preload')
    .then(({ runPostLoginPreload }) => {
      runPostLoginPreload();
    })
    .catch(() => {
      // 预加载失败不影响主流程
    });
}

function triggerClearPrefetchCache(): void {
  void import('../lib/utils/preload')
    .then(({ clearPrefetchCache }) => {
      clearPrefetchCache();
    })
    .catch(() => {
      // 清理失败不阻断退出
    });
}

function clearUserLocalCaches(): void {
  localStorage.removeItem(AGREEMENT_ACCEPTED_KEY);
  try {
    // 旧版本 key（迁移期保留清理）
    localStorage.removeItem('cache_rks_records_v1');
    localStorage.removeItem('cache_rks_records_v2');
    localStorage.removeItem('cache_rks_records_filters_v1');
    localStorage.removeItem('cache_service_stats_v3');
    // 当前版本
    localStorage.removeItem('cache_rks_records_v3');
    localStorage.removeItem('cache_rks_records_filters_v2');
    localStorage.removeItem('cache_service_stats_v4');
    localStorage.removeItem('cache_bestn_meta_v1');
    localStorage.removeItem('cache_song_image_meta_v1');
  } catch {
    // 忽略本地存储异常
  }
  triggerClearPrefetchCache();
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  // 协议阅读页不弹协议确认弹窗，允许用户先查看最新版本；离开后弹窗恢复拦截。
  const isAgreementReadPage = pathname === '/agreement' || pathname === '/privacy';
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    credential: null,
    isLoading: true,
    error: null,
    consentRequired: false,
    isSessionVerified: false,
  });
  const [showAgreement, setShowAgreement] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [agreementHtml, setAgreementHtml] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const banHandlingRef = useRef(false);
  const sessionRequestIdRef = useRef(0);
  // 通过 ref 暴露 refreshSession 给「服务可达」回调，避免声明顺序与依赖循环。
  const refreshSessionRef = useRef<(() => Promise<void>) | null>(null);

  const shouldPollStatus =
    !!authState.error &&
    (/服务器暂时无法访问/.test(authState.error) || /网络错误/.test(authState.error));
  useServiceReachability({
    shouldPoll: shouldPollStatus,
    // 服务器恢复后重新确认会话状态：避免 isSessionVerified 一直停在 false，
    // 让守卫长期卡在「正在确认登录状态」。
    onReachable: () => void refreshSessionRef.current?.(),
  });

  /**
   * 拉取会话状态并写入 authState。
   *
   * 关键约定：只有服务端给出权威结果（200）才改判登录态；
   * 瞬时失败（超时/网络/5xx）只标记 isSessionVerified=false，并沿用本地登录缓存，
   * 避免把「服务器抽风」当成「未登录」而把用户踢去登录页。
   */
  const loadSessionStatus = useCallback(async (): Promise<void> => {
    const requestId = ++sessionRequestIdRef.current;

    try {
      const payload = await fetchSessionStatus();
      if (requestId !== sessionRequestIdRef.current) return;

      // 本地缓存标记已登录、但服务端会话校验未通过（过期/被吊销）：
      // 清除缓存并弹窗引导重新登录。登录页/封禁页本身信息已足够，不重复弹窗。
      if (!payload.isAuthenticated && AuthStorage.getCachedLogin()) {
        AuthStorage.clearCachedLogin();
        if (pathname !== '/login' && pathname !== '/banned') {
          setShowSessionExpired(true);
        }
      }

      if (payload.isAuthenticated) {
        AuthAPI.checkHealth()
          .then((ok) => {
            if (!ok) {
              setAuthState((prev) => ({
                ...prev,
                error: '服务器暂时无法访问，请稍后再试',
              }));
            }
          })
          .catch(() => {
            // 健康检查失败不阻断流程
          });
      }

      setAuthState({
        isAuthenticated: payload.isAuthenticated,
        credential: payload.credential,
        isLoading: false,
        error: null,
        consentRequired: payload.consentRequired ?? false,
        isSessionVerified: true,
      });

      // 已登录但协议版本落后：弹出协议确认（跨设备/清缓存后也能拦住）。
      // 协议阅读页（/agreement、/privacy）在渲染处放行，允许先查看最新版本。
      if (payload.isAuthenticated && payload.consentRequired) {
        setAgreementHtml('');
        setShowAgreement(true);
      }
    } catch (error) {
      if (requestId !== sessionRequestIdRef.current) return;

      if (isTransientSessionStatusError(error)) {
        const hasCachedLogin = AuthStorage.getCachedLogin();
        setAuthState((prev) => ({
          ...prev,
          // 已缓存登录时不把用户判为未登录：否则守卫会把他踢到 /login，
          // 而 /login 又会因缓存标记弹回 /dashboard（来回跳转）。
          isAuthenticated: hasCachedLogin ? true : prev.isAuthenticated,
          isLoading: false,
          error: '服务器暂时无法访问，请稍后再试',
          isSessionVerified: false,
        }));
        return;
      }

      const message = error instanceof Error ? error.message : '初始化认证状态失败';
      setAuthState({
        isAuthenticated: false,
        credential: null,
        isLoading: false,
        error: message,
        consentRequired: false,
        isSessionVerified: false,
      });
    }
  }, [pathname]);

  /** 手动重试会话状态查询（服务器抽风时的显式重试入口）。 */
  const refreshSession = useCallback(async (): Promise<void> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
    await loadSessionStatus();
  }, [loadSessionStatus]);

  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  useEffect(() => {
    if (isInitialized) return;
    // 初始化守卫 flag：同步置位避免 effect 重复执行（一次性初始化标记）
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 一次性初始化守卫
    setIsInitialized(true);

    void loadSessionStatus();
  }, [isInitialized, loadSessionStatus]);

  const performClientLogout = useCallback(
    (reason: 'manual' | 'banned', detail?: string | null) => {
      if (reason === 'banned' && banHandlingRef.current) return;

      if (reason === 'banned') {
        banHandlingRef.current = true;
        const normalizedDetail = detail?.trim() || DEFAULT_BANNED_DETAIL;
        sessionStorage.setItem(BANNED_DETAIL_KEY, normalizedDetail);
      } else {
        sessionStorage.removeItem(BANNED_DETAIL_KEY);
      }

      fetch('/api/session/logout', { method: 'POST' }).catch(() => {});
      clearUserLocalCaches();
      AuthStorage.clearCachedLogin();
      setAuthState({
        isAuthenticated: false,
        credential: null,
        isLoading: false,
        error: null,
        consentRequired: false,
        isSessionVerified: true,
      });

      if (reason === 'banned') {
        router.replace('/banned');
        return;
      }
      router.replace('/login');
    },
    [router],
  );

  useEffect(() => {
    const origin = window.location.origin;
    const nativeFetch = window.fetch.bind(window);

    const guardedFetch: typeof window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init);
      if (!shouldInspectBanForRequest(input, origin)) return response;

      const banResult = await detectGlobalBanFromResponse(response);
      if (banResult.isGlobalBan) {
        performClientLogout('banned', banResult.detail);
      }
      return response;
    };

    window.fetch = guardedFetch;
    return () => {
      window.fetch = nativeFetch;
    };
  }, [performClientLogout]);

  const login = useCallback(
    async (credential: AuthCredential, capToken?: string) => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Cap 验证码 token：调用方（手动/API/平台登录等）未显式携带时，
        // 统一等待页面加载时已启动的后台解题结果（getCapToken 为模块级缓存，
        // 多次调用等待同一 Promise）。否则在 CAP_SECRET_KEY 强制校验模式下，
        // 未携带 token 的登录请求会被服务端直接拒绝（403 CAP_FAILED）。
        const resolvedCapToken = capToken ?? (await getCapToken());

        const taptapVersion = AuthStorage.getTapTapVersion();
        const res = await fetch('/api/session/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ credential, taptapVersion, capToken: resolvedCapToken }),
        });

        const data = (await res.json().catch(() => null)) as
          | {
              success: true;
              credential: AuthCredentialSummary;
              taptapVersion: string;
              consentRequired?: boolean;
            }
          | { success: false; message: string; code?: string }
          | null;

        if (!res.ok || !data || data.success !== true) {
          throw new Error(
            data && 'message' in data && data.message ? data.message : `登录失败（${res.status}）`,
          );
        }

        banHandlingRef.current = false;
        sessionStorage.removeItem(BANNED_DETAIL_KEY);

        const consentRequired = data.consentRequired ?? false;

        setAuthState({
          isAuthenticated: true,
          credential: data.credential,
          isLoading: false,
          error: null,
          consentRequired,
          isSessionVerified: true,
        });

        // 记录本地登录缓存（UI 提示用途），便于首页“立即开始”直接进入仪表盘。
        AuthStorage.setCachedLogin(true);

        // 服务端判定需要同意协议时，弹出确认；否则直接进入面板。
        if (consentRequired) {
          setAgreementHtml('');
          setShowAgreement(true);
        } else {
          // 仅为 UI 提示用途（菜单引导等）保留本地记号，不作为拦截依据。
          localStorage.setItem(AGREEMENT_ACCEPTED_KEY, 'true');
          triggerPostLoginPreload();
          router.replace('/dashboard');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '登录失败';
        setAuthState({
          isAuthenticated: false,
          credential: null,
          isLoading: false,
          error: errorMessage,
          consentRequired: false,
          isSessionVerified: true,
        });
      }
    },
    [router],
  );

  const handleAgree = useCallback(async () => {
    try {
      const res = await fetch('/api/session/consent', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json().catch(() => null)) as
        | { success: true; consentRequired?: boolean }
        | { success: false; message?: string }
        | null;

      if (!res.ok || !data || data.success !== true) {
        throw new Error(data && 'message' in data && data.message ? data.message : '记录同意状态失败');
      }

      setShowAgreement(false);
      setAuthState((prev) => ({ ...prev, consentRequired: false }));
      // UI 提示用途（菜单引导等）。
      localStorage.setItem(AGREEMENT_ACCEPTED_KEY, 'true');
      AuthStorage.setCachedLogin(true);
      triggerPostLoginPreload();
      router.replace('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '记录同意状态失败';
      setAuthState((prev) => ({ ...prev, error: errorMessage }));
      // 保留弹窗开启状态，等待用户重试。
    }
  }, [router]);

  const handleCloseAgreement = useCallback(() => {
    setShowAgreement(false);
    fetch('/api/session/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem(BANNED_DETAIL_KEY);
    clearUserLocalCaches();
    AuthStorage.clearCachedLogin();
    setAuthState({
      isAuthenticated: false,
      credential: null,
      isLoading: false,
      error: '您需要同意用户协议才能使用本服务',
      consentRequired: false,
      isSessionVerified: true,
    });
  }, []);

  const logout = useCallback(() => {
    performClientLogout('manual');
  }, [performClientLogout]);

  const validateCurrentCredential = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/session/validate', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json().catch(() => null)) as
        | { isValid: boolean; shouldLogout: boolean; error?: string }
        | null;

      // 5xx / 响应体缺失 = 上游不可用（瞬时）：不登出、不报无效，交由调用方决定是否重试。
      if (res.status >= 500 || !res.ok || !data) return false;
      if (data.shouldLogout) logout();
      return !!data.isValid;
    } catch (error) {
      console.error('验证凭证失败:', error);
      return false;
    }
  }, [logout]);

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    validateCurrentCredential,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showAgreement && !isAgreementReadPage && (
        <AgreementModal html={agreementHtml} onAgree={handleAgree} onClose={handleCloseAgreement} />
      )}
      {showSessionExpired && (
        <SessionExpiredModal
          onReLogin={() => router.replace('/login')}
          onDismiss={() => setShowSessionExpired(false)}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
}

export function withAuth<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, isSessionVerified } = useAuth();
    const router = useRouter();

    // 仅在「已确认未登录」时跳转：会话状态查询超时/上游 5xx 时 isSessionVerified 为 false，
    // 此时留在原页等待后续业务接口的 401 兜底，避免 /login ↔ /dashboard 来回跳。
    useEffect(() => {
      const action = resolveAuthGuardAction({ isLoading, isAuthenticated, isSessionVerified });
      if (action === 'redirect-login') {
        router.replace('/login');
      }
    }, [isAuthenticated, isLoading, isSessionVerified, router]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <RotatingTips />
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isSessionVerified ? '正在跳转到登录页…' : '正在确认登录状态…'}
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
