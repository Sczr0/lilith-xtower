'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AuthCredential } from '../lib/types/auth';
import { AuthStorage } from '../lib/storage/auth';
import { AuthAPI } from '../lib/api/auth';
import { AgreementModal } from '../components/AgreementModal';
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
  agreementContent: string;
}

export function AuthProvider({ children, agreementContent }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    credential: null,
    isLoading: true,
    error: null,
  });
  const [showAgreement, setShowAgreement] = useState(false);
  const setPendingCredential = useState<AuthCredential | null>(null)[1];

  // 当出现“服务器暂时无法访问/网络错误”时，轮询健康端点，恢复后移除横幅
  const shouldPollStatus = !!authState.error && (/服务器暂时无法访问/.test(authState.error) || /网络错误/.test(authState.error));
  useServiceReachability({
    shouldPoll: shouldPollStatus,
    onReachable: () => setAuthState(prev => ({ ...prev, error: null })),
  });

  // 初始化时检查本地存储中的凭证
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const credential = AuthStorage.getCredential();
        
        if (credential) {
          const result = await AuthAPI.validateCredential(credential);
          
          if (result.isValid) {
            setAuthState({
              isAuthenticated: true,
              credential,
              isLoading: false,
              error: null,
            });
          } else if (result.shouldLogout) {
            // 4xx 错误：凭证无效，清除本地凭证
            AuthStorage.clearCredential();
            setAuthState({
              isAuthenticated: false,
              credential: null,
              isLoading: false,
              error: result.error || '登录凭证已过期，请重新登录',
            });
          } else {
            // 5xx 或网络错误：保留凭证和认证状态，让用户留在当前页面
            setAuthState({
              isAuthenticated: true,
              credential,
              isLoading: false,
              error: result.error || '服务器暂时无法访问，请稍后再试',
            });
          }
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error);
        setAuthState({
          isAuthenticated: false,
          credential: null,
          isLoading: false,
          error: '初始化认证状态失败',
        });
      }
    };

    initializeAuth();
  }, []);

  const proceedLogin = async (credential: AuthCredential) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await AuthAPI.validateCredential(credential);
      if (!result.isValid) {
        throw new Error(result.error || '登录凭证验证失败，请重新登录');
      }

      // 只有登录成功后才保存协议接受状态
      localStorage.setItem(AGREEMENT_KEY, 'true');
      AuthStorage.saveCredential(credential);
      
      setAuthState({
        isAuthenticated: true,
        credential,
        isLoading: false,
        error: null,
      });

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
    } else {
      // 先验证并保存凭证，确保用户在查看协议期间也能正常访问其他页面
      try {
        setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
        
        const result = await AuthAPI.validateCredential(credential);
        if (!result.isValid) {
          throw new Error(result.error || '登录凭证验证失败，请重新登录');
        }
        
        // 保存凭证到存储和状态
        AuthStorage.saveCredential(credential);
        setAuthState({
          isAuthenticated: true,
          credential,
          isLoading: false,
          error: null,
        });
        
        // 显示协议弹窗
        setPendingCredential(credential);
        setShowAgreement(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '登录失败';
        setAuthState({ 
          isAuthenticated: false,
          credential: null,
          isLoading: false, 
          error: errorMessage 
        });
      }
    }
  };

  const handleAgree = async () => {
    setShowAgreement(false);
    setPendingCredential(null);
    
    // 保存协议接受状态并跳转
    localStorage.setItem(AGREEMENT_KEY, 'true');
    if (typeof window !== 'undefined') {
      window.location.href = '/debug-auth';
    }
  };

  const handleCloseAgreement = () => {
    setShowAgreement(false);
    setPendingCredential(null);
    
    // 用户拒绝协议，清除凭证和登录状态
    AuthStorage.clearCredential();
    setAuthState({
      isAuthenticated: false,
      credential: null,
      isLoading: false,
      error: '您需要同意用户协议才能使用本服务',
    });
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
    setAuthState({
      isAuthenticated: false,
      credential: null,
      isLoading: false,
      error: null,
    });
    
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
          content={agreementContent}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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