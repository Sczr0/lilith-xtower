'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, AuthCredential } from '../lib/types/auth';
import { AuthStorage } from '../lib/storage/auth';
import { AuthAPI } from '../lib/api/auth';
import dynamic from 'next/dynamic';
// 鍔ㄦ€佸姞杞藉崗璁脊绐楋紝閬垮厤 react-markdown 杩涘叆鍏ㄥ眬鍏变韩 chunk
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

export function AuthProvider({ children }: AuthProviderProps) {

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    credential: null,
    isLoading: true,
    error: null,
  });
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementHtml, setAgreementHtml] = useState<string>('');
  const setPendingCredential = useState<AuthCredential | null>(null)[1];

  // 褰撳嚭鐜扳€滄湇鍔″櫒鏆傛椂鏃犳硶璁块棶/缃戠粶閿欒鈥濇椂锛岃疆璇㈠仴搴风鐐癸紝鎭㈠鍚庣Щ闄ゆí骞?  const shouldPollStatus = !!authState.error && (/鏈嶅姟鍣ㄦ殏鏃舵棤娉曡闂?.test(authState.error) || /缃戠粶閿欒/.test(authState.error));
  useServiceReachability({
    shouldPoll: shouldPollStatus,
    onReachable: () => setAuthState(prev => ({ ...prev, error: null })),
  });

  // 鍒濆鍖栨椂妫€鏌ユ湰鍦板瓨鍌ㄤ腑鐨勫嚟璇?  useEffect(() => {
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
            // 4xx 閿欒锛氬嚟璇佹棤鏁堬紝娓呴櫎鏈湴鍑瘉
            AuthStorage.clearCredential();
            setAuthState({
              isAuthenticated: false,
              credential: null,
              isLoading: false,
              error: result.error || '鐧诲綍鍑瘉宸茶繃鏈燂紝璇烽噸鏂扮櫥褰?,
            });
          } else {
            // 5xx 鎴栫綉缁滈敊璇細淇濈暀鍑瘉鍜岃璇佺姸鎬侊紝璁╃敤鎴风暀鍦ㄥ綋鍓嶉〉闈?            setAuthState({
              isAuthenticated: true,
              credential,
              isLoading: false,
              error: result.error || '鏈嶅姟鍣ㄦ殏鏃舵棤娉曡闂紝璇风◢鍚庡啀璇?,
            });
          }
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('鍒濆鍖栬璇佺姸鎬佸け璐?', error);
        setAuthState({
          isAuthenticated: false,
          credential: null,
          isLoading: false,
          error: '鍒濆鍖栬璇佺姸鎬佸け璐?,
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
        throw new Error(result.error || '鐧诲綍鍑瘉楠岃瘉澶辫触锛岃閲嶆柊鐧诲綍');
      }

      // 协议勾选由登录后确认弹窗处理，这里不自动标记
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
      const errorMessage = error instanceof Error ? error.message : '鐧诲綍澶辫触';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  };

  const login = async (credential: AuthCredential) => {
    const agreementAccepted = localStorage.getItem(AGREEMENT_KEY);
    if (agreementAccepted) {
      await proceedLogin(credential);
    } else {
      // 鍏堥獙璇佸苟淇濆瓨鍑瘉锛岀‘淇濈敤鎴峰湪鏌ョ湅鍗忚鏈熼棿涔熻兘姝ｅ父璁块棶鍏朵粬椤甸潰
      try {
        setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
        
        const result = await AuthAPI.validateCredential(credential);
        if (!result.isValid) {
          throw new Error(result.error || '鐧诲綍鍑瘉楠岃瘉澶辫触锛岃閲嶆柊鐧诲綍');
        }
        
        // 淇濆瓨鍑瘉鍒板瓨鍌ㄥ拰鐘舵€?        AuthStorage.saveCredential(credential);
        setAuthState({
          isAuthenticated: true,
          credential,
          isLoading: false,
          error: null,
        });
        
        // 鍔犺浇鍗忚 HTML 鍚庡啀鏄剧ず鍗忚寮圭獥
        try {
          // 简化：不加载协议 HTML，直接进入勾选确认模式
          setAgreementHtml("");
          
          
          
          
        // 鏄剧ず鍗忚寮圭獥
        setPendingCredential(credential);
        setShowAgreement(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '鐧诲綍澶辫触';
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
    
    // 淇濆瓨鍗忚鎺ュ彈鐘舵€佸苟璺宠浆
    localStorage.setItem(AGREEMENT_KEY, 'true');
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  const handleCloseAgreement = () => {
    setShowAgreement(false);
    setPendingCredential(null);
    
    // 鐢ㄦ埛鎷掔粷鍗忚锛屾竻闄ゅ嚟璇佸拰鐧诲綍鐘舵€?    AuthStorage.clearCredential();
    setAuthState({
      isAuthenticated: false,
      credential: null,
      isLoading: false,
      error: '鎮ㄩ渶瑕佸悓鎰忕敤鎴峰崗璁墠鑳戒娇鐢ㄦ湰鏈嶅姟',
    });
  };

  const logout = () => {
    AuthStorage.clearCredential();
    localStorage.removeItem(AGREEMENT_KEY);
    // 娓呴櫎涓庣敤鎴风浉鍏崇殑缂撳瓨
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
        // 鍑瘉鏃犳晥锛岄€€鍑虹櫥褰?        logout();
      }
      return result.isValid;
    } catch (error) {
      console.error('楠岃瘉鍑瘉澶辫触:', error);
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
 * 浣跨敤璁よ瘉涓婁笅鏂囩殑Hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth蹇呴』鍦ˋuthProvider鍐呴儴浣跨敤');
  }
  
  return context;
}

/**
 * 璁よ瘉淇濇姢鐨勯珮闃剁粍浠? */
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
      // 閲嶅畾鍚戝埌鐧诲綍椤甸潰
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }

    return <Component {...props} />;
  };
}


