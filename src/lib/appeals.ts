// Appeal (İtiraz) Sistemi
import { db } from './firebase'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, orderBy, increment } from 'firebase/firestore'
import { sendEmailNotification } from './email-notifications'

export type AppealStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'dismissed'
export type AppealReason = 'unfair_decision' | 'incorrect_reason' | 'policy_misunderstanding' | 'other'

export interface UserAppeal {
    id: string
    userId: string
    username: string
    userEmail: string
    banId: string // Ban documentinin ID'si
    reason: AppealReason
    description: string
    evidence?: string // Link veya açıklama
    status: AppealStatus
    createdAt: Date
    reviewedBy?: string
    reviewedAt?: Date
    reviewerNote?: string
    decision?: 'upheld' | 'overturned'
    expiresAt?: Date // Çoktan itiraz etmediyse
}

// İtiraz oluştur
export async function createAppeal(
    userId: string,
    username: string,
    userEmail: string,
    banId: string,
    reason: AppealReason,
    description: string,
    evidence?: string
): Promise<string> {
    try {
        // Son 30 gün içinde aynı ban'a itiraz ettiyse izin verme
        const existingAppeals = await getDocs(
            query(
                collection(db, 'appeals'),
                where('userId', '==', userId),
                where('banId', '==', banId),
                where('status', 'in', ['pending', 'reviewing'])
            )
        )

        if (existingAppeals.size > 0) {
            throw new Error('Bu ban için zaten itiraz etmişsiniz')
        }

        const appealId = `appeal_${Date.now()}`

        await setDoc(doc(db, 'appeals', appealId), {
            id: appealId,
            userId,
            username,
            userEmail,
            banId,
            reason,
            description,
            evidence: evidence || null,
            status: 'pending',
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 gün
        })

        // Moderatörlere bildir
        await setDoc(doc(db, 'adminLogs', `appeal_${Date.now()}`), {
            action: 'create_appeal',
            moderatorId: 'user',
            targetUserId: userId,
            targetUsername: username,
            timestamp: serverTimestamp(),
            details: {
                reason,
                appealId
            }
        })

        return appealId
    } catch (error) {
        console.error('Error creating appeal:', error)
        throw error
    }
}

// İtirazı gözden geçir
export async function reviewAppeal(
    appealId: string,
    reviewedBy: string,
    decision: 'upheld' | 'overturned',
    reviewerNote?: string
): Promise<void> {
    try {
        const appealRef = doc(db, 'appeals', appealId)
        const appealSnap = await getDoc(appealRef)

        if (!appealSnap.exists()) {
            throw new Error('Appeal not found')
        }

        const appeal = appealSnap.data() as UserAppeal
        const newStatus: AppealStatus = decision === 'upheld' ? 'rejected' : 'approved'

        // İtirazı güncelle
        await updateDoc(appealRef, {
            status: newStatus,
            decision,
            reviewedBy,
            reviewedAt: serverTimestamp(),
            reviewerNote: reviewerNote || null
        })

        // Eğer itiraz kabul edildiyse ban'ı kaldır
        if (decision === 'overturned') {
            const banRef = doc(db, 'bans', appeal.banId)
            await updateDoc(banRef, {
                appealed: true,
                appealApprovedAt: serverTimestamp()
            })

            // Kullanıcının ban'ını kaldır
            const userRef = doc(db, 'users', appeal.userId)
            await updateDoc(userRef, {
                isBanned: false,
                banExpiresAt: null
            })
        }

        // Email gönder
        await sendEmailNotification(
            appeal.userId,
            appeal.userEmail,
            'appeal_update',
            undefined,
            undefined,
            decision === 'upheld' ? 'Reddedildi' : 'Kabul Edildi'
        )

        // Activity log
        await setDoc(doc(db, 'adminLogs', `review_appeal_${Date.now()}`), {
            action: 'review_appeal',
            moderatorId: reviewedBy,
            targetUserId: appeal.userId,
            targetUsername: appeal.username,
            timestamp: serverTimestamp(),
            details: {
                decision,
                status: newStatus
            }
        })
    } catch (error) {
        console.error('Error reviewing appeal:', error)
        throw error
    }
}

// İtirazları getir
export async function getAppeals(
    filter?: {
        status?: AppealStatus
        limit?: number
    }
): Promise<UserAppeal[]> {
    try {
        let q = query(
            collection(db, 'appeals'),
            orderBy('createdAt', 'desc')
        )

        const snapshot = await getDocs(q)
        let appeals = snapshot.docs.map(doc => ({
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            reviewedAt: doc.data().reviewedAt?.toDate() || null,
            expiresAt: doc.data().expiresAt?.toDate() || null
        })) as UserAppeal[]

        if (filter?.status) {
            appeals = appeals.filter(a => a.status === filter.status)
        }

        if (filter?.limit) {
            appeals = appeals.slice(0, filter.limit)
        }

        return appeals
    } catch (error) {
        console.error('Error getting appeals:', error)
        return []
    }
}

// Kullanıcının itirazlarını getir
export async function getUserAppeals(userId: string): Promise<UserAppeal[]> {
    try {
        const q = query(
            collection(db, 'appeals'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        )
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            reviewedAt: doc.data().reviewedAt?.toDate() || null,
            expiresAt: doc.data().expiresAt?.toDate() || null
        })) as UserAppeal[]
    } catch (error) {
        console.error('Error getting user appeals:', error)
        return []
    }
}

// İtiraz istatistikleri
export async function getAppealStats(): Promise<{
    pending: number
    reviewing: number
    approved: number
    rejected: number
    total: number
    approvalRate: number
}> {
    try {
        const appeals = await getAppeals({ limit: 1000 })

        const stats = {
            pending: appeals.filter(a => a.status === 'pending').length,
            reviewing: appeals.filter(a => a.status === 'reviewing').length,
            approved: appeals.filter(a => a.status === 'approved').length,
            rejected: appeals.filter(a => a.status === 'rejected').length,
            total: appeals.length,
            approvalRate: appeals.length > 0 
                ? (appeals.filter(a => a.decision === 'overturned').length / appeals.length) * 100
                : 0
        }

        return stats
    } catch (error) {
        console.error('Error getting appeal stats:', error)
        return {
            pending: 0,
            reviewing: 0,
            approved: 0,
            rejected: 0,
            total: 0,
            approvalRate: 0
        }
    }
}

// Süresi geçen itirazları kapat
export async function closeExpiredAppeals(): Promise<void> {
    try {
        const now = new Date()
        const appeals = await getAppeals()

        for (const appeal of appeals) {
            if (appeal.status === 'pending' && appeal.expiresAt && new Date(appeal.expiresAt) < now) {
                await updateDoc(doc(db, 'appeals', appeal.id), {
                    status: 'dismissed'
                })
            }
        }
    } catch (error) {
        console.error('Error closing expired appeals:', error)
    }
}
