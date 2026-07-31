/**
 * E-posta Template'leri
 * 
 * Rimora platformu için HTML e-posta template'leri.
 * Tüm template'ler responsive ve modern tasarıma sahiptir.
 */

import type { WelcomeEmailData, SubscriptionEmailData, PasswordResetEmailData } from './resend'
import type { InvoiceEmailData } from './resend'
import { formatNumberTR } from '@/lib/utils/format'

interface EmailTemplate {
  subject: string
  html: string
}

// Ortak stiller
const baseStyles = `
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #1a1a1a;
    background-color: #f5f5f5;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .header {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    padding: 40px 30px;
    text-align: center;
  }
  .header h1 {
    color: #ffffff;
    margin: 0;
    font-size: 28px;
    font-weight: 700;
  }
  .header .logo {
    font-size: 36px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 10px;
  }
  .content {
    padding: 40px 30px;
  }
  .content h2 {
    color: #1a1a1a;
    margin-top: 0;
    font-size: 24px;
  }
  .content p {
    color: #4a4a4a;
    margin: 16px 0;
  }
  .button {
    display: inline-block;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #ffffff !important;
    text-decoration: none;
    padding: 14px 32px;
    border-radius: 8px;
    font-weight: 600;
    margin: 20px 0;
    text-align: center;
  }
  .button:hover {
    opacity: 0.9;
  }
  .info-box {
    background-color: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }
  .info-box h3 {
    margin-top: 0;
    color: #1a1a1a;
    font-size: 16px;
  }
  .info-box p {
    margin: 8px 0;
    color: #6b7280;
    font-size: 14px;
  }
  .footer {
    background-color: #f8f9fa;
    padding: 30px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
  }
  .footer p {
    color: #9ca3af;
    font-size: 12px;
    margin: 8px 0;
  }
  .footer a {
    color: #6366f1;
    text-decoration: none;
  }
  .highlight {
    color: #6366f1;
    font-weight: 600;
  }
  .plan-badge {
    display: inline-block;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #ffffff;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
  }
  .warning-box {
    background-color: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    padding: 16px;
    margin: 20px 0;
  }
  .warning-box p {
    color: #92400e;
    margin: 0;
  }
`

// HTML wrapper
const wrapHtml = (content: string): string => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div style="padding: 20px;">
    <div class="container">
      ${content}
    </div>
  </div>
