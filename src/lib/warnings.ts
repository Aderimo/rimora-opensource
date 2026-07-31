// Uyarı ve Ceza Sistemi
import { db } from './firebase'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, orderBy, increment } from 'firebase/firestore'
import { logAdminAction } from './roles'

export type WarningType = 'spam' | 'inappropriate' | 'harassment' | 'copyright' | 'other'
export type ActionType = 'warning' | 'mute' | 'ban'

export interface UserWarning {
    id: string
    userId: string
    username: string
    reason: string
    type: WarningType
    issuedBy: string
    issuedAt: Date
    expiresAt?: Date | null // null = kalıcı
    status: 'active' | 'resolved' | 'appealed'
}

export interface UserAction {
    userId: string
    type: ActionType // 'warning', 'mute', 'ban'
    reason: string
    issuedBy: string
    issuedAt: Date
    expiresAt?: Date | null
    duration?: number // minutes
    autoRevoke?: boolean
}

export interface UserPenalty {
    userId: string
    warningCount: number
    muteCount: number
    banCount: number
    lastWarningAt?: Date
    appealable: boolean
}

// Warning verme
export async function issueWarning(
    userId: string,
    username: string,
    reason: string,
    type: WarningType,
    issuedBy: string,
    durationHours?: number,
    isAuto: boolean = false
): Promise<void> {
    try {
        const warningId = `warning_${Date.now()}`
        const expiresAt = durationHours 
            ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
            : null

        // Warning belgesi oluştur
        await setDoc(doc(db, 'warnings', warningId), {
            id: warningId,
            userId,
            username,
            reason,
            type,
            issuedBy,
            issuedAt: serverTimestamp(),
            expiresAt: expiresAt,
            status: 'active',
            isAuto: isAuto,
            warningCount: 1
        })

        // Kullanıcının warning sayısını artır
        const penaltyRef = doc(db, 'penalties', userId)
        await updateDoc(penaltyRef, {
            warningCount: increment(1),
            lastWarningAt: serverTimestamp()
        }).catch(async () => {
            // Eğer penalty doc yoksa oluştur
            await setDoc(penaltyRef, {
                userId,
                warningCount: 1,
                muteCount: 0,
                banCount: 0,
                lastWarningAt: serverTimestamp(),
                appealable: true
            })
        })

        // Activity log
        await logAdminAction(issuedBy, 'issue_warning', userId, { 
            reason, 
            type,
            duration: durationHours
        })
    } catch (error) {
        console.error('Error issuing warning:', error)
        throw error
    }
}

// Mute işlemi
export async function muteUser(
    userId: string,
    username: string,
    reason: string,
    durationMinutes: number,
    issuedBy: string,
    isAuto: boolean = false
): Promise<void> {
    try {
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)

        // Mute action oluştur
        await setDoc(doc(db, 'mutes', `${userId}_${Date.now()}`), {
            userId,
            username,
            reason,
            issuedBy,
            issuedAt: serverTimestamp(),
            expiresAt,
            durationMinutes: durationMinutes,
            duration: durationMinutes,
            isAuto: isAuto
        })

        // Kullanıcı belgesine mute flag ekle
        const userRef = doc(db, 'users', userId)
        await updateDoc(userRef, {
            isMuted: true,
            muteExpiresAt: expiresAt
        })

        // Penalty güncelle
        const penaltyRef = doc(db, 'penalties', userId)
        await updateDoc(penaltyRef, {
            muteCount: increment(1)
        }).catch(async () => {
            await setDoc(penaltyRef, {
                userId,
                warningCount: 0,
                muteCount: 1,
                banCount: 0,
                appealable: true
            })
        })

        // Activity log
        await logAdminAction(issuedBy, 'mute_user', userId, { 
            reason,
            duration: durationMinutes
        })
    } catch (error) {
        console.error('Error muting user:', error)
        throw error
    }
}

