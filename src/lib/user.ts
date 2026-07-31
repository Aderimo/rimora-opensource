import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface UserProfile {
    uid: string
    email: string | null
    displayName?: string
    photoURL?: string
    bio?: string
    role?: string
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId))

        if (userDoc.exists()) {
            const data = userDoc.data()
            return {
                uid: userDoc.id,
                email: data.email || null, // Mail gizliliği UI tarafında yönetilecek
                displayName: data.displayName,
                photoURL: data.photoURL,
                bio: data.bio,
                role: data.role
            }
        }
        return null
    } catch (error) {
        console.error('Error fetching user profile:', error)
        return null
    }
}
