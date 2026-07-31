'use client'

import Link from 'next/link'
import { useLanguage } from '@/contexts/language-context'

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="border-t border-border bg-card/50" role="contentinfo" aria-label="Site alt bilgi">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="Rimora ana sayfa">
            <span className="text-xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 bg-clip-text text-transparent">
              Rimora
            </span>
          </Link>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground" aria-label="Alt navigasyon">
            <Link href="/hakkimizda" className="hover:text-foreground transition-colors">
              {t('footer.about')}
            </Link>
            <Link href="/iletisim" className="hover:text-foreground transition-colors">
              {t('footer.contact')}
            </Link>
            <Link href="/gizlilik" className="hover:text-foreground transition-colors">
              {t('footer.privacy')}
            </Link>
            <Link href="/kullanim-kosullari" className="hover:text-foreground transition-colors">
              {t('footer.terms')}
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  )
}
