import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/demo/score-card',
  },
}

export default function ScoreCardDemoLayout({ children }: { children: React.ReactNode }) {
  return children
}

