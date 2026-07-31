import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy
} from 'firebase/firestore'
import { db } from './firebase'
import type { MediaType } from '@/types'

// export type ListType = 'watchlist' | 'favorites' | 'watched'
export type ListType = string // Allow custom lists

export interface CustomList {
  id: string
  userId: string
  name: string
  slug: string
  createdAt: Date
  itemCount?: number
  isPublic?: boolean
}


export interface UserListItem {
  id: string
  mediaId: number
  mediaType: MediaType
  listType: ListType
  title: string
  posterPath: string | null
  addedAt: Date
}

// Add to list
export async function addToList(
  userId: string,
  mediaId: number,
  mediaType: MediaType,
  listType: ListType,
  title: string,
  posterPath: string | null
): Promise<void> {
  const docId = `${userId}_${mediaType}_${mediaId}_${listType}`
  const docRef = doc(db, 'userLists', docId)

  await setDoc(docRef, {
    userId,
    mediaId,
    mediaType,
    listType,
    title,
    posterPath,
    addedAt: serverTimestamp(),
  })
}

// Remove from list
export async function removeFromList(
  userId: string,
  mediaId: number,
  mediaType: MediaType,
  listType: ListType
): Promise<void> {
  const docId = `${userId}_${mediaType}_${mediaId}_${listType}`
  const docRef = doc(db, 'userLists', docId)
  await deleteDoc(docRef)
}

// Check if in list
export async function isInList(
  userId: string,
  mediaId: number,
  mediaType: MediaType,
  listType: ListType
): Promise<boolean> {
  const docId = `${userId}_${mediaType}_${mediaId}_${listType}`
  const docRef = doc(db, 'userLists', docId)
  const { getDoc } = await import('firebase/firestore')
  const docSnap = await getDoc(docRef)
  return docSnap.exists()
}

// Get user's list
export async function getUserList(
  userId: string,
  listType: ListType
): Promise<UserListItem[]> {
  const q = query(
    collection(db, 'userLists'),
    where('userId', '==', userId),
    where('listType', '==', listType)
  )

  const snapshot = await getDocs(q)
  const items = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    addedAt: doc.data().addedAt?.toDate() || new Date(),
  })) as UserListItem[]

  // Client-side sort
  return items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
}

// Get all lists for a media item
export async function getMediaListStatus(
  userId: string,
  mediaId: number,
  mediaType: MediaType
): Promise<{ watchlist: boolean; favorites: boolean; watched: boolean }> {
  const [watchlist, favorites, watched] = await Promise.all([
    isInList(userId, mediaId, mediaType, 'watchlist'),
    isInList(userId, mediaId, mediaType, 'favorites'),
    isInList(userId, mediaId, mediaType, 'watched'),
  ])

  return { watchlist, favorites, watched }
}

// Toggle list item
export async function toggleListItem(
  userId: string,
  mediaId: number,
  mediaType: MediaType,
  listType: ListType,
  title: string,
  posterPath: string | null
): Promise<boolean> {
  const inList = await isInList(userId, mediaId, mediaType, listType)

  if (inList) {
    await removeFromList(userId, mediaId, mediaType, listType)
    return false
  } else {
    await addToList(userId, mediaId, mediaType, listType, title, posterPath)
    return true
  }
}

// ============ PUBLIC LISTS ============

export async function getPublicListsByUser(userId: string): Promise<CustomList[]> {
  const q = query(
    collection(db, 'customLists'),
    where('userId', '==', userId),
    where('isPublic', '==', true),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as CustomList[]
}

export async function getListById(listId: string): Promise<CustomList | null> {
  const { getDoc } = await import('firebase/firestore')
  const docRef = doc(db, 'customLists', listId)
  const snapshot = await getDoc(docRef)

  if (snapshot.exists()) {
    return {
      id: snapshot.id,
      ...snapshot.data(),
      createdAt: snapshot.data().createdAt?.toDate() || new Date()
    } as CustomList
  }
  return null
}

// ============ CUSTOM LISTS ============

export async function createCustomList(userId: string, name: string): Promise<CustomList> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const docRef = doc(collection(db, 'customLists'))

  await setDoc(docRef, {
    userId,
    name,
    slug,
    createdAt: serverTimestamp(),
  })

  return {
    id: docRef.id,
    userId,
    name,
    slug,
    createdAt: new Date(),
  }
}

export async function getCustomLists(userId: string): Promise<CustomList[]> {
  const q = query(
    collection(db, 'customLists'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as CustomList[]
}

export async function updateCustomList(listId: string, data: { name?: string; isPublic?: boolean; slug?: string }): Promise<void> {
  const { updateDoc } = await import('firebase/firestore')

  // If name changes, we should ideally update slug too, but that breaks links. 
  // For now let's only update name and visibility.
  await updateDoc(doc(db, 'customLists', listId), {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteCustomList(listId: string): Promise<void> {
  // Delete the list metadata
  await deleteDoc(doc(db, 'customLists', listId))

  // TODO: Implement Cloud Function to clean up list items (userLists where listType == slug)
  // Doing it client side is expensive if list is huge.
}

// Get all lists a media item belongs to
export async function getMediaMembership(
  userId: string,
  mediaId: number,
  mediaType: MediaType
): Promise<string[]> {
  const q = query(
    collection(db, 'userLists'),
    where('userId', '==', userId),
    where('mediaId', '==', mediaId),
    where('mediaType', '==', mediaType)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data().listType as string)
}
