import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">Gizlilik Politikası</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">Son güncelleme: Ocak 2026</p>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Toplanan Bilgiler</h2>
            <p className="text-muted-foreground">
              Rimora, hizmetlerimizi sunmak için aşağıdaki bilgileri toplar: e-posta adresi, kullanıcı adı, 
              izleme geçmişi ve tercihleriniz. Bu bilgiler size daha iyi bir deneyim sunmak için kullanılır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Bilgilerin Kullanımı</h2>
            <p className="text-muted-foreground">
              Topladığımız bilgiler; hesabınızı yönetmek, kişiselleştirilmiş öneriler sunmak, 
              hizmetlerimizi geliştirmek ve güvenliği sağlamak için kullanılır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Bilgi Paylaşımı</h2>
            <p className="text-muted-foreground">
              Kişisel bilgileriniz üçüncü taraflarla paylaşılmaz. Yasal zorunluluklar dışında 
              verileriniz gizli tutulur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Çerezler</h2>
            <p className="text-muted-foreground">
              Sitemiz, deneyiminizi iyileştirmek için çerezler kullanır. Tarayıcı ayarlarınızdan 
              çerezleri yönetebilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. İletişim</h2>
            <p className="text-muted-foreground">
              Gizlilik politikamız hakkında sorularınız için destek@rimora.com adresinden bize ulaşabilirsiniz.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
