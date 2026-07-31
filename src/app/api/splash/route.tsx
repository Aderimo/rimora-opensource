import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// PWA Splash Screen'ler için dinamik oluşturma
// Desteklenen boyutlar: iPhone, iPad, Android
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const widthParam = searchParams.get('width') || '1170'
  const heightParam = searchParams.get('height') || '2532'
  
  const width = parseInt(widthParam, 10)
  const height = parseInt(heightParam, 10)
  
  // Maksimum boyut sınırı
  const maxWidth = Math.min(width, 2048)
  const maxHeight = Math.min(height, 2732)

  const logoSize = Math.min(maxWidth, maxHeight) * 0.25

  return new ImageResponse(
    (
      <div
        style={{
          width: maxWidth,
          height: maxHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0A0612 0%, #1a0a2e 50%, #0A0612 100%)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* R Harfi */}
          <div
            style={{
              fontSize: logoSize,
              fontWeight: 900,
              color: '#A855F7',
              textShadow: `0 0 ${logoSize * 0.2}px rgba(168, 85, 247, 0.6)`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.05em',
            }}
          >
            R
          </div>
          {/* Alt çizgi */}
          <div
            style={{
              width: logoSize * 0.7,
              height: logoSize * 0.06,
              background: 'linear-gradient(90deg, transparent, #A855F7, transparent)',
              borderRadius: logoSize * 0.03,
              marginTop: -logoSize * 0.1,
            }}
          />
        </div>
        
        {/* Marka adı */}
        <div
          style={{
            fontSize: logoSize * 0.35,
            fontWeight: 700,
            color: '#ffffff',
            marginTop: logoSize * 0.3,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '0.1em',
          }}
        >
          RIMORA
        </div>
        
        {/* Slogan */}
        <div
          style={{
            fontSize: logoSize * 0.15,
            color: 'rgba(255, 255, 255, 0.6)',
            marginTop: logoSize * 0.1,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          İzleme Platformu
        </div>
      </div>
    ),
    {
      width: maxWidth,
      height: maxHeight,
    }
  )
}
