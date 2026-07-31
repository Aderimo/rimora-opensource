import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    updateDoc,
    increment,
    writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import type { MediaType } from '@/types'

export interface Review {
    id: string
    userId: string
    mediaId: number
    mediaType: MediaType
    rating: number // 1-10
    content?: string
    spoiler: boolean
    likes: number
    createdAt: Date
    updatedAt?: Date
    user?: {
        displayName: string
        photoURL: string
    }
}

// Add or Update Review
export async function addReview(
    userId: string,
    mediaId: number,
    mediaType: MediaType,
    rating: number,
    content: string = '',
    spoiler: boolean = false
): Promise<void> {
    const reviewId = `${userId}_${mediaType}_${mediaId}`
    const reviewRef = doc(db, 'reviews', reviewId)

    // Use a batch to update both the review and media stats (optional, but good for aggregation)
    // For now, simple setDoc
    await setDoc(reviewRef, {
        userId,
        mediaId,
        mediaType,
        rating,
        content,
        spoiler,
        likes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true })
}

// Get Reviews for Media
export async function getReviews(
    mediaId: number,
    mediaType: MediaType,
    lastVisible?: any
): Promise<{ reviews: Review[], lastDoc: any }> {
    // Base query
    // Base query without orderBy to avoid index issues
    let q = query(
        collection(db, 'reviews'),
        where('mediaId', '==', mediaId),
        where('mediaType', '==', mediaType),
        // orderBy('createdAt', 'desc'), // Removing this to fix index error
        limit(50) // Increased limit since we do client side sorting
    )

    if (lastVisible) {
        q = query(q, startAfter(lastVisible))
    }

    const snapshot = await getDocs(q)

    // Need to fetch user details for each review
    let reviews = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data()
        // Fetch user
        const userSnap = await getDoc(doc(db, 'users', data.userId))
        const userData = userSnap.exists() ? userSnap.data() : null

        return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            user: userData ? {
                displayName: userData.displayName,
                photoURL: userData.photoURL
            } : undefined
        } as Review
    }))

    // Client-side sort
    reviews = reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return {
        reviews,
        lastDoc: snapshot.docs[snapshot.docs.length - 1]
    }
}

// Get Specific User's Review
export async function getUserReview(
    userId: string,
    mediaId: number,
    mediaType: MediaType
): Promise<Review | null> {
    const reviewId = `${userId}_${mediaType}_${mediaId}`
    const docRef = doc(db, 'reviews', reviewId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
        return {
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate() || new Date()
        } as Review
    }
    return null
}

// Delete Review
export async function deleteReview(reviewId: string): Promise<void> {
    await deleteDoc(doc(db, 'reviews', reviewId))
}

// Toggle Like (Simplistic implementation)
export async function toggleReviewLike(reviewId: string, userId: string): Promise<boolean> {
    const likeRef = doc(db, 'reviews', reviewId, 'likes', userId)
    const likeSnap = await getDoc(likeRef)

    const batch = writeBatch(db)
    const reviewRef = doc(db, 'reviews', reviewId)

    if (likeSnap.exists()) {
        batch.delete(likeRef)
        batch.update(reviewRef, { likes: increment(-1) })
        await batch.commit()
        return false
    } else {
        batch.set(likeRef, { createdAt: serverTimestamp() })
        batch.update(reviewRef, { likes: increment(1) })
        await batch.commit()
        return true
    }
}
