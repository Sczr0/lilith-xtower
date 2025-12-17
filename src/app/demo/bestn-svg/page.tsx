import React from 'react';
import { BnImageGenerator } from '../../components/BnImageGenerator';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await searchParams) ?? {};
  const raw = resolved.debug;
  const debug =
    raw === '1' ||
    raw === 'true' ||
    (Array.isArray(raw) && (raw.includes('1') || raw.includes('true')));

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          BestN SVG æ¸²æŸ“æµ‹è¯•
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          æœ¬é¡µé¢å¤ç”?BestN ç”Ÿæˆç»„ä»¶ï¼Œå¹¶åœ¨è¯·æ±‚ä¸­é€šè¿‡æŸ¥è¯¢å‚æ•°æ·»åŠ {' '}
          <code className="font-mono">format=svg</code> èŽ·å– SVG è¾“å‡ºï¼Œç”¨äºŽéªŒè¯å‰ç«¯èƒ½å¦æ­£å¸¸æ¸²æŸ“åŽç«¯è¿”å›žçš„ SVG å›¾ç‰‡ã€?
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          æç¤ºï¼šè¯¥åŠŸèƒ½éœ€è¦ç™»å½•å‡­è¯ï¼›è‹¥æœªç™»å½•è¯·å…ˆå‰å¾€ç™»å½•é¡µã€?
        </p>
      </header>

      <BnImageGenerator
        showTitle={false}
        showDescription={false}
        format="svg"
        showSvgSource
        debugExport={debug}
      />
    </div>
  );
}
