/**
 * Altyazı İşleme ve Güvenlik Modülü
 * 
 * Altyazı dosyalarının güvenli işlenmesi ve format dönüştürme işlemleri
 * - Güvenlik kontrolü (zararlı içerik, script injection)
 * - Format dönüştürme (SRT ↔ VTT ↔ ASS)
 * - Dosya boyutu ve içerik validasyonu
 * 
 * Requirements: 6.2 (Altyazı güvenlik ve işleme)
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SubtitleFormat = 'srt' | 'vtt' | 'ass'

export interface SubtitleEntry {
  index: number
  startTime: string
  endTime: string
  text: string
}

export interface SubtitleValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sanitized?: string
}

export interface SubtitleConversionResult {
  success: boolean
  content: string
  format: SubtitleFormat
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

// Maksimum dosya boyutu (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Maksimum satır sayısı
const MAX_LINES = 50000

// Tehlikeli HTML/Script pattern'leri
const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick, onload, vb.
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
  /<applet[^>]*>/gi,
  /<meta[^>]*>/gi,
  /<link[^>]*>/gi,
  /<style[^>]*>.*?<\/style>/gi,
]

// İzin verilen HTML etiketleri (altyazılarda kullanılabilir)
const ALLOWED_HTML_TAGS = ['b', 'i', 'u', 'font', 'br']

// ============================================================================
// Güvenlik Fonksiyonları
// ============================================================================

/**
 * Altyazı içeriğini güvenlik açısından doğrular
 * 
 * @param content Altyazı içeriği
 * @param format Altyazı formatı
 * @returns Validasyon sonucu
 */
export function validateSubtitleContent(
  content: string,
  format: SubtitleFormat
): SubtitleValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Boş içerik kontrolü
  if (!content || content.trim().length === 0) {
    errors.push('Altyazı içeriği boş')
    return { valid: false, errors, warnings }
  }

  // Dosya boyutu kontrolü
  const sizeInBytes = new Blob([content]).size
  if (sizeInBytes > MAX_FILE_SIZE) {
    errors.push(`Dosya boyutu çok büyük (${Math.round(sizeInBytes / 1024 / 1024)}MB > 5MB)`)
    return { valid: false, errors, warnings }
  }

  // Satır sayısı kontrolü
  const lines = content.split('\n')
  if (lines.length > MAX_LINES) {
    errors.push(`Çok fazla satır (${lines.length} > ${MAX_LINES})`)
    return { valid: false, errors, warnings }
  }

  // Tehlikeli pattern kontrolü
  let hasDangerousContent = false
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      hasDangerousContent = true
      warnings.push(`Tehlikeli içerik tespit edildi: ${pattern.source}`)
    }
  }

  // Format-specific validasyon
  switch (format) {
    case 'srt':
      if (!validateSRTFormat(content)) {
        errors.push('Geçersiz SRT formatı')
      }
      break
    case 'vtt':
      if (!validateVTTFormat(content)) {
        errors.push('Geçersiz VTT formatı')
      }
      break
    case 'ass':
      if (!validateASSFormat(content)) {
        errors.push('Geçersiz ASS formatı')
      }
      break
  }

  // Sanitize edilmiş içerik
  const sanitized = hasDangerousContent ? sanitizeSubtitleContent(content) : content

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized
  }
}

/**
 * Altyazı içeriğini temizler (zararlı içeriği kaldırır)
 * 
 * @param content Altyazı içeriği
 * @returns Temizlenmiş içerik
 */
export function sanitizeSubtitleContent(content: string): string {
  let sanitized = content

  // Tehlikeli pattern'leri kaldır
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }

  // İzin verilmeyen HTML etiketlerini kaldır
  sanitized = sanitized.replace(/<(\w+)[^>]*>/g, (match, tag) => {
    if (ALLOWED_HTML_TAGS.includes(tag.toLowerCase())) {
      return match
    }
    return ''
  })

  // Closing tag'leri de temizle
  sanitized = sanitized.replace(/<\/(\w+)>/g, (match, tag) => {
    if (ALLOWED_HTML_TAGS.includes(tag.toLowerCase())) {
      return match
    }
    return ''
  })

  return sanitized
}

/**
 * SRT format validasyonu
 */
function validateSRTFormat(content: string): boolean {
  // SRT format: index, timestamp, text, boş satır
  const srtPattern = /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m
  return srtPattern.test(content)
}

/**
 * VTT format validasyonu
 */
function validateVTTFormat(content: string): boolean {
  // VTT format: WEBVTT header ile başlamalı
  return content.trim().startsWith('WEBVTT')
}

/**
 * ASS format validasyonu
 */
function validateASSFormat(content: string): boolean {
  // ASS format: [Script Info] section ile başlamalı
  return content.includes('[Script Info]') || content.includes('[V4+ Styles]')
}

// ============================================================================
// Format Dönüştürme Fonksiyonları
// ============================================================================

