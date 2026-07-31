# Firebase Security Rules Property Tests

Bu dizin Firebase Security Rules için property-based testleri içerir.

## Gereksinimler

1. **Java 11 veya üzeri** kurulu olmalı:
```bash
java -version
```
Eğer Java 8 veya daha eski bir sürüm kullanıyorsanız, [Java 21 LTS](https://www.oracle.com/java/technologies/downloads/) indirip kurun.

2. Firebase CLI kurulu olmalı:
```bash
npm install -g firebase-tools
```

3. Firebase Emulator kurulu olmalı:
```bash
firebase setup:emulators:firestore
```

## Testleri Çalıştırma

### 1. Firebase Emulator'ı Başlat

Testleri çalıştırmadan önce Firebase Emulator'ı başlatın:

```bash
firebase emulators:start --only firestore
```

Emulator varsayılan olarak `localhost:8080` portunda çalışacaktır.

### 2. Testleri Çalıştır

Başka bir terminal penceresinde testleri çalıştırın:

```bash
npm run test:security
```

veya

```bash
vitest run src/lib/firebase/__tests__/security-rules.property.test.ts
```

## Test Kapsamı

Bu testler aşağıdaki property'leri doğrular:

### Property 3: Kullanıcı Verisi Erişim Kontrolü
- **Validates: Requirements 2.1**
- Sadece giriş yapmış kullanıcılar users collection'ını okuyabilir
- Kullanıcılar sadece kendi user document'larını oluşturabilir

### Property 4: İzleme Geçmişi Erişim Kontrolü
- **Validates: Requirements 2.2, 2.3**
- Sadece veri sahibi kendi watchProgress verilerini okuyabilir
- Sadece veri sahibi kendi watchProgress verilerini yazabilir
- Query'ler sadece kullanıcının kendi verilerini döndürür

### Property 7: Subscription Erişim Kontrolü
- **Validates: Requirements 2.6**
- Kullanıcılar sadece kendi subscription'larını okuyabilir
- Hiçbir kullanıcı subscription yazamaz (sadece server-side)
- Subscription ID kullanıcı ID'si ile eşleşmelidir

## Önemli Notlar

- Her test minimum **100 iterasyon** ile çalışır
- Testler Firebase Emulator gerektirir (production Firestore kullanmaz)
- Her test öncesi Firestore temizlenir
- Testler property-based testing yaklaşımı kullanır (fast-check)

## Sorun Giderme

### Emulator bağlantı hatası
Eğer "ECONNREFUSED" hatası alırsanız:
1. Firebase Emulator'ın çalıştığından emin olun
2. Port 8080'in kullanılabilir olduğunu kontrol edin
3. `firebase.json` dosyasındaki emulator konfigürasyonunu kontrol edin

### Test timeout hatası
Eğer testler timeout oluyorsa:
1. Emulator'ın düzgün çalıştığından emin olun
2. Test timeout değerlerini artırın (her test için 120000ms)
3. `numRuns` değerini azaltın (geçici olarak)
