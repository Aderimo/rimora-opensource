import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    updateDoc,
    getDoc,
    addDoc,
    onSnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import type { UserRole } from './roles'
import { createNotification } from './notifications'

export type FeedbackType = 'bug' | 'suggestion' | 'account' | 'other'
export type FeedbackStatus = 'pending' | 'reviewing' | 'resolved' | 'unresolved'
export type FeedbackPriority = 'low' | 'medium' | 'high'

export interface FeedbackMessage {
    id: string
    feedbackId: string
    senderId: string
    message: string
    role?: string // 'user' or 'admin' etc.
    createdAt: Date
}

export interface Feedback {
    id: string
    userId: string
    userEmail?: string
    type: FeedbackType
    message: string // Initial message
    status: FeedbackStatus
    priority: FeedbackPriority // Yeni: Priority level
    isClosed?: boolean // true if ticket is closed and can't receive messages
    createdAt: Date
    updatedAt?: Date
    lastMessageAt?: Date
    resolutionNote?: string // Çözüldü/Çözülemedi durumunda açıklama
    resolvedAt?: Date // Çözüm tarihi
    resolvedBy?: string // Çözüm yapan moderatör UID
    modCreated?: boolean // true if ticket was created by moderator against a user
    assignedTo?: string // Ticket'i üstlenen mod UID
    assignedToName?: string // Üstlenen mod'un adı
    user?: {
        displayName: string
        photoURL?: string
        email?: string
    }
}

// Yeni destek talebi oluştur
export async function createFeedback(
    userId: string,
    type: FeedbackType,
    message: string,
    userEmail?: string,
    priority: FeedbackPriority = 'medium'
): Promise<string> {
    const docRef = doc(collection(db, 'feedbacks'))

    // Create main feedback doc
    const feedbackData: any = {
        userId,
        type,
        message,
        status: 'pending',
        priority,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp()
    }

    // Only add userEmail if provided
    if (userEmail) {
        feedbackData.userEmail = userEmail
    }

    await setDoc(docRef, feedbackData)

    // Add initial message to subcollection
    await addDoc(collection(docRef, 'messages'), {
        feedbackId: docRef.id,
        senderId: userId,
        message,
        role: 'user',
        createdAt: serverTimestamp()
    })

    return docRef.id
}

// Mesaj gönder
export async function sendFeedbackMessage(
    feedbackId: string,
    senderId: string,
    message: string,
    role: string = 'user'
): Promise<void> {
    const feedbackRef = doc(db, 'feedbacks', feedbackId)

    // Check if ticket is closed
    const feedbackDoc = await getDoc(feedbackRef)

    if (!feedbackDoc.exists()) {
        throw new Error('Talep bulunamadı')
    }

    if (feedbackDoc.data().isClosed) {
        throw new Error('Bu talep kapalı, yeni mesaj eklenemez')
    }

    // Check write permission
    const feedback = feedbackDoc.data()
    const isFounder = role === 'Kurucu' || role === 'founder'
    const isAssigned = feedback.assignedTo === senderId
    const isOwner = feedback.userId === senderId

    // Only founder, assigned mod, or ticket owner (for user tickets) can write
    if (!isFounder && !isAssigned && !isOwner) {
        throw new Error('Bu talep üzerinde yazma izniniz yok')
    }

    // Add message
    await addDoc(collection(feedbackRef, 'messages'), {
        feedbackId,
        senderId,
        message,
        role,
        createdAt: serverTimestamp()
    })

    // Update parent doc
    await updateDoc(feedbackRef, {
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        // If user replies, maybe change status to pending or reviewing?
        ...(role === 'user' ? { status: 'pending' } : {})
    })
}

// Mesajları getir (realtime için onSnapshot kullanılmalı ama bu fetch için)
export async function getFeedbackMessages(feedbackId: string): Promise<FeedbackMessage[]> {
    const q = query(
        collection(db, 'feedbacks', feedbackId, 'messages'),
        orderBy('createdAt', 'asc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as FeedbackMessage[]
}

// Real-time mesaj listener
export function subscribeToFeedbackMessages(
    feedbackId: string,
    onUpdate: (messages: FeedbackMessage[]) => void
) {
    const q = query(
        collection(db, 'feedbacks', feedbackId, 'messages'),
        orderBy('createdAt', 'asc')
    )

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as FeedbackMessage[]
        onUpdate(messages)
    })
}

