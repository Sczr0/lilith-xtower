"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { RotatingTips } from '../../components/RotatingTips';
import { useAuth } from '../../contexts/AuthContext';
import { SessionCredential, TapTapVersion } from '../../lib/types/auth';
import { AuthStorage } from '../../lib/storage/auth';
import {
  finishTapTapQrLogin,
  pollTapTapToken,
  requestTapTapDeviceCode,
  TokenResponse,
  QrCodeData,
} from '../../lib/taptap/qrLogin';
import { buildTapTapLoginAuthDeepLink, normalizeTapTapConfirmUrl } from '../../lib/taptap/deeplink';
import { getCapToken } from '../../lib/cap/client';
import { useClientValue } from '../../hooks/useClientValue';
import { buildGoHref } from '../../utils/outbound';

interface QRCodeLoginProps {
  taptapVersion: TapTapVersion;
}

/**
 * 一次扫码登录的进度快照。用于「授权失败绝不重扫码」：
 * 走到越靠后的阶段（已拿 token / sessionToken），失败后能原地续跑越远。
 */
type TapTapFlow = {
  version: TapTapVersion;
  qr: QrCodeData;
  /** 已从上游拿到 TapTap access_token（说明用户已授权）。 */
  token?: TokenResponse;
  /** 已用 token 换到 LeanCloud sessionToken。 */
  sessionToken?: string;
};

/** 服务端 flow 已失效时的报错：此时无法续跑，只能重新拉码。 */
function isFlowInvalidError(err: unknown): boolean {
  return err instanceof Error && /授权流程无效|已过期/.test(err.message);
}

