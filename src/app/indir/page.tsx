'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { Smartphone, Monitor, Apple, Chrome, Share, PlusSquare, MoreVertical, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // Platform detection
    const userAgent = navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))
    setIsAndroid(/android/.test(userAgent))
    setIsDesktop(!(/iphone|ipad|ipod|android/.test(userAgent)))

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-purple-950/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
          <Download className="h-4 w-4 text-purple-400" />
          <span className="text-sm text-purple-400">Ücretsiz İndir</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
          Rimora&apos;yı İndir
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Film, dizi ve animeleri her yerden izle. Masaüstüne veya telefonuna yükle, 
          internet bağlantısı olmadan da listelerine göz at.
        </p>

        {isInstalled ? (
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <Icons.check className="h-6 w-6 text-green-500" />
              <span className="text-lg font-medium text-green-400">Rimora zaten yüklü!</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Uygulamayı masaüstünden veya uygulama menüsünden açabilirsiniz.
            </p>
          </div>
        ) : deferredPrompt ? (
          <Button 
            size="lg" 
            className="h-14 px-8 text-lg gap-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            onClick={handleInstall}
          >
            <Download className="h-5 w-5" />
            Hemen Yükle
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">
              Aşağıdaki talimatları takip ederek Rimora&apos;yı cihazınıza yükleyebilirsiniz.
            </p>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <FeatureCard
            icon={<Icons.clock className="h-8 w-8" />}
            title="Hızlı Erişim"
            description="Tarayıcı açmadan direkt uygulamaya gir"
          />
          <FeatureCard
            icon={<Icons.bell className="h-8 w-8" />}
            title="Bildirimler"
            description="Yeni bölümlerden anında haberdar ol"
          />
          <FeatureCard
            icon={<Icons.zap className="h-8 w-8" />}
            title="Daha Hızlı"
            description="Native uygulama performansı"
          />
        </div>
      </div>

      {/* Platform Instructions */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Nasıl Yüklenir?</h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* iOS */}
          <div className={`p-6 rounded-2xl border ${isIOS ? 'border-purple-500 bg-purple-500/5' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gray-800">
                <Apple className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">iPhone / iPad</h3>
                <p className="text-sm text-muted-foreground">iOS & iPadOS</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">1</span>
                <span>Safari&apos;de bu sayfayı aç</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">2</span>
                <span className="flex items-center gap-1">
                  Paylaş butonuna <Share className="h-4 w-4 inline" /> tıkla
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">3</span>
                <span className="flex items-center gap-1">
                  &quot;Ana Ekrana Ekle&quot; <PlusSquare className="h-4 w-4 inline" /> seç
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">4</span>
                <span>&quot;Ekle&quot; butonuna tıkla</span>
              </li>
            </ol>
          </div>

          {/* Android */}
          <div className={`p-6 rounded-2xl border ${isAndroid ? 'border-purple-500 bg-purple-500/5' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-green-900">
                <Smartphone className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold">Android</h3>
                <p className="text-sm text-muted-foreground">Chrome & Samsung Internet</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">1</span>
                <span>Chrome&apos;da bu sayfayı aç</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">2</span>
                <span className="flex items-center gap-1">
                  Menü butonuna <MoreVertical className="h-4 w-4 inline" /> tıkla
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">3</span>
                <span>&quot;Uygulamayı yükle&quot; veya &quot;Ana ekrana ekle&quot; seç</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">4</span>
                <span>&quot;Yükle&quot; butonuna tıkla</span>
              </li>
            </ol>
          </div>

          {/* Desktop */}
          <div className={`p-6 rounded-2xl border ${isDesktop ? 'border-purple-500 bg-purple-500/5' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-900">
                <Monitor className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">Masaüstü</h3>
                <p className="text-sm text-muted-foreground">Windows, Mac, Linux</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">1</span>
                <span className="flex items-center gap-1">
                  Chrome veya Edge <Chrome className="h-4 w-4 inline" /> kullan
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">2</span>
                <span>Adres çubuğundaki yükle ikonuna tıkla</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">3</span>
                <span>Veya yukarıdaki &quot;Hemen Yükle&quot; butonunu kullan</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">4</span>
                <span>Masaüstünde kısayol oluşturulacak</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Sıkça Sorulan Sorular</h2>

        <div className="max-w-2xl mx-auto space-y-4">
          <FAQItem
            question="PWA nedir?"
            answer="Progressive Web App (PWA), web sitelerinin mobil uygulama gibi çalışmasını sağlayan bir teknolojidir. App Store veya Play Store'dan indirmenize gerek kalmadan, doğrudan tarayıcıdan yükleyebilirsiniz."
          />
          <FAQItem
            question="Ücretsiz mi?"
            answer="Evet! Rimora uygulamasını yüklemek tamamen ücretsizdir. Premium özelliklere erişmek için abonelik satın alabilirsiniz."
          />
          <FAQItem
            question="Ne kadar yer kaplar?"
            answer="Çok az! PWA uygulamaları normal uygulamalardan çok daha küçüktür. Rimora yaklaşık 2-5 MB yer kaplar."
          />
          <FAQItem
            question="İnternet olmadan çalışır mı?"
            answer="Bazı özellikler çevrimdışı çalışır. Listelerinize göz atabilir, daha önce ziyaret ettiğiniz sayfaları görebilirsiniz. Ancak video izlemek için internet bağlantısı gereklidir."
          />
          <FAQItem
            question="Nasıl kaldırırım?"
            answer="Diğer uygulamalar gibi! Telefonunuzda veya bilgisayarınızda uygulama simgesine uzun basın ve 'Kaldır' seçeneğini seçin."
          />
        </div>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-xl mx-auto p-8 rounded-2xl bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/20">
          {isInstalled ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Icons.check className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Rimora Yüklü!</h2>
              <p className="text-muted-foreground mb-6">
                Uygulamayı masaüstünden veya uygulama menüsünden açabilirsiniz.
              </p>
              <div className="text-sm text-muted-foreground">
                <p>Kaldırmak için: Uygulama simgesine sağ tıklayın → &quot;Kaldır&quot; seçin</p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-4">Hemen Başla!</h2>
              <p className="text-muted-foreground mb-6">
                Rimora&apos;yı yükle, binlerce film ve diziye anında eriş.
              </p>
              {deferredPrompt ? (
                <Button 
                  size="lg" 
                  className="gap-2 bg-white text-black hover:bg-white/90"
                  onClick={handleInstall}
                >
                  <Download className="h-5 w-5" />
                  Uygulamayı Yükle
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Yukarıdaki talimatları takip ederek cihazınıza yükleyebilirsiniz.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-card border border-border hover:border-purple-500/50 transition-colors">
      <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{question}</span>
        <Icons.chevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-6 pb-4 text-sm text-muted-foreground">
          {answer}
        </div>
      )}
    </div>
  )
}
