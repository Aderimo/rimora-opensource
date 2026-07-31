/**
 * Renk Kontrastı Utility
 * WCAG 2.1 AA/AAA standartlarına uygunluk kontrolü
 */

/**
 * Hex rengi RGB'ye çevirir
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * RGB'yi relative luminance'a çevirir
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * İki renk arasındaki kontrast oranını hesaplar
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  if (!rgb1 || !rgb2) {
    throw new Error('Geçersiz hex renk formatı')
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG AA standardına uygunluk kontrolü
 * Normal metin: 4.5:1
 * Büyük metin (18pt+ veya 14pt+ bold): 3:1
 */
export function meetsWCAG_AA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

/**
 * WCAG AAA standardına uygunluk kontrolü
 * Normal metin: 7:1
 * Büyük metin: 4.5:1
 */
export function meetsWCAG_AAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return isLargeText ? ratio >= 4.5 : ratio >= 7
}

/**
 * Kontrast seviyesini döndürür
 */
export function getContrastLevel(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): 'AAA' | 'AA' | 'Fail' {
  if (meetsWCAG_AAA(foreground, background, isLargeText)) {
    return 'AAA'
  }
  if (meetsWCAG_AA(foreground, background, isLargeText)) {
    return 'AA'
  }
  return 'Fail'
}

/**
 * Bir rengin üzerine kontrast sağlayan metin rengi önerir
 */
export function getAccessibleTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return '#000000'

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b)
  
  // Luminance 0.5'ten büyükse siyah, küçükse beyaz metin kullan
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

/**
 * Renk paletinin WCAG uyumluluğunu kontrol eder
 */
export interface ColorPair {
  name: string
  foreground: string
  background: string
  isLargeText?: boolean
}

export function checkColorPalette(pairs: ColorPair[]): {
  pair: ColorPair
  ratio: number
  level: 'AAA' | 'AA' | 'Fail'
  passes: boolean
}[] {
  return pairs.map((pair) => {
    const ratio = getContrastRatio(pair.foreground, pair.background)
    const level = getContrastLevel(
      pair.foreground,
      pair.background,
      pair.isLargeText
    )
    
    return {
      pair,
      ratio: Math.round(ratio * 100) / 100,
      level,
      passes: level !== 'Fail',
    }
  })
}

/**
 * Rimora tema renklerinin WCAG uyumluluğunu kontrol eder
 */
export function checkRimoraThemeContrast() {
  const lightTheme: ColorPair[] = [
    { name: 'Foreground on Background', foreground: '#1A0A2E', background: '#FFFFFF' },
    { name: 'Muted Foreground on Background', foreground: '#5A4A6E', background: '#FFFFFF' },
    { name: 'Accent Foreground on Accent', foreground: '#3D1F5C', background: '#F3E8FF' },
    { name: 'Primary Foreground on Primary', foreground: '#FFFFFF', background: '#A855F7' },
  ]

  const darkTheme: ColorPair[] = [
    { name: 'Foreground on Background', foreground: '#FAFAFA', background: '#0A0612' },
    { name: 'Muted Foreground on Background', foreground: '#B8B0C8', background: '#0A0612' },
    { name: 'Accent Foreground on Accent', foreground: '#D9C4F0', background: '#2D1B4E' },
    { name: 'Primary Foreground on Primary', foreground: '#FFFFFF', background: '#B565F8' },
  ]

  return {
    light: checkColorPalette(lightTheme),
    dark: checkColorPalette(darkTheme),
  }
}
