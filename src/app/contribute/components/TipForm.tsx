'use client';

import { useRef, useState, useTransition } from 'react';
import { submitTip } from '../actions';
import { buttonStyles, cardStyles, inputStyles } from '../../components/ui/styles';

export function TipForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await submitTip(formData);
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
      if (result.success) {
        // 清空表单并收起高级选项
        formRef.current?.reset();
        setShowAdvanced(false);
      }
    });
  }

  return (
    <div className={cardStyles({ tone: 'glass' })}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tips 投稿</h2>
      </div>

      <form ref={formRef} action={handleSubmit} className="space-y-4">
        {/* 反机器人蜜罐字段：正常用户不可见，若被填写则服务端会静默丢弃 */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

        <div>
          <label htmlFor="tip" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            你的 Tip 内容
          </label>
          <textarea
            id="tip"
            name="tip"
            rows={4}
            maxLength={100}
            placeholder="输入你想分享的 Tip（限100字）..."
            className={inputStyles({ className: 'resize-none' })}
            required
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">支持纯文本，请勿包含敏感信息</p>
        </div>

        <div className="space-y-3 pt-2 border-t border-dashed border-gray-200 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">需要附加信息？可在高级选项里填写。</p>
            <button
              type="button"
              onClick={() => setShowAdvanced((open) => !open)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 font-medium"
            >
              {showAdvanced ? '收起高级选项' : '展开高级选项'}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-2">
              <label htmlFor="author" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                投稿人（可选）
              </label>
              <input
                id="author"
                name="author"
                maxLength={30}
                placeholder="例如：鱼丸，或留空匿名投稿"
                className={inputStyles({ className: 'py-2.5' })}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">不填默认显示“匿名投稿”，最长 30 字</p>
            </div>
          )}
        </div>

        {message && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <button type="submit" disabled={isPending} className={buttonStyles({ fullWidth: true, variant: 'primary' })}>
          {isPending ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              发送中...
            </>
          ) : (
            '提交投稿'
          )}
        </button>
      </form>
    </div>
  );
}
