import type { Metadata } from 'next'
import { Bricolage_Grotesque, Newsreader, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-bricolage',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'FounderLex — Startup Legal Basics, in Plain English',
  description:
    'A guided assistant for first-time founders. Understand startup legal basics in plain English, figure out which documents you need, draft them with your details — and know when to talk to a real lawyer.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body style={{ margin: 0, height: '100%', WebkitFontSmoothing: 'antialiased' }}>
        {children}
      </body>
    </html>
  )
}
