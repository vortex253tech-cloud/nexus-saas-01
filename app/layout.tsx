import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { AuthProvider }  from '@/lib/auth-provider'
import { ThemeProvider } from '@/lib/themes/theme-context'
import { THEMES_INLINE_SCRIPT } from '@/lib/themes/themes'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'NEXUS — Seu COO de IA',
  description:
    'Inteligência financeira para empresas que querem crescer. Monitore, analise e tome decisões com IA.',
  openGraph: {
    title: 'NEXUS — Seu COO de IA',
    description: 'Inteligência financeira para empresas que querem crescer.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={geist.variable} suppressHydrationWarning>
      <head>
        {/* Flash-prevention: applies saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{ __html: THEMES_INLINE_SCRIPT }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
