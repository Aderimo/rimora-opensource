'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { type UserRole, ROLE_INFO } from '@/lib/roles'
import { useAdminAuth } from '@/hooks/useAdminAuth'

// Mock Data for Charts (Gerçek veri entegrasyonu ileride yapılabilir)
const REVENUE_DATA = [
  { month: 'Oca', amount: 1200 },
  { month: 'Şub', amount: 1900 },
  { month: 'Mar', amount: 1500 },
  { month: 'Nis', amount: 2800 },
  { month: 'May', amount: 4200 },
  { month: 'Haz', amount: 5600 },
]

// Type definitions
interface RecentUser {
  id: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  createdAt: {
    toDate: () => Date
  } | null
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  
  // Gelişmiş admin yetkilendirme hook'u kullan
  const { isAuthorized, isLoading, role, permissions, checkPermission } = useAdminAuth({
    requiredRole: 'moderator',
    redirectTo: '/'
  })

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    totalRevenue: 24500, // Mock
    pendingRefunds: 0,
  })

  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])

  useEffect(() => {
    if (isAuthorized && !isLoading) {
      loadData()
    }
  }, [isAuthorized, isLoading])

  const loadData = async () => {
    try {
      // Users count
      const usersSnap = await getDocs(collection(db, 'users'))
      const totalUsers = usersSnap.size

      // Premium users (mock logic for now as we don't scan all subs)
      const premiumUsers = Math.floor(totalUsers * 0.15)

      // Pending refunds
      const refundsSnap = await getDocs(query(collection(db, 'refundRequests'), where('status', '==', 'pending')))

      // Recent users
      const recentUsersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5)))
      const recent: RecentUser[] = recentUsersSnap.docs.map(d => ({
        id: d.id,
        displayName: d.data().displayName || null,
        email: d.data().email || null,
        photoURL: d.data().photoURL || null,
        createdAt: d.data().createdAt || null
      }))

      setStats(prev => ({
        ...prev,
        totalUsers,
        premiumUsers,
        pendingRefunds: refundsSnap.size
      }))
      setRecentUsers(recent)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  // Yükleniyor durumu
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Yetkisiz erişim - hook otomatik yönlendirme yapar ama yine de UI gösterelim
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <Icons.shield className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Yetkisiz Erişim</h1>
        <p className="text-muted-foreground mt-2">Bu sayfaya erişim için yönetici yetkisi gerekiyor.</p>
        <Button onClick={() => router.push('/')} variant="link" className="text-white mt-4">Ana Sayfaya Dön</Button>
      </div>
    )
  }

  const roleInfo = ROLE_INFO[role]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Top Bar */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-2 rounded-lg">
              <Icons.shield className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-lg hidden md:block">Rimora Admin</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">Sistem Aktif</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Hoş geldin, {user?.displayName || 'Yönetici'}
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <span style={{ color: roleInfo.color }}>{roleInfo.emoji} {roleInfo.label}</span>
              <span>•</span>
              <span>Bugün neler yapmak istersin?</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline" className="border-white/10 hover:bg-white/5">Siteyi Görüntüle</Button>
            </Link>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            title="Toplam Kullanıcı"
            value={stats.totalUsers}
            icon={Icons.users}
            trend="+12%"
            color="blue"
          />
          <KpiCard
            title="Premium Üyeler"
            value={stats.premiumUsers}
            icon={Icons.crown}
            trend="+5%"
            color="yellow"
          />
          <KpiCard
            title="Tahmini Gelir"
            value={`₺${stats.totalRevenue}`}
            icon={Icons.creditCard}
            trend="+8%"
            color="green"
          />
          <KpiCard
            title="Bekleyen İadeler"
            value={stats.pendingRefunds}
            icon={Icons.refresh}
            alert={stats.pendingRefunds > 0}
            color="red"
          />
        </div>

        {/* Quick Actions Grid */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icons.zap className="h-5 w-5 text-yellow-500" />
          Hızlı İşlemler
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <ActionCard href="/admin/kullanicilar" icon={Icons.users} label="Kullanıcılar" color="bg-blue-500/10 text-blue-500" />
          <ActionCard href="/admin/iadeler" icon={Icons.refresh} label="İadeler" color="bg-red-500/10 text-red-500" count={stats.pendingRefunds} />
          <ActionCard href="/admin/content" icon={Icons.film} label="İçerik" color="bg-purple-500/10 text-purple-500" />
          <ActionCard href="/admin/hatalar" icon={Icons.alertCircle} label="Hatalar" color="bg-orange-500/10 text-orange-500" />
          <ActionCard href="/admin/destek" icon={Icons.help} label="Destek" color="bg-indigo-500/10 text-indigo-500" />
          <ActionCard href="/admin/analytics" icon={Icons.chart} label="Analitik" color="bg-green-500/10 text-green-500" />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-card border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Gelir Analizi</h3>
              <select className="bg-black/20 border border-white/10 rounded-lg text-xs px-2 py-1">
                <option>Son 6 Ay</option>
                <option>Bu Yıl</option>
              </select>
            </div>
            <div className="h-[300px] flex items-end justify-between gap-2 px-2">
              {REVENUE_DATA.map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full">
                  <div
                    className="w-full bg-gradient-to-t from-primary/20 to-primary/60 rounded-t-lg hover:from-primary/40 hover:to-primary/80 transition-all relative group"
                    style={{ height: `${(item.amount / 6000) * 100}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      ₺{item.amount}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-6">Son Katılanlar</h3>
            <div className="space-y-4">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold">
                    {u.displayName?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('tr-TR') : 'Yeni'}
                  </span>
                </div>
              ))}
              {recentUsers.length === 0 && <p className="text-sm text-muted-foreground">Henüz kullanıcı yok</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ title, value, icon: Icon, trend, color, alert }: any) {
  const colors = {
    blue: 'text-blue-500 bg-blue-500/10',
    yellow: 'text-yellow-500 bg-yellow-500/10',
    green: 'text-green-500 bg-green-500/10',
    red: 'text-red-500 bg-red-500/10',
  }

  return (
    <div className={`bg-card border ${alert ? 'border-red-500/50' : 'border-white/10'} rounded-xl p-5 relative overflow-hidden group hover:border-white/20 transition-colors`}>
      {alert && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${colors[color as keyof typeof colors]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="text-green-500 text-xs font-bold bg-green-500/10 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-white">{value}</h3>
      </div>
    </div>
  )
}

function ActionCard({ href, icon: Icon, label, color, count }: any) {
  return (
    <Link href={href}>
      <div className="bg-card border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/5 hover:border-primary/50 transition-all group relative">
        {count > 0 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {count}
          </div>
        )}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="text-sm font-medium text-muted-foreground group-hover:text-white transition-colors">{label}</span>
      </div>
    </Link>
  )
}
