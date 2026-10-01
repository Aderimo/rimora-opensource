<div align="center">

# Rimora

**Sosyal özellikleri olan bir medya keşif ve izleme platformu iskeleti.**

[![Lisans](https://img.shields.io/badge/lisans-MIT-4ADE80)](LICENSE)
[![Altyapı](https://img.shields.io/badge/Next.js_14_%2B_Firebase-6B7280)](#teknolojiler)
[![Testler](https://img.shields.io/badge/testler-Vitest_%2B_Playwright-6B7280)](#komutlar)

Next.js 14 + Firebase üzerine kurulu: katalog, izleme geçmişi, listeler, gerçek
zamanlı mesajlaşma, birlikte izleme odaları ve admin paneli — orijinal site
kapatıldıktan sonra açık kaynak olarak yayınlandı; kendi platformunu kurmak isteyenler
doğrudan kullanabilir.

[Türkçe](README.tr.md) · [English](README.md)

</div>

> **Proje hiçbir video kaynağı ile birlikte gelmez.** Oynatıcı altyapısı hazırdır ama
> boştur — kaynakları siz tanımlarsınız. Ayrıntı için [Video kaynakları](#video-kaynakları)
> bölümüne bakın.

---

## Neler var

**İçerik**
- TMDB tabanlı film / dizi / anime kataloğu, arama ve keşif sayfaları
- Sezon–bölüm gezinme, izleme geçmişi, kişisel listeler
- Çoklu sunucu seçimli video oynatıcı iskeleti

**Sosyal**
- Gerçek zamanlı mesajlaşma — sabitleme, düzenleme, yanıtlama, thread, mention
- Birlikte izleme (watch party) odaları
- Kullanıcı profilleri, aktivite akışı, bildirimler

**Yönetim**
- Admin paneli ve moderasyon araçları
- Kullanıcı ticket / geri bildirim sistemi
- İstatistik sayfaları

**Altyapı**
- Firebase Auth, Firestore, Realtime Database, Storage, Cloud Messaging
- iyzico ile abonelik / ödeme akışı (opsiyonel)
- Resend ile e-posta, Cloudinary ile görsel yönetimi
- i18n desteği, SEO bileşenleri, PWA service worker
- Vitest (birim) + Playwright (E2E) testleri, Firestore güvenlik kuralı testleri

## Teknolojiler

| Katman | Kullanılan |
| --- | --- |
| Framework | Next.js 14.0.4 (App Router) |
| Dil | TypeScript |
| UI | React 18, Tailwind CSS, Framer Motion |
| Backend | Firebase 12 (Auth / Firestore / RTDB / Storage / FCM) |
| Ödeme | iyzipay |
| E-posta | Resend |
| Medya | Cloudinary |
| Test | Vitest, Playwright |

**Gereksinim:** Node.js >= 20

## Kurulum

### 1. Projeyi alın

```bash
git clone https://github.com/Aderimo/rimora-opensource.git
cd rimora-opensource
npm install
```

### 2. Firebase projesi oluşturun

1. [Firebase Console](https://console.firebase.google.com)'da yeni proje açın
2. **Authentication** → Sign-in method → *E-posta/Şifre*'yi etkinleştirin
3. **Firestore Database** oluşturun
4. **Realtime Database** oluşturun (mesajlaşma ve watch party için)
5. **Storage** etkinleştirin
6. Project Settings → General → *Your apps* → Web app ekleyin, SDK config değerlerini not alın

### 3. Ortam değişkenlerini doldurun

```bash
cp .env.example .env.local
```

`.env.local` içindeki alanları doldurun. En az şunlar gerekli:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase web SDK config
- `TMDB_API_KEY` — [themoviedb.org](https://www.themoviedb.org/settings/api) üzerinden ücretsiz alınır

iyzico, Resend ve Cloudinary opsiyoneldir; boş bırakılırsa ilgili özellikler devre dışı kalır.

### 4. Firebase kurallarını yükleyin

`.firebaserc` içindeki `your-firebase-project-id` değerini kendi proje kimliğinizle değiştirin, sonra:

```bash
npx firebase deploy --only firestore:rules,storage,database
```

### 5. Çalıştırın

```bash
npm run dev
```

http://localhost:3000

## Video kaynakları

Oynatıcı, kaynakları `NEXT_PUBLIC_VIDEO_SOURCES` ortam değişkeninden okur. Tanımlı
kaynak yoksa oynatıcı boş durum gösterir — uygulamanın geri kalanı normal çalışır.

Format, JSON dizisidir. Şablon değişkenleri: `{tmdbId}`, `{season}`, `{episode}`.

```bash
NEXT_PUBLIC_VIDEO_SOURCES='[
  {
    "id": "kendi-cdn",
    "name": "Sunucu 1",
    "quality": "1080p",
    "language": "TR",
    "priority": 1,
    "movie": "https://cdn.example.com/movie/{tmdbId}",
    "tv": "https://cdn.example.com/tv/{tmdbId}/{season}/{episode}"
  }
]'
```

Birden fazla kaynak tanımlarsanız `priority` sırasına göre listelenir ve kullanıcı
sunucular arasında geçiş yapabilir.

⚠️ **Sorumluluk:** Bu proje bilerek kaynaksız dağıtılır. Yalnızca yayın hakkına sahip
olduğunuz veya size bu hakkı veren kaynakları bağlayın. Bağladığınız içeriklerin
hukuki sorumluluğu tamamen size aittir.

## Komutlar

```bash
npm run dev            # geliştirme sunucusu
npm run build          # production build
npm run start          # production sunucu
npm run lint           # ESLint
npm run test           # birim testleri (Vitest)
npm run test:coverage  # kapsam raporu
npm run test:e2e       # E2E testleri (Playwright)
npm run test:security  # Firestore güvenlik kuralı testleri
```

## Dağıtım

Proje Vercel üzerinde çalışacak şekilde yapılandırılmıştır (Netlify betikleri de
mevcuttur).

1. Repoyu Vercel'e bağlayın
2. `.env.local` içindeki tüm değişkenleri Vercel → Settings → Environment Variables bölümüne ekleyin
3. Deploy edin

`prebuild` adımı Firebase Cloud Messaging service worker'ını
`public/firebase-messaging-sw.template.js` şablonundan otomatik üretir — üretilen
dosya repoya dahil edilmez.

## Katkı

Issue ve pull request'lere açıktır. Büyük değişikliklerden önce issue açıp konuşmak
iyi olur.

## Lisans

[MIT](LICENSE)
