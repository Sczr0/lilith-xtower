import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/agreement',
  },
}

export default function AgreementLayout({ children }: { children: React.ReactNode }) {
  return children
}

