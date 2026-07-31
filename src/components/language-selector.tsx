'use client'

import { useLanguage } from '@/contexts/language-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'

export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage()

  const toggleLanguage = () => {
    setLocale(locale === 'tr' ? 'en' : 'tr')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 gap-2 px-3"
      onClick={toggleLanguage}
    >
      <Icons.globe className="h-4 w-4" />
      <span className="text-sm font-medium">
        {locale === 'tr' ? t('language.tr') : t('language.en')}
      </span>
    </Button>
  )
}
