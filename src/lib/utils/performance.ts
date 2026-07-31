/**
 * Performance Monitoring Utility
 * Web Vitals ve performans metrikleri
 */

/**
 * Web Vitals metrikleri
 */
export interface WebVitalsMetric {
  id: string
  name: 'CLS' | 'FCP' | 'FID' | 'LCP' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  navigationType: string
}

/**
 * Performance mark oluştur
 */
export function markPerformance(name: string) {
  if (typeof window !== 'undefined' && window.performance) {
    performance.mark(name)
  }
}

/**
 * Performance measure oluştur
 */
export function measurePerformance(name: string, startMark: string, endMark?: string) {
  if (typeof window !== 'undefined' && window.performance) {
    try {
      if (endMark) {
        performance.measure(name, startMark, endMark)
      } else {
        performance.measure(name, startMark)
      }
      
      const measure = performance.getEntriesByName(name)[0]
      return measure?.duration
    } catch (error) {
      console.warn('Performance measurement failed:', error)
      return null
    }
  }
  return null
}

/**
 * Component render süresini ölç
 */
export function measureComponentRender(componentName: string) {
  const startMark = `${componentName}-start`
  const endMark = `${componentName}-end`
  const measureName = `${componentName}-render`

  return {
    start: () => markPerformance(startMark),
    end: () => {
      markPerformance(endMark)
      const duration = measurePerformance(measureName, startMark, endMark)
      
      if (duration && duration > 16) {
        console.warn(`⚠️ ${componentName} render took ${duration.toFixed(2)}ms (>16ms)`)
      }
      
      return duration
    },
  }
}

/**
 * Resource timing bilgilerini al
 */
export function getResourceTiming(url: string) {
  if (typeof window === 'undefined' || !window.performance) return null

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  return resources.find((resource) => resource.name.includes(url))
}

/**
 * Navigation timing bilgilerini al
 */
export function getNavigationTiming() {
  if (typeof window === 'undefined' || !window.performance) return null

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  
  if (!navigation) return null

  return {
    // DNS lookup
    dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
    
    // TCP connection
    tcpTime: navigation.connectEnd - navigation.connectStart,
    
    // Request + Response
    requestTime: navigation.responseEnd - navigation.requestStart,
    
    // DOM processing
    domProcessingTime: navigation.domComplete - navigation.domInteractive,
    
    // Total load time
    loadTime: navigation.loadEventEnd - navigation.fetchStart,
    
    // Time to first byte
    ttfb: navigation.responseStart - navigation.requestStart,
  }
}

/**
 * Memory usage bilgilerini al (Chrome only)
 */
export function getMemoryUsage() {
  if (typeof window === 'undefined') return null

  const memory = (performance as any).memory
  
  if (!memory) return null

  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
  }
}

/**
 * Long task detection
 */
export function observeLongTasks(callback: (duration: number) => void) {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Long task: >50ms
        if (entry.duration > 50) {
          callback(entry.duration)
        }
      }
    })

    observer.observe({ entryTypes: ['longtask'] })
    
    return () => observer.disconnect()
  } catch (error) {
    console.warn('Long task observation not supported')
  }
}

/**
 * Layout shift detection
 */
export function observeLayoutShifts(callback: (score: number) => void) {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  try {
    let clsScore = 0

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsScore += (entry as any).value
          callback(clsScore)
        }
      }
    })

    observer.observe({ entryTypes: ['layout-shift'] })
    
    return () => observer.disconnect()
  } catch (error) {
    console.warn('Layout shift observation not supported')
  }
}

/**
 * FPS (Frame Per Second) ölçümü
 */
export function measureFPS(duration: number = 1000): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0
    let lastTime = performance.now()
    
    function countFrame() {
      frames++
      const currentTime = performance.now()
      
      if (currentTime >= lastTime + duration) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime))
        resolve(fps)
      } else {
        requestAnimationFrame(countFrame)
      }
    }
    
    requestAnimationFrame(countFrame)
  })
}

/**
 * Bundle size analizi için
 */
export function logBundleSize() {
  if (typeof window === 'undefined') return

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  
  const scripts = resources.filter((r) => r.initiatorType === 'script')
  const styles = resources.filter((r) => r.initiatorType === 'link' || r.initiatorType === 'css')
  
  const totalScriptSize = scripts.reduce((acc, r) => acc + (r.transferSize || 0), 0)
  const totalStyleSize = styles.reduce((acc, r) => acc + (r.transferSize || 0), 0)
  
  console.group('📦 Bundle Size Analysis')
  console.log(`Scripts: ${(totalScriptSize / 1024).toFixed(2)} KB (${scripts.length} files)`)
  console.log(`Styles: ${(totalStyleSize / 1024).toFixed(2)} KB (${styles.length} files)`)
  console.log(`Total: ${((totalScriptSize + totalStyleSize) / 1024).toFixed(2)} KB`)
  console.groupEnd()
}

/**
 * Performance raporu oluştur
 */
export function generatePerformanceReport() {
  const navigation = getNavigationTiming()
  const memory = getMemoryUsage()
  
  console.group('⚡ Performance Report')
  
  if (navigation) {
    console.log('Navigation Timing:')
    console.table(navigation)
  }
  
  if (memory) {
    console.log('Memory Usage:')
    console.table(memory)
  }
  
  logBundleSize()
  
  console.groupEnd()
}
