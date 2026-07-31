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
  getDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { formatDateTR, formatNumberTR } from '@/lib/utils/format'
import { 
  Search, 
  Filter, 
  Calendar, 
  XCircle, 
  CheckCircle, 
  Clock,
  CalendarPlus,
  Ban,
  RefreshCw
} from 'lucide-react'
import { SubscriptionPlan, SubscriptionStatus, PLAN_PRICES } from '@/lib/subscription'

type FilterStatus = 'all' | 'active' | 'cancelled' | 'expired' | 'trial'

interface SubscriptionData {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  startDate: Date
  endDate: Date
  autoRenew: boolean
  billingCycle: 'monthly' | 'yearly'
  price: number
  paymentMethod?: string
  iyzicoSubscriptionId?: string
  lastPaymentDate?: Date
  nextPaymentDate?: Date
  cancelledAt?: Date
  createdAt: Date
  updatedAt?: Date
}

interface AuditLogEntry {
  adminId: string
  adminName: string
  action: string
  targetType: 'subscription'
  targetId: string
  details: Record<string, unknown>
  timestamp: Timestamp
}

// Audit log oluşturma fonksiyonu
async function createAuditLog(
  adminId: string,
  adminName: string,
  action: string,
  targetId: string,
  details: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), {
    adminId,
    adminName,
    action,
    targetType: 'subscription',
    targetId,
    details,
    timestamp: serverTimestamp(),
  })
}

// Plan renkleri
const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  free: 'bg-gray-500/10 text-gray-500',
  standard: 'bg-blue-500/10 text-blue-500',
  premium: 'bg-purple-500/10 text-purple-500',
  family: 'bg-pink-500/10 text-pink-500',
}

// Durum renkleri
const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'bg-green-500/10 text-green-500',
  cancelled: 'bg-yellow-500/10 text-yellow-500',
  expired: 'bg-red-500/10 text-red-500',
  trial: 'bg-blue-500/10 text-blue-500',
}

// Plan isimleri
const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  free: 'Ücretsiz',
  standard: 'Standart',
  premium: 'Premium',
  family: 'Aile',
}

// Durum isimleri
const STATUS_NAMES: Record<SubscriptionStatus, string> = {
  active: 'Aktif',
  cancelled: 'İptal Edildi',
  expired: 'Süresi Doldu',
  trial: 'Deneme',
}

