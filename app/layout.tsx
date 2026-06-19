import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { AuthProvider }  from '@/lib/auth-provider'
import { ThemeProvider } from '@/lib/themes/theme-context'
import { THEMES_INLINE_SCRIPT } from '@/lib/themes/themes'
import Analytics from '@/components/Analytics'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  metadataBase: new URL('https://nexusaas.com.br'),
  title: 'NEXUS — Seu COO de IA',
  description:
    'Inteligência financeira para empresas que querem crescer. Monitore, analise e tome decisões com IA.',
  alternates: {
    canonical: 'https://nexusaas.com.br',
  },
  openGraph: {
    title: 'NEXUS — Seu COO de IA',
    description: 'Inteligência financeira para empresas que querem crescer.',
    url: 'https://nexusaas.com.br',
    siteName: 'NEXUS',
    type: 'website',
    locale: 'pt_BR',
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
        <Analytics />
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
