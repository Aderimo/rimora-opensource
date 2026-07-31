// Global Error Tracker - TÜM hataları yakalar ve saklar
// Network, Fetch, Console, Compile, Resource, Script hataları dahil

export interface TrackedError {
  id: string
  message: string
  stack?: string
  type: 'error' | 'unhandledrejection' | 'console' | 'network' | 'fetch' | 'resource' | 'script' | 'compile' | 'warn'
  url: string
  timestamp: Date
  userAgent: string
  componentStack?: string
  statusCode?: number
  resourceUrl?: string
  method?: string
}

const MAX_ERRORS = 200
const STORAGE_KEY = 'rimora-error-log'

// Duplicate kontrolü için son hataları tut
const recentErrors = new Set<string>()
const DUPLICATE_WINDOW = 2000 // 2 saniye içinde aynı hata tekrar kaydedilmez

// Hataları localStorage'dan al
export function getStoredErrors(): TrackedError[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Hata kaydet
export function logError(error: Partial<TrackedError>): void {
  if (typeof window === 'undefined') return
  
  // Duplicate kontrolü
  const errorKey = `${error.type}:${error.message?.substring(0, 100)}`
  if (recentErrors.has(errorKey)) return
  
  recentErrors.add(errorKey)
  setTimeout(() => recentErrors.delete(errorKey), DUPLICATE_WINDOW)
  
  const trackedError: TrackedError = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    message: error.message || 'Unknown error',
    stack: error.stack,
    type: error.type || 'error',
    url: error.url || window.location.href,
    timestamp: new Date(),
    userAgent: navigator.userAgent,
    componentStack: error.componentStack,
    statusCode: error.statusCode,
    resourceUrl: error.resourceUrl,
    method: error.method,
  }

  const errors = getStoredErrors()
  errors.unshift(trackedError)
  
  // Max limit
  while (errors.length > MAX_ERRORS) {
    errors.pop()
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(errors))
}

