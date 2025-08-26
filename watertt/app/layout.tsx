import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '세무 일정 관리 시스템',
  description: '전기차 충전소 세금 일정 관리 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}