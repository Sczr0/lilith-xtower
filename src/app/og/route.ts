import { ImageResponse } from 'next/og'
import React from 'react'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') ?? 'Phigros Query'
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
  })
}
