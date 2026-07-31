/**
 * Stats Calculate API Endpoint
 * 
 * Kullanıcı istatistiklerini watchProgress verilerinden hesaplar
 * ve userStats collection'a kaydeder.
 * 
 * Cloud Functions yerine Next.js API route olarak implement edildi.
 * Vercel Cron Jobs, admin panel veya client-side'dan tetiklenebilir.
 * 
 * @requirements 11.1 - İstatistikleri gerçek watchProgress verilerinden hesaplamalı
 * @requirements 11.2 - Günlük/haftalık özet oluşturmalı
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * User stats document interface
 * Matches design.md userStats collection schema
 */
interface UserStatsDocument {
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
  lastUpdated: Timestamp | ReturnType<typeof serverTimestamp>
}

/**
 * Watch progress item from Firestore
 */
interface WatchProgressItem {
  id: string
  mediaId: number
  mediaType: 'movie' | 'tv' | 'anime'
  title: string
  posterPath: string | null
  season?: number
  episode?: number
  episodeName?: string
  currentTime: number // seconds
  duration: number // seconds
  progress: number // percentage 0-100
  updatedAt: Timestamp
}

/**
 * API Response interface
 */
interface StatsResponse {
  success: boolean
  message?: string
  error?: string
  stats?: UserStatsDocument
  userId?: string
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
 * Calculate user statistics from watchProgress data
 * 
 * @requirements 11.1 - İstatistikleri gerçek watchProgress verilerinden hesaplamalı
 */
async function calculateUserStats(userId: string): Promise<UserStatsDocument> {
  // Get all watch progress for user
  const progressRef = collection(db, 'users', userId, 'watchProgress')
  const q = query(progressRef, orderBy('updatedAt', 'desc'), limit(1000))
  
  const snapshot = await getDocs(q)
  const watchItems = snapshot.docs.map(doc => doc.data() as WatchProgressItem)
  
  // Initialize counters
  let totalWatchTime = 0 // in minutes
  let moviesWatched = 0
  let episodesWatched = 0
  let animesWatched = 0
  
  // Track unique media IDs to avoid double counting
  const uniqueMovies = new Set<number>()
  const uniqueEpisodes = new Set<string>()
  const uniqueAnimes = new Set<string>()
  
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
    } else if (item.mediaType === 'anime') {
      const animeKey = `${item.mediaId}_s${item.season || 1}_e${item.episode || 1}`
      if (isWatched && !uniqueAnimes.has(animeKey)) {
        uniqueAnimes.add(animeKey)
        animesWatched++
      }
    } else {
      // TV show episode
      const episodeKey = `${item.mediaId}_s${item.season || 1}_e${item.episode || 1}`
      if (isWatched && !uniqueEpisodes.has(episodeKey)) {
        uniqueEpisodes.add(episodeKey)
        episodesWatched++
      }
    }
    
    // Calculate weekly and daily stats
    if (item.updatedAt) {
      const date = item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt as any)
      
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
  
  return {
    totalWatchTime,
    moviesWatched,
    episodesWatched,
    animesWatched,
    favoriteGenres: [], // Genre hesaplaması için watch_history'deki içeriklerin TMDB genre bilgileri gerekli
    weeklyStats,
    dailyStats,
    lastUpdated: serverTimestamp(),
  }
}

/**
 * Save user stats to Firestore
 * 
 * @requirements 11.2 - userStats collection güncelleme
 */
async function saveUserStats(userId: string, stats: UserStatsDocument): Promise<void> {
  const statsRef = doc(db, 'userStats', userId)
  await setDoc(statsRef, stats, { merge: true })
}

/**
 * Verify API secret key for protected endpoints
 */
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') || 
                 request.headers.get('authorization')?.replace('Bearer ', '')
  
  const expectedKey = process.env.STATS_API_SECRET_KEY
  
  // If no secret key is configured, allow requests (development mode)
  if (!expectedKey) {
    console.warn('STATS_API_SECRET_KEY not configured - allowing all requests')
    return true
  }
  
  return apiKey === expectedKey
}

/**
 * POST /api/stats/calculate
 * 
 * Calculate and save user statistics
 * 
 * Body:
 * - userId: string (required) - User ID to calculate stats for
 * 
 * Headers:
 * - x-api-key or Authorization: Bearer <key> - API secret key
 * 
 * @requirements 11.1 - İstatistikleri gerçek watchProgress verilerinden hesaplamalı
 * @requirements 11.2 - Günlük/haftalık özet oluşturmalı
 */
export async function POST(request: NextRequest): Promise<NextResponse<StatsResponse>> {
  try {
    // Verify API key
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim', },
        { status: 401 }
      )
    }
    
    // Parse request body
    let body: { userId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Geçersiz JSON formatı' },
        { status: 400 }
      )
    }
    
    // Validate userId
    const { userId } = body
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'userId gerekli' },
        { status: 400 }
      )
    }
    
    // Calculate stats
    console.log(`Calculating stats for user: ${userId}`)
    const stats = await calculateUserStats(userId)
    
    // Save to Firestore
    await saveUserStats(userId, stats)
    
    console.log(`Stats calculated and saved for user: ${userId}`, {
      totalWatchTime: stats.totalWatchTime,
      moviesWatched: stats.moviesWatched,
      episodesWatched: stats.episodesWatched,
      animesWatched: stats.animesWatched,
    })
    
    return NextResponse.json({
      success: true,
      message: 'İstatistikler başarıyla hesaplandı',
      userId,
      stats,
    })
    
  } catch (error) {
    console.error('Stats calculation error:', error)
    return NextResponse.json(
      { success: false, error: 'İstatistik hesaplama hatası' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stats/calculate
 * 
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: 'Stats calculation endpoint is active',
    timestamp: new Date().toISOString(),
  })
}
