/**
 * User Statistics Library
 * 
 * Kullanıcı istatistiklerini yönetmek için yardımcı fonksiyonlar
 * 
 * @requirements 11.1 - İstatistikleri gerçek watchProgress verilerinden hesaplamalı
 * @requirements 11.3 - Kullanıcı istatistik sayfasını açtığında gerçek verileri göstermeli
 */

'use client'

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * User stats document interface
 */
export interface UserStats {
  totalWatchTime: number        // dakika cinsinden
  moviesWatched: number
  episodesWatched: number
  animesWatched: number
  favoriteGenres: Array<{
    genreId: number
    genreName: string
    watchTime: number
  }>
  weeklyStats: Array<{
    week: string               // "2024-W03" formatında
    watchTime: number
    itemsWatched: number
  }>
  dailyStats: Array<{
    date: string               // "2024-01-15" formatında
    watchTime: number
    itemsWatched: number
  }>
  lastUpdated: Timestamp | null
}

/**
 * Watch progress item interface
 */
interface WatchProgressItem {
  id: string
  mediaId: number
  mediaType: 'movie' | 'tv' | 'anime'
  title: string
  currentTime: number // seconds
  duration: number // seconds
  progress: number // percentage 0-100
  updatedAt: Timestamp
}

/**
 * Get ISO week number from date
 */
function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}

/**
 * Get date string in YYYY-MM-DD format
 */
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get user stats from Firestore userStats collection
 * Falls back to calculating from watchProgress if not available
 * 
 * @requirements 11.3 - Kullanıcı istatistik sayfasını açtığında gerçek verileri göstermeli
 */
export async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    // First try to get cached stats from userStats collection
    const statsRef = doc(db, 'userStats', userId)
    const statsSnap = await getDoc(statsRef)

    if (statsSnap.exists()) {
      const data = statsSnap.data()
      return {
        totalWatchTime: data.totalWatchTime || 0,
        moviesWatched: data.moviesWatched || 0,
        episodesWatched: data.episodesWatched || 0,
        animesWatched: data.animesWatched || 0,
        favoriteGenres: data.favoriteGenres || [],
        weeklyStats: data.weeklyStats || [],
        dailyStats: data.dailyStats || [],
        lastUpdated: data.lastUpdated || null,
      }
    }

    // If no cached stats, calculate from watchProgress
    return await calculateStatsFromWatchProgress(userId)

  } catch (error) {
    console.error('Error getting user stats:', error)
    return null
  }
}

/**
 * Calculate stats directly from watchProgress collection
 * Used as fallback when userStats is not available
 * 
 * @requirements 11.1 - İstatistikleri gerçek watchProgress verilerinden hesaplamalı
 * @requirements 11.4 - Mock/rastgele veri kullanmamalı
 */
