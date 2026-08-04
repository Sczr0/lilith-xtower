'use client';

import * as Dialog from '@radix-ui/react-dialog';

interface SessionExpiredModalProps {
  onReLogin: () => void;
  onDismiss: () => void;
}

/**
 * 登录状态异常弹窗：
 * 本地缓存标记已登录，但服务端会话校验未通过（过期/被吊销）时弹出，
 * 引导用户重新登录。允许 ESC / 点击遮罩关闭（“我知道了”），
 * 缓存已在触发时清除，不会反复弹出。
 */
export function SessionExpiredModal({ onReLogin, onDismiss }: SessionExpiredModalProps) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <Dialog.Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Overlay className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden focus:outline-none">
            {/* Header */}
            <header className="flex items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                </div>
                <Dialog.Title asChild>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">登录状态异常</h2>
                </Dialog.Title>
              </div>
            </header>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                您的登录状态已失效，请重新登录后继续使用服务。
              </p>
            </div>

            {/* Footer */}
            <footer className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-end">
              <button
                onClick={onDismiss}
                className="px-5 py-2.5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white transition-colors"
              >
                我知道了
              </button>
              <button
                onClick={onReLogin}
                className="px-6 py-2.5 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-colors"
              >
                去登录
              </button>
            </footer>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
