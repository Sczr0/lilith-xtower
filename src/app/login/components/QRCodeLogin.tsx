"use client";

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '../../contexts/AuthContext';
import { AuthAPI, poll } from '../../lib/api/auth';
import { SessionCredential } from '../../lib/types/auth';

export function QRCodeLogin() {
  const { login } = useAuth();
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  // 移动端深链：用于在移动端直接跳转 TapTap 确认登录
  const [taptapDeepLink, setTaptapDeepLink] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // 获取二维码
  const getQRCode = useCallback(async () => {
    try {
      setStatus('loading');
      setError('');
      
      const response = await AuthAPI.getQRCode();
      setQrCodeImage(response.qrCodeImage);
      // 生成 TapTap 深链（仅当后端返回 qrcodeUrl 时）
      if (response.qrcodeUrl) {
        try {
          const url = new URL(response.qrcodeUrl);
          const userCode = url.searchParams.get('user_code');
          if (userCode) {
            // 将 user_code 拼接到 TapTap 深链模板中（与产品方提供的格式保持一致）
            const encoded = encodeURIComponent(`https://accounts.taptap.cn/device?qrcode=1&user_code=${userCode}`);
            const deepLink = `taptap://taptap.com/login-auth?url=${encoded}`;
            setTaptapDeepLink(deepLink);
          } else {
            setTaptapDeepLink('');
          }
        } catch {
          setTaptapDeepLink('');
        }
      } else {
        setTaptapDeepLink('');
      }
      setStatus('scanning');
      
      // 开始轮询扫码状态
      const finalStatus = await poll(
        () => AuthAPI.pollQRStatus(response.qrId),
        (result) => result.status === 'success',
        2000, // 每2秒轮询一次
        120000 // 2分钟超时
      );

      // 扫码成功，直接使用轮询返回的结果
      if (finalStatus.status === 'success' && finalStatus.sessionToken) {
        const credential: SessionCredential = {
          type: 'session',
          token: finalStatus.sessionToken,
          timestamp: Date.now(),
        };
        
        await login(credential);
        setStatus('success');
      } else {
        // 如果轮询成功但没有token，说明逻辑异常
        throw new Error('扫码成功但未能获取登录凭证');
      }
    } catch (error) {
      console.error('扫码登录失败:', error);
      setStatus('error');
      setError(error instanceof Error ? error.message : '扫码登录失败');
    }
  }, [login]);

  // 组件挂载时自动获取二维码
  useEffect(() => {
    // 粗略判断是否为移动端，仅用于控制 UI 显示
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const mobile = /Mobile|Android|iP(hone|od|ad)|HarmonyOS|Huawei/i.test(ua);
      setIsMobile(mobile);
    }
    getQRCode();
  }, [getQRCode]);

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
          使用 TapTap App 扫描下方二维码登录
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">正在获取二维码...</p>
        </div>
      )}

      {status === 'scanning' && qrCodeImage && (
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <Image
              src={qrCodeImage}
              alt="登录二维码"
              width={256}
              height={256}
              className="w-64 h-64 object-contain"
              unoptimized
              priority
            />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              请使用 TapTap App 扫描二维码
            </p>
            <div className="flex items-center justify-center space-x-2 text-yellow-600 dark:text-yellow-400">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm">等待扫码...</span>
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
                在 TapTap 中确认登录
              </a>
              <p className="mt-2 text-xs text-center text-gray-600 dark:text-gray-400">
                确认后请返回浏览器阅读并同意「用户协议」，然后回到本页等待完成登录。
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
            登录成功！
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            正在跳转到主页...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
            登录失败
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
          <li>• 打开 TapTap App</li>
          <li>• 点击右上角扫码按钮，扫描上方二维码</li>
          <li>• 在 App 中确认登录</li>
        </ul>
      </div>
    </div>
  );
}