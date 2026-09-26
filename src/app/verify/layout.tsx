import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '图片验证 校验 Phigros Query 生成的成绩图片签名',
  description:
    'Phigros Query 图片验证工具，用于校验本站生成的 SVG / PNG 成绩图片是否被篡改：支持本地内容哈希比对、后端 HMAC 签名验证与 PNG 隐写水印提取。',
  keywords: ['Phigros', '图片验证', '签名校验', 'HMAC', 'Phigros Query', '成绩图片'],
  openGraph: {
    type: 'website',
    url: '/verify',
    title: '图片验证 校验 Phigros Query 生成的成绩图片签名',
    description:
      'Phigros Query 图片验证工具，用于校验本站生成的 SVG / PNG 成绩图片是否被篡改：支持本地内容哈希比对、后端 HMAC 签名验证与 PNG 隐写水印提取。',
    siteName: 'Phigros Query',
    locale: 'zh_CN',
    images: [{ url: '/og?title=图片验证', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '图片验证 校验 Phigros Query 生成的成绩图片签名',
    description:
      'Phigros Query 图片验证工具，用于校验本站生成的 SVG / PNG 成绩图片是否被篡改：支持本地内容哈希比对、后端 HMAC 签名验证与 PNG 隐写水印提取。',
    images: ['/og?title=图片验证'],
  },
  alternates: {
    canonical: '/verify',
  },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
