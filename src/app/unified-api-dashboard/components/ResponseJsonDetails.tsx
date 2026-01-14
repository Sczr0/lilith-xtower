'use client';

import { useMemo, useState } from 'react';

import { buttonStyles, cx } from '../../components/ui/styles';
import { stringifyJsonForDisplay } from '../../utils/redactJson';

export function ResponseJsonDetails({ data, className = 'mt-4' }: { data: unknown; className?: string }) {
  const [showRaw, setShowRaw] = useState(false);

  const redactedText = useMemo(() => stringifyJsonForDisplay(data), [data]);
  const rawText = useMemo(() => (showRaw ? stringifyJsonForDisplay(data, { redacted: false }) : ''), [data, showRaw]);

  const handleRevealRaw = () => {
    if (showRaw) return;
    const ok = window.confirm(
      '原始响应可能包含敏感信息（如 token/用户标识）。仅建议在本机可控环境排障使用，并避免截图/复制分享。确定要显示吗？',
    );
    if (!ok) return;
    setShowRaw(true);
  };

  return (
    <details className={cx(className)}>
      <summary className="cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400">查看响应 JSON（默认脱敏）</summary>
      <pre className="mt-3 p-3 rounded bg-gray-100/70 dark:bg-gray-900/50 overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
        <code>{redactedText}</code>
      </pre>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-gray-500 dark:text-gray-500">提示：脱敏会遮罩 token/secret 等字段，用于降低误泄露风险。</p>
        {showRaw ? (
          <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={() => setShowRaw(false)}>
            隐藏原始 JSON
          </button>
        ) : (
          <button type="button" className={buttonStyles({ variant: 'outline', size: 'sm' })} onClick={handleRevealRaw}>
            显示原始 JSON
          </button>
        )}
      </div>
      {showRaw && (
        <pre className="mt-3 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 overflow-x-auto text-xs text-gray-700 dark:text-gray-300">
          <code>{rawText}</code>
        </pre>
      )}
    </details>
  );
}

