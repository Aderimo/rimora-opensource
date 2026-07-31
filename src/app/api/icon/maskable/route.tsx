import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// Maskable ikon için - daha geniş safe zone ile
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sizeParam = searchParams.get('size') || '512'
  const size = parseInt(sizeParam, 10)
  
  const validSizes = [192, 512]
  const finalSize = validSizes.includes(size) ? size : 512

  // Maskable ikonlar için safe zone: %10 padding
  const safeZone = finalSize * 0.1
  const contentSize = finalSize - (safeZone * 2)

  return new ImageResponse(
    (
      <div
        style={{
          width: finalSize,
          height: finalSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#A855F7', // Solid purple background for maskable
        }}
      >
        {/* Logo Container - safe zone içinde */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: contentSize,
            height: contentSize,
          }}
        >
          {/* R Harfi */}
          <div
            style={{
              fontSize: contentSize * 0.55,
              fontWeight: 900,
              color: '#ffffff',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.05em',
            }}
          >
            R
          </div>
          {/* Alt çizgi */}
          <div
            style={{
              width: contentSize * 0.4,
              height: contentSize * 0.035,
              background: 'rgba(255, 255, 255, 0.8)',
              borderRadius: contentSize * 0.02,
              marginTop: -contentSize * 0.05,
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
