# Türkiye Format Standartları Kullanım Kılavuzu

Bu kılavuz, Rimora platformunda Türkiye format standartlarının nasıl kullanılacağını açıklar.

## Genel Bakış

Türkiye'de kullanılan standart format kuralları:
- **Tarih Formatı**: DD.MM.YYYY (örn: 15.01.2024)
- **Sayı Formatı**: 1.234,56 (binlik ayırıcı: nokta, ondalık ayırıcı: virgül)
- **Para Birimi**: ₺1.234,56

## Kullanılabilir Fonksiyonlar

### 1. formatDateTR(date, options?)

Tarihi Türkiye formatında (DD.MM.YYYY) formatlar.

```typescript
import { formatDateTR } from '@/lib/utils/format'

// Basit kullanım
formatDateTR(new Date('2024-01-15'))
// Çıktı: "15.01.2024"

// Saat ile birlikte
formatDateTR(new Date('2024-01-15T14:30:00'), { includeTime: true })
// Çıktı: "15.01.2024 14:30"

// Uzun ay adı ile
formatDateTR(new Date('2024-01-15'), { longMonth: true })
// Çıktı: "15 Ocak 2024"

// Gün adı ile
formatDateTR(new Date('2024-01-15'), { includeDay: true })
// Çıktı: "Pazartesi, 15.01.2024"

// Firestore Timestamp desteği
formatDateTR(firestoreTimestamp)
// Otomatik olarak Date'e çevrilir
```

**Parametreler:**
- `date`: Date, Firestore Timestamp veya string
- `options.includeTime`: Saat ve dakika ekle (boolean)
- `options.includeDay`: Gün adı ekle (boolean)
- `options.longMonth`: Uzun ay adı kullan (boolean)

### 2. formatNumberTR(value, options?)

Sayıyı Türkiye formatında (1.234,56) formatlar.

```typescript
import { formatNumberTR } from '@/lib/utils/format'

// Basit kullanım
formatNumberTR(1234)
// Çıktı: "1.234"

// Ondalık basamaklar ile
formatNumberTR(1234.56, { decimals: 2 })
// Çıktı: "1.234,56"

// Para birimi ile
formatNumberTR(1234.56, { currency: true, decimals: 2 })
// Çıktı: "₺1.234,56"

// Büyük sayılar
formatNumberTR(1234567.89, { decimals: 2 })
// Çıktı: "1.234.567,89"
```

**Parametreler:**
- `value`: Formatlanacak sayı
- `options.decimals`: Ondalık basamak sayısı (varsayılan: 0)
- `options.currency`: Para birimi formatı kullan (boolean)
- `options.currencySymbol`: Özel para birimi sembolü (string)

### 3. formatRelativeTimeTR(date)

Göreceli zaman formatı (örn: "2 saat önce", "3 gün önce").

```typescript
import { formatRelativeTimeTR } from '@/lib/utils/format'

// Az önce
formatRelativeTimeTR(new Date(Date.now() - 30000))
// Çıktı: "Az önce"

// Dakikalar
formatRelativeTimeTR(new Date(Date.now() - 30 * 60000))
// Çıktı: "30 dakika önce"

// Saatler
formatRelativeTimeTR(new Date(Date.now() - 5 * 3600000))
// Çıktı: "5 saat önce"

// Dün
formatRelativeTimeTR(new Date(Date.now() - 24 * 3600000))
// Çıktı: "Dün"

// Günler
formatRelativeTimeTR(new Date(Date.now() - 3 * 24 * 3600000))
// Çıktı: "3 gün önce"

// 7 günden eski
formatRelativeTimeTR(new Date('2024-01-01'))
// Çıktı: "01.01.2024"
```

### 4. formatDateRangeTR(startDate, endDate)

Tarih aralığını formatlar.

```typescript
import { formatDateRangeTR } from '@/lib/utils/format'

formatDateRangeTR(
  new Date('2024-01-15'),
  new Date('2024-01-20')
)
// Çıktı: "15.01.2024 - 20.01.2024"
```