// Hataları temizle
export function clearErrors(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

// Hataları kopyalanabilir formatta al
export function getErrorsAsText(): string {
  const errors = getStoredErrors()
  if (errors.length === 0) return 'Hiç hata kaydı yok.'
  
  return errors.map((e, i) => `
--- HATA ${i + 1} ---
Tip: ${e.type}
Mesaj: ${e.message}
URL: ${e.url}
${e.resourceUrl ? `Resource: ${e.resourceUrl}` : ''}
${e.statusCode ? `Status: ${e.statusCode}` : ''}
${e.method ? `Method: ${e.method}` : ''}
Zaman: ${new Date(e.timestamp).toLocaleString('tr-TR')}
${e.stack ? `Stack:\n${e.stack}` : ''}
`).join('\n')
}

// Global error handler'ları başlat
export function initErrorTracking(): void {
  if (typeof window === 'undefined') return
  
  // Zaten başlatılmış mı kontrol et
  if ((window as any).__errorTrackerInitialized) return
  (window as any).__errorTrackerInitialized = true

  // 1. Uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    // Resource loading error (img, script, css, etc.)
    if (event.target && (event.target as HTMLElement).tagName) {
      const element = event.target as HTMLElement
      const tagName = element.tagName.toLowerCase()
      const src = (element as HTMLImageElement).src || 
                  (element as HTMLScriptElement).src || 
                  (element as HTMLLinkElement).href || ''
      
      logError({
        message: `Resource load failed: ${tagName} - ${src}`,
        type: 'resource',
        resourceUrl: src,
      })
    } else {
      // Regular JS error
      logError({
        message: event.message,
        stack: event.error?.stack,
        type: 'error',
        url: event.filename || window.location.href,
      })
    }
  }, true) // capture phase for resource errors

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    let message = 'Unhandled Promise Rejection'
    let stack = ''
    
    if (reason instanceof Error) {
      message = reason.message
      stack = reason.stack || ''
    } else if (typeof reason === 'string') {
      message = reason
    } else if (reason && typeof reason === 'object') {
      message = reason.message || JSON.stringify(reason).substring(0, 500)
      stack = reason.stack || ''
    }
    
    logError({
      message,
      stack,
      type: 'unhandledrejection',
    })
  })

  // 3. Fetch API interceptor - Network hataları
  const originalFetch = window.fetch
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
    const method = (args[1]?.method || 'GET').toUpperCase()
    
    try {
      const response = await originalFetch.apply(this, args)
      
      // 4xx ve 5xx hataları yakala
      if (!response.ok) {
        logError({
          message: `Fetch failed: ${method} ${url} - ${response.status} ${response.statusText}`,
          type: 'fetch',
          resourceUrl: url,
          statusCode: response.status,
          method,
        })
      }
      
      return response
    } catch (error) {
      // Network error (CORS, offline, etc.)
      logError({
        message: `Network error: ${method} ${url} - ${error instanceof Error ? error.message : String(error)}`,
        type: 'network',
        resourceUrl: url,
        method,
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // 4. XMLHttpRequest interceptor - Eski API çağrıları için
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send
  
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL) {
    (this as any).__errorTracker = { method, url: url.toString() }
    return originalXHROpen.apply(this, arguments as any)
  }
  
  XMLHttpRequest.prototype.send = function() {
    const tracker = (this as any).__errorTracker
    
    this.addEventListener('error', () => {
      logError({
        message: `XHR Network error: ${tracker?.method} ${tracker?.url}`,
        type: 'network',
        resourceUrl: tracker?.url,
        method: tracker?.method,
      })
    })
    
    this.addEventListener('load', () => {
      if (this.status >= 400) {
        logError({
          message: `XHR failed: ${tracker?.method} ${tracker?.url} - ${this.status} ${this.statusText}`,
          type: 'fetch',
          resourceUrl: tracker?.url,
          statusCode: this.status,
          method: tracker?.method,
        })
      }
    })
    
    return originalXHRSend.apply(this, arguments as any)
  }

  // 5. Console.error override
  const originalConsoleError = console.error
  console.error = function(...args) {
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
    
    // Kendi loglarımızı ve bazı spam'leri filtrele
    const ignorePatterns = [
      '[ErrorTracker]',
      'Download the React DevTools',
      'Warning: ReactDOM.render',
      'Warning: Each child in a list',
    ]
    
    if (!ignorePatterns.some(p => message.includes(p))) {
      logError({
        message: message.substring(0, 1000),
        type: 'console',
        stack: new Error().stack,
      })
    }
    
    originalConsoleError.apply(console, args)
  }

  // 6. Console.warn override (opsiyonel ama faydalı)
  const originalConsoleWarn = console.warn
  console.warn = function(...args) {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
    
    // Önemli uyarıları yakala
    const importantPatterns = [
      'deprecated',
      'warning',
      'failed',
      'error',
      'invalid',
    ]
    
    if (importantPatterns.some(p => message.toLowerCase().includes(p))) {
      logError({
        message: message.substring(0, 500),
        type: 'warn',
      })
    }
    
    originalConsoleWarn.apply(console, args)
  }

  // 7. Next.js / React compile error detection
  // Next.js overlay error'larını yakala
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          // Next.js error overlay
          if (node.id === '__next-build-watcher' || 
              node.id === 'nextjs__container_errors_label' ||
              node.className?.includes('nextjs-toast-errors')) {
            const errorText = node.textContent || node.innerText
            if (errorText) {
              logError({
                message: `Build/Compile Error: ${errorText.substring(0, 500)}`,
                type: 'compile',
              })
            }
          }
          
          // Next.js error overlay dialog
          const errorDialog = node.querySelector('[data-nextjs-dialog]')
          if (errorDialog) {
            const errorText = errorDialog.textContent || ''
            logError({
              message: `Next.js Error: ${errorText.substring(0, 500)}`,
              type: 'compile',
            })
          }
        }
      })
    })
  })
  
  observer.observe(document.body, { childList: true, subtree: true })

  // 8. Performance observer - Slow resources
  if ('PerformanceObserver' in window) {
    try {
      const perfObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          // Firestore listener'ları filtrele (bunlar normal davranış)
          if (entry.name.includes('firestore.googleapis.com') && entry.name.includes('/Listen/')) {
            return // Firestore realtime listener'ları ignore et
          }
          
          // 10 saniyeden uzun süren kaynakları logla
          if (entry.duration > 10000) {
            logError({
              message: `Slow resource: ${entry.name} took ${Math.round(entry.duration)}ms`,
              type: 'network',
              resourceUrl: entry.name,
            })
          }
        })
      })
      perfObserver.observe({ entryTypes: ['resource'] })
    } catch {
      // PerformanceObserver desteklenmiyorsa sessizce geç
    }
  }

  console.log('[ErrorTracker] Gelişmiş hata takibi başlatıldı - Network, Fetch, Console, Compile hataları yakalanıyor')
}

// Hata sayısını al
export function getErrorCount(): number {
  return getStoredErrors().length
}

// Hata tipine göre sayı al
export function getErrorCountByType(): Record<string, number> {
  const errors = getStoredErrors()
  return errors.reduce((acc, error) => {
    acc[error.type] = (acc[error.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

// Son X dakikadaki hataları al
export function getRecentErrors(minutes: number = 30): TrackedError[] {
  const errors = getStoredErrors()
  const cutoff = Date.now() - (minutes * 60 * 1000)
  return errors.filter(e => new Date(e.timestamp).getTime() > cutoff)
}
