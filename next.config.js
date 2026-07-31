/** @type {import('next').NextConfig} */

// Bundle Analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// Türkiye'de ISP DNS poisoning: api.themoviedb.org IPv6 olarak 127.0.0.1'e yönlendiriliyor
// IPv4 önceliği vererek hosts dosyasındaki doğru IP'nin kullanılmasını sağla
require('node:dns').setDefaultResultOrder('ipv4first')

// Build öncesi Firebase config injection
const { execSync } = require('child_process');
const path = require('path');

// Firebase config'i service worker'a inject et
function injectFirebaseConfig() {
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'inject-firebase-config.js');
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: process.env
    });
  } catch (error) {
    console.error('Firebase config injection failed:', error.message);
    // Development modunda hata verme, sadece uyar
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

// Build başlamadan önce config'i inject et
if (process.env.NODE_ENV === 'production' || process.env.INJECT_FIREBASE_CONFIG === 'true') {
  injectFirebaseConfig();
}

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        // Self-hosted proxy images (Vercel)
        protocol: 'https',
        hostname: '*.vercel.app',
        pathname: '/api/image-proxy/**',
      },
    ],
    // Proxy images için unoptimized ayarı
    unoptimized: false,
  },

  // iyzipay modülü sadece server-side'da çalışır, client-side'dan hariç tut
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },

  // Service worker için header'lar
  async headers() {
    return [
      {
        source: '/firebase-messaging-sw.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
}

module.exports = withBundleAnalyzer(nextConfig)