### 5. formatDurationTR(minutes)

Süreyi formatlar (örn: "2sa 30dk").

```typescript
import { formatDurationTR } from '@/lib/utils/format'

formatDurationTR(45)
// Çıktı: "45dk"

formatDurationTR(120)
// Çıktı: "2sa"

formatDurationTR(150)
// Çıktı: "2sa 30dk"
```

### 6. formatFileSizeTR(bytes)

Dosya boyutunu formatlar.

```typescript
import { formatFileSizeTR } from '@/lib/utils/format'

formatFileSizeTR(500)
// Çıktı: "500 Byte"

formatFileSizeTR(1024)
// Çıktı: "1,00 KB"

formatFileSizeTR(1024 * 1024 * 1.5)
// Çıktı: "1,50 MB"
```

### 7. formatPercentageTR(value, decimals?)

Yüzdeyi formatlar.

```typescript
import { formatPercentageTR } from '@/lib/utils/format'

formatPercentageTR(45)
// Çıktı: "%45"

formatPercentageTR(45.5, 1)
// Çıktı: "%45,5"

formatPercentageTR(100)
// Çıktı: "%100"
```

## Kullanım Örnekleri

### React Component'lerinde

```typescript
import { formatDateTR, formatNumberTR } from '@/lib/utils/format'

function SubscriptionCard({ subscription }) {
  return (
    <div>
      <p>Bitiş Tarihi: {formatDateTR(subscription.endDate)}</p>
      <p>Fiyat: {formatNumberTR(subscription.price, { currency: true, decimals: 2 })}</p>
    </div>
  )
}
```

### API Route'larında

```typescript
import { formatDateTR } from '@/lib/utils/format'

export async function POST(request: Request) {
  const paymentDate = formatDateTR(new Date())
  
  // E-posta gönder
  await sendEmail({
    subject: 'Ödeme Onayı',
    body: `Ödeme tarihi: ${paymentDate}`
  })
}
```

### Bildirim Sistemlerinde

```typescript
import { formatRelativeTimeTR } from '@/lib/utils/format'

function NotificationItem({ notification }) {
  return (
    <div>
      <p>{notification.message}</p>
      <span>{formatRelativeTimeTR(notification.createdAt)}</span>
    </div>
  )
}
```

## Eski Kod Güncellemeleri

### Önce (Eski Yöntem)
```typescript
// ❌ Eski yöntem - kullanmayın
date.toLocaleDateString('tr-TR')
new Intl.NumberFormat('tr-TR').format(number)
```

### Sonra (Yeni Yöntem)
```typescript
// ✅ Yeni yöntem - kullanın
formatDateTR(date)
formatNumberTR(number)
```

## Avantajlar

1. **Tutarlılık**: Tüm platformda aynı format standardı
2. **Bakım Kolaylığı**: Tek bir yerden format değişiklikleri
3. **Tip Güvenliği**: TypeScript desteği ile hata önleme
4. **Firestore Uyumluluğu**: Timestamp otomatik dönüşümü
5. **Test Edilmiş**: Kapsamlı unit testler ile güvenilir
6. **Performans**: Optimize edilmiş format fonksiyonları

## Test Coverage

Tüm format fonksiyonları kapsamlı unit testler ile test edilmiştir:
- 30 test case
- Edge case'ler dahil
- Firestore Timestamp desteği
- Geçersiz veri işleme

Testleri çalıştırmak için:
```bash
npm test -- src/lib/utils/__tests__/format.test.ts
```

## Katkıda Bulunma

Yeni format fonksiyonları eklerken:
1. `src/lib/utils/format.ts` dosyasına fonksiyonu ekleyin
2. `src/lib/utils/__tests__/format.test.ts` dosyasına testleri ekleyin
3. Bu kılavuzu güncelleyin
4. Tüm testlerin geçtiğinden emin olun
