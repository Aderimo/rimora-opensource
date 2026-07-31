import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { SettingsProvider } from '@/contexts/settings-context'
import { LanguageProvider } from '@/contexts/language-context'
import { AuthProvider } from '@/contexts/auth-context'
import { ToastProvider } from '@/components/ui/toast'
import { BadgeNotificationProvider } from '@/components/badge-notification-provider'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ErrorTrackerInit } from '@/components/error-tracker-init'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://rimora-indol.vercel.app'),
  title: {
    default: 'Rimora - Film, Dizi ve Anime İzleme Platformu',
    template: '%s | Rimora'
  },
  description: 'Binlerce film, dizi ve anime keşfet. Puanla, listele, arkadaşlarınla paylaş. Türkçe altyazılı içerikler.',
  keywords: ['film izle', 'dizi izle', 'anime izle', 'türkçe altyazı', 'hd film', 'online dizi', 'rimora'],
  authors: [{ name: 'Rimora' }],
  creator: 'Rimora',
  publisher: 'Rimora',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://rimora-indol.vercel.app',
    siteName: 'Rimora',
    title: 'Rimora',
    description: 'Binlerce film, dizi ve anime keşfet. Puanla, listele, arkadaşlarınla paylaş.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Rimora',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rimora',
    description: 'Binlerce film, dizi ve anime keşfet. Puanla, listele, arkadaşlarınla paylaş.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
      { url: '/api/icon?size=192', sizes: '192x192', type: 'image/png' },
      { url: '/api/icon?size=512', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/api/icon?size=180', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/api/icon/maskable?size=512', color: '#A855F7' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Rimora',
    startupImage: [
      // iPhone 14 Pro Max
      {
        url: '/api/splash?width=1290&height=2796',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone 14 Pro
      {
        url: '/api/splash?width=1179&height=2556',
        media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone 14, 13, 12
      {
        url: '/api/splash?width=1170&height=2532',
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone 14 Plus, 13 Pro Max, 12 Pro Max
      {
        url: '/api/splash?width=1284&height=2778',
        media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)',
      },
      // iPhone SE, 8, 7, 6s
      {
        url: '/api/splash?width=750&height=1334',
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
      },
      // iPad Pro 12.9"
      {
        url: '/api/splash?width=2048&height=2732',
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
      },
      // iPad Pro 11"
      {
        url: '/api/splash?width=1668&height=2388',
        media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
      },
      // iPad Air, iPad 10.2"
      {
        url: '/api/splash?width=1640&height=2360',
        media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0612' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="canonical" href="https://rimora-indol.vercel.app" />
      </head>
      <body className={inter.className}>
        {/* Skip Navigation Link - Klavye kullanıcıları için */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Ana içeriğe atla
        </a>
        
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SettingsProvider>
            <LanguageProvider>
              <AuthProvider>
                <ToastProvider>
                  <BadgeNotificationProvider>
                    <ErrorTrackerInit />
                    <div className="flex min-h-screen flex-col">
                      <Header />
                      <main id="main-content" role="main" aria-label="Ana içerik" className="flex-1 pt-16">
                        {children}
                      </main>
                      <Footer />
                    </div>
                  </BadgeNotificationProvider>
                </ToastProvider>
              </AuthProvider>
            </LanguageProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
