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
  where, 
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { 
  Users, 
  Eye, 
  CreditCard, 
  TrendingUp,
  TrendingDown,
  Activity,
  Film,
  Tv,
  PlayCircle,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react'

interface AnalyticsData {
  users: {
    total: number
    newThisWeek: number
    newThisMonth: number
    activeToday: number
  }
  content: {
    totalViews: number
    viewsThisWeek: number
    avgWatchTime: number
    popularContent: Array<{
      id: string
      title: string
      type: string
      views: number
    }>
  }
  subscriptions: {
    active: number
    cancelled: number
    expired: number
    trial: number
    monthlyRevenue: number
    churnRate: number
  }
}


// Basit çizgi grafik komponenti
function LineChart({ data, label, color = 'primary' }: { 
  data: number[]
  label: string
  color?: 'primary' | 'green' | 'purple' | 'orange'
}) {
  const max = Math.max(...data, 1)
  const colorClasses = {
    primary: 'stroke-primary fill-primary/10',
    green: 'stroke-green-500 fill-green-500/10',
    purple: 'stroke-purple-500 fill-purple-500/10',
    orange: 'stroke-orange-500 fill-orange-500/10'
  }
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - (value / max) * 80
    return `${x},${y}`
  }).join(' ')
  
  const areaPoints = `0,100 ${points} 100,100`
  
  return (
    <div className="w-full">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <svg viewBox="0 0 100 100" className="w-full h-24" preserveAspectRatio="none">
        <polygon 
          points={areaPoints} 
          className={colorClasses[color]}
          strokeWidth="0"
        />
        <polyline 
          points={points} 
          fill="none" 
          className={colorClasses[color]}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>7 gün önce</span>
        <span>Bugün</span>
      </div>
    </div>
  )
}


