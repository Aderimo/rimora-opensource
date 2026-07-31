// Yetki ve Rol Sistemi
import { db } from './firebase'
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, orderBy } from 'firebase/firestore'

// Yetki seviyeleri (Firestore moderators collection'ı ile uyumlu)
export type UserRole = 'founder' | 'admin' | 'moderator' | 'user'

// Owner email - değişmez
export const OWNER_EMAIL = 'esenyurtcocg65@gmail.com'

// Yetki sıralaması
export const ROLE_HIERARCHY: Record<UserRole, number> = {
    founder: 100,       // Kurucu
    admin: 80,          // Yönetici
    moderator: 60,      // Moderatör
    user: 0,            // Normal Kullanıcı
}

// Yetki bilgileri
export const ROLE_INFO: Record<UserRole, { label: string; color: string; emoji: string }> = {
    founder: { label: 'Kurucu', color: '#FF6B00', emoji: '👑' },
    admin: { label: 'Yönetici', color: '#FF4500', emoji: '⚙️' },
    moderator: { label: 'Moderatör', color: '#8B5CF6', emoji: '🛡️' },
    user: { label: 'Kullanıcı', color: '#6B7280', emoji: '👤' },
}

// Kullanıcı rolünü al (Firestore moderators koleksiyonundan)
export async function getUserRole(userId: string, email?: string): Promise<UserRole> {
    // Owner kontrolü
    if (email === OWNER_EMAIL) {
        return 'founder'
    }

    try {
        const modDoc = await getDoc(doc(db, 'moderators', userId))
        if (modDoc.exists()) {
            const role = modDoc.data().role as UserRole
            // Geçerli rol mi?
            if (role && ROLE_HIERARCHY.hasOwnProperty(role)) {
                return role
            }
        }
    } catch (error) {
        console.error('Error getting user role:', error)
    }

    return 'user'
}

// Rol ata
export async function assignRole(
    targetUserId: string,
    role: UserRole,
    assignedBy: string
): Promise<void> {
    await setDoc(doc(db, 'moderators', targetUserId), {
        role,
        assignedBy,
        assignedAt: serverTimestamp(),
    })

    // Log kaydet
    await logAdminAction(assignedBy, 'assign_role', targetUserId, { role })
}

// Rol kaldır (user'a düşür)
export async function removeRole(targetUserId: string, removedBy: string): Promise<void> {
    await deleteDoc(doc(db, 'moderators', targetUserId))
    await logAdminAction(removedBy, 'remove_role', targetUserId, {})
}

// Yetki kontrolü - belirli bir yetkiye sahip mi?
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

// Owner mı?
export function isOwner(email?: string): boolean {
    return email === OWNER_EMAIL
}

// Admin veya üstü mü?
export function isAdmin(role: UserRole): boolean {
    return hasPermission(role, 'admin')
}

// Moderator veya üstü mü?
export function isModerator(role: UserRole): boolean {
    return hasPermission(role, 'moderator')
}

// ============ BAN SİSTEMİ ============

export interface BanInfo {
    reason: string
    bannedBy: string
    bannedAt: Date
    expiresAt: Date | null // null = kalıcı ban
}

// Kullanıcı banlı mı?
export async function isUserBanned(userId: string): Promise<BanInfo | null> {
    try {
        const banDoc = await getDoc(doc(db, 'bans', userId))
        if (banDoc.exists()) {
            const data = banDoc.data()
            const expiresAt = data.expiresAt?.toDate() || null

            // Süresi dolmuş mu?
            if (expiresAt && expiresAt < new Date()) {
                await deleteDoc(doc(db, 'bans', userId))
                return null
            }

            return {
                reason: data.reason,
                bannedBy: data.bannedBy,
                bannedAt: data.bannedAt?.toDate() || new Date(),
                expiresAt,
            }
        }
    } catch (error) {
        console.error('Error checking ban:', error)
    }
    return null
}