// Ban işlemi
export async function banUser(
    userId: string,
    username: string,
    reason: string,
    permanent: boolean = false,
    durationDays?: number,
    issuedBy?: string,
    isAuto: boolean = false
): Promise<void> {
    try {
        const expiresAt = permanent 
            ? null 
            : new Date(Date.now() + (durationDays || 7) * 24 * 60 * 60 * 1000)

        // Ban belgesi oluştur
        await setDoc(doc(db, 'bans', userId), {
            userId,
            username,
            reason,
            issuedBy: issuedBy || 'system',
            issuedAt: serverTimestamp(),
            expiresAt,
            permanent,
            duration: durationDays,
            durationDays: durationDays,
            isAuto: isAuto
        })

        // Kullanıcıyı deactivate et
        const userRef = doc(db, 'users', userId)
        await updateDoc(userRef, {
            isBanned: true,
            banExpiresAt: expiresAt
        })

        // Penalty güncelle
        const penaltyRef = doc(db, 'penalties', userId)
        await updateDoc(penaltyRef, {
            banCount: increment(1),
            appealable: !permanent
        }).catch(async () => {
            await setDoc(penaltyRef, {
                userId,
                warningCount: 0,
                muteCount: 0,
                banCount: 1,
                appealable: !permanent
            })
        })

        // Activity log
        await logAdminAction(issuedBy || 'system', 'ban_user', userId, { 
            reason,
            permanent,
            duration: durationDays
        })
    } catch (error) {
        console.error('Error banning user:', error)
        throw error
    }
}

// Mute kaldır
export async function unmuteUser(userId: string, unmutedBy: string): Promise<void> {
    try {
        const userRef = doc(db, 'users', userId)
        await updateDoc(userRef, {
            isMuted: false,
            muteExpiresAt: null
        })

        await logAdminAction(unmutedBy, 'unmute_user', userId, {})
    } catch (error) {
        console.error('Error unmuting user:', error)
        throw error
    }
}

// Ban kaldır
export async function unbanUser(userId: string, unbannedBy: string): Promise<void> {
    try {
        const userRef = doc(db, 'users', userId)
        await updateDoc(userRef, {
            isBanned: false,
            banExpiresAt: null
        })

        await logAdminAction(unbannedBy, 'unban_user', userId, {})
    } catch (error) {
        console.error('Error unbanning user:', error)
        throw error
    }
}

// Kullanıcının warning'lerini al
export async function getUserWarnings(userId: string): Promise<UserWarning[]> {
    try {
        const q = query(
            collection(db, 'warnings'),
            where('userId', '==', userId),
            orderBy('issuedAt', 'desc')
        )
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            issuedAt: doc.data().issuedAt?.toDate() || new Date(),
            expiresAt: doc.data().expiresAt?.toDate() || null
        })) as UserWarning[]
    } catch (error) {
        console.error('Error getting user warnings:', error)
        return []
    }
}

// Aktivite logu al
export async function getUserPenalties(userId: string): Promise<UserPenalty | null> {
    try {
        const doc_ref = doc(db, 'penalties', userId)
        const snapshot = await getDoc(doc_ref)
        if (snapshot.exists()) {
            return {
                userId,
                ...snapshot.data()
            } as UserPenalty
        }
        return null
    } catch (error) {
        console.error('Error getting user penalties:', error)
        return null
    }
}

// Otomatik warning kuralları (custom rules)
export async function checkAutoActions(userId: string): Promise<void> {
    try {
        const penalties = await getUserPenalties(userId)
        if (!penalties) return

        // 3 warning → 1 saat mute
        if (penalties.warningCount >= 3 && penalties.warningCount < 5) {
            const mutes = await getDocs(
                query(
                    collection(db, 'mutes'),
                    where('userId', '==', userId)
                )
            )
            if (mutes.size === 0) {
                await muteUser(userId, '', 'Otomatik sistem (3 uyarı)', 60, 'system', true)
            }
        }

        // 5 warning → 1 gün ban
        if (penalties.warningCount >= 5) {
            const bans = await getDocs(
                query(
                    collection(db, 'bans'),
                    where('userId', '==', userId)
                )
            )
            if (bans.size === 0) {
                await banUser(userId, '', 'Otomatik sistem (5 uyarı)', false, 1, 'system', true)
            }
        }
    } catch (error) {
        console.error('Error checking auto actions:', error)
    }
}