/**
 * Altyazı formatını dönüştürür
 * 
 * @param content Altyazı içeriği
 * @param fromFormat Kaynak format
 * @param toFormat Hedef format
 * @returns Dönüştürme sonucu
 */
export function convertSubtitleFormat(
  content: string,
  fromFormat: SubtitleFormat,
  toFormat: SubtitleFormat
): SubtitleConversionResult {
  try {
    // Aynı format ise direkt döndür
    if (fromFormat === toFormat) {
      return {
        success: true,
        content,
        format: toFormat
      }
    }

    // Önce güvenlik kontrolü
    const validation = validateSubtitleContent(content, fromFormat)
    if (!validation.valid) {
      return {
        success: false,
        content: '',
        format: toFormat,
        error: `Validasyon hatası: ${validation.errors.join(', ')}`
      }
    }

    // Sanitize edilmiş içeriği kullan
    const safeContent = validation.sanitized || content

    // Parse et
    let entries: SubtitleEntry[]
    switch (fromFormat) {
      case 'srt':
        entries = parseSRT(safeContent)
        break
      case 'vtt':
        entries = parseVTT(safeContent)
        break
      case 'ass':
        entries = parseASS(safeContent)
        break
      default:
        return {
          success: false,
          content: '',
          format: toFormat,
          error: `Desteklenmeyen kaynak format: ${fromFormat}`
        }
    }

    // Hedef formata dönüştür
    let converted: string
    switch (toFormat) {
      case 'srt':
        converted = generateSRT(entries)
        break
      case 'vtt':
        converted = generateVTT(entries)
        break
      case 'ass':
        converted = generateASS(entries)
        break
      default:
        return {
          success: false,
          content: '',
          format: toFormat,
          error: `Desteklenmeyen hedef format: ${toFormat}`
        }
    }

    return {
      success: true,
      content: converted,
      format: toFormat
    }
  } catch (error) {
    return {
      success: false,
      content: '',
      format: toFormat,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }
  }
}

// ============================================================================
// SRT Parser & Generator
// ============================================================================

/**
 * SRT formatını parse eder
 */
function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = []
  const blocks = content.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue

    const index = parseInt(lines[0], 10)
    const timeLine = lines[1]
    const text = lines.slice(2).join('\n')

    // Timestamp parse et: 00:00:20,000 --> 00:00:24,400
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
    if (!timeMatch) continue

    entries.push({
      index,
      startTime: timeMatch[1],
      endTime: timeMatch[2],
      text: text.trim()
    })
  }

  return entries
}

/**
 * SRT formatı oluşturur
 */
function generateSRT(entries: SubtitleEntry[]): string {
  return entries.map((entry, idx) => {
    const index = idx + 1
    return `${index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}\n`
  }).join('\n')
}

// ============================================================================
// VTT Parser & Generator
// ============================================================================

/**
 * VTT formatını parse eder
 */
function parseVTT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = []
  
  // WEBVTT header'ı kaldır
  const withoutHeader = content.replace(/^WEBVTT[^\n]*\n+/, '')
  const blocks = withoutHeader.trim().split(/\n\s*\n/)

  let index = 1
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // İlk satır timestamp veya cue identifier olabilir
    let timeLine = lines[0]
    let textStartIndex = 1

    // Eğer ilk satır timestamp değilse, ikinci satır timestamp'tir
    if (!timeLine.includes('-->')) {
      timeLine = lines[1]
      textStartIndex = 2
    }

    const text = lines.slice(textStartIndex).join('\n')

    // Timestamp parse et: 00:00:20.000 --> 00:00:24.400
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/)
    if (!timeMatch) continue

    entries.push({
      index: index++,
      startTime: timeMatch[1].replace('.', ','), // SRT formatına çevir
      endTime: timeMatch[2].replace('.', ','),
      text: text.trim()
    })
  }

  return entries
}

/**
 * VTT formatı oluşturur
 */
function generateVTT(entries: SubtitleEntry[]): string {
  const header = 'WEBVTT\n\n'
  const cues = entries.map((entry, idx) => {
    const startTime = entry.startTime.replace(',', '.')
    const endTime = entry.endTime.replace(',', '.')
    return `${idx + 1}\n${startTime} --> ${endTime}\n${entry.text}\n`
  }).join('\n')

  return header + cues
}

// ============================================================================
// ASS Parser & Generator
// ============================================================================

/**
 * ASS formatını parse eder (basitleştirilmiş)
 */