export default function SubscriptionManagementPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionData | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [extendDays, setExtendDays] = useState(30)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    cancelled: 0,
    expired: 0,
    trial: 0,
    revenue: 0
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
      const subsSnap = await getDocs(collection(db, 'subscriptions'))
      
      let active = 0
      let cancelled = 0
      let expired = 0
      let trial = 0
      let revenue = 0
      
      subsSnap.docs.forEach(doc => {
        const data = doc.data()
        const status = data.status as SubscriptionStatus
        
        switch (status) {
          case 'active':
            active++
            revenue += data.price || 0
            break
          case 'cancelled':
            cancelled++
            break
          case 'expired':
            expired++
            break
          case 'trial':
            trial++
            break
        }
      })
      
      setStats({
        total: subsSnap.size,
        active,
        cancelled,
        expired,
        trial,
        revenue
      })
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
    }
  }, [])

  // Kullanıcı bilgilerini getir
  const getUserInfo = async (userId: string): Promise<{ name?: string; email?: string }> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (userDoc.exists()) {
        const data = userDoc.data()
        return {
          name: data.displayName || data.name,
          email: data.email
        }
      }
    } catch (error) {
      console.error('Kullanıcı bilgisi getirme hatası:', error)
    }
    return {}
  }

  // Abonelikleri yükle
  const loadSubscriptions = useCallback(async (reset = false) => {
    if (!isAdmin) return
    
    setDataLoading(true)
    try {
      let q = query(
        collection(db, 'subscriptions'),
        orderBy('createdAt', 'desc'),
        limit(20)
      )
      
      // Durum filtreleme
      if (filterStatus !== 'all') {
        q = query(
          collection(db, 'subscriptions'),
          where('status', '==', filterStatus),
          orderBy('createdAt', 'desc'),
          limit(20)
        )
      }
      
      // Sayfalama
      if (!reset && lastDoc) {
        if (filterStatus !== 'all') {
          q = query(
            collection(db, 'subscriptions'),
            where('status', '==', filterStatus),
            orderBy('createdAt', 'desc'),
            startAfter(lastDoc),
            limit(20)
          )
        } else {
          q = query(
            collection(db, 'subscriptions'),
            orderBy('createdAt', 'desc'),
            startAfter(lastDoc),
            limit(20)
          )
        }
      }
      
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        if (reset) setSubscriptions([])
        setHasMore(false)
        setDataLoading(false)
        return
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1])
      setHasMore(snapshot.docs.length === 20)
      
      // Kullanıcı bilgilerini paralel olarak getir
      const subsWithUsers = await Promise.all(
        snapshot.docs.map(async (d) => {
          const data = d.data()
          const userInfo = await getUserInfo(d.id)
          
          return {
            id: d.id,
            userId: d.id,
            userName: userInfo.name,
            userEmail: userInfo.email,
            plan: data.plan as SubscriptionPlan,
            status: data.status as SubscriptionStatus,
            startDate: data.startDate?.toDate() || new Date(),
            endDate: data.endDate?.toDate() || new Date(),
            autoRenew: data.autoRenew ?? true,
            billingCycle: data.billingCycle || 'monthly',
            price: data.price || 0,
            paymentMethod: data.paymentMethod,
            iyzicoSubscriptionId: data.iyzicoSubscriptionId,
            lastPaymentDate: data.lastPaymentDate?.toDate(),
            nextPaymentDate: data.nextPaymentDate?.toDate(),
            cancelledAt: data.cancelledAt?.toDate(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
          }
        })
      )
      
      setSubscriptions(reset ? subsWithUsers : [...subscriptions, ...subsWithUsers])
    } catch (error) {
      console.error('Abonelik yükleme hatası:', error)
    } finally {
      setDataLoading(false)
    }
  }, [isAdmin, filterStatus, lastDoc, subscriptions])

  // Filtre değiştiğinde yeniden yükle
  useEffect(() => {
    if (isAdmin) {
      setLastDoc(null)
      setHasMore(true)
      loadSubscriptions(true)
      loadStats()
    }
  }, [filterStatus, isAdmin])

  // Abonelik iptal et
  const cancelSubscription = async (subscriptionId: string) => {
    if (!user || !selectedSubscription) return
    
    if (!confirm('Bu aboneliği iptal etmek istediğinizden emin misiniz?')) {
      return
    }
    
    setActionLoading(true)
    try {
      await updateDoc(doc(db, 'subscriptions', subscriptionId), {
        status: 'cancelled',
        autoRenew: false,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        'subscription_cancelled',
        subscriptionId,
        {
          previousStatus: selectedSubscription.status,
          plan: selectedSubscription.plan,
          userName: selectedSubscription.userName,
          userEmail: selectedSubscription.userEmail
        }
      )
      
      // State güncelle
      setSubscriptions(prev => prev.map(s => 
        s.id === subscriptionId 
          ? { ...s, status: 'cancelled' as SubscriptionStatus, autoRenew: false, cancelledAt: new Date() } 
          : s
      ))
      
      setSelectedSubscription(prev => prev ? { ...prev, status: 'cancelled', autoRenew: false, cancelledAt: new Date() } : null)
      loadStats()
    } catch (error) {
      console.error('Abonelik iptal hatası:', error)
      alert('Abonelik iptal edilirken bir hata oluştu.')
    } finally {
      setActionLoading(false)
    }
  }

  // Abonelik süresini uzat
  const extendSubscription = async () => {
    if (!user || !selectedSubscription || extendDays <= 0) return
    
    setActionLoading(true)
    try {
      const currentEndDate = selectedSubscription.endDate
      const newEndDate = new Date(currentEndDate)
      newEndDate.setDate(newEndDate.getDate() + extendDays)
      
      // Eğer abonelik expired ise, aktif yap
      const newStatus = selectedSubscription.status === 'expired' ? 'active' : selectedSubscription.status
      
      await updateDoc(doc(db, 'subscriptions', selectedSubscription.id), {
        endDate: Timestamp.fromDate(newEndDate),
        status: newStatus,
        nextPaymentDate: Timestamp.fromDate(newEndDate),
        updatedAt: serverTimestamp()
      })
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        'subscription_extended',
        selectedSubscription.id,
        {
          previousEndDate: currentEndDate.toISOString(),
          newEndDate: newEndDate.toISOString(),
          daysExtended: extendDays,
          plan: selectedSubscription.plan,
          userName: selectedSubscription.userName,
          userEmail: selectedSubscription.userEmail,
          previousStatus: selectedSubscription.status,
          newStatus
        }
      )
      
      // State güncelle
      setSubscriptions(prev => prev.map(s => 
        s.id === selectedSubscription.id 
          ? { ...s, endDate: newEndDate, status: newStatus as SubscriptionStatus, nextPaymentDate: newEndDate } 
          : s
      ))
      
      setSelectedSubscription(prev => prev ? { ...prev, endDate: newEndDate, status: newStatus as SubscriptionStatus, nextPaymentDate: newEndDate } : null)
      setShowExtendModal(false)
      setExtendDays(30)
      loadStats()
    } catch (error) {
      console.error('Abonelik uzatma hatası:', error)
      alert('Abonelik uzatılırken bir hata oluştu.')
    } finally {
      setActionLoading(false)
    }
  }

  // Aboneliği yeniden aktif et
  const reactivateSubscription = async (subscriptionId: string) => {
    if (!user || !selectedSubscription) return
    
    if (!confirm('Bu aboneliği yeniden aktif etmek istediğinizden emin misiniz?')) {
      return
    }
    
    setActionLoading(true)
    try {
      // Yeni bitiş tarihi hesapla (şu andan itibaren 1 ay)
      const newEndDate = new Date()
      if (selectedSubscription.billingCycle === 'yearly') {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1)
      } else {
        newEndDate.setMonth(newEndDate.getMonth() + 1)
      }
      
      await updateDoc(doc(db, 'subscriptions', subscriptionId), {
        status: 'active',
        autoRenew: true,
        endDate: Timestamp.fromDate(newEndDate),
        nextPaymentDate: Timestamp.fromDate(newEndDate),
        cancelledAt: null,
        updatedAt: serverTimestamp()
      })
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        'subscription_reactivated',
        subscriptionId,
        {
          previousStatus: selectedSubscription.status,
          plan: selectedSubscription.plan,
          userName: selectedSubscription.userName,
          userEmail: selectedSubscription.userEmail,
          newEndDate: newEndDate.toISOString()
        }
      )
      
      // State güncelle
      setSubscriptions(prev => prev.map(s => 
        s.id === subscriptionId 
          ? { ...s, status: 'active' as SubscriptionStatus, autoRenew: true, endDate: newEndDate, cancelledAt: undefined } 
          : s
      ))
      
      setSelectedSubscription(prev => prev ? { ...prev, status: 'active', autoRenew: true, endDate: newEndDate, cancelledAt: undefined } : null)
      loadStats()
    } catch (error) {
      console.error('Abonelik aktifleştirme hatası:', error)
      alert('Abonelik aktifleştirilirken bir hata oluştu.')
    } finally {
      setActionLoading(false)
    }
  }

  // Arama filtresi
  const filteredSubscriptions = subscriptions.filter(s => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      s.userName?.toLowerCase().includes(query) ||
      s.userEmail?.toLowerCase().includes(query) ||
      s.userId.toLowerCase().includes(query) ||
      s.plan.toLowerCase().includes(query)
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

  const filterTabs = [
    { id: 'all' as FilterStatus, label: 'Tümü', count: stats.total },
    { id: 'active' as FilterStatus, label: 'Aktif', count: stats.active },
    { id: 'cancelled' as FilterStatus, label: 'İptal', count: stats.cancelled },
    { id: 'expired' as FilterStatus, label: 'Süresi Dolmuş', count: stats.expired },
    { id: 'trial' as FilterStatus, label: 'Deneme', count: stats.trial },
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
              <h1 className="text-2xl font-bold">Abonelik Yönetimi</h1>
              <p className="text-muted-foreground text-sm">Kullanıcı aboneliklerini yönetin</p>
            </div>
          </div>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Icons.users className="h-5 w-5 text-blue-500" />
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
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Aktif</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.cancelled}</p>
                <p className="text-xs text-muted-foreground">İptal</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.expired}</p>
                <p className="text-xs text-muted-foreground">Süresi Dolmuş</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Icons.creditCard className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumberTR(stats.revenue, { currency: true, decimals: 2 })}</p>
                <p className="text-xs text-muted-foreground">Aylık Gelir</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtreler ve Arama */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  filterStatus === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {tab.label}
                <span className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  filterStatus === tab.id
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted-foreground/20 text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          
          <div className="flex-1 md:max-w-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Kullanıcı veya e-posta ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Abonelik Listesi */}
        {dataLoading && subscriptions.length === 0 ? (
          <div className="flex justify-center py-12">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="text-center py-12">
            <Icons.creditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Abonelik bulunamadı</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium">Kullanıcı</th>
                    <th className="text-left p-4 text-sm font-medium">Plan</th>
                    <th className="text-left p-4 text-sm font-medium">Durum</th>
                    <th className="text-left p-4 text-sm font-medium">Dönem</th>
                    <th className="text-left p-4 text-sm font-medium">Bitiş Tarihi</th>
                    <th className="text-left p-4 text-sm font-medium">Fiyat</th>
                    <th className="text-left p-4 text-sm font-medium">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{sub.userName || 'Anonim'}</p>
                          <p className="text-xs text-muted-foreground">{sub.userEmail || sub.userId}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={cn('px-2 py-1 rounded text-xs font-medium', PLAN_COLORS[sub.plan])}>
                          {PLAN_NAMES[sub.plan]}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn('px-2 py-1 rounded text-xs font-medium', STATUS_COLORS[sub.status])}>
                          {STATUS_NAMES[sub.status]}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        {sub.billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDateTR(sub.endDate)}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-medium">
                        ₺{sub.price}
                      </td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSubscription(sub)
                            setShowDetailModal(true)
                          }}
                        >
                          <Icons.info className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daha Fazla Yükle */}
        {hasMore && filteredSubscriptions.length > 0 && (
          <div className="flex justify-center pt-6">
            <Button
              variant="outline"
              onClick={() => loadSubscriptions(false)}
              disabled={dataLoading}
            >
              {dataLoading ? (
                <Icons.spinner className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Daha Fazla Yükle
            </Button>
          </div>
        )}

        {/* Detay Modal */}
        {showDetailModal && selectedSubscription && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Abonelik Detayı</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDetailModal(false)}
                >
                  <Icons.close className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Kullanıcı Bilgisi */}
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icons.user className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedSubscription.userName || 'Anonim'}</p>
                    <p className="text-sm text-muted-foreground">{selectedSubscription.userEmail || selectedSubscription.userId}</p>
                  </div>
                </div>

                {/* Plan ve Durum */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Plan</p>
                    <span className={cn('px-3 py-1.5 rounded text-sm font-medium inline-block', PLAN_COLORS[selectedSubscription.plan])}>
                      {PLAN_NAMES[selectedSubscription.plan]}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Durum</p>
                    <span className={cn('px-3 py-1.5 rounded text-sm font-medium inline-block', STATUS_COLORS[selectedSubscription.status])}>
                      {STATUS_NAMES[selectedSubscription.status]}
                    </span>
                  </div>
                </div>

                {/* Tarih Bilgileri */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Başlangıç Tarihi</p>
                    <p className="font-medium">{formatDateTR(selectedSubscription.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Bitiş Tarihi</p>
                    <p className="font-medium">{formatDateTR(selectedSubscription.endDate)}</p>
                  </div>
                </div>

                {/* Ödeme Bilgileri */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Faturalama Dönemi</p>
                    <p className="font-medium">{selectedSubscription.billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fiyat</p>
                    <p className="font-medium">₺{selectedSubscription.price}</p>
                  </div>
                </div>

                {/* Otomatik Yenileme */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Otomatik Yenileme</span>
                  </div>
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    selectedSubscription.autoRenew ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  )}>
                    {selectedSubscription.autoRenew ? 'Aktif' : 'Kapalı'}
                  </span>
                </div>

                {/* Ek Bilgiler */}
                {selectedSubscription.iyzicoSubscriptionId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">iyzico Abonelik ID</p>
                    <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{selectedSubscription.iyzicoSubscriptionId}</p>
                  </div>
                )}

                {selectedSubscription.lastPaymentDate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Son Ödeme Tarihi</p>
                    <p className="font-medium">{formatDateTR(selectedSubscription.lastPaymentDate)}</p>
                  </div>
                )}

                {selectedSubscription.cancelledAt && (
                  <div className="p-3 bg-yellow-500/10 rounded-lg">
                    <p className="text-xs text-yellow-500 mb-1">İptal Tarihi</p>
                    <p className="font-medium text-yellow-500">{formatDateTR(selectedSubscription.cancelledAt)}</p>
                  </div>
                )}

                {/* Aksiyonlar */}
                <div className="flex flex-col gap-2 pt-4 border-t border-border">
                  {/* Süre Uzatma */}
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowExtendModal(true)}
                    disabled={actionLoading}
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Süre Uzat
                  </Button>

                  {/* Yeniden Aktif Et (iptal edilmiş veya süresi dolmuş için) */}
                  {(selectedSubscription.status === 'cancelled' || selectedSubscription.status === 'expired') && (
                    <Button
                      className="w-full"
                      onClick={() => reactivateSubscription(selectedSubscription.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Icons.spinner className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Yeniden Aktif Et
                    </Button>
                  )}

                  {/* İptal Et (aktif için) */}
                  {selectedSubscription.status === 'active' && (
                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => cancelSubscription(selectedSubscription.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Icons.spinner className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Ban className="h-4 w-4 mr-2" />
                      )}
                      Aboneliği İptal Et
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Süre Uzatma Modal */}
        {showExtendModal && selectedSubscription && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card border border-border rounded-xl w-full max-w-md">
              <div className="border-b border-border p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Abonelik Süresini Uzat</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowExtendModal(false)
                    setExtendDays(30)
                  }}
                >
                  <Icons.close className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>{selectedSubscription.userName || 'Kullanıcı'}</strong> için abonelik süresini uzatın.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Mevcut bitiş tarihi: <strong>{formatDateTR(selectedSubscription.endDate)}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Uzatılacak Gün Sayısı</label>
                  <div className="flex gap-2">
                    {[7, 14, 30, 60, 90, 365].map((days) => (
                      <button
                        key={days}
                        onClick={() => setExtendDays(days)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          extendDays === days
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        )}
                      >
                        {days}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Özel Gün Sayısı</label>
                  <input
                    type="number"
                    min="1"
                    max="730"
                    value={extendDays}
                    onChange={(e) => setExtendDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    Yeni bitiş tarihi: <strong>{formatDateTR(new Date(selectedSubscription.endDate.getTime() + extendDays * 24 * 60 * 60 * 1000))}</strong>
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowExtendModal(false)
                      setExtendDays(30)
                    }}
                  >
                    İptal
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={extendSubscription}
                    disabled={actionLoading || extendDays <= 0}
                  >
                    {actionLoading ? (
                      <Icons.spinner className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CalendarPlus className="h-4 w-4 mr-2" />
                    )}
                    Uzat
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
