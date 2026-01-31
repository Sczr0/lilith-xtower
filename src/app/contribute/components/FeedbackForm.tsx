'use client';

import { useRef, useState, useTransition } from 'react';
import { submitFeedback } from '../actions';
import { buttonStyles, cardStyles, inputStyles } from '../../components/ui/styles';

const CATEGORIES = [
  { id: 'tip', label: 'Tip 投稿', desc: '分享有趣的 Tips (限100字)', limit: 100 },
  { id: 'bug', label: 'Bug 反馈', desc: '报告问题或错误 (限500字)', limit: 500 },
  { id: 'feature', label: '功能建议', desc: '想法与改进建议 (限500字)', limit: 500 },
  { id: 'other', label: '其他', desc: '其他想说的话 (限500字)', limit: 500 },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

export function FeedbackForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [category, setCategory] = useState<CategoryId>('tip');

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      // Append category manually since it's controlled state
      formData.set('category', category);
      
      const result = await submitFeedback(formData);
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

  const currentCategory = CATEGORIES.find(c => c.id === category)!;

  return (
    <div className={cardStyles({ tone: 'glass' })}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">投稿与反馈</h2>
      </div>

      <form ref={formRef} action={handleSubmit} className="space-y-6">
        {/* 反机器人蜜罐字段：正常用户不可见，若被填写则服务端会静默丢弃 */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

        {/* 分类选择 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`
                px-3 py-2 text-sm font-medium rounded-md transition-colors
                ${category === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'
                }
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {category === 'tip' ? 'Tip 内容' : '反馈内容'}
          </label>
          <textarea
            id="content"
            name="content"
            rows={5}
            maxLength={currentCategory.limit}
            placeholder={currentCategory.desc}
            className={inputStyles({ className: 'resize-none' })}
            required
          />
          <div className="mt-1 text-xs text-right text-gray-500 dark:text-gray-400">
             限 {currentCategory.limit} 字
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((open) => !open)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 font-medium flex items-center gap-1"
            >
              {showAdvanced ? (
                <>
                  <span>收起选项</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </>
              ) : (
                <>
                  <span>更多选项（署名，联系方式）</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </>
              )}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label htmlFor="author" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                署名（可选）
              </label>
              <input
                id="author"
                name="author"
                maxLength={30}
                placeholder="例如：鱼丸，或留空匿名"
                className={inputStyles({ className: 'py-2.5' })}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">不填默认显示“匿名用户”</p>

              <label htmlFor="contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                联系方式（可选）
              </label>
              <input
                id="contact"
                name="contact"
                maxLength={50}
                placeholder="QQ / 邮箱 / 其他社交账号"
                className={inputStyles({ className: 'py-2.5' })}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">方便我们在需要时联系你（仅管理员可见，请标注具体平台）</p>
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
            '提交反馈'
          )}
        </button>
      </form>
    </div>
  );
}