// Basit bar grafik komponenti
function BarChart({ data, labels, color = 'primary' }: { 
  data: number[]
  labels: string[]
  color?: 'primary' | 'green' | 'purple' | 'orange'
}) {
  const max = Math.max(...data, 1)
  const colorClasses = {
    primary: 'bg-primary',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  }
  
  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-2 h-32">
        {data.map((value, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-medium">{value}</span>
            <div 
              className={cn('w-full rounded-t transition-all', colorClasses[color])}
              style={{ height: `${(value / max) * 100}%`, minHeight: '4px' }}
            />
            <span className="text-xs text-muted-foreground truncate w-full text-center">
              {labels[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Basit pasta grafik komponenti
function DonutChart({ data, colors, labels }: { 
  data: number[]
  colors: string[]
  labels: string[]
}) {
  const total = data.reduce((a, b) => a + b, 0) || 1
  let currentAngle = 0
  
  const segments = data.map((value, index) => {
    const percentage = (value / total) * 100
    const angle = (value / total) * 360
    const startAngle = currentAngle
    currentAngle += angle
    
    const startRad = (startAngle - 90) * (Math.PI / 180)
    const endRad = (currentAngle - 90) * (Math.PI / 180)
    
    const x1 = 50 + 40 * Math.cos(startRad)
    const y1 = 50 + 40 * Math.sin(startRad)
    const x2 = 50 + 40 * Math.cos(endRad)
    const y2 = 50 + 40 * Math.sin(endRad)
    
    const largeArc = angle > 180 ? 1 : 0
    
    return {
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[index],
      label: labels[index],
      value,
      percentage: percentage.toFixed(1)
    }
  })
  
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment.path}
            fill={segment.color}
            className="transition-all hover:opacity-80"
          />
        ))}
        <circle cx="50" cy="50" r="25" className="fill-card" />
      </svg>
      <div className="flex-1 space-y-2">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="flex-1 text-muted-foreground">{segment.label}</span>
            <span className="font-medium">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function AnalyticsDashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    users: { total: 0, newThisWeek: 0, newThisMonth: 0, activeToday: 0 },
    content: { totalViews: 0, viewsThisWeek: 0, avgWatchTime: 0, popularContent: [] },
    subscriptions: { active: 0, cancelled: 0, expired: 0, trial: 0, monthlyRevenue: 0, churnRate: 0 }
  })
  const [weeklyUserData, setWeeklyUserData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [weeklyViewData, setWeeklyViewData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])

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


  // Analitik verilerini yükle
  const loadAnalytics = useCallback(async () => {
    if (!isAdmin) return
    
    setDataLoading(true)
    try {
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      // Kullanıcı verileri
      const usersSnap = await getDocs(collection(db, 'users'))
      let newThisWeek = 0
      let newThisMonth = 0
      let activeToday = 0
      const dailyNewUsers: number[] = [0, 0, 0, 0, 0, 0, 0]
      
      usersSnap.docs.forEach(doc => {
        const data = doc.data()
        const createdAt = data.createdAt?.toDate()
        const lastActive = data.lastActive?.toDate() || data.lastLogin?.toDate()
        
        if (createdAt) {
          if (createdAt >= oneWeekAgo) {
            newThisWeek++
            // Hangi güne ait olduğunu hesapla
            const dayIndex = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
            if (dayIndex >= 0 && dayIndex < 7) {
              dailyNewUsers[6 - dayIndex]++
            }
          }
          if (createdAt >= oneMonthAgo) {
            newThisMonth++
          }
        }
        
        if (lastActive && lastActive >= todayStart) {
          activeToday++
        }
      })
      
      setWeeklyUserData(dailyNewUsers)
      
      // Abonelik verileri
      const subsSnap = await getDocs(collection(db, 'subscriptions'))
      let active = 0
      let cancelled = 0
      let expired = 0
      let trial = 0
      let monthlyRevenue = 0
      
      subsSnap.docs.forEach(doc => {
        const data = doc.data()
        const status = data.status
        
        switch (status) {
          case 'active':
            active++
            monthlyRevenue += data.price || 0
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
      
      const totalSubs = active + cancelled + expired + trial
      const churnRate = totalSubs > 0 ? ((cancelled + expired) / totalSubs) * 100 : 0

      
      // İzleme verileri (watchProgress)
      let totalViews = 0
      let viewsThisWeek = 0
      let totalWatchTime = 0
      const dailyViews: number[] = [0, 0, 0, 0, 0, 0, 0]
      const contentViewCounts: Record<string, { title: string; type: string; views: number }> = {}
      
      try {
        const watchSnap = await getDocs(collection(db, 'watchProgress'))
        
        watchSnap.docs.forEach(doc => {
          const data = doc.data()
          totalViews++
          totalWatchTime += data.watchedDuration || data.currentTime || 0
          
          const updatedAt = data.updatedAt?.toDate() || data.lastWatched?.toDate()
          if (updatedAt && updatedAt >= oneWeekAgo) {
            viewsThisWeek++
            const dayIndex = Math.floor((now.getTime() - updatedAt.getTime()) / (24 * 60 * 60 * 1000))
            if (dayIndex >= 0 && dayIndex < 7) {
              dailyViews[6 - dayIndex]++
            }
          }
          
          // Popüler içerikleri say
          const mediaKey = `${data.mediaType}-${data.mediaId}`
          if (!contentViewCounts[mediaKey]) {
            contentViewCounts[mediaKey] = {
              title: data.mediaTitle || `${data.mediaType} #${data.mediaId}`,
              type: data.mediaType || 'unknown',
              views: 0
            }
          }
          contentViewCounts[mediaKey].views++
        })
      } catch (e) {
        console.error('watchProgress koleksiyonu okunamadı:', e)
      }
      
      setWeeklyViewData(dailyViews)
      
      // En popüler içerikleri sırala
      const popularContent = Object.entries(contentViewCounts)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
      
      const avgWatchTime = totalViews > 0 ? Math.round(totalWatchTime / totalViews / 60) : 0
      
      setAnalytics({
        users: {
          total: usersSnap.size,
          newThisWeek,
          newThisMonth,
          activeToday
        },
        content: {
          totalViews,
          viewsThisWeek,
          avgWatchTime,
          popularContent
        },
        subscriptions: {
          active,
          cancelled,
          expired,
          trial,
          monthlyRevenue,
          churnRate: Math.round(churnRate * 10) / 10
        }
      })
    } catch (error) {
      console.error('Analitik yükleme hatası:', error)
    } finally {
      setDataLoading(false)
    }
  }, [isAdmin])

  // Admin olduğunda verileri yükle
  useEffect(() => {
    if (isAdmin) {
      loadAnalytics()
    }
  }, [isAdmin, loadAnalytics])


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

  // Abonelik dağılımı için veriler
  const subscriptionData = [
    analytics.subscriptions.active,
    analytics.subscriptions.trial,
    analytics.subscriptions.cancelled,
    analytics.subscriptions.expired
  ]
  const subscriptionColors = ['#22c55e', '#3b82f6', '#eab308', '#ef4444']
  const subscriptionLabels = ['Aktif', 'Deneme', 'İptal', 'Süresi Dolmuş']

  // Haftalık günler
  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  const today = new Date().getDay()
  const orderedDays = [...weekDays.slice(today), ...weekDays.slice(0, today)]


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
              <h1 className="text-2xl font-bold">Analitik Dashboard</h1>
              <p className="text-muted-foreground text-sm">Platform istatistiklerini ve trendleri izleyin</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => loadAnalytics()}
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

        {dataLoading && !analytics.users.total ? (
          <div className="flex justify-center py-12">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Ana Metrikler */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.users.total.toLocaleString('tr-TR')}</p>
                    <p className="text-xs text-muted-foreground">Toplam Kullanıcı</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.users.activeToday}</p>
                    <p className="text-xs text-muted-foreground">Bugün Aktif</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.content.totalViews.toLocaleString('tr-TR')}</p>
                    <p className="text-xs text-muted-foreground">Toplam İzleme</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">₺{analytics.subscriptions.monthlyRevenue.toLocaleString('tr-TR')}</p>
                    <p className="text-xs text-muted-foreground">Aylık Gelir</p>
                  </div>
                </div>
              </div>
            </div>


            {/* Grafikler Satırı */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Yeni Kullanıcılar Grafiği */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Yeni Kullanıcılar</h3>
                    <p className="text-sm text-muted-foreground">Son 7 gün</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">+{analytics.users.newThisWeek}</span>
                  </div>
                </div>
                <LineChart data={weeklyUserData} label="" color="green" />
              </div>

              {/* İzleme Grafiği */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">İzleme Aktivitesi</h3>
                    <p className="text-sm text-muted-foreground">Son 7 gün</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-500">{analytics.content.viewsThisWeek} izleme</span>
                  </div>
                </div>
                <LineChart data={weeklyViewData} label="" color="purple" />
              </div>
            </div>

            {/* Detaylı İstatistikler */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Kullanıcı İstatistikleri */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">Kullanıcı İstatistikleri</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Toplam Kullanıcı</span>
                    <span className="font-medium">{analytics.users.total.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bu Hafta Yeni</span>
                    <span className="font-medium text-green-500">+{analytics.users.newThisWeek}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bu Ay Yeni</span>
                    <span className="font-medium text-green-500">+{analytics.users.newThisMonth}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bugün Aktif</span>
                    <span className="font-medium">{analytics.users.activeToday}</span>
                  </div>
                </div>
              </div>


              {/* İçerik İstatistikleri */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Film className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold">İçerik İstatistikleri</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Toplam İzleme</span>
                    <span className="font-medium">{analytics.content.totalViews.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bu Hafta İzleme</span>
                    <span className="font-medium">{analytics.content.viewsThisWeek.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ort. İzleme Süresi</span>
                    <span className="font-medium">{analytics.content.avgWatchTime} dk</span>
                  </div>
                </div>
              </div>

              {/* Abonelik İstatistikleri */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold">Abonelik İstatistikleri</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Aktif Abonelik</span>
                    <span className="font-medium text-green-500">{analytics.subscriptions.active}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Deneme</span>
                    <span className="font-medium text-blue-500">{analytics.subscriptions.trial}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Aylık Gelir</span>
                    <span className="font-medium">₺{analytics.subscriptions.monthlyRevenue.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Churn Oranı</span>
                    <span className={cn(
                      'font-medium',
                      analytics.subscriptions.churnRate > 10 ? 'text-red-500' : 'text-green-500'
                    )}>
                      %{analytics.subscriptions.churnRate}
                    </span>
                  </div>
                </div>
              </div>
            </div>


            {/* Alt Satır - Pasta Grafik ve Popüler İçerikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Abonelik Dağılımı */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <PieChart className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Abonelik Dağılımı</h3>
                </div>
                {subscriptionData.some(d => d > 0) ? (
                  <DonutChart 
                    data={subscriptionData}
                    colors={subscriptionColors}
                    labels={subscriptionLabels}
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Henüz abonelik verisi yok
                  </div>
                )}
              </div>

              {/* Popüler İçerikler */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Popüler İçerikler</h3>
                </div>
                {analytics.content.popularContent.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.content.popularContent.map((content, index) => (
                      <div 
                        key={content.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                          index === 0 && 'bg-yellow-500/20 text-yellow-500',
                          index === 1 && 'bg-gray-400/20 text-gray-400',
                          index === 2 && 'bg-orange-600/20 text-orange-600',
                          index > 2 && 'bg-muted text-muted-foreground'
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{content.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {content.type === 'movie' && <Film className="h-3 w-3" />}
                            {content.type === 'tv' && <Tv className="h-3 w-3" />}
                            {content.type === 'anime' && <PlayCircle className="h-3 w-3" />}
                            {content.type}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">{content.views}</p>
                          <p className="text-xs text-muted-foreground">izleme</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Henüz izleme verisi yok
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}