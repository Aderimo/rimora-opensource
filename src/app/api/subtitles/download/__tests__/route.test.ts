/**
 * Altyazı İndirme Endpoint Testleri
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '../route'
import { NextRequest } from 'next/server'

// Mock OpenSubtitles client
vi.mock('@/lib/api/opensubtitles', () => ({
  getOpenSubtitlesClient: vi.fn(() => ({
    isConfigured: vi.fn(() => true),
    getDownloadUrl: vi.fn(async (fileId: number) => {
      if (fileId === 999) {
        throw new Error('File not found')
      }
      return `https://dl.opensubtitles.org/download/${fileId}`
    })
  }))
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('POST /api/subtitles/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('geçerli SRT altyazısını indirmeli', async () => {
    const validSRT = `1
00:00:01,000 --> 00:00:05,000
Test subtitle`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => validSRT,
      headers: new Map([
        ['content-disposition', 'attachment; filename="subtitle.srt"']
      ])
    })

    const request = new NextRequest('http://localhost/api/subtitles/download', {
      method: 'POST',
      body: JSON.stringify({ fileId: 123 })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.format).toBe('srt')
    expect(data.content).toContain('Test subtitle')
  })

  it('zararlı içeriği temizlemeli', async () => {
    const maliciousSRT = `1
00:00:01,000 --> 00:00:05,000
<script>alert('xss')</script>Clean text`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => maliciousSRT,
      headers: new Map([
        ['content-disposition', 'attachment; filename="subtitle.srt"']
      ])
    })

    const request = new NextRequest('http://localhost/api/subtitles/download', {
      method: 'POST',
      body: JSON.stringify({ fileId: 123 })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.content).not.toContain('<script>')
    expect(data.content).toContain('Clean text')
  })

  it('format dönüştürme yapmalı (SRT -> VTT)', async () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Test`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => srt,
      headers: new Map([
        ['content-disposition', 'attachment; filename="subtitle.srt"']
      ])
    })

    const request = new NextRequest('http://localhost/api/subtitles/download', {
      method: 'POST',
      body: JSON.stringify({ 
        fileId: 123,
        targetFormat: 'vtt'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.format).toBe('vtt')
    expect(data.content).toContain('WEBVTT')
  })

  it('geçersiz fileId için hata döndürmeli', async () => {
    const request = new NextRequest('http://localhost/api/subtitles/download', {
      method: 'POST',
      body: JSON.stringify({ fileId: 'invalid' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
  })

  it('geçersiz format için hata döndürmeli', async () => {
    const request = new NextRequest('http://localhost/api/subtitles/download', {
      method: 'POST',
      body: JSON.stringify({ 
        fileId: 123,
        targetFormat: 'invalid'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
    expect(data.message).toContain('Geçersiz format')
  })

  it('indirme hatası için uygun yanıt döndürmeli', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    })

    const request = new NextRequest('http://localhost/api/subtitles/download', {
      method: 'POST',
      body: JSON.stringify({ fileId: 123 })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toBe('Download Error')
  })
})

describe('GET /api/subtitles/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('query parametreleri ile altyazı indirmeli', async () => {
    const validSRT = `1
00:00:01,000 --> 00:00:05,000
Test subtitle`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => validSRT,
      headers: new Map([
        ['content-disposition', 'attachment; filename="subtitle.srt"']
      ])
    })

    const request = new NextRequest('http://localhost/api/subtitles/download?fileId=123')

    const response = await GET(request)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(text).toContain('Test subtitle')
  })

  it('format parametresi ile dönüştürme yapmalı', async () => {
    const srt = `1
00:00:01,000 --> 00:00:05,000
Test`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => srt,
      headers: new Map([
        ['content-disposition', 'attachment; filename="subtitle.srt"']
      ])
    })

    const request = new NextRequest('http://localhost/api/subtitles/download?fileId=123&format=vtt')

    const response = await GET(request)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('WEBVTT')
  })

  it('fileId olmadan hata döndürmeli', async () => {
    const request = new NextRequest('http://localhost/api/subtitles/download')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
  })

  it('geçersiz fileId için hata döndürmeli', async () => {
    const request = new NextRequest('http://localhost/api/subtitles/download?fileId=invalid')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
  })
})
