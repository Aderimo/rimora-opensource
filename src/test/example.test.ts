import { describe, it, expect } from 'vitest'

/**
 * Örnek test dosyası - Vitest kurulumunun doğru çalıştığını doğrular
 * Bu dosya kurulum tamamlandıktan sonra silinebilir veya referans olarak tutulabilir
 */

describe('Vitest Kurulum Doğrulama', () => {
  it('temel assertion çalışmalı', () => {
    expect(1 + 1).toBe(2)
  })

  it('string eşleşmesi çalışmalı', () => {
    expect('Rimora').toContain('Rim')
  })

  it('array içerik kontrolü çalışmalı', () => {
    const genres = ['Aksiyon', 'Komedi', 'Drama']
    expect(genres).toContain('Aksiyon')
    expect(genres).toHaveLength(3)
  })

  it('object eşleşmesi çalışmalı', () => {
    const user = {
      id: '123',
      name: 'Test User',
      subscription: 'premium'
    }
    expect(user).toMatchObject({
      name: 'Test User',
      subscription: 'premium'
    })
  })

  it('async fonksiyon testi çalışmalı', async () => {
    const fetchData = async () => {
      return Promise.resolve({ status: 'success' })
    }
    
    const result = await fetchData()
    expect(result.status).toBe('success')
  })

  it('truthy/falsy kontrolleri çalışmalı', () => {
    expect(true).toBeTruthy()
    expect(false).toBeFalsy()
    expect(null).toBeNull()
    expect(undefined).toBeUndefined()
    expect('değer').toBeDefined()
  })
})

describe('Property-Based Testing Hazırlık (fast-check)', () => {
  it('fast-check import edilebilmeli', async () => {
    const fc = await import('fast-check')
    expect(fc).toBeDefined()
    expect(fc.assert).toBeDefined()
    expect(fc.property).toBeDefined()
  })
})
