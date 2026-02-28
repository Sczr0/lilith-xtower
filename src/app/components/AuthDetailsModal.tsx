'use client';

import { useEffect, useId, useRef } from 'react';
import type { AuthCredentialSummary } from '../lib/auth/credentialSummary';

interface AuthDetailsModalProps {
  credential: AuthCredentialSummary;
  isOpen: boolean;
  onClose: () => void;
}

export function AuthDetailsModal({ credential, isOpen, onClose }: AuthDetailsModalProps) {
  const dialogId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    previousFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = 'hidden';
    window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

      if (focusableElements.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === firstElement || !dialog.contains(current)) {
          e.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (current === lastElement || !dialog.contains(current)) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = previousBodyOverflow;

      if (
        previousFocusedElementRef.current &&
        document.contains(previousFocusedElementRef.current)
      ) {
        previousFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderCredentialDetails = () => {
    switch (credential.type) {
      case 'session':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">
                SessionToken 凭证
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-400">类型:</span>
                  <span className="text-green-900 dark:text-green-200">SessionToken</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-400">登录时间:</span>
                  <span className="text-green-900 dark:text-green-200">{formatTimestamp(credential.timestamp)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">SessionToken</h4>
              <code className="block bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs break-all text-gray-800 dark:text-gray-200">
                {credential.tokenMasked}
              </code>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                联合查分 API 凭证
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">类型:</span>
                  <span className="text-blue-900 dark:text-blue-200">联合查分 API</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">登录时间:</span>
                  <span className="text-blue-900 dark:text-blue-200">{formatTimestamp(credential.timestamp)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">API 凭证信息</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">用户 ID:</span>
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-xs text-gray-800 dark:text-gray-200">
                    {credential.api_user_id}
                  </code>
                </div>
                {credential.api_token_masked && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">API Token:</span>
                    <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-xs text-gray-800 dark:text-gray-200 break-all">
                      {credential.api_token_masked}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'platform':
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h3 className="font-medium text-purple-800 dark:text-purple-300 mb-2">
                联合查分平台凭证
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-700 dark:text-purple-400">类型:</span>
                  <span className="text-purple-900 dark:text-purple-200">平台登录</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700 dark:text-purple-400">登录时间:</span>
                  <span className="text-purple-900 dark:text-purple-200">{formatTimestamp(credential.timestamp)}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">平台凭证信息</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平台:</span>
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-xs text-gray-800 dark:text-gray-200">
                    {credential.platform}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平台用户 ID:</span>
                  <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-xs text-gray-800 dark:text-gray-200">
                    {credential.platform_id}
                  </code>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">
              未知的凭证类型
            </p>
          </div>
        );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="点击遮罩关闭认证凭证详情弹窗"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 id={dialogId} className="text-xl font-bold text-gray-900 dark:text-gray-100">
              认证凭证详情
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="关闭认证凭证详情弹窗"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p id={descriptionId} className="sr-only">
            这是认证凭证详情弹窗，按 Escape 可关闭，Tab 键会在弹窗内部循环。
          </p>

          {/* Content */}
          <div className="px-6 py-4">
            {renderCredentialDetails()}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2 text-sm">
                安全提示
              </h3>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>• 本页不会展示完整 token，仅展示脱敏摘要</li>
                <li>• 凭证存储在 HttpOnly 会话 Cookie 中（仅服务端可读）</li>
                <li>• 如有安全疑虑，请及时退出登录并重新登录</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
