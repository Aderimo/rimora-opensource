/**
 * Image Placeholder Utility
 * Blur placeholder ve shimmer effect için
 */

/**
 * Base64 encoded blur placeholder
 * 10x10 piksel gri gradient
 */
export const shimmerBlurDataURL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#2a2a2a;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="10" height="10" fill="url(#shimmer)" />
  </svg>`
).toString('base64')}`

/**
 * Poster için blur placeholder (2:3 aspect ratio)
 */
export const posterBlurDataURL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#2d1b4e;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#0a0612;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="200" height="300" fill="url(#grad)" />
  </svg>`
).toString('base64')}`

/**
 * Backdrop için blur placeholder (16:9 aspect ratio)
 */
export const backdropBlurDataURL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#2d1b4e;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#1a0a2e;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#0a0612;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#grad)" />
  </svg>`
).toString('base64')}`

/**
 * Avatar için blur placeholder (1:1 aspect ratio)
 */
export const avatarBlurDataURL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="grad">
        <stop offset="0%" style="stop-color:#a855f7;stop-opacity:0.5" />
        <stop offset="100%" style="stop-color:#2d1b4e;stop-opacity:1" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#grad)" />
  </svg>`
).toString('base64')}`

/**
 * Dinamik renk ile blur placeholder oluştur
 */
export function createColoredBlurDataURL(color: string = '#2d1b4e'): string {
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
      <rect width="10" height="10" fill="${color}" />
    </svg>`
  ).toString('base64')}`
}

/**
 * Shimmer effect SVG
 */
export const shimmerSVG = `
<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0);stop-opacity:1">
        <animate attributeName="offset" values="-2; 1" dur="2s" repeatCount="indefinite" />
      </stop>
      <stop offset="50%" style="stop-color:rgba(255,255,255,0.3);stop-opacity:1">
        <animate attributeName="offset" values="-1; 2" dur="2s" repeatCount="indefinite" />
      </stop>
      <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:1">
        <animate attributeName="offset" values="0; 3" dur="2s" repeatCount="indefinite" />
      </stop>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#shimmer)" />
</svg>
`

/**
 * Image loading state için props
 */
export interface ImagePlaceholderProps {
  blurDataURL?: string
  placeholder?: 'blur' | 'empty'
}

/**
 * Aspect ratio'ya göre placeholder seç
 */
export function getPlaceholderByAspectRatio(
  aspectRatio: 'poster' | 'backdrop' | 'avatar' | 'square'
): string {
  switch (aspectRatio) {
    case 'poster':
      return posterBlurDataURL
    case 'backdrop':
      return backdropBlurDataURL
    case 'avatar':
      return avatarBlurDataURL
    case 'square':
    default:
      return shimmerBlurDataURL
  }
}
