'use client';

import { useMemo, useState } from 'react';
import type { PrecompiledSignatureInfo } from '@/app/lib/precompiled-types';

interface SignatureBarProps {
  signatureInfo: PrecompiledSignatureInfo;
}

function getSignatureStatusText(signatureInfo: PrecompiledSignatureInfo): string {
  if (signatureInfo.status !== 'signed') return '未签名';
  if (signatureInfo.verified === true) return '已签名（校验通过）';
  if (signatureInfo.verified === false) return '已签名（校验失败）';
  return '已签名（未校验）';
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  // 优先使用现代 Clipboard API；失败时降级到 execCommand（兼容性兜底）
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 页面底部签名信息栏：
 * - 提示签名状态（已签名/未签名 + 是否校验）
 * - 可展开查看签名块全文，并一键复制
 *
 * 注意：当前站内不做签名校验（verified 为 null），仅用于展示与用户自行核验。
 */
export function SignatureBar({ signatureInfo }: SignatureBarProps) {
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');

  const statusText = useMemo(() => getSignatureStatusText(signatureInfo), [signatureInfo]);
  const hashText = signatureInfo.hash ? `Hash: ${signatureInfo.hash}` : null;
  const signatureText = typeof signatureInfo.signature === 'string' ? signatureInfo.signature : '';

  if (!signatureInfo || signatureInfo.format !== 'openpgp-clearsign') return null;

  const onCopy = async () => {
    if (!signatureText) return;
    const ok = await copyTextToClipboard(signatureText);
    setCopyState(ok ? 'ok' : 'fail');
    window.setTimeout(() => setCopyState('idle'), 1500);
  };

  return (
    <div className="mt-6 border-t border-gray-200 dark:border-neutral-800 pt-4 text-xs text-gray-600 dark:text-gray-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-gray-700 dark:text-gray-200">签名</span>
          <span>{statusText}</span>
          {hashText ? <span className="text-gray-500 dark:text-gray-400">{hashText}</span> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={!signatureText}
            className="rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 shadow-sm disabled:opacity-50"
          >
            {open ? '收起' : '查看签名'}
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!signatureText}
            className="rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 shadow-sm disabled:opacity-50"
          >
            {copyState === 'ok' ? '已复制' : copyState === 'fail' ? '复制失败' : '复制签名'}
          </button>
        </div>
      </div>

      {open && signatureText ? (
        <div className="mt-3 rounded-md border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/40 p-3">
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
            {signatureText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

