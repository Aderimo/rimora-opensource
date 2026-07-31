/**
 * Türkiye format standardları için yardımcı fonksiyonlar
 * Tarih formatı: DD.MM.YYYY
 * Sayı formatı: 1.234,56
 */

/**
 * Tarihi Türkiye formatında (DD.MM.YYYY) formatlar
 * @param date - Formatlanacak tarih (Date, Timestamp veya string)
 * @param options - Opsiyonel format seçenekleri
 * @returns DD.MM.YYYY formatında tarih string'i
 */
export function formatDateTR(
  date: Date | any,
  options?: {
    includeTime?: boolean
    includeDay?: boolean
    longMonth?: boolean
  }
): string {
  // Firestore Timestamp'i Date'e çevir
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date))
  
  if (isNaN(d.getTime())) {
    return 'Geçersiz tarih'
  }

  // Sadece tarih (DD.MM.YYYY)
  if (!options?.includeTime && !options?.includeDay && !options?.longMonth) {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}.${month}.${year}`
  }

  // Uzun format seçenekleri
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: options?.longMonth ? 'long' : '2-digit',
    year: 'numeric'
  }

  if (options?.includeDay) {
    formatOptions.weekday = 'long'
  }

  if (options?.includeTime) {
    formatOptions.hour = '2-digit'
    formatOptions.minute = '2-digit'
  }

  return new Intl.DateTimeFormat('tr-TR', formatOptions).format(d)
}

/**
 * Sayıyı Türkiye formatında (1.234,56) formatlar
 * @param value - Formatlanacak sayı
 * @param options - Opsiyonel format seçenekleri
 * @returns Türkiye formatında sayı string'i
 */
export function formatNumberTR(
  value: number,
  options?: {
    decimals?: number
    currency?: boolean
    currencySymbol?: string
  }
): string {
  if (isNaN(value)) {
    return '0'
  }

  const formatOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: options?.decimals ?? 0,
    maximumFractionDigits: options?.decimals ?? 2
  }

  if (options?.currency) {
    formatOptions.style = 'currency'
    formatOptions.currency = 'TRY'
  }

  const formatted = new Intl.NumberFormat('tr-TR', formatOptions).format(value)

  // Özel para birimi sembolü kullanılacaksa
  if (options?.currency && options?.currencySymbol) {
    return formatted.replace('₺', options.currencySymbol)
  }

  return formatted
}

/**
 * Göreceli zaman formatı (örn: "2 saat önce", "3 gün önce")
 * @param date - Formatlanacak tarih
 * @returns Göreceli zaman string'i
 */
export function formatRelativeTimeTR(date: Date | any): string {
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date))
  
  if (isNaN(d.getTime())) {
    return 'Geçersiz tarih'
  }

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Az önce'
  if (diffMins < 60) return `${diffMins} dakika önce`
  if (diffHours < 24) return `${diffHours} saat önce`
  if (diffDays === 1) return 'Dün'
  if (diffDays < 7) return `${diffDays} gün önce`
  
  // 7 günden eski ise tam tarih göster (DD.MM.YYYY)
  return formatDateTR(d)
}

/**
 * Tarih aralığını formatlar
 * @param startDate - Başlangıç tarihi
 * @param endDate - Bitiş tarihi
 * @returns Formatlanmış tarih aralığı
 */
export function formatDateRangeTR(
  startDate: Date | any,
  endDate: Date | any
): string {
  const start = formatDateTR(startDate)
  const end = formatDateTR(endDate)
  return `${start} - ${end}`
}

/**
 * Süreyi formatlar (örn: "2s 30dk", "1sa 15dk")
 * @param minutes - Dakika cinsinden süre
 * @returns Formatlanmış süre string'i
 */
export function formatDurationTR(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}dk`
  }
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (mins === 0) {
    return `${hours}sa`
  }
  
  return `${hours}sa ${mins}dk`
}

/**
 * Dosya boyutunu formatlar (örn: "1,5 MB", "256 KB")
 * @param bytes - Byte cinsinden boyut
 * @returns Formatlanmış dosya boyutu
 */
export function formatFileSizeTR(bytes: number): string {
  if (bytes === 0) return '0 Byte'
  
  const k = 1024
  const sizes = ['Byte', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  const value = bytes / Math.pow(k, i)
  const formatted = formatNumberTR(value, { decimals: i === 0 ? 0 : 2 })
  
  return `${formatted} ${sizes[i]}`
}

/**
 * Yüzdeyi formatlar (örn: "%45,5", "%100")
 * @param value - 0-100 arası yüzde değeri
 * @param decimals - Ondalık basamak sayısı
 * @returns Formatlanmış yüzde string'i
 */
export function formatPercentageTR(value: number, decimals: number = 0): string {
  const formatted = formatNumberTR(value, { decimals })
  return `%${formatted}`
}
