// Validation Utilities

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface SearchFilters {
  year?: number
  genre?: string
  type?: 'movie' | 'tv' | 'anime' | 'all'
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Validate search filters
 */
export function validateFilters(filters: SearchFilters): ValidationResult {
  const errors: string[] = []
  
  // Year validation
  if (filters.year !== undefined) {
    const currentYear = new Date().getFullYear()
    if (filters.year < 1900 || filters.year > currentYear + 5) {
      errors.push(`Yıl 1900 ile ${currentYear + 5} arasında olmalıdır`)
    }
  }
  
  // Type validation
  if (filters.type && !['movie', 'tv', 'anime', 'all'].includes(filters.type)) {
    errors.push('Geçersiz içerik tipi')
  }
  
  // Sort order validation
  if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
    errors.push('Geçersiz sıralama yönü')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = []
  
  if (password.length < 6) {
    errors.push('Şifre en az 6 karakter olmalıdır')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Sanitize string input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000) // Limit length
}
