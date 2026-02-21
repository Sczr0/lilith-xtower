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
import { useRouter } from 'next/navigation';

import { RotatingTips } from '../components/RotatingTips';
import { AuthAPI } from '../lib/api/auth';
import {
  detectGlobalBanFromResponse,
  shouldInspectBanForRequest,
} from '../lib/auth/banGuard';
import type { AuthCredentialSummary, SessionStatusResponse } from '../lib/auth/credentialSummary';
import { AGREEMENT_ACCEPTED_KEY, BANNED_DETAIL_KEY } from '../lib/constants/storageKeys';
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
};

interface AuthContextType extends AuthState {
  login: (credential: AuthCredential) => Promise<void>;
  logout: () => void;
  validateCurrentCredential: () => Promise<boolean>;
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
    localStorage.removeItem('cache_rks_records_v1');
    localStorage.removeItem('cache_rks_records_v2');
    localStorage.removeItem('cache_bestn_meta_v1');
    localStorage.removeItem('cache_song_image_meta_v1');
  } catch {
    // 忽略本地存储异常
  }
  triggerClearPrefetchCache();
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    credential: null,
    isLoading: true,
    error: null,
  });
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementHtml, setAgreementHtml] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const banHandlingRef = useRef(false);

  const shouldPollStatus =
    !!authState.error &&
    (/服务器暂时无法访问/.test(authState.error) || /网络错误/.test(authState.error));
  useServiceReachability({
    shouldPoll: shouldPollStatus,
    onReachable: () => setAuthState((prev) => ({ ...prev, error: null })),
  });

  useEffect(() => {
    if (isInitialized) return;
    setIsInitialized(true);

    fetch('/api/session', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | (SessionStatusResponse & { error?: string })
          | null;
        if (!res.ok || !payload) {
          throw new Error(payload?.error || `获取会话失败（${res.status}）`);
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
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '初始化认证状态失败';
        setAuthState({
          isAuthenticated: false,
          credential: null,
          isLoading: false,
          error: message,
        });
      });
  }, [isInitialized]);

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
      setAuthState({
        isAuthenticated: false,
        credential: null,
        isLoading: false,
        error: null,
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

  const proceedLogin = useCallback(
    async (credential: AuthCredential) => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

        const taptapVersion = AuthStorage.getTapTapVersion();
        const res = await fetch('/api/session/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ credential, taptapVersion }),
        });

        const data = (await res.json().catch(() => null)) as
          | { success: true; credential: AuthCredentialSummary; taptapVersion: string }
          | { success: false; message: string }
          | null;

        if (!res.ok || !data || data.success !== true) {
          throw new Error(
            data && 'message' in data && data.message ? data.message : `登录失败（${res.status}）`,
          );
        }

        banHandlingRef.current = false;
        sessionStorage.removeItem(BANNED_DETAIL_KEY);

        setAuthState({
          isAuthenticated: true,
          credential: data.credential,
          isLoading: false,
          error: null,
        });

        triggerPostLoginPreload();
        router.replace('/dashboard');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '登录失败';
        setAuthState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        throw error;
      }
    },
    [router],
  );

  const login = useCallback(
    async (credential: AuthCredential) => {
      const agreementAccepted = localStorage.getItem(AGREEMENT_ACCEPTED_KEY);
      if (agreementAccepted) {
        await proceedLogin(credential);
        return;
      }

      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

        const taptapVersion = AuthStorage.getTapTapVersion();
        const res = await fetch('/api/session/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ credential, taptapVersion }),
        });

        const data = (await res.json().catch(() => null)) as
          | { success: true; credential: AuthCredentialSummary; taptapVersion: string }
          | { success: false; message: string }
          | null;

        if (!res.ok || !data || data.success !== true) {
          throw new Error(
            data && 'message' in data && data.message ? data.message : `登录失败（${res.status}）`,
          );
        }

        banHandlingRef.current = false;
        sessionStorage.removeItem(BANNED_DETAIL_KEY);

        setAuthState({
          isAuthenticated: true,
          credential: data.credential,
          isLoading: false,
          error: null,
        });

        setAgreementHtml('');
        setShowAgreement(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '登录失败';
        setAuthState({
          isAuthenticated: false,
          credential: null,
          isLoading: false,
          error: errorMessage,
        });
      }
    },
    [proceedLogin],
  );

  const handleAgree = useCallback(() => {
    setShowAgreement(false);
    localStorage.setItem(AGREEMENT_ACCEPTED_KEY, 'true');
    triggerPostLoginPreload();
    router.replace('/dashboard');
  }, [router]);

  const handleCloseAgreement = useCallback(() => {
    setShowAgreement(false);
    fetch('/api/session/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem(BANNED_DETAIL_KEY);
    clearUserLocalCaches();
    setAuthState({
      isAuthenticated: false,
      credential: null,
      isLoading: false,
      error: '您需要同意用户协议才能使用本服务',
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

      if (!res.ok || !data) return false;
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showAgreement && (
        <AgreementModal html={agreementHtml} onAgree={handleAgree} onClose={handleCloseAgreement} />
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
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (isLoading) return;
      if (!isAuthenticated) {
        router.replace('/login');
      }
    }, [isAuthenticated, isLoading, router]);

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
          <div className="text-sm text-gray-600 dark:text-gray-400">正在跳转到登录页…</div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