// Tüm destek taleplerini getir (Mod için)
export async function getFeedbacks(status?: FeedbackStatus): Promise<Feedback[]> {
    let q = query(collection(db, 'feedbacks'))

    if (status) {
        q = query(collection(db, 'feedbacks'), where('status', '==', status))
    }

    const snapshot = await getDocs(q)

    // Fetch user details for each feedback
    const feedbacks = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data()
        let userData = null

        if (data.userId) {
            try {
                const userDoc = await getDoc(doc(db, 'users', data.userId))
                if (userDoc.exists()) {
                    userData = userDoc.data()
                }
            } catch (e) {
                // Ignore fetch errors
            }
        }

        return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
            lastMessageAt: data.lastMessageAt?.toDate(),
            resolvedAt: data.resolvedAt?.toDate(),
            user: userData ? {
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                email: userData.email
            } : undefined
        } as Feedback
    }))

    // Sort client-side
    return feedbacks.sort((a, b) => (b.lastMessageAt || b.createdAt).getTime() - (a.lastMessageAt || a.createdAt).getTime())
}

// Kullanıcının taleplerini getir
export async function getUserFeedbacks(userId: string): Promise<Feedback[]> {
    const q = query(
        collection(db, 'feedbacks'),
        where('userId', '==', userId)
    )

    const snapshot = await getDocs(q)
    const feedbacks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate(),
        lastMessageAt: doc.data().lastMessageAt?.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
    })) as Feedback[]

    // Sort client-side
    return feedbacks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

// Talep durumunu güncelle
export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
    const docRef = doc(db, 'feedbacks', id)
    await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp()
    })
}

// Talep çöz (resolved/unresolved) + note ekle
export async function resolveFeedback(
    id: string,
    status: 'resolved' | 'unresolved',
    note: string,
    resolvedBy: string
): Promise<void> {
    const docRef = doc(db, 'feedbacks', id)
    await updateDoc(docRef, {
        status,
        isClosed: true, // Close the ticket so no more messages can be added
        resolutionNote: note,
        resolvedAt: serverTimestamp(),
        resolvedBy,
        updatedAt: serverTimestamp()
    })
}

// Mod tarafından kullanıcıya karşı ticket açma
export async function createModTicket(
    targetUserId: string,
    type: FeedbackType,
    message: string,
    modId: string,
    modEmail?: string,
    priority: FeedbackPriority = 'medium'
): Promise<string> {
    const docRef = doc(collection(db, 'feedbacks'))

    const feedbackData: any = {
        userId: targetUserId, // Ticket is about this user
        type,
        message,
        status: 'pending',
        priority,
        modCreated: true, // Flag this as mod-created
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp()
    }

    if (modEmail) {
        feedbackData.modEmail = modEmail
    }

    await setDoc(docRef, feedbackData)

    // Add initial message from moderator
    await addDoc(collection(docRef, 'messages'), {
        feedbackId: docRef.id,
        senderId: modId,
        message,
        role: 'Moderatör',
        createdAt: serverTimestamp()
    })

    // Send notification to the user
    await createNotification(
        targetUserId,
        'ticket_opened',
        'Bir Ticket Açıldı',
        'Moderatör tarafından sizin hakkınızda bir ticket açılmıştır. Detayları görmek için destek bölümünü ziyaret edin.',
        {
            fromUserId: modId
        }
    )

    return docRef.id
}

// Ticket'i üstlen (assign to mod)
export async function assignFeedback(
    id: string,
    modId: string,
    modName: string
): Promise<void> {
    const docRef = doc(db, 'feedbacks', id)
    await updateDoc(docRef, {
        assignedTo: modId,
        assignedToName: modName,
        status: 'reviewing',
        updatedAt: serverTimestamp()
    })
}

// İstatistikler için sayıları getir
export async function getFeedbackStats(): Promise<{ total: number, pending: number, resolved: number }> {
    const snapshot = await getDocs(collection(db, 'feedbacks'))
    const all = snapshot.docs.map(d => d.data())

    return {
        total: all.length,
        pending: all.filter(f => f.status === 'pending').length,
        resolved: all.filter(f => f.status === 'resolved').length
    }
}