</body>
</html>
`

/**
 * Hoş geldin e-postası template'i
 */
export function getWelcomeEmailTemplate(data: WelcomeEmailData): EmailTemplate {
  const content = `
    <div class="header">
      <div class="logo">🎬 Rimora</div>
      <h1>Hoş Geldiniz!</h1>
    </div>
    <div class="content">
      <h2>Merhaba ${data.userName}! 👋</h2>
      <p>
        Rimora ailesine katıldığınız için çok mutluyuz! Artık binlerce film, dizi ve anime 
        içeriğine erişebilir, arkadaşlarınızla birlikte izleyebilir ve kişiselleştirilmiş 
        öneriler alabilirsiniz.
      </p>
      
      <div class="info-box">
        <h3>🚀 Hemen Başlayın</h3>
        <p>• Profilinizi tamamlayın ve tercihlerinizi belirleyin</p>
        <p>• İzleme listesi oluşturun</p>
        <p>• Arkadaşlarınızı takip edin</p>
        <p>• Birlikte izleme odaları oluşturun</p>
      </div>
      
      <div style="text-align: center;">
        <a href="https://rimora.com" class="button">Keşfetmeye Başla</a>
      </div>
      
      <p>
        Herhangi bir sorunuz varsa, destek ekibimiz size yardımcı olmaktan mutluluk duyacaktır.
      </p>
      
      <p>İyi seyirler! 🍿</p>
    </div>
    <div class="footer">
      <p>Bu e-posta ${data.email} adresine gönderilmiştir.</p>
      <p>
        <a href="https://rimora.com/ayarlar/bildirimler">E-posta tercihlerini yönet</a> | 
        <a href="https://rimora.com/yardim">Yardım Merkezi</a>
      </p>
      <p>© ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.</p>
    </div>
  `
  
  return {
    subject: 'Rimora\'ya Hoş Geldiniz! 🎬',
    html: wrapHtml(content)
  }
}

/**
 * Abonelik onay e-postası template'i
 */
export function getSubscriptionConfirmTemplate(data: SubscriptionEmailData): EmailTemplate {
  const billingText = data.billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'
  
  const content = `
    <div class="header">
      <div class="logo">🎬 Rimora</div>
      <h1>Abonelik Onayı</h1>
    </div>
    <div class="content">
      <h2>Tebrikler ${data.userName}! 🎉</h2>
      <p>
        <span class="plan-badge">${data.planName}</span> aboneliğiniz başarıyla aktifleştirildi!
      </p>
      
      <div class="info-box">
        <h3>📋 Abonelik Detayları</h3>
        <p><strong>Plan:</strong> ${data.planName}</p>
        <p><strong>Ödeme Periyodu:</strong> ${billingText}</p>
        ${data.price ? `<p><strong>Tutar:</strong> ${data.price} TL</p>` : ''}
        ${data.endDate ? `<p><strong>Sonraki Ödeme:</strong> ${data.endDate}</p>` : ''}
      </div>
      
      <p>
        Artık tüm premium özelliklere erişebilirsiniz:
      </p>
      <ul style="color: #4a4a4a;">
        <li>Reklamsız izleme deneyimi</li>
        <li>4K ve HDR kalitesinde içerikler</li>
        <li>Çoklu cihaz desteği</li>
        <li>Öncelikli müşteri desteği</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="https://rimora.com" class="button">İzlemeye Başla</a>
      </div>
      
      <p>
        Aboneliğinizi <a href="https://rimora.com/abonelik" style="color: #6366f1;">abonelik sayfasından</a> 
        yönetebilirsiniz.
      </p>
    </div>
    <div class="footer">
      <p>Bu e-posta ${data.email} adresine gönderilmiştir.</p>
      <p>
        <a href="https://rimora.com/abonelik">Aboneliği Yönet</a> | 
        <a href="https://rimora.com/yardim">Yardım Merkezi</a>
      </p>
      <p>© ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.</p>
    </div>
  `
  
  return {
    subject: `${data.planName} Aboneliğiniz Aktif! ✨`,
    html: wrapHtml(content)
  }
}

/**
 * Abonelik iptal e-postası template'i
 */
export function getSubscriptionCancelledTemplate(data: SubscriptionEmailData): EmailTemplate {
  const content = `
    <div class="header">
      <div class="logo">🎬 Rimora</div>
      <h1>Abonelik İptali</h1>
    </div>
    <div class="content">
      <h2>Merhaba ${data.userName},</h2>
      <p>
        ${data.planName} aboneliğiniz iptal edilmiştir.
      </p>
      
      ${data.endDate ? `
      <div class="info-box">
        <h3>📅 Önemli Bilgi</h3>
        <p>
          Aboneliğiniz <strong>${data.endDate}</strong> tarihine kadar aktif kalacaktır. 
          Bu tarihe kadar tüm premium özellikleri kullanmaya devam edebilirsiniz.
        </p>
      </div>
      ` : ''}
      
      <p>
        Sizi aramızda görmekten mutluluk duymuştuk. Eğer fikrinizi değiştirirseniz, 
        her zaman geri dönebilirsiniz!
      </p>
      
      <div style="text-align: center;">
        <a href="https://rimora.com/abonelik" class="button">Aboneliği Yeniden Başlat</a>
      </div>
      
      <p style="font-size: 14px; color: #6b7280;">
        İptal nedeninizi öğrenmek isteriz. Geri bildiriminiz bizim için çok değerli. 
        <a href="https://rimora.com/geri-bildirim" style="color: #6366f1;">Görüşlerinizi paylaşın</a>
      </p>
    </div>
    <div class="footer">
      <p>Bu e-posta ${data.email} adresine gönderilmiştir.</p>
      <p>
        <a href="https://rimora.com/ayarlar/bildirimler">E-posta tercihlerini yönet</a> | 
        <a href="https://rimora.com/yardim">Yardım Merkezi</a>
      </p>
      <p>© ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.</p>
    </div>
  `
  
  return {
    subject: 'Aboneliğiniz İptal Edildi',
    html: wrapHtml(content)
  }
}

/**
 * Abonelik süre dolumu uyarı e-postası template'i
 */
export function getSubscriptionExpiringTemplate(data: SubscriptionEmailData): EmailTemplate {
  const content = `
    <div class="header">
      <div class="logo">🎬 Rimora</div>
      <h1>Abonelik Hatırlatması</h1>
    </div>
    <div class="content">
      <h2>Merhaba ${data.userName},</h2>
      
      <div class="warning-box">
        <p>
          ⚠️ ${data.planName} aboneliğiniz <strong>${data.endDate}</strong> tarihinde sona erecek.
        </p>
      </div>
      
      <p>
        Kesintisiz izleme deneyimi için aboneliğinizi yenilemenizi öneririz. 
        Otomatik yenileme açıksa, ödeme otomatik olarak alınacaktır.
      </p>
      
      <div class="info-box">
        <h3>🎁 Aboneliğinizi Yenileyin</h3>
        <p>Premium özelliklerin keyfini çıkarmaya devam edin:</p>
        <p>• Reklamsız izleme</p>
        <p>• 4K ve HDR kalite</p>
        <p>• Çoklu cihaz desteği</p>
      </div>
      
      <div style="text-align: center;">
        <a href="https://rimora.com/abonelik" class="button">Aboneliği Yenile</a>
      </div>
      
      <p style="font-size: 14px; color: #6b7280;">
        Abonelik ayarlarınızı <a href="https://rimora.com/abonelik" style="color: #6366f1;">buradan</a> 
        yönetebilirsiniz.
      </p>
    </div>
    <div class="footer">
      <p>Bu e-posta ${data.email} adresine gönderilmiştir.</p>
      <p>
        <a href="https://rimora.com/ayarlar/bildirimler">E-posta tercihlerini yönet</a> | 
        <a href="https://rimora.com/yardim">Yardım Merkezi</a>
      </p>
      <p>© ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.</p>
    </div>
  `
  
  return {
    subject: `⚠️ Aboneliğiniz ${data.endDate} Tarihinde Sona Eriyor`,
    html: wrapHtml(content)
  }
}

/**
 * Şifre sıfırlama e-postası template'i
 */
export function getPasswordResetTemplate(data: PasswordResetEmailData): EmailTemplate {
  const content = `
    <div class="header">
      <div class="logo">🎬 Rimora</div>
      <h1>Şifre Sıfırlama</h1>
    </div>
    <div class="content">
      <h2>Merhaba ${data.userName},</h2>
      <p>
        Hesabınız için şifre sıfırlama talebinde bulundunuz. 
        Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz.
      </p>
      
      <div style="text-align: center;">
        <a href="${data.resetLink}" class="button">Şifremi Sıfırla</a>
      </div>
      
      <div class="warning-box">
        <p>
          ⚠️ Bu link 1 saat içinde geçerliliğini yitirecektir. 
          Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
        </p>
      </div>
      
      <p style="font-size: 14px; color: #6b7280;">
        Link çalışmıyorsa, aşağıdaki URL'yi tarayıcınıza kopyalayın:<br>
        <span style="word-break: break-all; color: #6366f1;">${data.resetLink}</span>
      </p>
    </div>
    <div class="footer">
      <p>Bu e-posta ${data.email} adresine gönderilmiştir.</p>
      <p>
        <a href="https://rimora.com/yardim">Yardım Merkezi</a> | 
        <a href="https://rimora.com/iletisim">İletişim</a>
      </p>
      <p>© ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.</p>
    </div>
  `
  
  return {
    subject: 'Şifre Sıfırlama Talebi 🔐',
    html: wrapHtml(content)
  }
}

/**
 * Fatura e-postası template'i
 */
export function getInvoiceEmailTemplate(data: InvoiceEmailData): EmailTemplate {
  const billingText = data.billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'
  const formattedPrice = formatNumberTR(data.price, { currency: true, decimals: 2 })
  
  const content = `
    <div class="header">
      <div class="logo">🎬 Rimora</div>
      <h1>Fatura</h1>
    </div>
    <div class="content">
      <h2>Merhaba ${data.userName},</h2>
      <p>
        <span class="plan-badge">${data.planName}</span> aboneliğiniz için ödemeniz başarıyla alınmıştır.
      </p>
      
      <div class="info-box">
        <h3>🧾 Fatura Detayları</h3>
        <p><strong>Fatura No:</strong> ${data.invoiceNumber}</p>
        <p><strong>Ödeme Tarihi:</strong> ${data.paymentDate}</p>
        <p><strong>Plan:</strong> ${data.planName}</p>
        <p><strong>Ödeme Periyodu:</strong> ${billingText}</p>
        <p><strong>Tutar:</strong> ${formattedPrice}</p>
        <p><strong>Ödeme Yöntemi:</strong> ${data.paymentMethod}</p>
        ${data.nextPaymentDate ? `<p><strong>Sonraki Ödeme:</strong> ${data.nextPaymentDate}</p>` : ''}
      </div>
      
      <p>
        Bu fatura, ${data.planName} aboneliğinizin ${billingText.toLowerCase()} ödemesini kapsamaktadır. 
        Ödemeniz başarıyla işlenmiş ve aboneliğiniz aktif durumda.
      </p>
      
      <div class="info-box">
        <h3>📋 Abonelik Avantajları</h3>
        <p>• Reklamsız izleme deneyimi</p>
        <p>• 4K ve HDR kalitesinde içerikler</p>
        <p>• Çoklu cihaz desteği</p>
        <p>• Öncelikli müşteri desteği</p>
        <p>• Gelişmiş sosyal özellikler</p>
      </div>
      
      <div style="text-align: center;">
        <a href="https://rimora.com" class="button">İzlemeye Devam Et</a>
      </div>
      
      <p style="font-size: 14px; color: #6b7280;">
        Fatura ve ödeme geçmişinizi <a href="https://rimora.com/abonelik" style="color: #6366f1;">abonelik sayfasından</a> 
        görüntüleyebilirsiniz.
      </p>
      
      <p>
        Herhangi bir sorunuz varsa, destek ekibimizle iletişime geçmekten çekinmeyin.
      </p>
    </div>
    <div class="footer">
      <p>Bu e-posta ${data.email} adresine gönderilmiştir.</p>
      <p>
        <a href="https://rimora.com/abonelik">Aboneliği Yönet</a> | 
        <a href="https://rimora.com/yardim">Yardım Merkezi</a> | 
        <a href="https://rimora.com/iletisim">İletişim</a>
      </p>
      <p>© ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.</p>
    </div>
  `
  
  return {
    subject: `Fatura - ${data.planName} Aboneliği (${data.invoiceNumber})`,
    html: wrapHtml(content)
  }
}
