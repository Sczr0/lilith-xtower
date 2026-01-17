'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthCredential } from '../lib/types/auth';
import { AuthStorage } from '../lib/storage/auth';
import { AuthAPI } from '../lib/api/auth';
import { RotatingTips } from '../components/RotatingTips';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
// 动态加载协议弹窗，避免 react-markdown 进入全局共享 chunk
const AgreementModal = dynamic(() => import('../components/AgreementModal').then(m => m.AgreementModal), { ssr: false, loading: () => null });

import { useServiceReachability } from '../hooks/useServiceReachability';
import { runPostLoginPreload, clearPrefetchCache } from '../lib/utils/preload';
import type { AuthCredentialSummary, SessionStatusResponse } from '../lib/auth/credentialSummary';
import { AGREEMENT_ACCEPTED_KEY } from '../lib/constants/storageKeys';

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

export function AuthProvider({ children }: AuthProviderProps) {
  // 说明：登录态由服务端 HttpOnly 会话 Cookie 决定；客户端不再读取 localStorage 的凭证（P0-1）。
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

  // 当出现"服务器暂时无法访问/网络错误"时，轮询健康端点，恢复后移除横幅
  const shouldPollStatus = !!authState.error && (/服务器暂时无法访问/.test(authState.error || '') || /网络错误/.test(authState.error || ''));
  useServiceReachability({
    shouldPoll: shouldPollStatus,
    onReachable: () => setAuthState(prev => ({ ...prev, error: null })),
  });

  // 客户端 hydration 后进行后台健康检查（不阻塞渲染）
  useEffect(() => {
    if (isInitialized) return;
    setIsInitialized(true);

    // 1) 初始化：从服务端 session 读取登录态
    fetch('/api/session', { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as (SessionStatusResponse & { error?: string }) | null;
        if (!res.ok || !payload) {
          throw new Error(payload?.error || `获取会话失败（${res.status}）`);
        }
        // 仅在已登录时做后台健康检查（不阻塞 UI）
        if (payload.isAuthenticated) {
          AuthAPI.checkHealth()
            .then(ok => {
              if (!ok) setAuthState(prev => ({ ...prev, error: '服务器暂时无法访问，请稍后再试' }));
            })
            .catch(() => {
              // 忽略健康检查错误，不影响用户体验
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
        setAuthState({ isAuthenticated: false, credential: null, isLoading: false, error: message });
      });
  }, [isInitialized, authState.isAuthenticated, authState.credential]);

  const proceedLogin = async (credential: AuthCredential) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

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
        throw new Error((data && 'message' in data && data.message) ? data.message : `登录失败（${res.status}）`);
      }

      setAuthState({ isAuthenticated: true, credential: data.credential, isLoading: false, error: null });

      // 登录成功后预加载关键数据
      runPostLoginPreload();

      router.replace('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  };

  const login = async (credential: AuthCredential) => {
    const agreementAccepted = localStorage.getItem(AGREEMENT_ACCEPTED_KEY);
    if (agreementAccepted) {
      await proceedLogin(credential);
      return;
    }

    // 先验证并保存凭证，再弹出同意弹窗（默认简化模式）
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

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
        throw new Error((data && 'message' in data && data.message) ? data.message : `登录失败（${res.status}）`);
      }

      setAuthState({ isAuthenticated: true, credential: data.credential, isLoading: false, error: null });

      // 简化模式：不给 html，则弹窗走“勾选确认”
      setAgreementHtml('');
      setShowAgreement(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      setAuthState({ isAuthenticated: false, credential: null, isLoading: false, error: errorMessage });
    }
  };

  const handleAgree = async () => {
    setShowAgreement(false);

    // 保存协议接受状态并跳转
    localStorage.setItem(AGREEMENT_ACCEPTED_KEY, 'true');
    // 同意协议后预加载关键数据（与 proceedLogin 保持一致）
    runPostLoginPreload();
    router.replace('/dashboard');
  };

  const handleCloseAgreement = () => {
    setShowAgreement(false);

    // 用户拒绝协议，清除凭证和登录状态
    fetch('/api/session/logout', { method: 'POST' }).catch(() => {});
    setAuthState({ isAuthenticated: false, credential: null, isLoading: false, error: '您需要同意用户协议才能使用本服务' });
  };

  const logout = () => {
    fetch('/api/session/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem(AGREEMENT_ACCEPTED_KEY);
    // 清除与用户相关的缓存
    try {
      localStorage.removeItem('cache_rks_records_v1');
      localStorage.removeItem('cache_rks_records_v2');
      localStorage.removeItem('cache_bestn_meta_v1');
      localStorage.removeItem('cache_song_image_meta_v1');
    } catch {}
    // 清除预取缓存
    clearPrefetchCache();
    setAuthState({ isAuthenticated: false, credential: null, isLoading: false, error: null });

    router.replace('/login');
  };

  const validateCurrentCredential = async (): Promise<boolean> => {
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
  };

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
        <AgreementModal
          html={agreementHtml}
          onAgree={handleAgree}
          onClose={handleCloseAgreement}
        />
      )}
    </AuthContext.Provider>
  );
}

/**
 * 使用认证上下文的Hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }

  return context;
}

/**
 * 认证保护的高阶组件
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
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
