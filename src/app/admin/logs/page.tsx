'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where, 
  Timestamp,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { 
  Search, 
  Filter, 
  Calendar,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  User,
  Clock,
  FileText,
  ChevronDown
} from 'lucide-react'

type LogLevel = 'all' | 'info' | 'warning' | 'error' | 'success'

interface SystemLog {
  id: string
  level: 'info' | 'warning' | 'error' | 'success'
  action: string
  message: string
  userId?: string
  userName?: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

// Log seviyesi renkleri
const LEVEL_COLORS: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  success: 'bg-green-500/10 text-green-500 border-green-500/20',
}


// Log seviyesi ikonları
const LEVEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
}

// Log seviyesi isimleri
const LEVEL_NAMES: Record<string, string> = {
  info: 'Bilgi',
  warning: 'Uyarı',
  error: 'Hata',
  success: 'Başarılı',
}

// Aksiyon isimleri
const ACTION_NAMES: Record<string, string> = {
  user_banned: 'Kullanıcı Yasaklandı',
  user_unbanned: 'Yasak Kaldırıldı',
  comment_deleted: 'Yorum Silindi',
  content_hidden: 'İçerik Gizlendi',
  content_shown: 'İçerik Gösterildi',
  subscription_cancelled: 'Abonelik İptal Edildi',
  subscription_extended: 'Abonelik Uzatıldı',
  subscription_reactivated: 'Abonelik Aktifleştirildi',
  subscription_modified: 'Abonelik Değiştirildi',
  bulk_action: 'Toplu İşlem',
  login: 'Giriş Yapıldı',
  logout: 'Çıkış Yapıldı',
  error_logged: 'Hata Kaydedildi',
  system_event: 'Sistem Olayı',
}