// Kullanıcı banla
export async function banUser(
    targetUserId: string,
    reason: string,
    bannedBy: string,
    durationDays?: number // undefined = kalıcı
): Promise<void> {
    const expiresAt = durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null

    await setDoc(doc(db, 'bans', targetUserId), {
        reason,
        bannedBy,
        bannedAt: serverTimestamp(),
        expiresAt,
    })

    await logAdminAction(bannedBy, 'ban_user', targetUserId, { reason, durationDays })
}

// Ban kaldır
export async function unbanUser(targetUserId: string, unbannedBy: string): Promise<void> {
    await deleteDoc(doc(db, 'bans', targetUserId))
    await logAdminAction(unbannedBy, 'unban_user', targetUserId, {})
}

// ============ ADMIN LOG SİSTEMİ ============

export interface AdminLog {
    id: string
    action: string
    performedBy: string
    targetUser: string
    details: Record<string, unknown>
    timestamp: Date
}

// Admin log kaydet
export async function logAdminAction(
    performedBy: string,
    action: string,
    targetUser: string,
    details: Record<string, unknown>
): Promise<void> {
    try {
        const logRef = doc(collection(db, 'adminLogs'))
        await setDoc(logRef, {
            action,
            performedBy,
            targetUser,
            details,
            timestamp: serverTimestamp(),
        })
    } catch (error) {
        console.error('Error logging admin action:', error)
    }
}

// Admin loglarını getir
export async function getAdminLogs(limit = 50): Promise<AdminLog[]> {
    try {
        const q = query(
            collection(db, 'adminLogs'),
            orderBy('timestamp', 'desc')
        )
        const snapshot = await getDocs(q)
        return snapshot.docs.slice(0, limit).map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as AdminLog[]
    } catch (error) {
        console.error('Error getting admin logs:', error)
        return []
    }
}

// Tüm admin/mod kullanıcıları getir
export async function getStaffMembers(): Promise<{ id: string; role: UserRole }[]> {
    try {
        const q = query(
            collection(db, 'moderators'),
            where('role', 'in', ['moderator', 'admin', 'founder'])
        )
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            role: doc.data().role as UserRole,
        }))
    } catch (error) {
        console.error('Error getting staff members:', error)
        return []
    }
}

// ============ MOD PANEL ERİŞİM KONTROL ============

// Mod paneline erişebilir mi?
export function canAccessModPanel(role: UserRole): boolean {
    return role !== 'user'
}

// ============ KISITLAMALAR SİSTEMİ ============

export interface RoleRestrictions {
    canBanUsers: boolean
    canDeleteContent: boolean
    canModerateChat: boolean
    canViewAnalytics: boolean
    canManageRoles: boolean
    canAccessRoomChat: boolean
}

export const ROLE_RESTRICTIONS: Record<UserRole, RoleRestrictions> = {
    founder: {
        // Kurucunun kısıtlaması yok
        canBanUsers: true,
        canDeleteContent: true,
        canModerateChat: true,
        canViewAnalytics: true,
        canManageRoles: true,
        canAccessRoomChat: true,
    },
    admin: {
        canBanUsers: true,
        canDeleteContent: true,
        canModerateChat: true,
        canViewAnalytics: true,
        canManageRoles: false,
        canAccessRoomChat: true,
    },
    moderator: {
        canBanUsers: true,
        canDeleteContent: true,
        canModerateChat: true,
        canViewAnalytics: false,
        canManageRoles: false,
        canAccessRoomChat: true,
    },
    user: {
        canBanUsers: false,
        canDeleteContent: false,
        canModerateChat: false,
        canViewAnalytics: false,
        canManageRoles: false,
        canAccessRoomChat: false,
    },
}

// Belirli bir yetki var mı?
export function hasRestriction(role: UserRole, permission: keyof RoleRestrictions): boolean {
    return ROLE_RESTRICTIONS[role][permission]
}