export function QRCodeLogin({ taptapVersion }: QRCodeLoginProps) {
  const { login, consentRequired, isAuthenticated, error: authError } = useAuth();
  // AuthProvider 每次渲染都会生成新的 login 引用；这里用 ref 持有最新值，避免触发“依赖变化导致重复拉码”
  const loginRef = useRef(login);
  useEffect(() => {
    loginRef.current = login;
  }, [login]);

  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'resuming' | 'success' | 'error' | 'expired'>('idle');
  const [error, setError] = useState<string>('');
  // 当前流程是否可续跑（已拿到 token 或 sessionToken）。用 state 而非仅 ref：它是渲染依据。
  const [canResume, setCanResume] = useState(false);
  // 移动端确认链接：scheme 优先唤起 TapTap，https 作为兜底（新开标签页）
  const [taptapConfirmUrl, setTaptapConfirmUrl] = useState<string>('');
  const isMobile = useClientValue(() => {
    const ua = navigator.userAgent || '';
    return /Mobile|Android|iP(hone|od|ad)|HarmonyOS|Huawei/i.test(ua);
  }, false);
  const taptapWebConfirmUrl = normalizeTapTapConfirmUrl(taptapConfirmUrl);
  const taptapSchemeConfirmUrl = buildTapTapLoginAuthDeepLink(taptapWebConfirmUrl || taptapConfirmUrl);
  const pollAbortRef = useRef<AbortController | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowRef = useRef<TapTapFlow | null>(null);

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

  // 拿到 sessionToken 后统一提交到 /api/session/login（Cap 验证 → 建立会话）
  const submitSessionLogin = useCallback(async (sessionToken: string) => {
    const credential: SessionCredential = {
      type: 'session',
      token: sessionToken,
      timestamp: Date.now(),
    };
    // 获取 Cap 验证码 token（程序化模式，已在页面加载时启动后台解题）
    const capToken = await getCapToken();
    await loginRef.current(credential, capToken);
  }, []);

  // 首次登录：拉码 → 轮询授权 → 换资料/sessionToken → 建会话
  const startLogin = useCallback(async () => {
    try {
      setStatus('loading');
      setError('');
      setCanResume(false);
      flowRef.current = null;
      cancelPolling();

      const version = taptapVersion ?? AuthStorage.getTapTapVersion();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      const codeData = await requestTapTapDeviceCode(version, controller.signal);
      flowRef.current = { version, qr: codeData };

      setQrCodeImage(codeData.qrcodeUrl);
      try {
        // qrcode 仅此处使用：延迟到真正出码时再加载，避免其进入扫码面板的首屏 chunk。
        const { default: QRCode } = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(codeData.qrcodeUrl, { width: 256, margin: 1 });
        setQrCodeDataUrl(dataUrl);
      } catch {
        setQrCodeDataUrl(codeData.qrcodeUrl);
      }
      // 移动端：优先使用携带 user_code 的完整链接，避免跳转后还需要手动输入验证码
      setTaptapConfirmUrl(codeData.qrcodeUrl || codeData.verificationUrl);
      setStatus('scanning');

      // 二维码过期定时
      expireTimerRef.current = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
          setStatus('expired');
          setError('二维码已过期，请重新获取');
        }
      }, (codeData.expiresIn ?? 300) * 1000);

      // 轮询授权（真正的上游轮询已由服务端后台承担，客户端只读状态）
      const token = await pollTapTapToken(
        version,
        codeData.deviceCode,
        codeData.deviceId,
        codeData.interval * 1000,
        (codeData.expiresIn ?? 300) * 1000,
        controller.signal,
        codeData.flowId,
      );

      // 用户已授权：二维码不再重要，撤掉过期定时器，并标记为可续跑
      if (expireTimerRef.current) {
        clearTimeout(expireTimerRef.current);
        expireTimerRef.current = null;
      }
      if (flowRef.current) flowRef.current.token = token;
      setCanResume(true);

      const { sessionToken } = await finishTapTapQrLogin(version, codeData, token, { signal: controller.signal });
      if (flowRef.current) flowRef.current.sessionToken = sessionToken;

      await submitSessionLogin(sessionToken);

      cancelPolling();
      flowRef.current = null;
      setCanResume(false);
      setStatus('success');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      console.error('扫码登录失败:', err);
      cancelPolling();
      if (isFlowInvalidError(err)) {
        flowRef.current = null;
        setCanResume(false);
      }
      setStatus('error');
      setError(err instanceof Error ? err.message : '扫码登录失败，请重试');
    }
  }, [taptapVersion, cancelPolling, submitSessionLogin]);

  // 续跑：复用已拿到的 token / sessionToken，绝不重新拉码让用户重扫
  const resumeLogin = useCallback(async () => {
    const flow = flowRef.current;
    if (!flow || (!flow.token && !flow.sessionToken)) {
      await startLogin();
      return;
    }
    try {
      setStatus('resuming');
      setError('');
      cancelPolling();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      let sessionToken = flow.sessionToken;
      if (!sessionToken) {
        // 已授权但还没换到 sessionToken：只重放「资料 → LeanCloud」这一段
        const result = await finishTapTapQrLogin(flow.version, flow.qr, flow.token as TokenResponse, {
          signal: controller.signal,
        });
        sessionToken = result.sessionToken;
        flow.sessionToken = sessionToken;
      }

      await submitSessionLogin(sessionToken);

      cancelPolling();
      flowRef.current = null;
      setCanResume(false);
      setStatus('success');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      console.error('继续登录失败:', err);
      cancelPolling();
      if (isFlowInvalidError(err)) {
        flowRef.current = null;
        setCanResume(false);
      }
      setStatus('error');
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    }
  }, [cancelPolling, submitSessionLogin, startLogin]);

  // 组件挂载时自动获取二维码
  useEffect(() => {
    // 说明：通过异步调度触发拉码，避免在 effect 同步阶段直接触发一串 setState（符合 React 19 hooks 规则）。
    const timer = window.setTimeout(() => {
      void startLogin();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cancelPolling();
    };
  }, [startLogin, cancelPolling]);

  const handleRetry = () => {
    if (canResume) {
      void resumeLogin();
    } else {
      void startLogin();
    }
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

      {(status === 'loading' || status === 'resuming') && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {status === 'resuming' ? '正在完成登录...' : '正在获取二维码...'}
          </p>
          <RotatingTips />
        </div>
      )}

      {status === 'scanning' && (qrCodeDataUrl || qrCodeImage) && (
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element -- 说明：二维码为 data: 或第三方短期资源，迁移 next/image 收益有限且会引入 remotePatterns 维护成本 */}
            <img
              src={qrCodeDataUrl || qrCodeImage}
              alt="登录二维码"
              className="w-64 h-64 object-contain"
              width={256}
              height={256}
              decoding="async"
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
          {isMobile && taptapConfirmUrl && (
            <div className="w-full max-w-sm pt-2 md:hidden">
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                <span className="mx-3 text-xs text-gray-500 dark:text-gray-400">或</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <a
                href={taptapSchemeConfirmUrl || taptapWebConfirmUrl || taptapConfirmUrl}
                className="mt-3 block w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                去 TapTap 中确认登录
              </a>
              {(taptapWebConfirmUrl || taptapConfirmUrl) && (
                <a
                  href={
                    buildGoHref(taptapWebConfirmUrl || taptapConfirmUrl) ??
                    (taptapWebConfirmUrl || taptapConfirmUrl)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="mt-2 block w-full text-center text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  无法唤起 TapTap？在新标签页打开确认页
                </a>
              )}
              <p className="mt-2 text-xs text-center text-gray-600 dark:text-gray-400">
                确认后请回到浏览器阅读并同意《用户协议》，然后返回本页等待完成登录。
              </p>
            </div>
          )}
        </div>
      )}

      {/* 成功态必须同时满足 isAuthenticated：登录接口失败或用户在协议弹窗选择「不同意」
          （handleCloseAgreement 会登出）时，status 仍是 success 但会话并未建立，
          旧实现只凭 status 就渲染「正在跳转到首页…」，导致永久卡死。 */}
      {status === 'success' && isAuthenticated && (
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
            {consentRequired ? '请在弹窗中阅读并同意用户协议后继续' : '正在跳转到首页...'}
          </p>
        </div>
      )}

      {(status === 'error' || status === 'expired' || (status === 'success' && !isAuthenticated)) && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {status === 'expired' ? '二维码已过期' : status === 'success' ? '登录未完成' : '登录失败'}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            {error || authError || (status === 'success' ? '登录未能完成，请重新获取二维码' : '')}
          </p>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {canResume ? '重试登录' : '重新获取二维码'}
            </button>
            {canResume && (
              <button
                onClick={() => {
                  // 用户已授权但若续跑始终失败，仍允许主动换一张码重来
                  flowRef.current = null;
                  setCanResume(false);
                  void startLogin();
                }}
                className="px-4 py-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                重新获取二维码
              </button>
            )}
          </div>
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
