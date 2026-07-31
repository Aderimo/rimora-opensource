'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/language-context'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSelector } from '@/components/language-selector'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { Download, Users } from 'lucide-react'

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { t } = useLanguage()
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  
  // Arama sayfasında mıyız?
  const isSearchPage = pathname === '/arama'

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/arama?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/arama')
    }
  }

  const handleSearchClick = () => {
    if (!isSearchPage) {
      router.push('/arama')
    }
  }

  return (
    <header
      role="banner"
      aria-label="Ana navigasyon"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border'
          : 'bg-gradient-to-b from-background/80 to-transparent'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0" aria-label="Rimora ana sayfa">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 bg-clip-text text-transparent">
              Rimora
            </span>
          </Link>

          {/* Center Search Bar - Arama sayfasında gizle, mobilde de gizle */}
          {!isSearchPage && (
            <div className="hidden md:flex flex-1 max-w-xl mx-auto">
              <form onSubmit={handleSearch} className="relative w-full" role="search" aria-label="Arama formu">
                <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={handleSearchClick}
                  placeholder="Film, dizi, anime veya kullanıcı ara..."
                  aria-label="Arama kutusu"
                  className={cn(
                    'w-full h-10 pl-10 pr-4 rounded-full bg-muted/50 border border-border text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-background',
                    'transition-all duration-200 cursor-pointer'
                  )}
                  readOnly
                />
              </form>
            </div>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0" role="navigation" aria-label="Kullanıcı menüsü">
            {/* Mobilde arama ikonu göster */}
            {!isSearchPage && (
              <Link href="/arama" className="md:hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Arama">
                  <Icons.search className="h-4 w-4" />
                </Button>
              </Link>
            )}

            {/* Arama sayfasındayken arama ikonu göster */}
            {isSearchPage && (
              <div className="hidden sm:block text-sm text-muted-foreground">
                Arama
              </div>
            )}

            {/* Language Selector - Mobilde gizle */}
            <div className="hidden lg:block">
              <LanguageSelector />
            </div>

            {/* Download App Button - Mobilde gizle */}
            <Link href="/indir" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="h-9 w-9" title="Uygulamayı İndir" aria-label="Uygulamayı indir">
                <Download className="h-4 w-4" />
              </Button>
            </Link>

            {/* Watch Party Button */}
            <Link href="/izle-birlikte" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="h-9 w-9" title="Birlikte İzle" aria-label="Birlikte izleme odası">
                <Users className="h-4 w-4" />
              </Button>
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Giriş yapmış kullanıcılar için */}
            {user ? (
              <>
                {/* Messages */}
                <Link href="/mesajlar">
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mesajlar">
                    <Icons.comment className="h-4 w-4" />
                  </Button>
                </Link>

                {/* Notifications */}
                <NotificationBell />

                {/* Profile Button with Avatar */}
                <Link href="/profil">
                  <Button variant="ghost" size="icon" className="h-9 w-9 p-0 overflow-hidden rounded-full" aria-label="Profil sayfası">
                    {userProfile?.photoURL ? (
                      <Image
                        src={userProfile.photoURL}
                        alt="Profil fotoğrafı"
                        width={36}
                        height={36}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                        <span className="text-white text-sm font-bold">
                          {(userProfile?.displayName || user.email || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </Button>
                </Link>
              </>
            ) : (
              /* Giriş yapmamış kullanıcılar için */
              <>
                <Link href="/giris">
                  <Button variant="ghost" size="sm" className="hidden sm:flex">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link href="/kayit">
                  <Button size="sm">
                    {t('nav.register')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
