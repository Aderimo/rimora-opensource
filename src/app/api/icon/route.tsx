import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// PWA ikonları için dinamik SVG oluşturma
// Desteklenen boyutlar: 192x192, 512x512, 180x180 (apple-touch-icon)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sizeParam = searchParams.get('size') || '512'
  const size = parseInt(sizeParam, 10)
  
  // Geçerli boyutları kontrol et
  const validSizes = [180, 192, 512]
  const finalSize = validSizes.includes(size) ? size : 512

  return new ImageResponse(
    (
      <div
        style={{
          width: finalSize,
          height: finalSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A0612 0%, #1a0a2e 50%, #0A0612 100%)',
          borderRadius: finalSize * 0.15,
        }}
      >
        {/* Logo Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* R Harfi - Stilize Logo */}
          <div
            style={{
              fontSize: finalSize * 0.5,
              fontWeight: 900,
              color: '#A855F7',
              textShadow: `0 0 ${finalSize * 0.1}px rgba(168, 85, 247, 0.5)`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.05em',
            }}
          >
            R
          </div>
          {/* Alt çizgi dekorasyon */}
          <div
            style={{
              width: finalSize * 0.35,
              height: finalSize * 0.03,
              background: 'linear-gradient(90deg, transparent, #A855F7, transparent)',
              borderRadius: finalSize * 0.02,
              marginTop: -finalSize * 0.05,
            }}
          />
        </div>
      </div>
    ),
    {
      width: finalSize,
      height: finalSize,
    }
  )
}
