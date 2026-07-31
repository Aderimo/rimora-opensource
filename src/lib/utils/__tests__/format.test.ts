import { describe, it, expect } from 'vitest'
import {
  formatDateTR,
  formatNumberTR,
  formatRelativeTimeTR,
  formatDateRangeTR,
  formatDurationTR,
  formatFileSizeTR,
  formatPercentageTR
} from '../format'

describe('formatDateTR', () => {
  it('should format date in DD.MM.YYYY format', () => {
    const date = new Date('2024-01-15')
    const formatted = formatDateTR(date)
    expect(formatted).toBe('15.01.2024')
  })

  it('should format date with single digit day and month', () => {
    const date = new Date('2024-03-05')
    const formatted = formatDateTR(date)
    expect(formatted).toBe('05.03.2024')
  })

  it('should handle Firestore Timestamp-like objects', () => {
    const mockTimestamp = {
      toDate: () => new Date('2024-12-25')
    }
    const formatted = formatDateTR(mockTimestamp)
    expect(formatted).toBe('25.12.2024')
  })

  it('should include time when requested', () => {
    const date = new Date('2024-01-15T14:30:00')
    const formatted = formatDateTR(date, { includeTime: true })
    expect(formatted).toContain('15')
    expect(formatted).toContain('01')
    expect(formatted).toContain('2024')
    expect(formatted).toContain('14')
    expect(formatted).toContain('30')
  })

  it('should include long month name when requested', () => {
    const date = new Date('2024-01-15')
    const formatted = formatDateTR(date, { longMonth: true })
    expect(formatted).toContain('Ocak')
  })

  it('should handle invalid dates', () => {
    const formatted = formatDateTR('invalid-date')
    expect(formatted).toBe('Geçersiz tarih')
  })
})

describe('formatNumberTR', () => {
  it('should format number with thousand separator', () => {
    const formatted = formatNumberTR(1234)
    expect(formatted).toBe('1.234')
  })

  it('should format number with decimals', () => {
    const formatted = formatNumberTR(1234.56, { decimals: 2 })
    expect(formatted).toBe('1.234,56')
  })

  it('should format large numbers correctly', () => {
    const formatted = formatNumberTR(1234567.89, { decimals: 2 })
    expect(formatted).toBe('1.234.567,89')
  })

  it('should format currency with TRY symbol', () => {
    const formatted = formatNumberTR(1234.56, { currency: true, decimals: 2 })
    expect(formatted).toContain('1.234,56')
    expect(formatted).toContain('₺')
  })

  it('should handle zero', () => {
    const formatted = formatNumberTR(0)
    expect(formatted).toBe('0')
  })

  it('should handle negative numbers', () => {
    const formatted = formatNumberTR(-1234.56, { decimals: 2 })
    expect(formatted).toBe('-1.234,56')
  })

  it('should handle NaN', () => {
    const formatted = formatNumberTR(NaN)
    expect(formatted).toBe('0')
  })
})

describe('formatRelativeTimeTR', () => {
  it('should return "Az önce" for recent times', () => {
    const date = new Date(Date.now() - 30 * 1000) // 30 seconds ago
    const formatted = formatRelativeTimeTR(date)
    expect(formatted).toBe('Az önce')
  })

  it('should return minutes for times within an hour', () => {
    const date = new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    const formatted = formatRelativeTimeTR(date)
    expect(formatted).toBe('30 dakika önce')
  })

  it('should return hours for times within a day', () => {
    const date = new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
    const formatted = formatRelativeTimeTR(date)
    expect(formatted).toBe('5 saat önce')
  })

  it('should return "Dün" for yesterday', () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    const formatted = formatRelativeTimeTR(date)
    expect(formatted).toBe('Dün')
  })

  it('should return days for times within a week', () => {
    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    const formatted = formatRelativeTimeTR(date)
    expect(formatted).toBe('3 gün önce')
  })

  it('should return full date for times older than a week', () => {
    const date = new Date('2024-01-01')
    const formatted = formatRelativeTimeTR(date)
    expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })
})

describe('formatDateRangeTR', () => {
  it('should format date range correctly', () => {
    const start = new Date('2024-01-15')
    const end = new Date('2024-01-20')
    const formatted = formatDateRangeTR(start, end)
    expect(formatted).toBe('15.01.2024 - 20.01.2024')
  })
})

describe('formatDurationTR', () => {
  it('should format minutes only', () => {
    const formatted = formatDurationTR(45)
    expect(formatted).toBe('45dk')
  })

  it('should format hours only', () => {
    const formatted = formatDurationTR(120)
    expect(formatted).toBe('2sa')
  })

  it('should format hours and minutes', () => {
    const formatted = formatDurationTR(150)
    expect(formatted).toBe('2sa 30dk')
  })
})

describe('formatFileSizeTR', () => {
  it('should format bytes', () => {
    const formatted = formatFileSizeTR(500)
    expect(formatted).toBe('500 Byte')
  })

  it('should format kilobytes', () => {
    const formatted = formatFileSizeTR(1024)
    expect(formatted).toBe('1,00 KB')
  })

  it('should format megabytes', () => {
    const formatted = formatFileSizeTR(1024 * 1024 * 1.5)
    expect(formatted).toContain('1,5')
    expect(formatted).toContain('MB')
  })

  it('should handle zero', () => {
    const formatted = formatFileSizeTR(0)
    expect(formatted).toBe('0 Byte')
  })
})

describe('formatPercentageTR', () => {
  it('should format percentage without decimals', () => {
    const formatted = formatPercentageTR(45)
    expect(formatted).toBe('%45')
  })

  it('should format percentage with decimals', () => {
    const formatted = formatPercentageTR(45.5, 1)
    expect(formatted).toBe('%45,5')
  })

  it('should format 100%', () => {
    const formatted = formatPercentageTR(100)
    expect(formatted).toBe('%100')
  })
})