function parseASS(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = []
  const lines = content.split('\n')

  let inEventsSection = false
  let index = 1

  for (const line of lines) {
    const trimmed = line.trim()

    // Events section'ı bul
    if (trimmed === '[Events]') {
      inEventsSection = true
      continue
    }

    // Başka bir section başladıysa çık
    if (trimmed.startsWith('[') && trimmed !== '[Events]') {
      inEventsSection = false
      continue
    }

    // Dialogue satırlarını parse et
    if (inEventsSection && trimmed.startsWith('Dialogue:')) {
      // Format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
      const parts = trimmed.substring(9).split(',')
      if (parts.length < 10) continue

      const startTime = convertASSTimeToSRT(parts[1].trim())
      const endTime = convertASSTimeToSRT(parts[2].trim())
      const text = parts.slice(9).join(',').trim()

      // ASS formatting kodlarını temizle
      const cleanText = text
        .replace(/\{[^}]*\}/g, '') // {formatting} kodlarını kaldır
        .replace(/\\N/g, '\n') // Satır sonlarını dönüştür
        .replace(/\\n/g, '\n')

      entries.push({
        index: index++,
        startTime,
        endTime,
        text: cleanText
      })
    }
  }

  return entries
}

/**
 * ASS formatı oluşturur (basitleştirilmiş)
 */
function generateASS(entries: SubtitleEntry[]): string {
  const header = `[Script Info]
Title: Converted Subtitle
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const dialogues = entries.map(entry => {
    const startTime = convertSRTTimeToASS(entry.startTime)
    const endTime = convertSRTTimeToASS(entry.endTime)
    const text = entry.text.replace(/\n/g, '\\N')
    return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}`
  }).join('\n')

  return header + dialogues + '\n'
}

// ============================================================================
// Time Conversion Utilities
// ============================================================================

/**
 * ASS time formatını SRT formatına çevir
 * ASS: 0:00:20.00 -> SRT: 00:00:20,000
 */
function convertASSTimeToSRT(assTime: string): string {
  const parts = assTime.split(':')
  if (parts.length !== 3) return '00:00:00,000'

  const hours = parts[0].padStart(2, '0')
  const minutes = parts[1].padStart(2, '0')
  const secondsParts = parts[2].split('.')
  const seconds = secondsParts[0].padStart(2, '0')
  const centiseconds = (secondsParts[1] || '00').padEnd(2, '0')
  const milliseconds = centiseconds.padEnd(3, '0')

  return `${hours}:${minutes}:${seconds},${milliseconds}`
}

/**
 * SRT time formatını ASS formatına çevir
 * SRT: 00:00:20,000 -> ASS: 0:00:20.00
 */
function convertSRTTimeToASS(srtTime: string): string {
  const [time, ms] = srtTime.split(',')
  const [hours, minutes, seconds] = time.split(':')
  
  const h = parseInt(hours, 10)
  const centiseconds = ms ? ms.substring(0, 2) : '00'

  return `${h}:${minutes}:${seconds}.${centiseconds}`
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format extension'dan format tipini belirler
 */
export function detectFormatFromExtension(filename: string): SubtitleFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'srt':
      return 'srt'
    case 'vtt':
    case 'webvtt':
      return 'vtt'
    case 'ass':
    case 'ssa':
      return 'ass'
    default:
      return null
  }
}

/**
 * İçerikten format tipini tahmin eder
 */
export function detectFormatFromContent(content: string): SubtitleFormat | null {
  const trimmed = content.trim()

  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt'
  }

  if (trimmed.includes('[Script Info]') || trimmed.includes('[V4+ Styles]')) {
    return 'ass'
  }

  // SRT pattern kontrolü
  if (/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m.test(trimmed)) {
    return 'srt'
  }

  return null
}

/**
 * Altyazı dosyasını güvenli şekilde işler
 * 
 * @param content Altyazı içeriği
 * @param filename Dosya adı (format tespiti için)
 * @param targetFormat Hedef format (opsiyonel)
 * @returns İşlenmiş ve güvenli altyazı içeriği
 */
export function processSubtitleFile(
  content: string,
  filename: string,
  targetFormat?: SubtitleFormat
): SubtitleConversionResult {
  // Format tespiti
  let sourceFormat = detectFormatFromExtension(filename)
  
  if (!sourceFormat) {
    sourceFormat = detectFormatFromContent(content)
  }

  if (!sourceFormat) {
    return {
      success: false,
      content: '',
      format: targetFormat || 'srt',
      error: 'Altyazı formatı tespit edilemedi'
    }
  }

  // Güvenlik kontrolü
  const validation = validateSubtitleContent(content, sourceFormat)
  if (!validation.valid) {
    return {
      success: false,
      content: '',
      format: targetFormat || sourceFormat,
      error: `Güvenlik kontrolü başarısız: ${validation.errors.join(', ')}`
    }
  }

  // Format dönüştürme gerekli mi?
  if (targetFormat && targetFormat !== sourceFormat) {
    return convertSubtitleFormat(
      validation.sanitized || content,
      sourceFormat,
      targetFormat
    )
  }

  // Sadece sanitize edilmiş içeriği döndür
  return {
    success: true,
    content: validation.sanitized || content,
    format: sourceFormat
  }
}
