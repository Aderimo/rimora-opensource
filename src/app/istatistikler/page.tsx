'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { 
  getUserStats, 
  calculateStatsFromWatchProgress,
  formatWatchTime,
  type UserStats 
} from '@/lib/user-stats'

/**
 * Watch stats interface for UI display
 * @requirements 11.3 - Kullanıcı istatistik sayfasını açtığında gerçek verileri göstermeli
 * @requirements 11.4 - Mock/rastgele veri kullanmamalı
 */
interface WatchStats {
  totalWatchTime: number // minutes
  moviesWatched: number
  episodesWatched: number
  animeWatched: number
  favoriteGenre: string
  weeklyData: { day: string; minutes: number }[]
  monthlyData: { month: string; minutes: number }[]
}

export default function StatsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<WatchStats | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/giris')
      return
    }
    loadStats()
  }, [user, router])

  /**
   * Load user statistics from real watchProgress data
   * @requirements 11.1 - İstatistikleri gerçek watchProgress verilerinden hesaplamalı
   * @requirements 11.3 - Kullanıcı istatistik sayfasını açtığında gerçek verileri göstermeli
   * @requirements 11.4 - Mock/rastgele veri kullanmamalı
   */
  const loadStats = async () => {
    if (!user) return
    
    try {
      // Get real stats from userStats collection or calculate from watchProgress
      const userStats = await getUserStats(user.uid)
      
      if (!userStats) {
        // If no stats available, calculate directly from watchProgress
        const calculatedStats = await calculateStatsFromWatchProgress(user.uid)
        processStats(calculatedStats)
      } else {
        processStats(userStats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
      // Set empty stats on error - NO mock data
      setStats({
        totalWatchTime: 0,
        moviesWatched: 0,
        episodesWatched: 0,
        animeWatched: 0,
        favoriteGenre: '-',
        weeklyData: [],
        monthlyData: [],
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Process UserStats into display format
   * Converts dailyStats to weekly view and generates monthly aggregation
   */
  const processStats = (userStats: UserStats) => {
    // Generate weekly data from dailyStats (last 7 days)
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
    const today = new Date()
    const weeklyData: { day: string; minutes: number }[] = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayStats = userStats.dailyStats.find(d => d.date === dateStr)
      
      weeklyData.push({
        day: days[date.getDay()],
        minutes: dayStats?.watchTime || 0
      })
    }
    
    // Generate monthly data from weeklyStats
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    const monthlyMap = new Map<number, number>()
    
    // Aggregate weekly stats into months
    userStats.weeklyStats.forEach(week => {
      // Parse week string like "2024-W03"
      const [, weekPart] = week.week.split('-W')
      const weekNum = parseInt(weekPart, 10)
      
      // Estimate month from week number (approximate)
      const monthIndex = Math.min(11, Math.floor((weekNum - 1) / 4.33))
      const currentTotal = monthlyMap.get(monthIndex) || 0
      monthlyMap.set(monthIndex, currentTotal + week.watchTime)
    })
    
    // Also aggregate from daily stats for more accuracy
    userStats.dailyStats.forEach(day => {
      const date = new Date(day.date)
      const monthIndex = date.getMonth()
      const currentTotal = monthlyMap.get(monthIndex) || 0
      monthlyMap.set(monthIndex, currentTotal + day.watchTime)
    })
    
    const currentMonth = new Date().getMonth()
    const monthlyData = monthNames.slice(0, currentMonth + 1).map((month, index) => ({
      month,
      minutes: monthlyMap.get(index) || 0
    }))
    
    // Get favorite genre
    const favoriteGenre = userStats.favoriteGenres.length > 0 
      ? userStats.favoriteGenres[0].genreName 
      : '-'
    
    setStats({
      totalWatchTime: userStats.totalWatchTime,
      moviesWatched: userStats.moviesWatched,
      episodesWatched: userStats.episodesWatched,
      animeWatched: userStats.animesWatched,
      favoriteGenre,
      weeklyData,
      monthlyData,
    })
  }

  // Use formatWatchTime from user-stats library
  const formatTime = formatWatchTime

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Icons.chart className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Giriş Yapın</h1>
        <p className="text-muted-foreground mb-4">İstatistiklerinizi görmek için giriş yapmalısınız.</p>
        <Link href="/giris">
          <Button>Giriş Yap</Button>
        </Link>
      </div>
    )
  }

  const maxWeekly = Math.max(...stats.weeklyData.map(d => d.minutes))
  const maxMonthly = Math.max(...stats.monthlyData.map(d => d.minutes))

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">İzleme İstatistikleri</h1>
            <p className="text-muted-foreground mt-1">İzleme alışkanlıklarınızı keşfedin</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icons.clock className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatTime(stats.totalWatchTime)}</p>
            <p className="text-sm text-muted-foreground">Toplam İzleme</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Icons.film className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats.moviesWatched}</p>
            <p className="text-sm text-muted-foreground">Film İzlendi</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Icons.tv className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats.episodesWatched}</p>
            <p className="text-sm text-muted-foreground">Bölüm İzlendi</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                <Icons.anime className="h-5 w-5 text-pink-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats.animeWatched}</p>
            <p className="text-sm text-muted-foreground">Anime İzlendi</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Weekly Chart */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-6">Bu Hafta</h3>
            <div className="flex items-end justify-between gap-2 h-40">
              {stats.weeklyData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-primary/20 rounded-t-lg relative overflow-hidden"
                    style={{ height: `${(data.minutes / maxWeekly) * 100}%`, minHeight: '8px' }}
                  >
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-lg transition-all"
                      style={{ height: '100%' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{data.day}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Bu hafta toplam <span className="text-foreground font-medium">
                  {formatTime(stats.weeklyData.reduce((a, b) => a + b.minutes, 0))}
                </span> izlediniz
              </p>
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-6">Bu Yıl</h3>
            <div className="flex items-end justify-between gap-1 h-40">
              {stats.monthlyData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-gradient-to-t from-purple-500 to-pink-500 rounded-t-lg opacity-80"
                    style={{ height: `${(data.minutes / maxMonthly) * 100}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-muted-foreground">{data.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Bu yıl toplam <span className="text-foreground font-medium">
                  {formatTime(stats.monthlyData.reduce((a, b) => a + b.minutes, 0))}
                </span> izlediniz
              </p>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="mt-6 bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Özet</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {Math.round(stats.totalWatchTime / 60 / 24)}
              </p>
              <p className="text-sm text-muted-foreground">Gün</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {stats.moviesWatched + stats.episodesWatched + stats.animeWatched}
              </p>
              <p className="text-sm text-muted-foreground">Toplam İçerik</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {Math.round(stats.totalWatchTime / 7)}
              </p>
              <p className="text-sm text-muted-foreground">Günlük Ort. (dk)</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xl font-bold text-primary">{stats.favoriteGenre}</p>
              <p className="text-sm text-muted-foreground">Favori Tür</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
