/**
 * OpenSubtitles API Client Tests
 * 
 * Unit testler - OpenSubtitles client'ın temel fonksiyonlarını test eder
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OpenSubtitlesClient,
  createOpenSubtitlesClient,
  OpenSubtitlesRateLimitError,
  OpenSubtitlesConfigError,
  OpenSubtitlesNotFoundError,
  OpenSubtitlesAuthError,
  type SubtitleSearchParams
} from '../opensubtitles'

describe('OpenSubtitlesClient', () => {
  describe('Configuration', () => {
    it('API anahtarı olmadan yapılandırılmamış olmalı', () => {
      const client = createOpenSubtitlesClient({ apiKey: '' })
      expect(client.isConfigured()).toBe(false)
    })

    it('API anahtarı ile yapılandırılmış olmalı', () => {
      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      expect(client.isConfigured()).toBe(true)
    })

    it('Varsayılan rate limit ayarları doğru olmalı', () => {
      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      const status = client.getRateLimitStatus()
      
      expect(status.maxRequests).toBe(40)
      expect(status.currentCount).toBe(0)
      expect(status.canRequest).toBe(true)
    })

    it('Özel rate limit ayarları kullanılabilmeli', () => {
      const client = createOpenSubtitlesClient({
        apiKey: 'test-key',
        rateLimit: {
          maxRequests: 10,
          windowMs: 5000
        }
      })
      const status = client.getRateLimitStatus()
      
      expect(status.maxRequests).toBe(10)
    })
  })

  describe('Rate Limiting', () => {
    it('Rate limit durumunu doğru raporlamalı', () => {
      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      const status = client.getRateLimitStatus()
      
      expect(status).toHaveProperty('canRequest')
      expect(status).toHaveProperty('currentCount')
      expect(status).toHaveProperty('maxRequests')
      expect(status).toHaveProperty('waitTime')
    })

    it('Rate limiter sıfırlanabilmeli', () => {
      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      
      // İlk durum
      const status1 = client.getRateLimitStatus()
      expect(status1.currentCount).toBe(0)
      
      // Reset
      client.resetRateLimiter()
      
      // Reset sonrası
      const status2 = client.getRateLimitStatus()
      expect(status2.currentCount).toBe(0)
    })
  })

  describe('Search Subtitles', () => {
    it('API anahtarı olmadan hata vermeli', async () => {
      const client = createOpenSubtitlesClient({ apiKey: '' })
      
      const params: SubtitleSearchParams = {
        tmdbId: 550,
        languages: ['tr', 'en']
      }

      await expect(client.searchSubtitles(params)).rejects.toThrow(OpenSubtitlesConfigError)
    })

    it('Geçerli parametrelerle arama yapabilmeli (mock)', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 1,
          total_pages: 1,
          page: 1,
          data: [
            {
              id: '1',
              type: 'subtitle',
              attributes: {
                subtitle_id: '1',
                language: 'tr',
                download_count: 100,
                new_download_count: 10,
                hearing_impaired: false,
                hd: true,
                fps: 23.976,
                votes: 5,
                ratings: 4.5,
                from_trusted: true,
                foreign_parts_only: false,
                upload_date: '2024-01-01',
                ai_translated: false,
                machine_translated: false,
                release: 'Test Release',
                comments: 'Test comments',
                legacy_subtitle_id: 123,
                uploader: {
                  uploader_id: 1,
                  name: 'Test User',
                  rank: 'trusted'
                },
                feature_details: {
                  feature_id: 550,
                  feature_type: 'Movie',
                  year: 1999,
                  title: 'Fight Club',
                  movie_name: 'Fight Club',
                  imdb_id: 137523,
                  tmdb_id: 550
                },
                url: 'https://example.com/subtitle',
                related_links: [],
                files: [
                  {
                    file_id: 1,
                    cd_number: 1,
                    file_name: 'test.srt'
                  }
                ]
              }
            }
          ]
        })
      }) as any

      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      
      const params: SubtitleSearchParams = {
        tmdbId: 550,
        languages: ['tr', 'en']
      }

      const results = await client.searchSubtitles(params)
      
      expect(results).toHaveLength(1)
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('language')
      expect(results[0]).toHaveProperty('languageName')
      expect(results[0]).toHaveProperty('downloadUrl')
      expect(results[0]).toHaveProperty('format')
      expect(results[0].language).toBe('tr')
      expect(results[0].languageName).toBe('Türkçe')
    })

    it('404 hatası alındığında NotFoundError fırlatmalı', async () => {
      // Mock fetch - 404 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      }) as any

      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      
      const params: SubtitleSearchParams = {
        tmdbId: 999999,
        languages: ['tr']
      }

      await expect(client.searchSubtitles(params)).rejects.toThrow(OpenSubtitlesNotFoundError)
    })

    it('401 hatası alındığında AuthError fırlatmalı', async () => {
      // Mock fetch - 401 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      }) as any

      const client = createOpenSubtitlesClient({ apiKey: 'invalid-key' })
      
      const params: SubtitleSearchParams = {
        tmdbId: 550,
        languages: ['tr']
      }

      await expect(client.searchSubtitles(params)).rejects.toThrow(OpenSubtitlesAuthError)
    })

    it('IMDB ID prefix temizlenmeli', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 0,
          total_pages: 0,
          page: 1,
          data: []
        })
      }) as any

      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      
      const params: SubtitleSearchParams = {
        imdbId: 'tt0137523',
        languages: ['tr']
      }

      await client.searchSubtitles(params)
      
      // fetch çağrısını kontrol et
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('imdb_id=0137523'),
        expect.any(Object)
      )
    })

    it('Dil isimleri doğru dönüştürülmeli', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 3,
          total_pages: 1,
          page: 1,
          data: [
            {
              id: '1',
              type: 'subtitle',
              attributes: {
                subtitle_id: '1',
                language: 'tr',
                download_count: 100,
                new_download_count: 10,
                hearing_impaired: false,
                hd: true,
                fps: 23.976,
                votes: 5,
                ratings: 4.5,
                from_trusted: true,
                foreign_parts_only: false,
                upload_date: '2024-01-01',
                ai_translated: false,
                machine_translated: false,
                release: 'Test',
                comments: '',
                legacy_subtitle_id: 1,
                uploader: { uploader_id: 1, name: 'Test', rank: 'trusted' },
                feature_details: {
                  feature_id: 550,
                  feature_type: 'Movie',
                  year: 1999,
                  title: 'Test',
                  movie_name: 'Test',
                  imdb_id: 1,
                  tmdb_id: 550
                },
                url: 'https://example.com/1',
                related_links: [],
                files: [{ file_id: 1, cd_number: 1, file_name: 'test.srt' }]
              }
            },
            {
              id: '2',
              type: 'subtitle',
              attributes: {
                subtitle_id: '2',
                language: 'en',
                download_count: 200,
                new_download_count: 20,
                hearing_impaired: false,
                hd: true,
                fps: 23.976,
                votes: 10,
                ratings: 4.8,
                from_trusted: true,
                foreign_parts_only: false,
                upload_date: '2024-01-01',
                ai_translated: false,
                machine_translated: false,
                release: 'Test',
                comments: '',
                legacy_subtitle_id: 2,
                uploader: { uploader_id: 1, name: 'Test', rank: 'trusted' },
                feature_details: {
                  feature_id: 550,
                  feature_type: 'Movie',
                  year: 1999,
                  title: 'Test',
                  movie_name: 'Test',
                  imdb_id: 1,
                  tmdb_id: 550
                },
                url: 'https://example.com/2',
                related_links: [],
                files: [{ file_id: 2, cd_number: 1, file_name: 'test.srt' }]
              }
            },
            {
              id: '3',
              type: 'subtitle',
              attributes: {
                subtitle_id: '3',
                language: 'de',
                download_count: 50,
                new_download_count: 5,
                hearing_impaired: false,
                hd: true,
                fps: 23.976,
                votes: 3,
                ratings: 4.0,
                from_trusted: true,
                foreign_parts_only: false,
                upload_date: '2024-01-01',
                ai_translated: false,
                machine_translated: false,
                release: 'Test',
                comments: '',
                legacy_subtitle_id: 3,
                uploader: { uploader_id: 1, name: 'Test', rank: 'trusted' },
                feature_details: {
                  feature_id: 550,
                  feature_type: 'Movie',
                  year: 1999,
                  title: 'Test',
                  movie_name: 'Test',
                  imdb_id: 1,
                  tmdb_id: 550
                },
                url: 'https://example.com/3',
                related_links: [],
                files: [{ file_id: 3, cd_number: 1, file_name: 'test.srt' }]
              }
            }
          ]
        })
      }) as any

      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      
      const params: SubtitleSearchParams = {
        tmdbId: 550,
        languages: ['tr', 'en', 'de']
      }

      const results = await client.searchSubtitles(params)
      
      expect(results[0].languageName).toBe('Türkçe')
      expect(results[1].languageName).toBe('English')
      expect(results[2].languageName).toBe('Deutsch')
    })

    it('Dosya formatları doğru algılanmalı', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 3,
          total_pages: 1,
          page: 1,
          data: [
            {
              id: '1',
              type: 'subtitle',
              attributes: {
                subtitle_id: '1',
                language: 'tr',
                download_count: 100,
                new_download_count: 10,
                hearing_impaired: false,
                hd: true,
                fps: 23.976,
                votes: 5,
                ratings: 4.5,
                from_trusted: true,
                foreign_parts_only: false,
                upload_date: '2024-01-01',
                ai_translated: false,
                machine_translated: false,
                release: 'Test',
                comments: '',
                legacy_subtitle_id: 1,
                uploader: { uploader_id: 1, name: 'Test', rank: 'trusted' },
                feature_details: {
                  feature_id: 550,
                  feature_type: 'Movie',
                  year: 1999,
                  title: 'Test',
                  movie_name: 'Test',
                  imdb_id: 1,
                  tmdb_id: 550
                },
                url: 'https://example.com/1',
                related_links: [],
                files: [{ file_id: 1, cd_number: 1, file_name: 'test.srt' }]
              }
            },
            {
              id: '2',
              type: 'subtitle',
              attributes: {
                subtitle_id: '2',
                language: 'en',
                download_count: 200,
                new_download_count: 20,
                hearing_impaired: false,
                hd: true,
                fps: 23.976,
                votes: 10,
                ratings: 4.8,
                from_trusted: true,
                foreign_parts_only: false,
                upload_date: '2024-01-01',
                ai_translated: false,
                machine_translated: false,
                release: 'Test',
                comments: '',
                legacy_subtitle_id: 2,
                uploader: { uploader_id: 1, name: 'Test', rank: 'trusted' },
                feature_details: {
                  feature_id: 550,
                  feature_type: 'Movie',
                  year: 1999,
                  title: 'Test',
                  movie_name: 'Test',
                  imdb_id: 1,
                  tmdb_id: 550
                },
                url: 'https://example.com/2',
                related_links: [],
                files: [{ file_id: 2, cd_number: 1, file_name: 'test.vtt' }]
              }
            },
            {
              id: '3',
              type: 'subtitle',
              attributes: {
                subtitle_id: '3',
                language: 'de',
                download_count: 50,
                new_download_count: 5,
                hearing_impaired: false,
                hd: true,
                fps: 23.976,
                votes: 3,
                ratings: 4.0,
                from_trusted: true,
                foreign_parts_only: false,
                upload_date: '2024-01-01',
                ai_translated: false,
                machine_translated: false,
                release: 'Test',
                comments: '',
                legacy_subtitle_id: 3,
                uploader: { uploader_id: 1, name: 'Test', rank: 'trusted' },
                feature_details: {
                  feature_id: 550,
                  feature_type: 'Movie',
                  year: 1999,
                  title: 'Test',
                  movie_name: 'Test',
                  imdb_id: 1,
                  tmdb_id: 550
                },
                url: 'https://example.com/3',
                related_links: [],
                files: [{ file_id: 3, cd_number: 1, file_name: 'test.ass' }]
              }
            }
          ]
        })
      }) as any

      const client = createOpenSubtitlesClient({ apiKey: 'test-key' })
      
      const params: SubtitleSearchParams = {
        tmdbId: 550,
        languages: ['tr', 'en', 'de']
      }

      const results = await client.searchSubtitles(params)
      
      expect(results[0].format).toBe('srt')
      expect(results[1].format).toBe('vtt')
      expect(results[2].format).toBe('ass')
    })
  })
})
