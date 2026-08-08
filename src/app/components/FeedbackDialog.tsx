'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import { submitFeedback } from '../contribute/actions';
import { useAuth } from '../contexts/AuthContext';
import {
  formatDiagnosticsBlock,
  getDiagnosticsSnapshot,
  pushEvent,
  type DiagnosticsSnapshot,
} from '../lib/diagnostics/collector';
import { copyText } from '../utils/copyText';
import { buttonStyles, inputStyles } from './ui/styles';

interface FeedbackDialogProps {
  /** button=主要按钮；outline=描边按钮（错误页）；link=页脚链接样式 */
  variant?: 'button' | 'outline' | 'link';
  label?: string;
  /** 错误页传入：出错上下文会写入诊断信息轨迹 */
  initialError?: { message?: string; stack?: string; digest?: string };
}

/**
 * 反馈弹窗可被错误页渲染（此时 AuthProvider 可能已损坏），
 * 因此登录态用“可选”方式读取，缺 Provider 时按未登录处理。
 */
function useOptionalAuth() {
  try {
    return useAuth();
  } catch {
    return { isAuthenticated: false, isLoading: false };
  }
}

export function FeedbackDialog({
  variant = 'button',
  label = '遇到问题？',
  initialError,
}: FeedbackDialogProps) {
  const { isAuthenticated, isLoading } = useOptionalAuth();
  const [open, setOpen] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorPushedRef = useRef(false);

  const refreshSnapshot = () => {
    setSnapshot(getDiagnosticsSnapshot());
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setResult(null);
      setShowDiagnostics(false);
      // 错误页入口：把出错上下文补进轨迹（每挂载一次），随诊断块一起携带
      if (initialError && !errorPushedRef.current) {
        errorPushedRef.current = true;
        pushEvent({
          t: Date.now(),
          type: 'error',
          message: initialError.message ?? 'Unknown error',
          stack: initialError.stack,
        });
      }
      refreshSnapshot();
    }
  };

  const handleCopy = async () => {
    const block = snapshot ? formatDiagnosticsBlock(snapshot) : '';
    const ok = await copyText(block);
    setCopyHint(ok ? '已复制诊断信息' : '复制失败，请手动复制');
    window.setTimeout(() => setCopyHint(null), 1600);
  };

  const handleSubmit = (formData: FormData) => {
    setResult(null);
    startTransition(async () => {
      formData.set('category', 'bug');
      formData.set('diagnostics', formatDiagnosticsBlock(snapshot ?? getDiagnosticsSnapshot()));
      const res = await submitFeedback(formData);
      setResult({ type: res.success ? 'success' : 'error', text: res.message });
      if (res.success) {
        formRef.current?.reset();
        setShowDiagnostics(false);
      }
    });
  };

  const triggerClass =
    variant === 'link'
      ? 'hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer'
      : buttonStyles({ variant: variant === 'button' ? 'primary' : 'outline' });

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button type="button" className={triggerClass}>
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Overlay className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden focus:outline-none">
            {/* Header */}
            <header className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <Dialog.Title asChild>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">遇到问题？</h2>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="关闭"
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </Dialog.Close>
            </header>

            {/* Content */}
            <form ref={formRef} action={handleSubmit} id="feedback-form" className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* 反机器人蜜罐字段：正常用户不可见（与服务端校验一致） */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

              <div>
                <label htmlFor="feedback-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  问题描述（限 500 字）
                </label>
                <textarea
                  id="feedback-content"
                  name="content"
                  rows={4}
                  maxLength={500}
                  required
                  placeholder="发生了什么？例如：点击生成 BestN 图片时一直转圈……"
                  className={inputStyles({ className: 'resize-none' })}
                />
              </div>

              <div>
                <label htmlFor="feedback-contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  联系方式（必填）
                </label>
                <input
                  id="feedback-contact"
                  name="contact"
                  maxLength={50}
                  required
                  placeholder="QQ / 邮箱（仅管理员可见，请标注具体平台）"
                  className={inputStyles({ className: 'py-2.5' })}
                />
              </div>

              {/* 诊断信息（自动采集） */}
              <div className="rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span>诊断信息（自动采集，随反馈一起提交）</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showDiagnostics ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDiagnostics && snapshot && (
                  <div className="border-t border-gray-200 dark:border-neutral-700 p-3 space-y-2 bg-gray-50 dark:bg-neutral-900/50">
                    <pre className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {formatDiagnosticsBlock(snapshot)}
                    </pre>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                      >
                        复制诊断信息
                      </button>
                      <button
                        type="button"
                        onClick={refreshSnapshot}
                        className={buttonStyles({ variant: 'outline', size: 'sm' })}
                      >
                        刷新
                      </button>
                      {copyHint && (
                        <span role="status" className="text-xs text-green-600 dark:text-green-400">
                          {copyHint}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      包含页面、版本、浏览器、最近操作与错误；不含密码等敏感信息。也可复制后直接发到 QQ 群。
                    </p>
                  </div>
                )}
              </div>

              {!isLoading && !isAuthenticated && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  提交问题反馈需要登录。尚未登录？
                  <Link href="/login" className="underline underline-offset-2 ml-1">
                    去登录
                  </Link>
                </p>
              )}

              {result && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className={`p-3 rounded-lg text-sm ${
                    result.type === 'success'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  }`}
                >
                  {result.text}
                </div>
              )}
            </form>

            {/* Footer */}
            <footer className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <button type="button" className={buttonStyles({ variant: 'secondary' })}>
                  关闭
                </button>
              </Dialog.Close>
              <button
                type="submit"
                form="feedback-form"
                disabled={isPending || !isAuthenticated}
                className={buttonStyles({ variant: 'primary' })}
              >
                {isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    提交中...
                  </>
                ) : (
                  '提交反馈'
                )}
              </button>
            </footer>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
