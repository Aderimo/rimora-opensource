// Firebase Cloud Messaging Service Worker
// Bu dosya build sırasında otomatik olarak oluşturulur
// Doğrudan düzenlemeyin - firebase-messaging-sw.template.js dosyasını düzenleyin

// Service Worker Version - Otomatik güncelleme için
const SW_VERSION = '__SW_VERSION__';
const SW_BUILD_TIME = '__SW_BUILD_TIME__';

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase config - Build time'da inject edilir
firebase.initializeApp({
  apiKey: '__FIREBASE_API_KEY__',
  authDomain: '__FIREBASE_AUTH_DOMAIN__',
  projectId: '__FIREBASE_PROJECT_ID__',
  storageBucket: '__FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__FIREBASE_APP_ID__'
});

const messaging = firebase.messaging();

// Service Worker güncelleme kontrolü
self.addEventListener('install', (event) => {
  console.log(`[SW v${SW_VERSION}] Installing new service worker...`);
  // Yeni service worker'ı hemen aktive et
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW v${SW_VERSION}] Service worker activated at ${SW_BUILD_TIME}`);
  // Tüm client'ları hemen kontrol altına al
  event.waitUntil(clients.claim());
});

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log(`[SW v${SW_VERSION}] Background message received:`, payload);
  
  const notificationTitle = payload.notification?.title || 'Rimora';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'rimora-notification',
    data: payload.data,
    actions: [
      { action: 'open', title: 'Aç' },
      { action: 'close', title: 'Kapat' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Token refresh handler - FCM token yenilendiğinde tetiklenir
messaging.onTokenRefresh(() => {
  console.log(`[SW v${SW_VERSION}] FCM token refreshed`);
  
  // Ana thread'e token refresh mesajı gönder
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'FCM_TOKEN_REFRESH',
        timestamp: Date.now()
      });
    });
  });
});

/**
 * Bildirim tipine göre yönlendirme URL'i oluşturur
 * @param {Object} data - Bildirim verisi
 * @returns {string} - Yönlendirme URL'i
 */
function getNotificationUrl(data) {
  if (!data) return '/';
  
  // Eğer doğrudan URL verilmişse onu kullan
  if (data.url) return data.url;
  
  const { type, mediaId, mediaType, roomId, conversationId } = data;
  
  switch (type) {
    case 'new_episode':
      // Yeni bölüm bildirimi - medya detay sayfasına yönlendir
      if (mediaId && mediaType) {
        const mediaPath = getMediaPath(mediaType);
        return `/${mediaPath}/${mediaId}`;
      }
      return '/';
    
    case 'comment':
      // Yorum bildirimi - medya detay sayfasına yönlendir (yorumlar bölümüne)
      if (mediaId && mediaType) {
        const mediaPath = getMediaPath(mediaType);
        return `/${mediaPath}/${mediaId}#yorumlar`;
      }
      return '/';
    
    case 'message':
      // Mesaj bildirimi - mesajlar sayfasına yönlendir
      if (conversationId) {
        return `/mesajlar?conversation=${conversationId}`;
      }
      return '/mesajlar';
    
    case 'watch_party':
      // Watch party daveti - watch party odasına yönlendir
      if (roomId) {
        return `/izle-birlikte/${roomId}`;
      }
      return '/';
    
    case 'friend_activity':
      // Arkadaş aktivitesi - profil veya aktivite sayfasına yönlendir
      if (data.userId) {
        return `/profil/${data.userId}`;
      }
      return '/';
    
    default:
      return data.url || '/';
  }
}

/**
 * Media tipine göre URL path'ini döndürür
 * @param {string} mediaType - 'movie' | 'tv' | 'anime'
 * @returns {string} - URL path
 */
function getMediaPath(mediaType) {
  switch (mediaType) {
    case 'movie':
      return 'filmler';
    case 'tv':
      return 'diziler';
    case 'anime':
      return 'animeler';
    default:
      return 'filmler';
  }
}

/**
 * Mevcut açık pencereler arasında en uygun olanı bulur
 * @param {Array} windowClients - Açık pencere listesi
 * @param {string} targetUrl - Hedef URL
 * @returns {Object|null} - En uygun pencere veya null
 */
function findBestWindow(windowClients, targetUrl) {
  if (!windowClients || windowClients.length === 0) return null;
  
  // Önce aynı URL'de açık pencere var mı kontrol et
  for (const client of windowClients) {
    if (client.url === targetUrl) {
      return { client, needsNavigation: false };
    }
  }
  
  // Sonra ana sayfada veya herhangi bir Rimora sayfasında açık pencere bul
  for (const client of windowClients) {
    if (client.url.includes(self.location.origin) && 'focus' in client) {
      return { client, needsNavigation: true };
    }
  }
  
  return null;
}

// Notification click handler - İyileştirilmiş versiyon
self.addEventListener('notificationclick', (event) => {
  console.log(`[SW v${SW_VERSION}] Notification clicked:`, event);
  
  // Bildirimi kapat
  event.notification.close();
  
  // Kapat aksiyonu seçildiyse hiçbir şey yapma
  if (event.action === 'close') {
    console.log('Notification closed by user action');
    return;
  }
  
  // Bildirim verisinden URL'i al
  const notificationData = event.notification.data || {};
  const urlToOpen = getNotificationUrl(notificationData);
  const fullUrl = new URL(urlToOpen, self.location.origin).href;
  
  console.log('Navigating to:', fullUrl, 'Type:', notificationData.type);
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    })
    .then((windowClients) => {
      // En uygun pencereyi bul
      const bestWindow = findBestWindow(windowClients, fullUrl);
      
      if (bestWindow) {
        const { client, needsNavigation } = bestWindow;
        
        // Eğer farklı bir sayfadaysa, yönlendir
        if (needsNavigation) {
          return client.navigate(fullUrl).then(() => client.focus());
        }
        
        // Aynı sayfadaysa sadece odaklan
        return client.focus();
      }
      
      // Açık pencere yoksa yeni pencere aç
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
      
      console.warn('Unable to open window for notification');
      return null;
    })
    .catch((error) => {
      console.error('Error handling notification click:', error);
      // Hata durumunda yeni pencere açmayı dene
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Notification close handler - Analitik için
self.addEventListener('notificationclose', (event) => {
  console.log(`[SW v${SW_VERSION}] Notification closed without interaction:`, event.notification.tag);
  // İsteğe bağlı: Analitik verisi gönderilebilir
});
