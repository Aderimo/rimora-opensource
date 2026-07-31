/**
 * Altyazı İşleme ve Güvenlik Testleri
 * 
 * Unit testler: Spesifik örnekler ve edge case'ler
 */

import { describe, it, expect } from 'vitest'
import {
  validateSubtitleContent,
  sanitizeSubtitleContent,
  convertSubtitleFormat,
  detectFormatFromExtension,
  detectFormatFromContent,
  processSubtitleFile,
  type SubtitleFormat
} from '../subtitle-processor'

describe('Altyazı Güvenlik Kontrolü', () => {
  it('boş içeriği reddetmeli', () => {
    const result = validateSubtitleContent('', 'srt')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Altyazı içeriği boş')
  })

  it('script tag içeren içeriği tespit etmeli', () => {
    const maliciousContent = `1
00:00:01,000 --> 00:00:05,000
<script>alert('xss')</script>Merhaba`

    const result = validateSubtitleContent(maliciousContent, 'srt')
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some(w => w.includes('Tehlikeli içerik'))).toBe(true)
  })

  it('iframe tag içeren içeriği tespit etmeli', () => {
    const maliciousContent = `1
00:00:01,000 --> 00:00:05,000
<iframe src="evil.com"></iframe>Test`

    const result = validateSubtitleContent(maliciousContent, 'srt')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('javascript: protokolünü tespit etmeli', () => {
    const maliciousContent = `1
00:00:01,000 --> 00:00:05,000
<a href="javascript:alert('xss')">Tıkla</a>`

    const result = validateSubtitleContent(maliciousContent, 'srt')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('event handler içeren içeriği tespit etmeli', () => {
    const maliciousContent = `1
00:00:01,000 --> 00:00:05,000
<div onclick="alert('xss')">Test</div>`

    const result = validateSubtitleContent(maliciousContent, 'srt')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('geçerli SRT formatını kabul etmeli', () => {
    const validSRT = `1
00:00:01,000 --> 00:00:05,000
Merhaba dünya

2
00:00:06,000 --> 00:00:10,000
Bu bir test`

    const result = validateSubtitleContent(validSRT, 'srt')
    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('geçerli VTT formatını kabul etmeli', () => {
    const validVTT = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
Merhaba dünya`

    const result = validateSubtitleContent(validVTT, 'vtt')
    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('geçersiz SRT formatını reddetmeli', () => {
    const invalidSRT = `Bu geçerli bir SRT değil
sadece metin var`

    const result = validateSubtitleContent(invalidSRT, 'srt')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Geçersiz SRT formatı')
  })

  it('geçersiz VTT formatını reddetmeli', () => {
    const invalidVTT = `1
00:00:01.000 --> 00:00:05.000
WEBVTT header yok`

    const result = validateSubtitleContent(invalidVTT, 'vtt')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Geçersiz VTT formatı')
  })
})

describe('Altyazı İçerik Temizleme', () => {
  it('script tag\'lerini kaldırmalı', () => {
    const malicious = '<script>alert("xss")</script>Temiz metin'
    const sanitized = sanitizeSubtitleContent(malicious)
    expect(sanitized).not.toContain('<script>')
    expect(sanitized).toContain('Temiz metin')
  })

  it('iframe tag\'lerini kaldırmalı', () => {
    const malicious = '<iframe src="evil.com"></iframe>Temiz metin'
    const sanitized = sanitizeSubtitleContent(malicious)
    expect(sanitized).not.toContain('<iframe>')
    expect(sanitized).toContain('Temiz metin')
  })

  it('izin verilen HTML tag\'lerini korumalı', () => {
    const content = '<b>Kalın</b> <i>İtalik</i> <u>Altı çizili</u>'
    const sanitized = sanitizeSubtitleContent(content)
    expect(sanitized).toContain('<b>')
    expect(sanitized).toContain('<i>')
    expect(sanitized).toContain('<u>')
  })

  it('izin verilmeyen HTML tag\'lerini kaldırmalı', () => {
    const content = '<div>Test</div> <span>Span</span> <b>Kalın</b>'
    const sanitized = sanitizeSubtitleContent(content)
    expect(sanitized).not.toContain('<div>')
    expect(sanitized).not.toContain('<span>')
    expect(sanitized).toContain('<b>')
  })

  it('event handler\'ları kaldırmalı', () => {
    const malicious = '<div onclick="alert()">Test</div>'
    const sanitized = sanitizeSubtitleContent(malicious)
    expect(sanitized).not.toContain('onclick')
  })
})

describe('Format Dönüştürme - SRT to VTT', () => {
  it('basit SRT\'yi VTT\'ye dönüştürmeli', () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Merhaba dünya

2
00:00:06,000 --> 00:00:10,000
İkinci satır`

    const result = convertSubtitleFormat(srt, 'srt', 'vtt')
    expect(result.success).toBe(true)
    expect(result.content).toContain('WEBVTT')
    expect(result.content).toContain('00:00:01.000')
    expect(result.content).toContain('Merhaba dünya')
  })

  it('virgülü nokta ile değiştirmeli (SRT -> VTT)', () => {
    const srt = `1
00:00:01,500 --> 00:00:05,750
Test`

    const result = convertSubtitleFormat(srt, 'srt', 'vtt')
    expect(result.success).toBe(true)
    expect(result.content).toContain('00:00:01.500')
    expect(result.content).toContain('00:00:05.750')
  })
})

describe('Format Dönüştürme - VTT to SRT', () => {
  it('basit VTT\'yi SRT\'ye dönüştürmeli', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
Merhaba dünya

2
00:00:06.000 --> 00:00:10.000
İkinci satır`

    const result = convertSubtitleFormat(vtt, 'vtt', 'srt')
    expect(result.success).toBe(true)
    expect(result.content).not.toContain('WEBVTT')
    expect(result.content).toContain('00:00:01,000')
    expect(result.content).toContain('Merhaba dünya')
  })

  it('noktayı virgül ile değiştirmeli (VTT -> SRT)', () => {
    const vtt = `WEBVTT

1
00:00:01.500 --> 00:00:05.750
Test`

    const result = convertSubtitleFormat(vtt, 'vtt', 'srt')
    expect(result.success).toBe(true)
    expect(result.content).toContain('00:00:01,500')
    expect(result.content).toContain('00:00:05,750')
  })
})

describe('Format Dönüştürme - ASS', () => {
  it('basit ASS\'yi SRT\'ye dönüştürmeli', () => {
    const ass = `[Script Info]
Title: Test

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,20

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,Merhaba dünya
Dialogue: 0,0:00:06.00,0:00:10.00,Default,,0,0,0,,İkinci satır`

    const result = convertSubtitleFormat(ass, 'ass', 'srt')
    expect(result.success).toBe(true)
    expect(result.content).toContain('00:00:01,000')
    expect(result.content).toContain('Merhaba dünya')
  })

  it('ASS formatting kodlarını temizlemeli', () => {
    const ass = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,{\\b1}Kalın{\\b0} normal`

    const result = convertSubtitleFormat(ass, 'ass', 'srt')
    expect(result.success).toBe(true)
    expect(result.content).not.toContain('{\\b1}')
    expect(result.content).toContain('Kalın normal')
  })

  it('ASS satır sonlarını dönüştürmeli', () => {
    const ass = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,Birinci satir\\NIkinci satir`

    const result = convertSubtitleFormat(ass, 'ass', 'srt')
    expect(result.success).toBe(true)
    expect(result.content).toContain('Birinci satir\nIkinci satir')
  })
})

describe('Format Tespiti', () => {
  it('dosya uzantısından SRT formatını tespit etmeli', () => {
    expect(detectFormatFromExtension('subtitle.srt')).toBe('srt')
    expect(detectFormatFromExtension('movie.SRT')).toBe('srt')
  })

  it('dosya uzantısından VTT formatını tespit etmeli', () => {
    expect(detectFormatFromExtension('subtitle.vtt')).toBe('vtt')
    expect(detectFormatFromExtension('subtitle.webvtt')).toBe('vtt')
  })

  it('dosya uzantısından ASS formatını tespit etmeli', () => {
    expect(detectFormatFromExtension('subtitle.ass')).toBe('ass')
    expect(detectFormatFromExtension('subtitle.ssa')).toBe('ass')
  })

  it('bilinmeyen uzantı için null döndürmeli', () => {
    expect(detectFormatFromExtension('subtitle.txt')).toBe(null)
    expect(detectFormatFromExtension('subtitle.unknown')).toBe(null)
  })

  it('içerikten VTT formatını tespit etmeli', () => {
    const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nTest'
    expect(detectFormatFromContent(vtt)).toBe('vtt')
  })

  it('içerikten ASS formatını tespit etmeli', () => {
    const ass = '[Script Info]\nTitle: Test\n[Events]\nDialogue: ...'
    expect(detectFormatFromContent(ass)).toBe('ass')
  })

  it('içerikten SRT formatını tespit etmeli', () => {
    const srt = '1\n00:00:01,000 --> 00:00:05,000\nTest'
    expect(detectFormatFromContent(srt)).toBe('srt')
  })

  it('belirsiz içerik için null döndürmeli', () => {
    const unknown = 'Bu sadece düz metin'
    expect(detectFormatFromContent(unknown)).toBe(null)
  })
})

describe('Altyazı Dosyası İşleme', () => {
  it('geçerli SRT dosyasını işlemeli', () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Merhaba dünya`

    const result = processSubtitleFile(srt, 'subtitle.srt')
    expect(result.success).toBe(true)
    expect(result.format).toBe('srt')
  })

  it('zararlı içeriği temizlemeli', () => {
    const malicious = `1
00:00:01,000 --> 00:00:05,000
<script>alert('xss')</script>Temiz metin`

    const result = processSubtitleFile(malicious, 'subtitle.srt')
    expect(result.success).toBe(true)
    expect(result.content).not.toContain('<script>')
  })

  it('format dönüştürme yapmalı', () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Test`

    const result = processSubtitleFile(srt, 'subtitle.srt', 'vtt')
    expect(result.success).toBe(true)
    expect(result.format).toBe('vtt')
    expect(result.content).toContain('WEBVTT')
  })

  it('geçersiz format için hata döndürmeli', () => {
    const invalid = 'Bu geçerli bir altyazı değil'
    const result = processSubtitleFile(invalid, 'subtitle.txt')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('Edge Cases', () => {
  it('çok satırlı altyazı metnini işlemeli', () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Birinci satır
İkinci satır
Üçüncü satır`

    const result = validateSubtitleContent(srt, 'srt')
    expect(result.valid).toBe(true)
  })

  it('özel karakterleri korumalı', () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Türkçe: ğüşıöçĞÜŞİÖÇ
Emoji: 😀🎬🎥`

    const result = validateSubtitleContent(srt, 'srt')
    expect(result.valid).toBe(true)
    expect(result.sanitized).toContain('ğüşıöç')
    expect(result.sanitized).toContain('😀')
  })

  it('boş satırları işlemeli', () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000


Boş satırlarla çevrili metin


2
00:00:06,000 --> 00:00:10,000
Normal metin`

    const result = validateSubtitleContent(srt, 'srt')
    expect(result.valid).toBe(true)
  })

  it('aynı formata dönüştürme isteğinde içeriği olduğu gibi döndürmeli', () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Test`

    const result = convertSubtitleFormat(srt, 'srt', 'srt')
    expect(result.success).toBe(true)
    expect(result.content).toBe(srt)
  })
})
