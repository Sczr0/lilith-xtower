import { ImageResponse } from 'next/og'
import React from 'react'

// 标题来自公开 query，仅用于文案渲染：截断以避免超长入参放大 satori 布局开销
const TITLE_MAX_LENGTH = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const title = (searchParams.get('title') ?? 'Phigros Query').slice(0, TITLE_MAX_LENGTH)
  const style: React.CSSProperties = {
    width: '1200px',
    height: '630px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
    color: 'white',
    fontSize: 72,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    padding: '80px',
    textAlign: 'center',
  }
  return new ImageResponse(React.createElement('div', { style }, title), {
    width: 1200,
    height: 630,
    // ImageResponse 每次都要跑一遍 satori + resvg 栅格化，同一标题的结果是确定性的：
    // 交给 CDN 缓存，避免社交抓取/页面预览每次命中源站 CPU。
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
