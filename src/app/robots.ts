import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/profil/', '/mesajlar/', '/izle/'],
      },
    ],
    sitemap: 'https://rimora-indol.vercel.app/sitemap.xml',
  }
}
