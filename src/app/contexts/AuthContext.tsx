'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AuthCredential } from '../lib/types/auth';
import { AuthStorage } from '../lib/storage/auth';
import { AuthAPI } from '../lib/api/auth';
import { RotatingTips } from '../components/RotatingTips';
import dynamic from 'next/dynamic';
// 动态加载协议弹窗，避免 react-markdown 进入全局共享 chunk
const AgreementModal = dynamic(() => import('../components/AgreementModal').then(m => m.AgreementModal), { ssr: false, loading: () => null });

import { useServiceReachability } from '../hooks/useServiceReachability';

const AGREEMENT_KEY = 'phigros_agreement_accepted';

interface AuthContextType extends AuthState {
  login: (credential: AuthCredential) => Promise<void>;
  logout: () => void;
  validateCurrentCredential: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 同步读取 localStorage 中的凭证（仅在客户端执行）
 * 用于初始化时立即获取认证状态，避免阻塞首屏渲染
 */
function getInitialAuthState(): AuthState {
  if (typeof window === 'undefined') {
    // SSR 时返回默认状态
    return {
      isAuthenticated: false,
      credential: null,
      isLoading: false,
      error: null,
    };
  }
  
  try {
    const credential = AuthStorage.getCredential();
    if (credential) {
      return {
        isAuthenticated: true,
        credential,
        isLoading: false,
        error: null,
      };
    }
  } catch (error) {
    console.error('读取凭证失败:', error);
  }
  
  return {
    isAuthenticated: false,
    credential: null,
    isLoading: false,
    error: null,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  // 乐观渲染：同步读取 localStorage，不阻塞首屏
  const [authState, setAuthState] = useState<AuthState>(getInitialAuthState);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementHtml, setAgreementHtml] = useState<string>('');
  const setPendingCredential = useState<AuthCredential | null>(null)[1];
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

    // 如果已登录，后台进行健康检查
    if (authState.isAuthenticated && authState.credential) {
      // 异步健康检查，不阻塞 UI
      AuthAPI.checkHealth()
        .then(ok => {
          if (!ok) {
            setAuthState(prev => ({ ...prev, error: '服务器暂时无法访问，请稍后再试' }));
          }
        })
        .catch(() => {
          // 忽略健康检查错误，不影响用户体验
        });
    }
  }, [isInitialized, authState.isAuthenticated, authState.credential]);

  const proceedLogin = async (credential: AuthCredential) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await AuthAPI.validateCredential(credential);
      if (!result.isValid) {
        throw new Error(result.error || '登录凭证验证失败，请重新登录');
      }

      // 仅在验证通过后保存凭证
      AuthStorage.saveCredential(credential);

      setAuthState({ isAuthenticated: true, credential, isLoading: false, error: null });

      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  };

  const login = async (credential: AuthCredential) => {
    const agreementAccepted = localStorage.getItem(AGREEMENT_KEY);
    if (agreementAccepted) {
      await proceedLogin(credential);
      return;
    }

    // 先验证并保存凭证，再弹出同意弹窗（默认简化模式）
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await AuthAPI.validateCredential(credential);
      if (!result.isValid) {
        throw new Error(result.error || '登录凭证验证失败，请重新登录');
      }

      AuthStorage.saveCredential(credential);
      setAuthState({ isAuthenticated: true, credential, isLoading: false, error: null });

      // 简化模式：不给 html，则弹窗走“勾选确认”
      setAgreementHtml('');
      setPendingCredential(credential);
      setShowAgreement(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      setAuthState({ isAuthenticated: false, credential: null, isLoading: false, error: errorMessage });
    }
  };

  const handleAgree = async () => {
    setShowAgreement(false);
    setPendingCredential(null);

    // 保存协议接受状态并跳转
    localStorage.setItem(AGREEMENT_KEY, 'true');
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  const handleCloseAgreement = () => {
    setShowAgreement(false);
    setPendingCredential(null);

    // 用户拒绝协议，清除凭证和登录状态
    AuthStorage.clearCredential();
    setAuthState({ isAuthenticated: false, credential: null, isLoading: false, error: '您需要同意用户协议才能使用本服务' });
  };

  const logout = () => {
    AuthStorage.clearCredential();
    localStorage.removeItem(AGREEMENT_KEY);
    // 清除与用户相关的缓存
    try {
      localStorage.removeItem('cache_rks_records_v1');
      localStorage.removeItem('cache_rks_records_v2');
      localStorage.removeItem('cache_bestn_meta_v1');
      localStorage.removeItem('cache_song_image_meta_v1');
    } catch {}
    setAuthState({ isAuthenticated: false, credential: null, isLoading: false, error: null });

    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const validateCurrentCredential = async (): Promise<boolean> => {
    if (!authState.credential) return false;
    try {
      const result = await AuthAPI.validateCredential(authState.credential);
      if (result.shouldLogout) {
        // 凭证无效，退出登录
        logout();
      }
      return result.isValid;
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
      // 重定向到登录页面
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }

    return <Component {...props} />;
  };
}
