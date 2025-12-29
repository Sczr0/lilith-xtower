"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { RotatingTips } from '../../components/RotatingTips';
import { useAuth } from '../../contexts/AuthContext';
import { SessionCredential, TapTapVersion } from '../../lib/types/auth';
import { AuthStorage } from '../../lib/storage/auth';
import {
  completeTapTapQrLogin,
  QrCodeData,
  requestTapTapDeviceCode,
} from '../../lib/taptap/qrLogin';
import QRCode from 'qrcode';
import { getPreloadedQrData, clearPreloadedQrData } from '../../lib/utils/preload';

interface QRCodeLoginProps {
  taptapVersion: TapTapVersion;
}

export function QRCodeLogin({ taptapVersion }: QRCodeLoginProps) {
  const { login } = useAuth();
  // AuthProvider 每次渲染都会生成新的 login 引用；这里用 ref 持有最新值，避免触发“依赖变化导致重复拉码”
  const loginRef = useRef(login);
  useEffect(() => {
    loginRef.current = login;
  }, [login]);

  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'success' | 'error' | 'expired'>('idle');
  const [error, setError] = useState<string>('');
  // 移动端深链：用于在移动端直接跳转 TapTap 确认登录
  const [taptapDeepLink, setTaptapDeepLink] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const pollAbortRef = useRef<AbortController | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理轮询与定时器
  const cancelPolling = useCallback(() => {
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current);
      expireTimerRef.current = null;
    }
  }, []);

  // 使用完整的 TapTap 扫码登录流程
  const getQRCode = useCallback(async () => {
    try {
      setStatus('loading');
      setError('');
      cancelPolling();

      const version = taptapVersion ?? AuthStorage.getTapTapVersion();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      // 尝试使用预加载的二维码数据
      let codeData: QrCodeData;
      const preloadedData = getPreloadedQrData(version);
      if (preloadedData && typeof preloadedData === 'object' && 'deviceCode' in preloadedData) {
        codeData = preloadedData as QrCodeData;
        // 清除已使用的预加载数据
        clearPreloadedQrData(version);
      } else {
        codeData = await requestTapTapDeviceCode(version, controller.signal);
      }

      setQrCodeImage(codeData.qrcodeUrl);
      try {
        const dataUrl = await QRCode.toDataURL(codeData.qrcodeUrl, { width: 256, margin: 1 });
        setQrCodeDataUrl(dataUrl);
      } catch {
        setQrCodeDataUrl(codeData.qrcodeUrl);
      }
      // 移动端深链优先使用带 user_code 的完整链接，避免跳转后还需要手动输入验证码
      setTaptapDeepLink(codeData.qrcodeUrl || codeData.verificationUrl);
      setStatus('scanning');

      // 二维码过期定时
      expireTimerRef.current = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
          setStatus('expired');
          setError('二维码已过期，请重新获取');
        }
      }, (codeData.expiresIn ?? 300) * 1000);

      // 执行完整扫码登录流程
      const { sessionToken } = await completeTapTapQrLogin(
        version,
        codeData,
        {
          signal: controller.signal,
          timeoutMs: (codeData.expiresIn ?? 300) * 1000,
        },
      );

      const credential: SessionCredential = {
        type: 'session',
        token: sessionToken,
        timestamp: Date.now(),
      };

      await loginRef.current(credential);
      cancelPolling();
      setStatus('success');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      console.error('扫码登录失败:', err);
      cancelPolling();
      setStatus('error');
      setError(err instanceof Error ? err.message : '扫码登录失败，请重试');
    }
  }, [taptapVersion, cancelPolling]);

  // 组件挂载时自动获取二维码
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const mobile = /Mobile|Android|iP(hone|od|ad)|HarmonyOS|Huawei/i.test(ua);
      setIsMobile(mobile);
    }
    getQRCode();
    return () => {
      cancelPolling();
    };
  }, [getQRCode, cancelPolling]);

  const handleRetry = () => {
    getQRCode();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          扫码登录
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          使用 TapTap App 扫描下方二维码完成登录
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">正在获取二维码...</p>
          <RotatingTips />
        </div>
      )}

      {status === 'scanning' && (qrCodeDataUrl || qrCodeImage) && (
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <img
              src={qrCodeDataUrl || qrCodeImage}
              alt="登录二维码"
              className="w-64 h-64 object-contain"
              width={256}
              height={256}
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              请使用 TapTap App 扫描二维码并确认
            </p>
            <div className="flex items-center justify-center space-x-2 text-yellow-600 dark:text-yellow-400">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm">等待确认中...</span>
            </div>
          </div>

          {/* 移动端下属登录方式：直接跳转 TapTap 确认登录（桌面端隐藏） */}
          {isMobile && taptapDeepLink && (
            <div className="w-full max-w-sm pt-2 md:hidden">
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                <span className="mx-3 text-xs text-gray-500 dark:text-gray-400">或</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <a
                href={taptapDeepLink}
                className="mt-3 block w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                去 TapTap 中确认登录
              </a>
              <p className="mt-2 text-xs text-center text-gray-600 dark:text-gray-400">
                确认后请回到浏览器阅读并同意《用户协议》，然后返回本页等待完成登录。
              </p>
            </div>
          )}
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
            登录成功
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            正在跳转到首页...
          </p>
        </div>
      )}

      {(status === 'error' || status === 'expired') && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {status === 'expired' ? '二维码已过期' : '登录失败'}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重新获取二维码
          </button>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
          使用说明
        </h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>1) 打开 TapTap App</li>
          <li>2) 点击右上角扫一扫，扫描页面二维码</li>
          <li>3) 在 TapTap 中确认授权后回到本页等待跳转</li>
        </ul>
      </div>
    </div>
  );
}
