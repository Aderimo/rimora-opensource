import { getUserList } from './user-lists'
import type { Media, MediaType } from '@/types'

interface UserPreferences {
  favoriteGenres: number[]
  watchedMediaIds: number[]
  favoriteMediaIds: number[]
  preferredTypes: MediaType[]
}

// Analyze user preferences from their lists
export async function analyzeUserPreferences(userId: string): Promise<UserPreferences> {
  // Return empty preferences if no userId
  if (!userId) {
    return {
      favoriteGenres: [],
      watchedMediaIds: [],
      favoriteMediaIds: [],
      preferredTypes: ['movie', 'tv'],
    }
  }
  
  try {
    const [favorites, watched, watchlist] = await Promise.all([
      getUserList(userId, 'favorites').catch(() => []),
      getUserList(userId, 'watched').catch(() => []),
      getUserList(userId, 'watchlist').catch(() => []),
    ])
    
    const allItems = [...favorites, ...watched, ...watchlist]
    
    // Count media types
    const typeCounts: Record<MediaType, number> = { movie: 0, tv: 0, anime: 0 }
    allItems.forEach(item => {
      typeCounts[item.mediaType]++
    })
    
    // Get preferred types (sorted by count)
    const preferredTypes = (Object.entries(typeCounts) as [MediaType, number][])
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0)
      .map(([type]) => type)
    
    return {
      favoriteGenres: [],
      watchedMediaIds: watched.map(w => w.mediaId),
      favoriteMediaIds: favorites.map(f => f.mediaId),
      preferredTypes: preferredTypes.length > 0 ? preferredTypes : ['movie', 'tv'],
    }
  } catch (error) {
    // Silently fail and return empty preferences
    return {
      favoriteGenres: [],
      watchedMediaIds: [],
      favoriteMediaIds: [],
      preferredTypes: ['movie', 'tv'],
    }
  }
}

// Fetch similar media via API route
async function fetchSimilarMedia(mediaId: number, type: 'movie' | 'tv'): Promise<Media[]> {
  try {
    const res = await fetch(`/api/tmdb/similar?id=${mediaId}&type=${type}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  } catch (error) {
    console.error('Error fetching similar media:', error)
    return []
  }
}

// Get personalized recommendations
export async function getPersonalizedRecommendations(
  userId: string,
  limitCount: number = 20
): Promise<Media[]> {
  try {
    const preferences = await analyzeUserPreferences(userId)
    const recommendations: Media[] = []
    
    // Get recommendations based on favorites
    for (const mediaId of preferences.favoriteMediaIds.slice(0, 3)) {
      const type = preferences.preferredTypes[0] === 'anime' ? 'tv' : preferences.preferredTypes[0]
      const similar = await fetchSimilarMedia(mediaId, type as 'movie' | 'tv')
      recommendations.push(...similar)
    }
    
    // Filter out already watched/favorited
    const excludeIds = new Set([...preferences.watchedMediaIds, ...preferences.favoriteMediaIds])
    const filtered = recommendations.filter(m => !excludeIds.has(m.id))
    
    // Remove duplicates and limit
    const unique = Array.from(new Map(filtered.map(m => [m.id, m])).values())
    return unique.slice(0, limitCount)
  } catch (error) {
    console.error('Error getting recommendations:', error)
    return []
  }
}

// Get trending recommendations (fallback for new users)
export async function getTrendingRecommendations(limitCount: number = 20): Promise<Media[]> {
  try {
    const res = await fetch('/api/tmdb/trending')
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).slice(0, limitCount)
  } catch (error) {
    console.error('Error fetching trending:', error)
    return []
  }
}

// Get recommendations for user (personalized or trending)
export async function getRecommendationsForUser(
  userId: string | null,
  limitCount: number = 20
): Promise<Media[]> {
  if (userId) {
    const personalized = await getPersonalizedRecommendations(userId, limitCount)
    if (personalized.length >= 5) {
      return personalized
    }
  }
  
  // Fallback to trending
  return getTrendingRecommendations(limitCount)
}

// Get "Because you watched X" recommendations
export async function getBecauseYouWatched(
  userId: string,
  limitCount: number = 10
): Promise<{ basedOn: string; items: Media[] }[]> {
  if (!userId) return []
  
  try {
    const watched = await getUserList(userId, 'watched').catch(() => [])
    if (watched.length === 0) return []
    
    const results: { basedOn: string; items: Media[] }[] = []
    
    for (const item of watched.slice(0, 3)) {
      const type = item.mediaType === 'anime' ? 'tv' : item.mediaType
      const similar = await fetchSimilarMedia(item.mediaId, type as 'movie' | 'tv')
      
      if (similar.length > 0) {
        results.push({
          basedOn: item.title,
          items: similar.slice(0, limitCount),
        })
      }
    }
    
    return results
  } catch (error) {
    // Silently fail
    return []
  }
}
