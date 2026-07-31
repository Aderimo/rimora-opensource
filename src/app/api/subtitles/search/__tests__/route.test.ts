/**
 * Altyazı Arama API Endpoint Tests
 * 
 * Unit testler - API endpoint'in doğru çalıştığını test eder
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, GET } from '../route'
import { NextRequest } from 'next/server'

// Mock OpenSubtitles client
vi.mock('@/lib/api/opensubtitles', () => ({
  getOpenSubtitlesClient: vi.fn(() => ({
    isConfigured: vi.fn(() => true),
    getRateLimitStatus: vi.fn(() => ({
      maxRequests: 40,
      currentCount: 0,
      canRequest: true,
      waitTime: 0
    })),
    searchSubtitles: vi.fn(async () => [
      {
        id: '1',
        language: 'tr',
        languageName: 'Türkçe',
        downloadUrl: 'https://example.com/subtitle',
        format: 'srt',
        rating: 4.5,
        downloads: 100,
        uploadDate: '2024-01-01'
      }
    ])
  })),
  OpenSubtitlesRateLimitError: class extends Error {
    waitTime: number
    constructor(message: string, waitTime: number) {
      super(message)
      this.waitTime = waitTime
    }
  },
  OpenSubtitlesNotFoundError: class extends Error {},
  OpenSubtitlesConfigError: class extends Error {},
  OpenSubtitlesAuthError: class extends Error {}
}))

describe('POST /api/subtitles/search', () => {
  it('Geçerli parametrelerle başarılı yanıt dönmeli', async () => {
    const request = new NextRequest('http://localhost:3000/api/subtitles/search', {
      method: 'POST',
      body: JSON.stringify({
        tmdbId: 550,
        languages: ['tr', 'en']
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
    expect(data.total).toBe(1)
  })

  it('Geçersiz tmdbId ile 400 hatası dönmeli', async () => {
    const request = new NextRequest('http://localhost:3000/api/subtitles/search', {
      method: 'POST',
      body: JSON.stringify({
        tmdbId: -1,
        languages: ['tr']
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
  })

  it('Hiç tanımlayıcı olmadan 400 hatası dönmeli', async () => {
    const request = new NextRequest('http://localhost:3000/api/subtitles/search', {
      method: 'POST',
      body: JSON.stringify({
        languages: ['tr']
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
  })

  it('Geçersiz languages tipi ile 400 hatası dönmeli', async () => {
    const request = new NextRequest('http://localhost:3000/api/subtitles/search', {
      method: 'POST',
      body: JSON.stringify({
        tmdbId: 550,
        languages: 'tr' // Array olmalı
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
  })

  it('Varsayılan dilleri kullanmalı', async () => {
    const request = new NextRequest('http://localhost:3000/api/subtitles/search', {
      method: 'POST',
      body: JSON.stringify({
        tmdbId: 550
        // languages belirtilmemiş
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('Cache header\'ları doğru ayarlanmalı', async () => {
    const request = new NextRequest('http://localhost:3000/api/subtitles/search', {
      method: 'POST',
      body: JSON.stringify({
        tmdbId: 550,
        languages: ['tr']
      })
    })

    const response = await POST(request)

    expect(response.headers.get('X-Cache')).toBeTruthy()
    expect(response.headers.get('Cache-Control')).toBeTruthy()
  })
})

describe('GET /api/subtitles/search', () => {
  it('Query parametreleri ile başarılı yanıt dönmeli', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/subtitles/search?tmdbId=550&languages=tr,en',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
  })

  it('IMDB ID ile arama yapabilmeli', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/subtitles/search?imdbId=tt0137523&languages=tr',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('Query string ile arama yapabilmeli', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/subtitles/search?query=Fight+Club&languages=tr',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('Season ve episode parametreleri ile çalışmalı', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/subtitles/search?tmdbId=1399&season=1&episode=1&languages=tr',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('Geçersiz parametrelerle 400 hatası dönmeli', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/subtitles/search?tmdbId=invalid',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation Error')
  })
})
