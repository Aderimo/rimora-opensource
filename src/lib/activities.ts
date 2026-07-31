import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import type { MediaType } from '@/types'

export type ActivityType = 'watch' | 'favorite' | 'watchlist' | 'comment' | 'rating' | 'follow'

export interface Activity {
  id: string
  userId: string
  userName: string
  userPhoto: string | null
  type: ActivityType
  mediaId?: number
  mediaType?: MediaType
  mediaTitle?: string
  mediaPoster?: string
  targetUserId?: string
  targetUserName?: string
  rating?: number
  comment?: string
  createdAt: Date
}

// Create activity
export async function createActivity(
  userId: string,
  userName: string,
  userPhoto: string | null,
  type: ActivityType,
  data?: {
    mediaId?: number
    mediaType?: MediaType
    mediaTitle?: string
    mediaPoster?: string
    targetUserId?: string
    targetUserName?: string
    rating?: number
    comment?: string
  }
): Promise<void> {
  const docRef = doc(collection(db, 'activities'))
  
  await setDoc(docRef, {
    userId,
    userName,
    userPhoto,
    type,
    mediaId: data?.mediaId || null,
    mediaType: data?.mediaType || null,
    mediaTitle: data?.mediaTitle || null,
    mediaPoster: data?.mediaPoster || null,
    targetUserId: data?.targetUserId || null,
    targetUserName: data?.targetUserName || null,
    rating: data?.rating || null,
    comment: data?.comment || null,
    createdAt: serverTimestamp(),
  })
}

// Get user activities
export async function getUserActivities(
  userId: string,
  limitCount: number = 20
): Promise<Activity[]> {
  const q = query(
    collection(db, 'activities'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
  })) as Activity[]
}

// Get feed (activities from followed users)
export async function getFeedActivities(
  followingIds: string[],
  limitCount: number = 30
): Promise<Activity[]> {
  if (followingIds.length === 0) return []
  
  // Firestore 'in' query limit is 30
  const chunks = []
  for (let i = 0; i < followingIds.length; i += 30) {
    chunks.push(followingIds.slice(i, i + 30))
  }
  
  const allActivities: Activity[] = []
  
  for (const chunk of chunks) {
    const q = query(
      collection(db, 'activities'),
      where('userId', 'in', chunk),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    
    const snapshot = await getDocs(q)
    const activities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Activity[]
    
    allActivities.push(...activities)
  }
  
  // Sort by date and limit
  return allActivities
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limitCount)
}