export async function calculateStatsFromWatchProgress(userId: string): Promise<UserStats> {
  try {
    const progressRef = collection(db, 'users', userId, 'watchProgress')
    const q = query(progressRef, orderBy('updatedAt', 'desc'), limit(1000))

    const snapshot = await getDocs(q)
    const watchItems = snapshot.docs.map(doc => doc.data() as WatchProgressItem)

    // Initialize counters
    let totalWatchTime = 0 // in minutes
    let moviesWatched = 0
    let episodesWatched = 0
    let animesWatched = 0

    // Track unique media IDs
    const uniqueMovies = new Set<number>()
    const uniqueEpisodes = new Set<string>()
    const uniqueAnimes = new Set<string>()

    // Genre statistics map
    const genreStats = new Map<string, { count: number; watchTime: number }>()

    // Weekly and daily stats maps
    const weeklyMap = new Map<string, { watchTime: number; itemsWatched: number }>()
    const dailyMap = new Map<string, { watchTime: number; itemsWatched: number }>()

    // Process each watch progress item
    for (const item of watchItems) {
      // Calculate watch time in minutes
      const watchedMinutes = Math.round(item.currentTime / 60)
      totalWatchTime += watchedMinutes

      // Count by media type (only count if progress > 50% as "watched")
      const isWatched = item.progress >= 50

      if (item.mediaType === 'movie') {
        if (isWatched && !uniqueMovies.has(item.mediaId)) {
          uniqueMovies.add(item.mediaId)
          moviesWatched++
        }
        // Track genres from item if available
        if (item.genres) {
          for (const genre of item.genres) {
            const stats = genreStats.get(genre) || { count: 0, watchTime: 0 }
            stats.count += isWatched ? 1 : 0
            stats.watchTime += watchedMinutes
            genreStats.set(genre, stats)
          }
        }
      } else if (item.mediaType === 'anime') {
        const animeKey = `${item.mediaId}_s${item.season || 1}_e${item.episode || 1}`
        if (isWatched && !uniqueAnimes.has(animeKey)) {
          uniqueAnimes.add(animeKey)
          animesWatched++
        }
        // Add "Anime" as a genre
        const stats = genreStats.get('Anime') || { count: 0, watchTime: 0 }
        stats.count += isWatched ? 1 : 0
        stats.watchTime += watchedMinutes
        genreStats.set('Anime', stats)
      } else {
        // TV show episode
        const episodeKey = `${item.mediaId}_s${item.season || 1}_e${item.episode || 1}`
        if (isWatched && !uniqueEpisodes.has(episodeKey)) {
          uniqueEpisodes.add(episodeKey)
          episodesWatched++
        }
        // Track genres from item if available
        if (item.genres) {
          for (const genre of item.genres) {
            const stats = genreStats.get(genre) || { count: 0, watchTime: 0 }
            stats.count += isWatched ? 1 : 0
            stats.watchTime += watchedMinutes
            genreStats.set(genre, stats)
          }
        }
      }

      // Calculate weekly and daily stats
      if (item.updatedAt) {
        const date = item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt as string | number)

        // Weekly stats
        const weekKey = getWeekNumber(date)
        const weekStats = weeklyMap.get(weekKey) || { watchTime: 0, itemsWatched: 0 }
        weekStats.watchTime += watchedMinutes
        weekStats.itemsWatched += 1
        weeklyMap.set(weekKey, weekStats)

        // Daily stats
        const dayKey = getDateString(date)
        const dayStats = dailyMap.get(dayKey) || { watchTime: 0, itemsWatched: 0 }
        dayStats.watchTime += watchedMinutes
        dayStats.itemsWatched += 1
        dailyMap.set(dayKey, dayStats)
      }
    }

    // Convert maps to arrays and sort
    const weeklyStats = Array.from(weeklyMap.entries())
      .map(([week, stats]) => ({ week, ...stats }))
      .sort((a, b) => b.week.localeCompare(a.week))
      .slice(0, 12) // Last 12 weeks

    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30) // Last 30 days

    // Calculate favorite genres from stats
    const favoriteGenres = Array.from(genreStats.entries())
      .sort((a, b) => b[1].watchTime - a[1].watchTime)
      .slice(0, 5)
      .map(([genreName, stats], index) => ({
        genreId: index + 1, // Generate pseudo ID
        genreName,
        watchTime: stats.watchTime
      }))

    return {
      totalWatchTime,
      moviesWatched,
      episodesWatched,
      animesWatched,
      favoriteGenres,
      weeklyStats,
      dailyStats,
      lastUpdated: null,
    }

  } catch (error) {
    console.error('Error calculating stats from watch progress:', error)
    // Return empty stats instead of mock data
    return {
      totalWatchTime: 0,
      moviesWatched: 0,
      episodesWatched: 0,
      animesWatched: 0,
      favoriteGenres: [],
      weeklyStats: [],
      dailyStats: [],
      lastUpdated: null,
    }
  }
}

/**
 * Trigger stats calculation via API
 * Can be called from client-side to refresh stats
 */
export async function refreshUserStats(userId: string): Promise<UserStats | null> {
  try {
    const response = await fetch('/api/stats/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      throw new Error('Stats calculation failed')
    }

    const data = await response.json()
    return data.stats || null

  } catch (error) {
    console.error('Error refreshing user stats:', error)
    return null
  }
}

/**
 * Format watch time for display
 */
export function formatWatchTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} gün ${hours % 24} saat`
  }
  if (hours > 0) {
    return `${hours} saat ${minutes % 60} dk`
  }
  return `${minutes} dakika`
}

/**
 * Get day name in Turkish
 */
export function getDayName(dateString: string): string {
  const date = new Date(dateString)
  const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
  return days[date.getDay()]
}

/**
 * Get week range string
 */
export function getWeekRange(weekString: string): string {
  // Parse week string like "2024-W03"
  const [year, weekPart] = weekString.split('-W')
  const weekNum = parseInt(weekPart, 10)

  // Calculate first day of the week
  const firstDayOfYear = new Date(parseInt(year, 10), 0, 1)
  const daysOffset = (weekNum - 1) * 7
  const firstDayOfWeek = new Date(firstDayOfYear.getTime() + daysOffset * 24 * 60 * 60 * 1000)

  // Adjust to Monday
  const dayOfWeek = firstDayOfWeek.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  firstDayOfWeek.setDate(firstDayOfWeek.getDate() + diff)

  // Calculate last day of the week
  const lastDayOfWeek = new Date(firstDayOfWeek)
  lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6)

  const formatDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

  return `${formatDate(firstDayOfWeek)} - ${formatDate(lastDayOfWeek)}`
}
