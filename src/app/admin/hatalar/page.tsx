'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getStoredErrors, clearErrors, getErrorsAsText, getErrorCountByType, type TrackedError } from '@/lib/error-tracker'
import { cn } from '@/lib/utils'
import { RefreshCw, Play, Square, ExternalLink, Clock, Layers, History, GitCompare, Settings, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'

type FilterType = 'all' | 'error' | 'console' | 'network' | 'fetch' | 'resource' | 'compile' | 'warn'

const ALL_PAGES = [
  { path: '/', name: 'Ana Sayfa' },
  { path: '/filmler', name: 'Filmler' },
  { path: '/diziler', name: 'Diziler' },
  { path: '/animeler', name: 'Animeler' },
  { path: '/arama', name: 'Arama' },
  { path: '/giris', name: 'Giriş' },
  { path: '/kayit', name: 'Kayıt' },
  { path: '/sifremi-unuttum', name: 'Şifremi Unuttum' },
  { path: '/profil', name: 'Profil' },
  { path: '/ayarlar', name: 'Ayarlar' },
  { path: '/ayarlar/hesap', name: 'Hesap Ayarları' },
  { path: '/ayarlar/gizlilik', name: 'Gizlilik Ayarları' },
  { path: '/ayarlar/bildirimler', name: 'Bildirim Ayarları' },
  { path: '/abonelik', name: 'Abonelik' },
  { path: '/odeme', name: 'Ödeme' },
  { path: '/mesajlar', name: 'Mesajlar' },
  { path: '/izleme-gecmisi', name: 'İzleme Geçmişi' },
  { path: '/istatistikler', name: 'İstatistikler' },
  { path: '/gizlilik', name: 'Gizlilik Politikası' },
  { path: '/kullanim-kosullari', name: 'Kullanım Koşulları' },
  { path: '/admin', name: 'Admin Panel' },
  { path: '/filmler/1184918', name: 'Film Detay' },
  { path: '/diziler/1396', name: 'Dizi Detay' },
  { path: '/animeler/1', name: 'Anime Detay' },
]

interface TestResult {
  path: string
  name: string
  status: 'pending' | 'testing' | 'done' | 'error'
  errorCount: number
  errors: string[]
}

interface TestHistory {
  id: string
  date: string
  totalErrors: number
  pageResults: TestResult[]
  duration: number
  testDuration: number
  parallelCount: number
}

const TEST_HISTORY_KEY = 'rimora-test-history'
const MAX_HISTORY = 10

function getTestHistory(): TestHistory[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(TEST_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveTestHistory(history: TestHistory[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TEST_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

function clearTestHistory(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TEST_HISTORY_KEY)
}

export default function ErrorsPage() {
  // Admin yetkilendirme
  const { isAuthorized, isLoading } = useAdminAuth({
    requiredRole: 'moderator',
    redirectTo: '/'
  })
  
  const [errors, setErrors] = useState<TrackedError[]>([])
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [errorCounts, setErrorCounts] = useState<Record<string, number>>({})
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [showTestPanel, setShowTestPanel] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [testDuration, setTestDuration] = useState(4)
  const [parallelCount, setParallelCount] = useState(1)
  const [testHistory, setTestHistory] = useState<TestHistory[]>([])
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([])
  const testStartTime = useRef<number>(0)
  const currentBatchIndex = useRef<number>(0)
  const isTestingRef = useRef(false)

  const loadErrors = useCallback(() => {
    setErrors(getStoredErrors())
    setErrorCounts(getErrorCountByType())
  }, [])

  useEffect(() => {
    if (isAuthorized && !isLoading) {
      loadErrors()
      setTestHistory(getTestHistory())
    }
    let interval: NodeJS.Timeout
    if (autoRefresh && isAuthorized) {
      interval = setInterval(loadErrors, 3000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [autoRefresh, isAuthorized, isLoading, loadErrors])

  // Yükleniyor durumu
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Yetkisiz erişim
  if (!isAuthorized) {
    return null // Hook otomatik yönlendirme yapar
  }

  const finishTest = useCallback(() => {
    isTestingRef.current = false
    setIsTesting(false)
    loadErrors()
    
    setTestResults(prev => {
      const finalResults = prev.map(r => ({ ...r, status: 'done' as const }))
      const duration = Date.now() - testStartTime.current
      const newHistory: TestHistory = {
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        totalErrors: finalResults.reduce((sum, r) => sum + r.errorCount, 0),
        pageResults: finalResults,
        duration,
        testDuration,
        parallelCount
      }
      const updatedHistory = [newHistory, ...testHistory].slice(0, MAX_HISTORY)
      setTestHistory(updatedHistory)
      saveTestHistory(updatedHistory)
      return finalResults
    })
  }, [testHistory, testDuration, parallelCount, loadErrors])

  const runBatch = useCallback((batchIdx: number, results: TestResult[]) => {
    if (!isTestingRef.current) return
    
    const startIdx = batchIdx * parallelCount
    if (startIdx >= ALL_PAGES.length) {
      finishTest()
      return
    }
    
    const endIdx = Math.min(startIdx + parallelCount, ALL_PAGES.length)
    const updatedResults = results.map((r, i) => 
      i >= startIdx && i < endIdx ? { ...r, status: 'testing' as const } : r
    )
    setTestResults(updatedResults)
    
    for (let i = 0; i < parallelCount && startIdx + i < ALL_PAGES.length; i++) {
      const iframe = iframeRefs.current[i]
      if (iframe) iframe.src = ALL_PAGES[startIdx + i].path
    }
    
    setTimeout(() => {
      if (!isTestingRef.current) return
      const currentErrors = getStoredErrors()
      
      const newResults = updatedResults.map((r, i) => {
        if (i >= startIdx && i < endIdx) {
          const pageErrors = currentErrors.filter(e => e.url.includes(r.path) || (r.path === '/' && e.url.match(/localhost:\d+\/?$/)))
          return { ...r, status: 'done' as const, errorCount: pageErrors.length, errors: pageErrors.map(e => e.message) }
        }
        return r
      })
      setTestResults(newResults)
      loadErrors()
      
      if ((batchIdx + 1) * parallelCount < ALL_PAGES.length) {
        runBatch(batchIdx + 1, newResults)
      } else {
        finishTest()
      }
    }, testDuration * 1000)
  }, [parallelCount, testDuration, loadErrors, finishTest])

  const startTest = useCallback(() => {
    clearErrors()
    setErrors([])
    setErrorCounts({})
    isTestingRef.current = true
    setIsTesting(true)
    setShowTestPanel(true)
    testStartTime.current = Date.now()
    currentBatchIndex.current = 0
    
    const initialResults = ALL_PAGES.map(p => ({
      path: p.path, name: p.name, status: 'pending' as const, errorCount: 0, errors: []
    }))
    setTestResults(initialResults)
    
    setTimeout(() => runBatch(0, initialResults), 100)
  }, [runBatch])

  const stopTest = useCallback(() => {
    isTestingRef.current = false
    setIsTesting(false)
    iframeRefs.current.forEach(iframe => { if (iframe) iframe.src = 'about:blank' })
  }, [])

  const getComparisonData = useCallback(() => {
    if (!selectedHistoryId || testHistory.length === 0) return null
    const selectedHistory = testHistory.find(h => h.id === selectedHistoryId)
    const currentResults = testResults.filter(r => r.status === 'done')
    if (!selectedHistory || currentResults.length === 0) return null
    
    const newErrors: string[] = []
    const fixedErrors: string[] = []
    
    currentResults.forEach(current => {
      const previous = selectedHistory.pageResults.find(p => p.path === current.path)
      if (previous) {
        current.errors.forEach(err => { if (!previous.errors.includes(err)) newErrors.push(`[${current.name}] ${err}`) })
        previous.errors.forEach(err => { if (!current.errors.includes(err)) fixedErrors.push(`[${current.name}] ${err}`) })
      }
    })
    return { newErrors, fixedErrors, selectedHistory }
  }, [selectedHistoryId, testHistory, testResults])

  const handleClear = () => { clearErrors(); setErrors([]); setErrorCounts({}) }
  const handleCopy = async () => { await navigator.clipboard.writeText(getErrorsAsText()); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const handleClearHistory = () => { clearTestHistory(); setTestHistory([]); setSelectedHistoryId(null) }

  const filteredErrors = filter === 'all' ? errors : errors.filter(e => e.type === filter)
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      error: 'bg-red-500/20 text-red-500', console: 'bg-yellow-500/20 text-yellow-500',
      network: 'bg-blue-500/20 text-blue-500', fetch: 'bg-orange-500/20 text-orange-500',
      resource: 'bg-pink-500/20 text-pink-500', compile: 'bg-red-600/20 text-red-400',
      warn: 'bg-amber-500/20 text-amber-500', script: 'bg-violet-500/20 text-violet-500',
      unhandledrejection: 'bg-rose-500/20 text-rose-500'
    }
    return colors[type] || 'bg-purple-500/20 text-purple-500'
  }
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      error: 'JS Error', console: 'Console', network: 'Network', fetch: 'Fetch',
      resource: 'Resource', compile: 'Compile', warn: 'Warning', script: 'Script',
      unhandledrejection: 'Promise'
    }
    return labels[type] || type
  }

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Tümü' }, { key: 'error', label: 'JS Hataları' },
    { key: 'console', label: 'Console' }, { key: 'network', label: 'Network' },
    { key: 'fetch', label: 'Fetch/API' }, { key: 'resource', label: 'Resource' },
    { key: 'compile', label: 'Compile' }, { key: 'warn', label: 'Uyarılar' },
  ]

  const testedCount = testResults.filter(r => r.status === 'done').length
  const totalErrorsInTest = testResults.reduce((sum, r) => sum + r.errorCount, 0)
  const comparisonData = getComparisonData()

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin"><Button variant="ghost" size="icon"><Icons.chevronLeft className="h-5 w-5" /></Button></Link>
            <h1 className="text-2xl font-bold">Hata Kayıtları ({errors.length})</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isTesting ? (
              <Button onClick={startTest} className="bg-green-600 hover:bg-green-700"><Play className="h-4 w-4 mr-2" />Testi Başlat</Button>
            ) : (
              <Button onClick={stopTest} variant="destructive"><Square className="h-4 w-4 mr-2" />Durdur</Button>
            )}
            <Button variant={autoRefresh ? "default" : "outline"} onClick={() => setAutoRefresh(!autoRefresh)} size="sm">
              <RefreshCw className={cn("h-4 w-4 mr-2", autoRefresh && "animate-spin")} />{autoRefresh ? 'Canlı' : 'Otomatik'}
            </Button>
            <Button variant="outline" onClick={loadErrors} size="sm"><RefreshCw className="h-4 w-4 mr-2" />Yenile</Button>
            <Button variant="outline" onClick={handleCopy}>{copied ? <Icons.check className="h-4 w-4 mr-2" /> : <Icons.copy className="h-4 w-4 mr-2" />}{copied ? 'Kopyalandı!' : 'Kopyala'}</Button>
            <Button variant="outline" className="text-red-500" onClick={handleClear}><Icons.trash className="h-4 w-4 mr-2" />Temizle</Button>
          </div>
        </div>

        {showTestPanel && (
          <div className="mb-6 p-4 bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                🧪 Otomatik Test {isTesting && <span className="text-sm font-normal text-muted-foreground">({testedCount}/{ALL_PAGES.length})</span>}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className={showSettings ? 'bg-muted' : ''}>
                  <Settings className="h-4 w-4 mr-1" />Ayarlar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className={showHistory ? 'bg-muted' : ''}>
                  <History className="h-4 w-4 mr-1" />Geçmiş ({testHistory.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowComparison(!showComparison)} className={showComparison ? 'bg-muted' : ''} disabled={testHistory.length === 0 || testedCount === 0}>
                  <GitCompare className="h-4 w-4 mr-1" />Karşılaştır
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowTestPanel(false)}><Icons.close className="h-4 w-4" /></Button>
              </div>
            </div>

            {showSettings && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium mb-3 flex items-center gap-2"><Settings className="h-4 w-4" />Test Ayarları</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2"><Clock className="h-4 w-4" />Sayfa Başına Süre</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min="2" max="15" value={testDuration} onChange={(e) => setTestDuration(Number(e.target.value))} className="flex-1" disabled={isTesting} />
                      <span className="text-sm font-mono bg-background px-2 py-1 rounded min-w-[60px] text-center">{testDuration} sn</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2"><Layers className="h-4 w-4" />Paralel Test</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min="1" max="4" value={parallelCount} onChange={(e) => setParallelCount(Number(e.target.value))} className="flex-1" disabled={isTesting} />
                      <span className="text-sm font-mono bg-background px-2 py-1 rounded min-w-[60px] text-center">{parallelCount} iframe</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-primary/10 rounded text-sm">
                  <strong>Tahmini süre:</strong> ~{Math.ceil(ALL_PAGES.length / parallelCount) * testDuration} saniye
                </div>
              </div>
            )}

            {showHistory && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2"><History className="h-4 w-4" />Test Geçmişi</h3>
                  {testHistory.length > 0 && <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-red-500"><Trash2 className="h-4 w-4 mr-1" />Temizle</Button>}
                </div>
                {testHistory.length === 0 ? <p className="text-sm text-muted-foreground">Henüz test geçmişi yok.</p> : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {testHistory.map((history) => (
                      <div key={history.id} className={cn("p-3 rounded-lg border cursor-pointer transition-colors", selectedHistoryId === history.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted")} onClick={() => setSelectedHistoryId(selectedHistoryId === history.id ? null : history.id)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{new Date(history.date).toLocaleString('tr-TR')}</span>
                            <span className={cn("ml-2 px-2 py-0.5 rounded text-xs", history.totalErrors > 0 ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500")}>{history.totalErrors} hata</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{Math.round(history.duration / 1000)}sn</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showComparison && comparisonData && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium mb-3 flex items-center gap-2"><GitCompare className="h-4 w-4" />Karşılaştırma</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <h4 className="font-medium text-red-500 mb-2 flex items-center gap-2"><ChevronUp className="h-4 w-4" />Yeni Hatalar ({comparisonData.newErrors.length})</h4>
                    {comparisonData.newErrors.length === 0 ? <p className="text-sm text-muted-foreground">Yeni hata yok! 🎉</p> : (
                      <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">{comparisonData.newErrors.map((err, i) => <li key={i} className="truncate">{err}</li>)}</ul>
                    )}
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <h4 className="font-medium text-green-500 mb-2 flex items-center gap-2"><ChevronDown className="h-4 w-4" />Düzeltilen ({comparisonData.fixedErrors.length})</h4>
                    {comparisonData.fixedErrors.length === 0 ? <p className="text-sm text-muted-foreground">Düzeltilen hata yok</p> : (
                      <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">{comparisonData.fixedErrors.map((err, i) => <li key={i} className="truncate">{err}</li>)}</ul>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {isTesting && (
              <div className="mb-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(testedCount / ALL_PAGES.length) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Test ediliyor...</span>
                  <span>{totalErrorsInTest} hata bulundu</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {testResults.map((result) => (
                <div key={result.path} className={cn("p-2 rounded-lg text-xs border transition-all",
                  result.status === 'pending' && "bg-muted/50 border-border",
                  result.status === 'testing' && "bg-blue-500/20 border-blue-500 animate-pulse",
                  result.status === 'done' && result.errorCount === 0 && "bg-green-500/20 border-green-500",
                  result.status === 'done' && result.errorCount > 0 && "bg-red-500/20 border-red-500",
                )}>
                  <div className="font-medium truncate">{result.name}</div>
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span className="truncate">{result.path}</span>
                    {result.status === 'done' && <span className={result.errorCount > 0 ? 'text-red-500' : 'text-green-500'}>{result.errorCount > 0 ? `${result.errorCount}` : '✓'}</span>}
                    {result.status === 'testing' && <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden">
              {Array.from({ length: parallelCount }).map((_, idx) => (
                <iframe key={idx} ref={el => { iframeRefs.current[idx] = el }} sandbox="allow-same-origin allow-scripts" />
              ))}
            </div>
          </div>
        )}

        {Object.keys(errorCounts).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
            {Object.entries(errorCounts).map(([type, count]) => (
              <div key={type} className={cn("p-3 rounded-lg text-center", getTypeColor(type))}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs opacity-80">{getTypeLabel(type)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {filterOptions.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={cn('px-4 py-2 rounded-full text-sm font-medium transition-colors', filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80')}>
              {f.label}{f.key !== 'all' && errorCounts[f.key] ? ` (${errorCounts[f.key]})` : ''}
            </button>
          ))}
        </div>

        {filteredErrors.length > 0 ? (
          <div className="space-y-3">
            {filteredErrors.map((error) => (
              <details key={error.id} className="bg-card border border-border rounded-xl overflow-hidden group">
                <summary className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50">
                  <span className={cn('px-2 py-1 rounded text-xs font-medium whitespace-nowrap', getTypeColor(error.type))}>{getTypeLabel(error.type)}</span>
                  <span className="flex-1 truncate font-mono text-sm">{error.message}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(error.timestamp).toLocaleString('tr-TR')}</span>
                  <Icons.chevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="p-4 border-t border-border bg-muted/30">
                  <div className="space-y-2 text-sm">
                    <p><strong>URL:</strong> {error.url}</p>
                    {error.resourceUrl && <p><strong>Resource:</strong> {error.resourceUrl}</p>}
                    {error.statusCode && <p><strong>Status:</strong> {error.statusCode}</p>}
                    {error.method && <p><strong>Method:</strong> {error.method}</p>}
                    {error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="mt-2 p-3 bg-black/50 rounded-lg overflow-x-auto text-xs text-red-400 max-h-60">{error.stack}</pre>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${error.type}: ${error.message}\nURL: ${error.url}\n${error.stack || ''}`)}><Icons.copy className="h-3 w-3 mr-2" />Kopyala</Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(error.url, '_blank')}><ExternalLink className="h-3 w-3 mr-2" />Aç</Button>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Icons.check className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold mb-2">Harika! Hiç hata yok</h2>
            <p className="text-muted-foreground mb-4">Şu anda kayıtlı hata bulunmuyor.</p>
            <Button onClick={startTest} className="bg-green-600 hover:bg-green-700"><Play className="h-4 w-4 mr-2" />Tüm Sayfaları Test Et</Button>
          </div>
        )}

        <div className="mt-8 p-4 bg-muted rounded-xl">
          <h3 className="font-semibold mb-2">🧪 Gelişmiş Test Sistemi</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div><h4 className="font-medium text-foreground mb-1">⚙️ Ayarlanabilir Süre</h4><p>2-15 saniye arasında ayarlayın.</p></div>
            <div><h4 className="font-medium text-foreground mb-1">🚀 Paralel Test</h4><p>1-4 iframe ile hızlı test.</p></div>
            <div><h4 className="font-medium text-foreground mb-1">📜 Test Geçmişi</h4><p>Son 10 test kaydedilir.</p></div>
            <div><h4 className="font-medium text-foreground mb-1">🔄 Karşılaştırma</h4><p>Yeni ve düzeltilen hataları görün.</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}
