'use client';

import { useEffect } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  installErrorCapture,
  installFetchPatch,
  installRouteTracking,
  reportErrorToServer,
  setDiagnosticsLogin,
} from '../lib/diagnostics/collector';

const isProd = process.env.NODE_ENV === 'production';

/**
 * 诊断采集初始化（挂载于根布局 AuthProvider 内，无 UI）。
 * - 仅生产环境安装全局错误捕获 / 请求轨迹 / 路由跟踪（避免开发噪音）
 * - 登录态始终同步到采集器（反馈弹窗展示与诊断块需要）
 */
export function DiagnosticsInit() {
  const { isAuthenticated, credential } = useAuth();

  useEffect(() => {
    if (!isProd) return;
    const offError = installErrorCapture(({ message, stack }) => {
      reportErrorToServer(message, stack, window.location.pathname);
    });
    const offFetch = installFetchPatch();
    const offRoute = installRouteTracking();
    return () => {
      offError();
      offFetch();
      offRoute();
    };
  }, []);

  useEffect(() => {
    setDiagnosticsLogin({ authenticated: isAuthenticated, method: credential?.type });
  }, [isAuthenticated, credential]);

  return null;
}
