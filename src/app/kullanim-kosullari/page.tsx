import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">Kullanım Koşulları</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">Son güncelleme: Ocak 2026</p>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Hizmet Kullanımı</h2>
            <p className="text-muted-foreground">
              Rimora'yı kullanarak bu koşulları kabul etmiş olursunuz. Hizmetlerimiz yalnızca 
              kişisel ve ticari olmayan kullanım içindir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Hesap Sorumluluğu</h2>
            <p className="text-muted-foreground">
              Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmayın ve 
              şüpheli aktivite durumunda bize bildirin.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. İçerik Politikası</h2>
            <p className="text-muted-foreground">
              Platformumuzda paylaşılan yorumlar ve içerikler topluluk kurallarına uygun olmalıdır. 
              Uygunsuz içerikler kaldırılabilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Abonelik ve Ödemeler</h2>
            <p className="text-muted-foreground">
              Premium abonelikler otomatik yenilenir. İptal işlemi dönem sonuna kadar geçerlidir. 
              30 gün içinde para iade garantisi sunuyoruz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Değişiklikler</h2>
            <p className="text-muted-foreground">
              Bu koşulları önceden haber vermeksizin değiştirme hakkını saklı tutarız. 
              Önemli değişiklikler e-posta ile bildirilir.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
