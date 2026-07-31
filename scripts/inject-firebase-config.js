#!/usr/bin/env node

/**
 * Firebase Config Injection Script
 * 
 * Bu script, build sırasında Firebase yapılandırmasını service worker'a inject eder.
 * Template dosyasındaki placeholder'ları environment variable'larla değiştirir.
 * 
 * Kullanım: node scripts/inject-firebase-config.js
 * 
 * Gerekli Environment Variables:
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// .env.local dosyasını yükle
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('📄 .env.local dosyası yüklendi');
} else {
  console.warn('⚠️  .env.local dosyası bulunamadı');
}

// Dosya yolları
const TEMPLATE_PATH = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.template.js');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js');

// Environment variable mapping
const ENV_MAPPING = {
  '__FIREBASE_API_KEY__': 'NEXT_PUBLIC_FIREBASE_API_KEY',
  '__FIREBASE_AUTH_DOMAIN__': 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  '__FIREBASE_PROJECT_ID__': 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  '__FIREBASE_STORAGE_BUCKET__': 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  '__FIREBASE_MESSAGING_SENDER_ID__': 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  '__FIREBASE_APP_ID__': 'NEXT_PUBLIC_FIREBASE_APP_ID'
};

/**
 * Benzersiz versiyon numarası oluşturur
 * @returns {string} - Versiyon numarası (timestamp + hash)
 */
function generateVersion() {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${hash}`;
}

/**
 * Build zamanını formatlar
 * @returns {string} - ISO formatında tarih
 */
function getBuildTime() {
  return new Date().toISOString();
}

/**
 * Environment variable'ı güvenli şekilde alır
 * @param {string} envKey - Environment variable adı
 * @returns {string} - Değer veya boş string
 */
function getEnvValue(envKey) {
  const value = process.env[envKey];

  if (!value) {
    console.warn(`⚠️  Warning: ${envKey} is not set`);
    return '';
  }

  return value;
}

/**
 * Tüm gerekli environment variable'ların varlığını kontrol eder
 * @returns {boolean} - Tüm değişkenler mevcutsa true
 */
function validateEnvironment() {
  const missingVars = [];

  for (const envKey of Object.values(ENV_MAPPING)) {
    if (!process.env[envKey]) {
      missingVars.push(envKey);
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    return false;
  }

  return true;
}

/**
 * Template dosyasını okur ve placeholder'ları değiştirir
 */
function injectConfig() {
  console.log('🔧 Firebase Config Injection Script');
  console.log('===================================\n');

  // Template dosyasının varlığını kontrol et
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.warn(`⚠️  Template file not found: ${TEMPLATE_PATH}`);
    console.warn('   Skipping FCM service worker generation.');
    return; // Graceful skip - build'i durdurmadan devam et
  }

  // Environment variable'ları kontrol et
  const isValid = validateEnvironment();

  if (!isValid) {
    console.warn('\n⚠️  Firebase config not complete - FCM may not work.');
    console.warn('   Service worker will use placeholder values.');
    // Vercel'de env vars varsa devam et, yoksa da build'i durdurma
  }

  // Template'i oku
  let content = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Versiyon ve build zamanını inject et
  const version = generateVersion();
  const buildTime = getBuildTime();

  content = content.replace('__SW_VERSION__', version);
  content = content.replace('__SW_BUILD_TIME__', buildTime);

  // Firebase config'i inject et
  for (const [placeholder, envKey] of Object.entries(ENV_MAPPING)) {
    const value = getEnvValue(envKey);
    content = content.replace(placeholder, value);
  }

  // Çıktı dosyasını yaz
  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');

  console.log('✅ Firebase config injected successfully!');
  console.log(`   Version: ${version}`);
  console.log(`   Build Time: ${buildTime}`);
  console.log(`   Output: ${OUTPUT_PATH}\n`);

  // Güvenlik kontrolü - hardcoded değerlerin olmadığını doğrula
  const outputContent = fs.readFileSync(OUTPUT_PATH, 'utf8');
  const hasPlaceholders = Object.keys(ENV_MAPPING).some(p => outputContent.includes(p));

  if (hasPlaceholders) {
    console.warn('⚠️  Warning: Some placeholders were not replaced!');
    console.warn('   Check that all environment variables are properly set.');
  }

  // API key'in doğrudan dosyada olmadığını kontrol et (güvenlik)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (apiKey && outputContent.includes(apiKey)) {
    console.log('ℹ️  Note: Firebase API key is now in the service worker.');
    console.log('   This is expected for FCM to work, but ensure .env files are in .gitignore');
  }
}

// Script'i çalıştır
try {
  injectConfig();
} catch (error) {
  console.error('❌ Error during config injection:', error.message);
  process.exit(1);
}
