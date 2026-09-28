'use client';

import Image from 'next/image';
import { ServiceStats } from '../../components/ServiceStats';
import { useClientValue } from '../../hooks/useClientValue';
import { buildGoHref } from '../../utils/outbound';

/**
 * About 页面的客户端动态部分
 * 包含：平台检测、服务统计、赞助者列表
 */
export function AboutClientSections() {
  // 检测部署平台：
  // - 首屏使用 serverValue（空字符串）保证与静态 HTML 一致，避免 hydration mismatch。
  // - hydration 后再读取浏览器 hostname，对齐真实部署环境。
  const hostname = useClientValue(() => window.location.hostname, '');

  // 优先判断 Netlify
  const isNetlify = hostname.includes('netlify.app') || hostname === 'startrip.xtower.site';

  // Vercel：排除 Netlify 域名后再判断
  const isVercel =
    !!hostname &&
    !isNetlify &&
    (hostname.includes('vercel.app') || hostname.includes('xtower.site')); // 匹配所有其他 xtower.site 相关域名

  const serviceProviders = [
    {
      name: 'Cloudflare',
      url: 'https://www.cloudflare.com',
      logo: (
        <Image
          src="/Cloudflare.png"
          alt="Cloudflare"
          width={120}
          height={32}
          className="h-8 w-auto"
        />
      ),
      description: 'CDN，DNS与安全服务',
      show: true
    },
    {
      name: 'Vercel',
      url: 'https://vercel.com',
      logo: (
        <svg height="32" viewBox="0 0 283 64" fill="none" className="text-black dark:text-white">
          <path fill="currentColor" d="M141.68 16.25c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM248.72 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM200.24 34c0 6 3.92 10 10 10 4.12 0 7.21-1.87 8.8-4.92l7.68 4.43c-3.18 5.3-9.14 8.49-16.48 8.49-11.05 0-19-7.2-19-18s7.96-18 19-18c7.34 0 13.29 3.19 16.48 8.49l-7.68 4.43c-1.59-3.05-4.68-4.92-8.8-4.92-6.07 0-10 4-10 10zm82.48-29v46h-9V5h9zM36.95 0L73.9 64H0L36.95 0zm92.38 5l-27.71 48L73.91 5H84.3l17.32 30 17.32-30h10.39zm58.91 12v9.69c-1-.29-2.06-.49-3.2-.49-5.81 0-10 4-10 10V51h-9V17h9v9.2c0-5.08 5.91-9.2 13.2-9.2z"/>
        </svg>
      ),
      description: '部署与托管服务',
      show: isVercel
    },
    {
      name: 'Netlify',
      url: 'https://www.netlify.com',
      logo: (
        <Image
          src="/netlify-badge-color-accent.svg"
          alt="Deploys by Netlify"
          width={160}
          height={32}
          className="h-8 w-auto"
        />
      ),
      description: '部署与托管服务',
      show: isNetlify
    },
    {
      name: 'Sentry',
      url: 'https://sentry.io',
      logo: (
        <svg
          viewBox="0 0 222 66"
          aria-hidden="true"
          className="h-8 w-auto text-black dark:text-white"
        >
          <path
            fill="currentColor"
            transform="translate(11, 11)"
            d="M29,2.26a4.67,4.67,0,0,0-8,0L14.42,13.53A32.21,32.21,0,0,1,32.17,40.19H27.55A27.68,27.68,0,0,0,12.09,17.47L6,28a15.92,15.92,0,0,1,9.23,12.17H4.62A.76.76,0,0,1,4,39.06l2.94-5a10.74,10.74,0,0,0-3.36-1.9l-2.91,5a4.54,4.54,0,0,0,1.69,6.24A4.66,4.66,0,0,0,4.62,44H19.15a19.4,19.4,0,0,0-8-17.31l2.31-4A23.87,23.87,0,0,1,23.76,44H36.07a35.88,35.88,0,0,0-16.41-31.8l4.67-8a.77.77,0,0,1,1.05-.27c.53.29,20.29,34.77,20.66,35.17a.76.76,0,0,1-.68,1.13H40.6q.09,1.91,0,3.81h4.78A4.59,4.59,0,0,0,50,39.43a4.49,4.49,0,0,0-.62-2.28Z M124.32,28.28,109.56,9.22h-3.68V34.77h3.73V15.19l15.18,19.58h3.26V9.22h-3.73ZM87.15,23.54h13.23V20.22H87.14V12.53h14.93V9.21H83.34V34.77h18.92V31.45H87.14ZM71.59,20.3h0C66.44,19.06,65,18.08,65,15.7c0-2.14,1.89-3.59,4.71-3.59a12.06,12.06,0,0,1,7.07,2.55l2-2.83a14.1,14.1,0,0,0-9-3c-5.06,0-8.59,3-8.59,7.27,0,4.6,3,6.19,8.46,7.52C74.51,24.74,76,25.78,76,28.11s-2,3.77-5.09,3.77a12.34,12.34,0,0,1-8.3-3.26l-2.25,2.69a15.94,15.94,0,0,0,10.42,3.85c5.48,0,9-2.95,9-7.51C79.75,23.79,77.47,21.72,71.59,20.3ZM195.7,9.22l-7.69,12-7.64-12h-4.46L186,24.67V34.78h3.84V24.55L200,9.22Zm-64.63,3.46h8.37v22.1h3.84V12.68h8.37V9.22H131.08ZM169.41,24.8c3.86-1.07,6-3.77,6-7.63,0-4.91-3.59-8-9.38-8H154.67V34.76h3.8V25.58h6.45l6.48,9.2h4.44l-7-9.82Zm-10.95-2.5V12.6h7.17c3.74,0,5.88,1.77,5.88,4.84s-2.29,4.86-5.84,4.86Z"
          />
        </svg>
      ),
      description: '错误监控与性能追踪',
      show: true
    }
  ].filter(provider => provider.show);

  return (
    <>
      {/* 感谢服务提供商 */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">感谢</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">感谢以下服务提供商为本站提供的服务：</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {serviceProviders.map((provider) => (
            <a
              key={provider.name}
              href={buildGoHref(provider.url) ?? provider.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="border border-gray-200 dark:border-neutral-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-neutral-700 transition-colors flex flex-col items-center justify-center gap-3 group"
            >
              <div className="flex items-center justify-center">
                {provider.logo}
              </div>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">{provider.description}</p>
            </a>
          ))}
        </div>
      </section>

      {/* 服务统计（极简配色） */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">服务统计</h2>
        <ServiceStats variant="mono" showTitle={false} showDescription={false} />
      </section>
    </>
  );
}
