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
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Flag, Filter, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

type ContentType = 'all' | 'comments' | 'reviews' | 'reported'
type ContentStatus = 'visible' | 'hidden' | 'deleted'

interface ContentItem {
  id: string
  type: 'comment' | 'review'
  userId: string
  userName: string
  userPhoto: string | null
  content: string
  mediaId: number
  mediaType: string
  mediaTitle?: string
  rating?: number
  status: ContentStatus
  isReported: boolean
  reportCount: number
  reportReasons: string[]
  createdAt: Date
  updatedAt?: Date
}

interface AuditLogEntry {
  adminId: string
  adminName: string
  action: string
  targetType: 'comment' | 'review' | 'content'
  targetId: string
  details: Record<string, unknown>
  timestamp: Timestamp
}

// Audit log oluşturma fonksiyonu
async function createAuditLog(
  adminId: string,
  adminName: string,
  action: string,
  targetType: 'comment' | 'review' | 'content',
  targetId: string,
  details: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), {
    adminId,
    adminName,
    action,
    targetType,
    targetId,
    details,
    timestamp: serverTimestamp(),
  })
}

export default function ContentModerationPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [activeTab, setActiveTab] = useState<ContentType>('all')
  const [contents, setContents] = useState<ContentItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    visible: 0,
    hidden: 0,
    reported: 0
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
    try {
      const [commentsSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, 'comments')),
        getDocs(query(collection(db, 'reports'), where('status', '==', 'pending')))
      ])
      
      let visible = 0
      let hidden = 0
      
      commentsSnap.docs.forEach(doc => {
        const data = doc.data()
        if (data.status === 'hidden') {
          hidden++
        } else {
          visible++
        }
      })
      
      setStats({
        total: commentsSnap.size,
        visible,
        hidden,
        reported: reportsSnap.size
      })
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
    }
  }, [])

  // İçerikleri yükle
  const loadContents = useCallback(async (reset = false) => {
    if (!isAdmin) return
    
    setDataLoading(true)
    try {
      let q = query(
        collection(db, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(20)
      )
      
      // Tab'a göre filtrele
      if (activeTab === 'reported') {
        // Raporlanmış içerikleri getir
        const reportsSnap = await getDocs(query(
          collection(db, 'reports'),
          where('targetType', '==', 'comment'),
          where('status', '==', 'pending')
        ))
        
        const reportedIds = reportsSnap.docs.map(d => d.data().targetId)
        
        if (reportedIds.length === 0) {
          setContents([])
          setDataLoading(false)
          return
        }
        
        // Raporlanmış yorumları getir
        const reportedContents: ContentItem[] = []
        for (const id of reportedIds.slice(0, 20)) {
          try {
            const commentSnap = await getDocs(query(
              collection(db, 'comments'),
              where('__name__', '==', id)
            ))
            if (!commentSnap.empty) {
              const data = commentSnap.docs[0].data()
              const reports = reportsSnap.docs.filter(r => r.data().targetId === id)
              reportedContents.push({
                id: commentSnap.docs[0].id,
                type: 'comment',
                userId: data.userId,
                userName: data.userName || 'Anonim',
                userPhoto: data.userPhoto,
                content: data.content,
                mediaId: data.mediaId,
                mediaType: data.mediaType,
                rating: data.rating,
                status: data.status || 'visible',
                isReported: true,
                reportCount: reports.length,
                reportReasons: reports.map(r => r.data().reason),
                createdAt: data.createdAt?.toDate() || new Date(),
              })
            }
          } catch (e) {
            console.error('Yorum getirme hatası:', e)
          }
        }
        
        setContents(reportedContents)
        setHasMore(false)
        setDataLoading(false)
        return
      }

      // Gizli içerikleri filtrele
      if (activeTab === 'comments') {
        q = query(
          collection(db, 'comments'),
          where('status', '!=', 'hidden'),
          orderBy('status'),
          orderBy('createdAt', 'desc'),
          limit(20)
        )
      }
      
      // Sayfalama için
      if (!reset && lastDoc) {
        q = query(
          collection(db, 'comments'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(20)
        )
      }
      
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        if (reset) setContents([])
        setHasMore(false)
        setDataLoading(false)
        return
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1])
      setHasMore(snapshot.docs.length === 20)
      
      // Raporları kontrol et
      const contentIds = snapshot.docs.map(d => d.id)
      const reportsSnap = await getDocs(query(
        collection(db, 'reports'),
        where('targetType', '==', 'comment'),
        where('status', '==', 'pending')
      ))
      
      const reportsByTarget: Record<string, { count: number; reasons: string[] }> = {}
      reportsSnap.docs.forEach(r => {
        const data = r.data()
        if (contentIds.includes(data.targetId)) {
          if (!reportsByTarget[data.targetId]) {
            reportsByTarget[data.targetId] = { count: 0, reasons: [] }
          }
          reportsByTarget[data.targetId].count++
          reportsByTarget[data.targetId].reasons.push(data.reason)
        }
      })
      
      const newContents = snapshot.docs.map((d) => {
        const data = d.data()
        const reports = reportsByTarget[d.id]
        return {
          id: d.id,
          type: 'comment' as const,
          userId: data.userId,
          userName: data.userName || 'Anonim',
          userPhoto: data.userPhoto,
          content: data.content,
          mediaId: data.mediaId,
          mediaType: data.mediaType,
          rating: data.rating,
          status: (data.status || 'visible') as ContentStatus,
          isReported: !!reports,
          reportCount: reports?.count || 0,
          reportReasons: reports?.reasons || [],
          createdAt: data.createdAt?.toDate() || new Date(),
        }
      })
      
      setContents(reset ? newContents : [...contents, ...newContents])
    } catch (error) {
      console.error('İçerik yükleme hatası:', error)
    } finally {
      setDataLoading(false)
    }
  }, [isAdmin, activeTab, lastDoc, contents])

  // Tab değiştiğinde içerikleri yeniden yükle
  useEffect(() => {
    if (isAdmin) {
      setLastDoc(null)
      setHasMore(true)
      loadContents(true)
      loadStats()
    }
  }, [activeTab, isAdmin])

  // İçerik gizle/göster
  const toggleContentVisibility = async (contentId: string, currentStatus: ContentStatus) => {
    if (!user) return
    
    const newStatus = currentStatus === 'hidden' ? 'visible' : 'hidden'
    
    try {
      await updateDoc(doc(db, 'comments', contentId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      })
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        newStatus === 'hidden' ? 'content_hidden' : 'content_shown',
        'comment',
        contentId,
        { previousStatus: currentStatus, newStatus }
      )
      
      // State güncelle
      setContents(prev => prev.map(c => 
        c.id === contentId ? { ...c, status: newStatus } : c
      ))
      
      // İstatistikleri güncelle
      loadStats()
    } catch (error) {
      console.error('İçerik durumu güncelleme hatası:', error)
    }
  }

  // İçerik sil
  const deleteContent = async (contentId: string) => {
    if (!user) return
    
    if (!confirm('Bu içeriği kalıcı olarak silmek istediğinizden emin misiniz?')) {
      return
    }
    
    try {
      // Önce içerik bilgisini al
      const content = contents.find(c => c.id === contentId)
      
      await deleteDoc(doc(db, 'comments', contentId))
      
      // İlgili raporları da çözüldü olarak işaretle
      const reportsSnap = await getDocs(query(
        collection(db, 'reports'),
        where('targetId', '==', contentId)
      ))
      
      for (const reportDoc of reportsSnap.docs) {
        await updateDoc(doc(db, 'reports', reportDoc.id), {
          status: 'resolved',
          resolvedAt: serverTimestamp(),
          resolvedBy: user.uid
        })
      }
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        'comment_deleted',
        'comment',
        contentId,
        { 
          content: content?.content?.substring(0, 100),
          userId: content?.userId,
          userName: content?.userName
        }
      )
      
      // State güncelle
      setContents(prev => prev.filter(c => c.id !== contentId))
      setShowDetailModal(false)
      
      // İstatistikleri güncelle
      loadStats()
    } catch (error) {
      console.error('İçerik silme hatası:', error)
    }
  }

  // Raporu çöz
  const resolveReports = async (contentId: string) => {
    if (!user) return
    
    try {
      const reportsSnap = await getDocs(query(
        collection(db, 'reports'),
        where('targetId', '==', contentId),
        where('status', '==', 'pending')
      ))
      
      for (const reportDoc of reportsSnap.docs) {
        await updateDoc(doc(db, 'reports', reportDoc.id), {
          status: 'resolved',
          resolvedAt: serverTimestamp(),
          resolvedBy: user.uid
        })
      }
      
      // State güncelle
      setContents(prev => prev.map(c => 
        c.id === contentId ? { ...c, isReported: false, reportCount: 0, reportReasons: [] } : c
      ))
      
      // İstatistikleri güncelle
      loadStats()
    } catch (error) {
      console.error('Rapor çözme hatası:', error)
    }
  }

  // Arama filtresi
  const filteredContents = contents.filter(c => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      c.content.toLowerCase().includes(query) ||
      c.userName.toLowerCase().includes(query) ||
      c.mediaType.toLowerCase().includes(query)
    )
  })

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

  const tabs = [
    { id: 'all' as ContentType, label: 'Tüm İçerikler', icon: Icons.list },
    { id: 'comments' as ContentType, label: 'Yorumlar', icon: Icons.comment },
    { id: 'reported' as ContentType, label: 'Raporlananlar', icon: Flag, badge: stats.reported },
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
              <h1 className="text-2xl font-bold">İçerik Moderasyonu</h1>
              <p className="text-muted-foreground text-sm">Yorumları ve içerikleri yönetin</p>
            </div>
          </div>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Icons.comment className="h-5 w-5 text-blue-500" />
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
                <Eye className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.visible}</p>
                <p className="text-xs text-muted-foreground">Görünür</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <EyeOff className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.hidden}</p>
                <p className="text-xs text-muted-foreground">Gizli</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Flag className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.reported}</p>
                <p className="text-xs text-muted-foreground">Raporlanan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs ve Arama */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.badge && tab.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          
          <div className="flex-1 md:max-w-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="İçerik ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* İçerik Listesi */}
        {dataLoading && contents.length === 0 ? (
          <div className="flex justify-center py-12">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredContents.length === 0 ? (
          <div className="text-center py-12">
            <Icons.comment className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">İçerik bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredContents.map((content) => (
              <div
                key={content.id}
                className={cn(
                  'bg-card border rounded-xl p-4 transition-all',
                  content.status === 'hidden' && 'opacity-60 border-yellow-500/50',
                  content.isReported && 'border-red-500/50'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Kullanıcı Bilgisi */}
                    <div className="flex items-center gap-2 mb-2">
                      {content.userPhoto ? (
                        <img
                          src={content.userPhoto}
                          alt={content.userName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Icons.user className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{content.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {content.mediaType} #{content.mediaId} • {content.createdAt.toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>

                    {/* İçerik */}
                    <p className="text-sm mb-2 line-clamp-2">{content.content}</p>
                    
                    {/* Durum Etiketleri */}
                    <div className="flex flex-wrap gap-2">
                      {content.status === 'hidden' && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          Gizli
                        </span>
                      )}
                      {content.isReported && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs rounded-full flex items-center gap-1">
                          <Flag className="h-3 w-3" />
                          {content.reportCount} Rapor
                        </span>
                      )}
                      {content.rating && (
                        <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full flex items-center gap-1">
                          <Icons.star className="h-3 w-3" />
                          {content.rating}/10
                        </span>
                      )}
                    </div>
                    
                    {/* Rapor Nedenleri */}
                    {content.isReported && content.reportReasons.length > 0 && (
                      <div className="mt-2 p-2 bg-red-500/10 rounded-lg">
                        <p className="text-xs font-medium text-red-500 mb-1">Rapor Nedenleri:</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {Array.from(new Set(content.reportReasons)).map((reason, i) => (
                            <li key={i}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  {/* Aksiyonlar */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedContent(content)
                        setShowDetailModal(true)
                      }}
                    >
                      <Icons.info className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={content.status === 'hidden' ? 'default' : 'outline'}
                      onClick={() => toggleContentVisibility(content.id, content.status)}
                      title={content.status === 'hidden' ? 'Göster' : 'Gizle'}
                    >
                      {content.status === 'hidden' ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    {content.isReported && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-500"
                        onClick={() => resolveReports(content.id)}
                        title="Raporları Çöz"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteContent(content.id)}
                      title="Sil"
                    >
                      <Icons.trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Daha Fazla Yükle */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => loadContents(false)}
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
        {showDetailModal && selectedContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">İçerik Detayı</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDetailModal(false)}
                >
                  <Icons.close className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Kullanıcı */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Kullanıcı</p>
                  <div className="flex items-center gap-2">
                    {selectedContent.userPhoto ? (
                      <img
                        src={selectedContent.userPhoto}
                        alt={selectedContent.userName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Icons.user className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{selectedContent.userName}</p>
                      <p className="text-xs text-muted-foreground">ID: {selectedContent.userId}</p>
                    </div>
                  </div>
                </div>
                
                {/* İçerik */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">İçerik</p>
                  <p className="p-3 bg-muted rounded-lg text-sm">{selectedContent.content}</p>
                </div>
                
                {/* Meta Bilgiler */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Medya Tipi</p>
                    <p className="font-medium">{selectedContent.mediaType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Medya ID</p>
                    <p className="font-medium">{selectedContent.mediaId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Oluşturulma</p>
                    <p className="font-medium">{selectedContent.createdAt.toLocaleString('tr-TR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Durum</p>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs',
                      selectedContent.status === 'hidden' 
                        ? 'bg-yellow-500/20 text-yellow-500' 
                        : 'bg-green-500/20 text-green-500'
                    )}>
                      {selectedContent.status === 'hidden' ? 'Gizli' : 'Görünür'}
                    </span>
                  </div>
                </div>

                {/* Raporlar */}
                {selectedContent.isReported && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Raporlar ({selectedContent.reportCount})</p>
                    <div className="p-3 bg-red-500/10 rounded-lg">
                      <ul className="text-sm space-y-1">
                        {Array.from(new Set(selectedContent.reportReasons)).map((reason, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {/* Aksiyonlar */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button
                    className="flex-1"
                    variant={selectedContent.status === 'hidden' ? 'default' : 'outline'}
                    onClick={() => {
                      toggleContentVisibility(selectedContent.id, selectedContent.status)
                      setSelectedContent({
                        ...selectedContent,
                        status: selectedContent.status === 'hidden' ? 'visible' : 'hidden'
                      })
                    }}
                  >
                    {selectedContent.status === 'hidden' ? (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Göster
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Gizle
                      </>
                    )}
                  </Button>
                  {selectedContent.isReported && (
                    <Button
                      variant="outline"
                      className="text-green-500"
                      onClick={() => {
                        resolveReports(selectedContent.id)
                        setSelectedContent({
                          ...selectedContent,
                          isReported: false,
                          reportCount: 0,
                          reportReasons: []
                        })
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Raporları Çöz
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => deleteContent(selectedContent.id)}
                  >
                    <Icons.trash className="h-4 w-4 mr-2" />
                    Sil
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
