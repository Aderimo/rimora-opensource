import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  addDoc
} from 'firebase/firestore'
import { db } from './firebase'

export interface UserProfile {
  uid: string
  displayName: string
  photoURL: string | null
  bio?: string
  email?: string
  createdAt?: Date
}

export interface Follow {
  id: string
  followerId: string
  followingId: string
  followerName: string
  followingName: string
  createdAt: Date
}

// Get user profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (!userDoc.exists()) return null

    const data = userDoc.data()
    return {
      uid: userDoc.id,
      displayName: data.displayName || 'Kullanıcı',
      photoURL: data.photoURL || null,
      bio: data.bio,
      email: data.email,
      createdAt: data.createdAt?.toDate(),
    }
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}

// Follow a user
export async function followUser(
  followerId: string,
  followingId: string,
  followerName: string
): Promise<void> {
  if (followerId === followingId) return

  // Get following user's name
  const followingUser = await getUserProfile(followingId)
  if (!followingUser) throw new Error('User not found')

  const followId = `${followerId}_${followingId}`
  
  await setDoc(doc(db, 'follows', followId), {
    followerId,
    followingId,
    followerName,
    followingName: followingUser.displayName,
    createdAt: serverTimestamp(),
  })

  // Create notification for the followed user
  await addDoc(collection(db, 'notifications'), {
    userId: followingId,
    type: 'follow',
    title: 'Yeni Takipçi',
    message: `${followerName} sizi takip etmeye başladı`,
    data: {
      followerId,
      followerName,
    },
    read: false,
    createdAt: serverTimestamp(),
  })
}

// Unfollow a user
export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const followId = `${followerId}_${followingId}`
  await deleteDoc(doc(db, 'follows', followId))
}

// Check if user is following another user
export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  if (followerId === followingId) return false

  try {
    const followId = `${followerId}_${followingId}`
    const followDoc = await getDoc(doc(db, 'follows', followId))
    return followDoc.exists()
  } catch (error) {
    console.error('Error checking follow status:', error)
    return false
  }
}

// Get follow counts
export async function getFollowCounts(userId: string): Promise<{
  followers: number
  following: number
}> {
  try {
    const [followersSnapshot, followingSnapshot] = await Promise.all([
      getDocs(query(
        collection(db, 'follows'),
        where('followingId', '==', userId)
      )),
      getDocs(query(
        collection(db, 'follows'),
        where('followerId', '==', userId)
      ))
    ])

    return {
      followers: followersSnapshot.size,
      following: followingSnapshot.size,
    }
  } catch (error) {
    console.error('Error getting follow counts:', error)
    return { followers: 0, following: 0 }
  }
}

// Get user's followers
export async function getFollowers(
  userId: string,
  limitCount: number = 20
): Promise<Follow[]> {
  try {
    const q = query(
      collection(db, 'follows'),
      where('followingId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Follow[]
  } catch (error) {
    console.error('Error getting followers:', error)
    return []
  }
}

// Get users that user is following
export async function getFollowing(
  userId: string,
  limitCount: number = 20
): Promise<Follow[]> {
  try {
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Follow[]
  } catch (error) {
    console.error('Error getting following:', error)
    return []
  }
}

// Search users globally
export async function searchUsersGlobal(
  searchTerm: string,
  currentUserId?: string,
  limitCount: number = 20
): Promise<UserProfile[]> {
  if (!searchTerm.trim()) return []

  try {
    const searchLower = searchTerm.toLowerCase()
    
    // Search by displayName
    const q = query(
      collection(db, 'users'),
      where('displayName', '>=', searchTerm),
      where('displayName', '<=', searchTerm + '\uf8ff'),
      limit(limitCount)
    )

    const snapshot = await getDocs(q)
    
    return snapshot.docs
      .map(doc => ({
        uid: doc.id,
        displayName: doc.data().displayName || 'Kullanıcı',
        photoURL: doc.data().photoURL || null,
        bio: doc.data().bio,
        email: doc.data().email,
        createdAt: doc.data().createdAt?.toDate(),
      }))
      .filter(user => 
        user.uid !== currentUserId &&
        user.displayName.toLowerCase().includes(searchLower)
      )
      .slice(0, limitCount)
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

// Get share URL for media
export function getShareUrl(mediaType: string, mediaId: number): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rimora.com'
  const path = mediaType === 'movie' ? 'filmler' : mediaType === 'anime' ? 'animeler' : 'diziler'
  return `${baseUrl}/${path}/${mediaId}`
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      textArea.remove()
      return success
    }
  } catch (error) {
    console.error('Error copying to clipboard:', error)
    return false
  }
}