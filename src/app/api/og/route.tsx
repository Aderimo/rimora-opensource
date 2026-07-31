import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// İçerik tipi renkleri
const typeColors: Record<string, { bg: string; text: string; gradient: string }> = {
  movie: {
    bg: '#ef4444',
    text: '#ffffff',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  tv: {
    bg: '#8b5cf6',
    text: '#ffffff',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 50%, #4a1d6e 100%)',
  },
  anime: {
    bg: '#f97316',
    text: '#ffffff',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #3d2314 50%, #5c3520 100%)',
  },
}

// İçerik tipi etiketleri (Türkçe)
const typeLabels: Record<string, string> = {
  movie: 'Film',
  tv: 'Dizi',
  anime: 'Anime',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Query parametrelerini al
    const title = searchParams.get('title') || 'Rimora'
    const type = searchParams.get('type') || 'movie'
    const year = searchParams.get('year') || ''
    const rating = searchParams.get('rating') || ''
    const poster = searchParams.get('poster') || ''

    // Tip için renk ve gradient ayarları
    const colors = typeColors[type] || typeColors.movie
    const typeLabel = typeLabels[type] || 'Film'

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            background: colors.gradient,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Sol taraf - Poster */}
          {poster && (
            <div
              style={{
                width: '400px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
              }}
            >
              <img
                src={poster}
                alt={title}
                style={{
                  width: '320px',
                  height: '480px',
                  objectFit: 'cover',
                  borderRadius: '16px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
              />
            </div>
          )}

          {/* Sağ taraf - İçerik bilgileri */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: poster ? '40px 60px 40px 20px' : '60px',
              gap: '24px',
            }}
          >
            {/* İçerik tipi badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  fontSize: '24px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {typeLabel}
              </div>
              {year && (
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '24px',
                    fontWeight: 500,
                  }}
                >
                  {year}
                </div>
              )}
            </div>

            {/* Başlık */}
            <div
              style={{
                fontSize: title.length > 30 ? '48px' : '64px',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.1,
                maxWidth: '700px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>

            {/* Rating */}
            {rating && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="#fbbf24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#fbbf24',
                  }}
                >
                  {rating}
                </span>
                <span
                  style={{
                    fontSize: '24px',
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  / 10
                </span>
              </div>
            )}

            {/* Rimora branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: 'auto',
                paddingTop: '40px',
              }}
            >
              {/* Logo placeholder - gradient circle */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: '#ffffff',
                  }}
                >
                  R
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <span
                  style={{
                    fontSize: '32px',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Rimora
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  Film • Dizi • Anime
                </span>
              </div>
            </div>
          </div>

          {/* Dekoratif elementler */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              transform: 'translate(50%, -50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '30%',
              width: '300px',
              height: '300px',
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
              borderRadius: '50%',
              transform: 'translateY(50%)',
            }}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error) {
    console.error('OG Image generation error:', error)

    // Hata durumunda basit bir fallback image
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
            }}
          >
            <span
              style={{
                fontSize: '64px',
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              R
            </span>
          </div>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            Rimora
          </span>
          <span
            style={{
              fontSize: '28px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginTop: '16px',
            }}
          >
            Film • Dizi • Anime
          </span>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  }
}
