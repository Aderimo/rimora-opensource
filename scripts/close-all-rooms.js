// Tüm watch party odalarını kapat
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, remove } = require('firebase/database');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

async function closeAllRooms() {
  try {
    // .env.local dosyasını yükle
    require('dotenv').config({ path: '.env.local' });
    
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    
    // Tüm odaları sil
    await remove(ref(db, 'watchParties'));
    console.log('✅ Tüm watch party odaları silindi');
    
    // Tüm mesajları da sil
    await remove(ref(db, 'watchPartyMessages'));
    console.log('✅ Tüm watch party mesajları silindi');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

closeAllRooms();
