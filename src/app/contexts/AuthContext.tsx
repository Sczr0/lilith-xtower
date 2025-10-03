'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AuthCredential } from '../lib/types/auth';
import { AuthStorage } from '../lib/storage/auth';
import { AuthAPI } from '../lib/api/auth';
import { AgreementModal } from '../components/AgreementModal';
import fs from 'fs';
import path from 'path';

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
  const [pendingCredential, setPendingCredential] = useState<AuthCredential | null>(null);

  // 初始化时检查本地存储中的凭证
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const credential = AuthStorage.getCredential();
        
        if (credential) {
          const isValid = await AuthAPI.validateCredential(credential);
          
          if (isValid) {
            setAuthState({
              isAuthenticated: true,
              credential,
              isLoading: false,
              error: null,
            });
          } else {
            AuthStorage.clearCredential();
            setAuthState({
              isAuthenticated: false,
              credential: null,
              isLoading: false,
              error: '登录凭证已过期，请重新登录',
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

      const isValid = await AuthAPI.validateCredential(credential);
      if (!isValid) throw new Error('登录凭证无效');

      AuthStorage.saveCredential(credential);
      setAuthState({
        isAuthenticated: true,
        credential,
        isLoading: false,
        error: null,
      });

      if (typeof window !== 'undefined') {
        window.location.href = '/debug-auth';
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
      setPendingCredential(credential);
      setShowAgreement(true);
    }
  };

  const handleAgree = async () => {
    localStorage.setItem(AGREEMENT_KEY, 'true');
    setShowAgreement(false);
    if (pendingCredential) {
      await proceedLogin(pendingCredential);
      setPendingCredential(null);
    }
  };

  const handleCloseAgreement = () => {
    setShowAgreement(false);
    setPendingCredential(null);
  };

  const logout = () => {
    AuthStorage.clearCredential();
    localStorage.removeItem(AGREEMENT_KEY);
    setAuthState({
      isAuthenticated: false,
      credential: null,
      isLoading: false,
      error: null,
    });
  };

  const validateCurrentCredential = async (): Promise<boolean> => {
    if (!authState.credential) return false;
    try {
      const isValid = await AuthAPI.validateCredential(authState.credential);
      if (!isValid) logout();
      return isValid;
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