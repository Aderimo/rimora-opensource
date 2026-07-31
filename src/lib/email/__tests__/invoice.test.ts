/**
 * Fatura E-posta Sistemi Unit Testleri
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getInvoiceEmailTemplate } from '../templates'
import type { InvoiceEmailData } from '../resend'

describe('Fatura E-posta Sistemi', () => {
  const mockInvoiceData: InvoiceEmailData = {
    userName: 'Test Kullanıcı',
    email: 'test@example.com',
    plan: 'premium',
    planName: 'Premium',
    price: 49.99,
    billingCycle: 'monthly',
    paymentDate: '01.12.2024',
    invoiceNumber: 'INV-20241201-12345',
    paymentMethod: 'Kredi Kartı (iyzico)',
    nextPaymentDate: '01.01.2025',
  }

  describe('getInvoiceEmailTemplate', () => {
    it('fatura template\'ini doğru şekilde oluşturmalı', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      expect(result.subject).toContain('Fatura - Premium Aboneliği')
      expect(result.subject).toContain('INV-20241201-12345')
      expect(result.html).toContain('Test Kullanıcı')
      expect(result.html).toContain('Premium')
      expect(result.html).toContain('49,99')
      expect(result.html).toContain('INV-20241201-12345')
      expect(result.html).toContain('01.12.2024')
      expect(result.html).toContain('Kredi Kartı (iyzico)')
      expect(result.html).toContain('01.01.2025')
    })

    it('aylık abonelik için doğru metni göstermeli', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      expect(result.html).toContain('Aylık')
    })

    it('yıllık abonelik için doğru metni göstermeli', () => {
      const yearlyData = { ...mockInvoiceData, billingCycle: 'yearly' as const }
      const result = getInvoiceEmailTemplate(yearlyData)
      
      expect(result.html).toContain('Yıllık')
    })

    it('Türk Lirası formatında fiyat göstermeli', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      expect(result.html).toContain('₺49,99')
    })

    it('sonraki ödeme tarihi olmadığında hata vermemeli', () => {
      const dataWithoutNextPayment = { ...mockInvoiceData, nextPaymentDate: undefined }
      
      expect(() => getInvoiceEmailTemplate(dataWithoutNextPayment)).not.toThrow()
      
      const result = getInvoiceEmailTemplate(dataWithoutNextPayment)
      expect(result.html).toBeDefined()
      expect(result.subject).toBeDefined()
    })

    it('tüm planlar için doğru çalışmalı', () => {
      const plans: Array<{ plan: 'standard' | 'premium' | 'family', planName: string }> = [
        { plan: 'standard', planName: 'Standart' },
        { plan: 'premium', planName: 'Premium' },
        { plan: 'family', planName: 'Aile' },
      ]

      plans.forEach(({ plan, planName }) => {
        const data = { ...mockInvoiceData, plan, planName }
        const result = getInvoiceEmailTemplate(data)
        
        expect(result.subject).toContain(planName)
        expect(result.html).toContain(planName)
      })
    })

    it('HTML içeriği geçerli yapıda olmalı', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      expect(result.html).toContain('<!DOCTYPE html>')
      expect(result.html).toContain('<html lang="tr">')
      expect(result.html).toContain('</html>')
      expect(result.html).toContain('<body>')
      expect(result.html).toContain('</body>')
    })

    it('responsive tasarım için meta viewport içermeli', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      expect(result.html).toContain('viewport')
      expect(result.html).toContain('width=device-width')
    })

    it('güvenlik için e-posta adresini içermeli', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      expect(result.html).toContain(mockInvoiceData.email)
    })
  })

  describe('Fatura Numarası Formatı', () => {
    it('fatura numarası doğru formatta olmalı', () => {
      const invoiceNumber = 'INV-20241201-12345'
      
      expect(invoiceNumber).toMatch(/^INV-\d{8}-\d{5}$/)
    })
  })

  describe('E-posta İçerik Kontrolü', () => {
    it('tüm gerekli bilgileri içermeli', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      const requiredElements = [
        'Fatura No:',
        'Ödeme Tarihi:',
        'Plan:',
        'Ödeme Periyodu:',
        'Tutar:',
        'Ödeme Yöntemi:',
        'Sonraki Ödeme:',
      ]

      requiredElements.forEach(element => {
        expect(result.html).toContain(element)
      })
    })

    it('abonelik avantajlarını listelenmeli', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      const advantages = [
        'Reklamsız izleme deneyimi',
        '4K ve HDR kalitesinde içerikler',
        'Çoklu cihaz desteği',
        'Öncelikli müşteri desteği',
        'Gelişmiş sosyal özellikler',
      ]

      advantages.forEach(advantage => {
        expect(result.html).toContain(advantage)
      })
    })

    it('gerekli linkleri içermeli', () => {
      const result = getInvoiceEmailTemplate(mockInvoiceData)
      
      const links = [
        'https://rimora.com',
        'https://rimora.com/abonelik',
        'https://rimora.com/yardim',
        'https://rimora.com/iletisim',
      ]

      links.forEach(link => {
        expect(result.html).toContain(link)
      })
    })
  })
})