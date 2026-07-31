import { NextRequest, NextResponse } from 'next/server'

/**
 * TMDB Image Proxy
 * 
 * Bu route, TMDB image'larını server-side'dan proxy'ler.
 * Türkiye'de image.tmdb.org DPI tarafından engellendiği için
 * bu proxy kullanılarak görsel yükleme sorunu çözülür.
 * 
 * Kullanım: /api/image-proxy?url=https://image.tmdb.org/t/p/w500/xxx.jpg
 */

// Allowed domains for security
const ALLOWED_DOMAINS = [
    'image.tmdb.org',
    'www.themoviedb.org',
    's4.anilist.co',
    'anilist.co',
]

// Cache control
const CACHE_MAX_AGE = 86400 // 24 saat
const STALE_WHILE_REVALIDATE = 604800 // 7 gün

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    // URL parametresi kontrolü
    if (!imageUrl) {
        return NextResponse.json(
            { error: 'Missing url parameter' },
            { status: 400 }
        )
    }

    // URL'i parse et ve güvenlik kontrolü yap
    let parsedUrl: URL
    try {
        parsedUrl = new URL(imageUrl)
    } catch {
        return NextResponse.json(
            { error: 'Invalid URL format' },
            { status: 400 }
        )
    }

    // Domain whitelist kontrolü
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
        return NextResponse.json(
            { error: 'Domain not allowed' },
            { status: 403 }
        )
    }

    try {
        // TMDB'den image'ı fetch et
        const response = await fetch(imageUrl, {
            headers: {
                'Accept': 'image/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            // Vercel'de cache kullan
            next: { revalidate: CACHE_MAX_AGE }
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch image', status: response.status },
                { status: response.status }
            )
        }

        // Content type al
        const contentType = response.headers.get('content-type') || 'image/jpeg'

        // Image data'yı al
        const imageBuffer = await response.arrayBuffer()

        // Response döndür
        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
                'X-Image-Proxy': 'rimora',
            }
        })
    } catch (error) {
        console.error('Image proxy error:', error)
        return NextResponse.json(
            { error: 'Failed to proxy image' },
            { status: 502 }
        )
    }
}

// Config for edge runtime (optional, for better performance)
export const runtime = 'edge'
