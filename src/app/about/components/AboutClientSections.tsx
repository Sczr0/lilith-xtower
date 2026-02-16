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
  // 临时开关：隐藏“感谢服务提供商”区块。
  const showServiceProviderSection = false;

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
    }
  ].filter(provider => provider.show);

  return (
    <>
      {showServiceProviderSection ? (
        /* 感谢服务提供商 */
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
      ) : null}

      {/* 服务统计（极简配色） */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">服务统计</h2>
        <ServiceStats variant="mono" showTitle={false} showDescription={false} />
      </section>
    </>
  );
}
