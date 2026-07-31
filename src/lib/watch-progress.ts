'use client'

import { 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase'

export interface WatchProgress {
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

// Alias for backward compatibility
export type WatchProgressItem = WatchProgress

// Save watch progress
export async function saveWatchProgress(
  userId: string,
  data: Omit<WatchProgress, 'id' | 'updatedAt'>
): Promise<void> {
  const progressId = data.mediaType === 'movie' 
    ? `${data.mediaId}` 
    : `${data.mediaId}_s${data.season}_e${data.episode}`
  
  const docRef = doc(db, 'users', userId, 'watchProgress', progressId)
  
  await setDoc(docRef, {
    ...data,
    id: progressId,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

// Get watch progress for a specific media
export async function getWatchProgress(
  userId: string,
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime',
  season?: number,
  episode?: number
): Promise<WatchProgress | null> {
  const progressId = mediaType === 'movie' 
    ? `${mediaId}` 
    : `${mediaId}_s${season}_e${episode}`
  
  const docRef = doc(db, 'users', userId, 'watchProgress', progressId)
  const docSnap = await getDoc(docRef)
  
  if (docSnap.exists()) {
    return docSnap.data() as WatchProgress
  }
  return null
}

// Get continue watching list
export async function getContinueWatching(
  userId: string,
  limitCount: number = 10
): Promise<WatchProgress[]> {
  const progressRef = collection(db, 'users', userId, 'watchProgress')
  const q = query(
    progressRef,
    where('progress', '<', 95), // Not finished
    where('progress', '>', 5),  // Started watching
    orderBy('progress', 'desc'),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  )
  
  try {
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => doc.data() as WatchProgress)
  } catch (error) {
    // Fallback query without compound index
    const simpleQuery = query(
      progressRef,
      orderBy('updatedAt', 'desc'),
      limit(limitCount * 2)
    )
    const snapshot = await getDocs(simpleQuery)
    return snapshot.docs
      .map(doc => doc.data() as WatchProgress)
      .filter(p => p.progress > 5 && p.progress < 95)
      .slice(0, limitCount)
  }
}

// Get last watched episode for a TV show
export async function getLastWatchedEpisode(
  userId: string,
  mediaId: number
): Promise<{ season: number; episode: number } | null> {
  const progressRef = collection(db, 'users', userId, 'watchProgress')
  const q = query(
    progressRef,
    where('mediaId', '==', mediaId),
    orderBy('updatedAt', 'desc'),
    limit(1)
  )
  
  try {
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data() as WatchProgress
      return {
        season: data.season || 1,
        episode: data.episode || 1
      }
    }
  } catch (error) {
    console.error('Error getting last watched:', error)
  }
  return null
}

// Format time for display
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Format remaining time
export function formatRemainingTime(currentTime: number, duration: number): string {
  const remaining = duration - currentTime
  return formatTime(remaining)
}


// Get all watch progress for a user (for history page)
export async function getUserWatchProgress(
  userId: string,
  limitCount: number = 50
): Promise<WatchProgress[]> {
  const progressRef = collection(db, 'users', userId, 'watchProgress')
  const q = query(
    progressRef,
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  )
  
  try {
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        ...data,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date()
      } as WatchProgress
    })
  } catch (error) {
    console.error('Error getting watch progress:', error)
    return []
  }
}

// Delete a specific watch progress entry
export async function deleteWatchProgress(
  userId: string,
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime',
  season?: number,
  episode?: number
): Promise<void> {
  const progressId = mediaType === 'movie' 
    ? `${mediaId}` 
    : `${mediaId}_s${season || 1}_e${episode || 1}`
  
  const docRef = doc(db, 'users', userId, 'watchProgress', progressId)
  await deleteDoc(docRef)
}

// Clear all watch progress for a user
export async function clearAllWatchProgress(userId: string): Promise<void> {
  const progressRef = collection(db, 'users', userId, 'watchProgress')
  const snapshot = await getDocs(progressRef)
  
  const batch = writeBatch(db)
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref)
  })
  
  await batch.commit()
}