export default function SystemLogsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [filterLevel, setFilterLevel] = useState<LogLevel>('all')
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    info: 0,
    warning: 0,
    error: 0,
    success: 0
  })


  // Admin kontrolü
  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setCheckingAdmin(false)
        return
      }
      
      try {
        const modDoc = await getDocs(query(
          collection(db, 'moderators'),
          where('__name__', '==', user.uid)
        ))
        
        if (!modDoc.empty) {
          const modData = modDoc.docs[0].data()
          if (modData.role === 'founder' || modData.role === 'admin') {
            setIsAdmin(true)
          }
        }
      } catch (error) {
        console.error('Admin kontrolü hatası:', error)
      } finally {
        setCheckingAdmin(false)
      }
    }
    
    if (!loading) {
      checkAdmin()
    }
  }, [user, loading])

  // İstatistikleri yükle
  const loadStats = useCallback(async () => {
    if (!isAdmin) return // Admin değilse işlemi yapma
    
    try {
      // auditLogs ve systemLogs koleksiyonlarından istatistik çek
      const [auditSnap, errorSnap] = await Promise.all([
        getDocs(collection(db, 'auditLogs')),
        getDocs(collection(db, 'errorLogs'))
      ])
      
      let info = 0
      let warning = 0
      let error = 0
      let success = 0
      
      // Audit logları say
      auditSnap.docs.forEach(doc => {
        const data = doc.data()
        const action = data.action as string
        
        if (action?.includes('deleted') || action?.includes('banned')) {
          warning++
        } else if (action?.includes('error')) {
          error++
        } else {
          success++
        }
      })
      
      // Error logları say
      error += errorSnap.size
      
      setStats({
        total: auditSnap.size + errorSnap.size,
        info,
        warning,
        error,
        success
      })
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
    }
  }, [])


  // Logları yükle
  const loadLogs = useCallback(async (reset = false) => {
    if (!isAdmin) return
    
    setDataLoading(true)
    try {
      const allLogs: SystemLog[] = []
      
      // Audit logları getir
      let auditQuery = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(30)
      )
      
      if (!reset && lastDoc) {
        auditQuery = query(
          collection(db, 'auditLogs'),
          orderBy('timestamp', 'desc'),
          startAfter(lastDoc),
          limit(30)
        )
      }
      
      const auditSnap = await getDocs(auditQuery)
      
      auditSnap.docs.forEach(doc => {
        const data = doc.data()
        const action = data.action as string
        
        // Log seviyesini belirle
        let level: 'info' | 'warning' | 'error' | 'success' = 'info'
        if (action?.includes('deleted') || action?.includes('banned') || action?.includes('cancelled')) {
          level = 'warning'
        } else if (action?.includes('error')) {
          level = 'error'
        } else if (action?.includes('created') || action?.includes('extended') || action?.includes('reactivated')) {
          level = 'success'
        }
        
        allLogs.push({
          id: doc.id,
          level,
          action: data.action || 'unknown',
          message: ACTION_NAMES[data.action] || data.action || 'Bilinmeyen işlem',
          userId: data.adminId,
          userName: data.adminName,
          targetType: data.targetType,
          targetId: data.targetId,
          details: data.details,
          timestamp: data.timestamp?.toDate() || new Date(),
        })
      })
      
      // Error logları getir (sadece ilk yüklemede)
      if (reset) {
        try {
          const errorSnap = await getDocs(query(
            collection(db, 'errorLogs'),
            orderBy('timestamp', 'desc'),
            limit(20)
          ))
          
          errorSnap.docs.forEach(doc => {
            const data = doc.data()
            allLogs.push({
              id: doc.id,
              level: 'error',
              action: 'error_logged',
              message: data.message || 'Sistem hatası',
              userId: data.userId,
              details: {
                stack: data.stack,
                url: data.url,
                componentStack: data.componentStack,
              },
              timestamp: data.timestamp?.toDate() || new Date(),
            })
          })
        } catch (e) {
          // errorLogs koleksiyonu yoksa devam et
          console.log('Error logs koleksiyonu bulunamadı')
        }
      }
      
      // Tarihe göre sırala
      allLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      
      if (auditSnap.docs.length > 0) {
        setLastDoc(auditSnap.docs[auditSnap.docs.length - 1])
      }
      setHasMore(auditSnap.docs.length === 30)
      
      setLogs(reset ? allLogs : [...logs, ...allLogs])
    } catch (error) {
      console.error('Log yükleme hatası:', error)
    } finally {
      setDataLoading(false)
    }
  }, [isAdmin, lastDoc, logs])


  // Filtre değiştiğinde yeniden yükle
  useEffect(() => {
    if (isAdmin) {
      setLastDoc(null)
      setHasMore(true)
      loadLogs(true)
      loadStats()
    }
  }, [isAdmin])

  // Filtreleme
  const filteredLogs = logs.filter(log => {
    // Seviye filtresi
    if (filterLevel !== 'all' && log.level !== filterLevel) {
      return false
    }
    
    // Tarih filtresi
    if (dateRange.start) {
      const startDate = new Date(dateRange.start)
      if (log.timestamp < startDate) return false
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999)
      if (log.timestamp > endDate) return false
    }
    
    // Arama filtresi
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        log.message.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.userName?.toLowerCase().includes(query) ||
        log.targetId?.toLowerCase().includes(query) ||
        log.userId?.toLowerCase().includes(query)
      )
    }
    
    return true
  })

  // Tarihi formatla
  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Az önce'
    if (minutes < 60) return `${minutes} dakika önce`
    if (hours < 24) return `${hours} saat önce`
    if (days < 7) return `${days} gün önce`
    
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Loading durumları
  if (loading || checkingAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    router.push('/giris')
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Icons.shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Erişim Engellendi</h1>
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    )
  }


  const filterTabs = [
    { id: 'all' as LogLevel, label: 'Tümü', icon: FileText, count: stats.total },
    { id: 'success' as LogLevel, label: 'Başarılı', icon: CheckCircle, count: stats.success },
    { id: 'info' as LogLevel, label: 'Bilgi', icon: Info, count: stats.info },
    { id: 'warning' as LogLevel, label: 'Uyarı', icon: AlertTriangle, count: stats.warning },
    { id: 'error' as LogLevel, label: 'Hata', icon: AlertCircle, count: stats.error },
  ]

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <Icons.chevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Sistem Logları</h1>
              <p className="text-muted-foreground text-sm">Sistem aktivitelerini ve hataları izleyin</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setLastDoc(null)
              loadLogs(true)
              loadStats()
            }}
            disabled={dataLoading}
          >
            {dataLoading ? (
              <Icons.spinner className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Icons.refresh className="h-4 w-4 mr-2" />
            )}
            Yenile
          </Button>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Toplam</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.success}</p>
                <p className="text-xs text-muted-foreground">Başarılı</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Info className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.info}</p>
                <p className="text-xs text-muted-foreground">Bilgi</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.warning}</p>
                <p className="text-xs text-muted-foreground">Uyarı</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.error}</p>
                <p className="text-xs text-muted-foreground">Hata</p>
              </div>
            </div>
          </div>
        </div>


        {/* Filtreler ve Arama */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Seviye Filtreleri */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filterTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterLevel(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    filterLevel === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
          
          {/* Arama ve Gelişmiş Filtreler */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 md:max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Log ara (mesaj, kullanıcı, ID)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="md:w-auto"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtreler
              <ChevronDown className={cn('h-4 w-4 ml-2 transition-transform', showFilters && 'rotate-180')} />
            </Button>
          </div>
          
          {/* Gelişmiş Filtreler */}
          {showFilters && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange({ start: '', end: '' })}
                >
                  Filtreleri Temizle
                </Button>
              </div>
            </div>
          )}
        </div>


        {/* Log Listesi */}
        {dataLoading && logs.length === 0 ? (
          <div className="flex justify-center py-12">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Log bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const LevelIcon = LEVEL_ICONS[log.level] || Info
              return (
                <div
                  key={log.id}
                  onClick={() => {
                    setSelectedLog(log)
                    setShowDetailModal(true)
                  }}
                  className={cn(
                    'bg-card border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50',
                    'border-l-4',
                    log.level === 'error' && 'border-l-red-500',
                    log.level === 'warning' && 'border-l-yellow-500',
                    log.level === 'success' && 'border-l-green-500',
                    log.level === 'info' && 'border-l-blue-500'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        LEVEL_COLORS[log.level]
                      )}>
                        <LevelIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            LEVEL_COLORS[log.level]
                          )}>
                            {LEVEL_NAMES[log.level]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {log.action}
                          </span>
                        </div>
                        <p className="font-medium text-sm mb-1 truncate">{log.message}</p>
                        {log.userName && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{log.userName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Daha Fazla Yükle */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => loadLogs(false)}
                  disabled={dataLoading}
                >
                  {dataLoading ? (
                    <Icons.spinner className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Daha Fazla Yükle
                </Button>
              </div>
            )}
          </div>
        )}


        {/* Detay Modal */}
        {showDetailModal && selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    LEVEL_COLORS[selectedLog.level]
                  )}>
                    {(() => {
                      const LevelIcon = LEVEL_ICONS[selectedLog.level] || Info
                      return <LevelIcon className="h-4 w-4" />
                    })()}
                  </div>
                  <h2 className="text-lg font-semibold">Log Detayı</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDetailModal(false)}
                >
                  <Icons.close className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Seviye ve Aksiyon */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-3 py-1 rounded text-sm font-medium',
                    LEVEL_COLORS[selectedLog.level]
                  )}>
                    {LEVEL_NAMES[selectedLog.level]}
                  </span>
                  <span className="text-sm text-muted-foreground">{selectedLog.action}</span>
                </div>
                
                {/* Mesaj */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mesaj</p>
                  <p className="p-3 bg-muted rounded-lg text-sm">{selectedLog.message}</p>
                </div>
                
                {/* Kullanıcı Bilgisi */}
                {selectedLog.userName && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">İşlemi Yapan</p>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{selectedLog.userName}</span>
                      {selectedLog.userId && (
                        <span className="text-xs text-muted-foreground">({selectedLog.userId.slice(0, 8)}...)</span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Hedef Bilgisi */}
                {selectedLog.targetType && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Hedef Tipi</p>
                      <p className="font-medium text-sm">{selectedLog.targetType}</p>
                    </div>
                    {selectedLog.targetId && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Hedef ID</p>
                        <p className="font-medium text-sm font-mono">{selectedLog.targetId.slice(0, 12)}...</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Zaman */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Zaman</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedLog.timestamp.toLocaleString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                
                {/* Detaylar */}
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Detaylar</p>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}