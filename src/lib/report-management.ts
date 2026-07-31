// Şikayet/Rapor Yönetim Sistemi
import { db } from './firebase'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { logAdminAction } from './roles'

export type ReportCategory = 'spam' | 'inappropriate' | 'harassment' | 'copyright' | 'scam' | 'adult' | 'other'
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical'
export type ReportStatus = 'new' | 'reviewing' | 'under_review' | 'resolved' | 'rejected' | 'appealed'

export interface UserReport {
    id: string
    reporterId: string
    reporterName: string
    targetUserId?: string
    targetUsername?: string
    contentId?: string
    contentType?: 'user' | 'video' | 'comment' | 'message'
    category: ReportCategory
    description: string
    evidence?: string // İlgili link veya açıklama
    priority: ReportPriority
    status: ReportStatus
    createdAt: Date
    reviewedBy?: string
    reviewedAt?: Date
    resolution?: string
    autoAction?: boolean
    actionTaken?: 'warning' | 'mute' | 'ban' | 'delete' | 'none'
}

export interface ReportStats {
    totalReports: number
    newReports: number
    reviewingReports: number
    resolvedReports: number
    rejectedReports: number
    byCategory: Record<ReportCategory, number>
    byPriority: Record<ReportPriority, number>
}

// Raporta oluştur
export async function createReport(
    reporterId: string,
    reporterName: string,
    targetUserId: string | null,
    targetUsername: string | null,
    category: ReportCategory,
    description: string,
    contentId?: string,
    evidence?: string
): Promise<string> {
    try {
        const reportId = `report_${Date.now()}`
        
        // Priority otomatik hesapla
        const priority = calculatePriority(category, description)

        await setDoc(doc(db, 'reports', reportId), {
            id: reportId,
            reporterId,
            reporterName,
            targetUserId: targetUserId || null,
            targetUsername: targetUsername || null,
            contentId: contentId || null,
            contentType: contentId ? 'content' : 'user',
            category,
            description,
            evidence: evidence || null,
            priority,
            status: 'new',
            createdAt: serverTimestamp(),
            autoAction: false
        })

        // Activity log
        await logAdminAction(reporterId, 'create_report', targetUserId || 'unknown', {
            category,
            priority
        })

        return reportId
    } catch (error) {
        console.error('Error creating report:', error)
        throw error
    }
}

// Priority otomatik hesapla (AI-style rules)
function calculatePriority(category: ReportCategory, description: string): ReportPriority {
    // Critical kategoriler
    if (['adult', 'copyright'].includes(category)) return 'critical'
    
    // High kategoriler
    if (['harassment', 'scam'].includes(category)) return 'high'
    
    // Açıklama içeriğine göre
    const urgentKeywords = ['acid', 'threat', 'violence', 'harm', 'danger']
    if (urgentKeywords.some(keyword => description.toLowerCase().includes(keyword))) {
        return 'high'
    }
    
    // Varsayılan
    return category === 'spam' ? 'low' : 'medium'
}

// Raporu gözden geç
export async function reviewReport(
    reportId: string,
    reviewedBy: string,
    status: ReportStatus,
    resolution?: string,
    actionTaken?: 'warning' | 'mute' | 'ban' | 'delete' | 'none'
): Promise<void> {
    try {
        const reportRef = doc(db, 'reports', reportId)
        const reportSnap = await getDoc(reportRef)
        
        if (!reportSnap.exists()) {
            throw new Error('Report not found')
        }

        await updateDoc(reportRef, {
            status,
            reviewedBy,
            reviewedAt: serverTimestamp(),
            resolution: resolution || null,
            actionTaken: actionTaken || 'none'
        })

        // Activity log
        await logAdminAction(reviewedBy, 'review_report', reportSnap.data().targetUserId || 'unknown', {
            status,
            actionTaken
        })
    } catch (error) {
        console.error('Error reviewing report:', error)
        throw error
    }
}

// Otomatik kategorize ve öneri sistemi
export async function getAutoSuggestedAction(reportId: string): Promise<{
    suggestedAction: 'warning' | 'mute' | 'ban' | 'delete' | 'none'
    confidence: number
    reasoning: string
}> {
    try {
        const reportRef = doc(db, 'reports', reportId)
        const reportSnap = await getDoc(reportRef)
        
        if (!reportSnap.exists()) {
            throw new Error('Report not found')
        }

        const report = reportSnap.data() as UserReport

        // Kurallar
        if (report.category === 'adult') {
            return {
                suggestedAction: 'ban',
                confidence: 0.95,
                reasoning: 'Yetişkinlik içeriği - anında ban önerilir'
            }
        }

        if (report.priority === 'critical') {
            return {
                suggestedAction: 'ban',
                confidence: 0.85,
                reasoning: 'Kritik öncelik - ban önerilir'
            }
        }

        if (['harassment', 'scam'].includes(report.category)) {
            return {
                suggestedAction: 'warning',
                confidence: 0.8,
                reasoning: `${report.category === 'harassment' ? 'Taciz' : 'Dolandırıcılık'} - uyarı önerilir`
            }
        }

        if (report.category === 'spam') {
            return {
                suggestedAction: 'mute',
                confidence: 0.75,
                reasoning: 'Spam içeriği - geçici susturma önerilir'
            }
        }

        return {
            suggestedAction: 'none',
            confidence: 0.5,
            reasoning: 'Otomatik tavsiye kullanılamıyor - manuel inceleme gerekli'
        }
    } catch (error) {
        console.error('Error getting auto suggestion:', error)
        return {
            suggestedAction: 'none',
            confidence: 0,
            reasoning: 'Hata oluştu'
        }
    }
}

// Raporları filtrele
export async function getReports(
    filters?: {
        status?: ReportStatus
        priority?: ReportPriority
        category?: ReportCategory
        limit?: number
    }
): Promise<UserReport[]> {
    try {
        let q = query(
            collection(db, 'reports'),
            orderBy('createdAt', 'desc'),
            limit(filters?.limit || 50)
        )

        const snapshot = await getDocs(q)
        let reports = snapshot.docs.map(doc => ({
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            reviewedAt: doc.data().reviewedAt?.toDate() || null
        })) as UserReport[]

        // Client-side filtrele
        if (filters?.status) {
            reports = reports.filter(r => r.status === filters.status)
        }
        if (filters?.priority) {
            reports = reports.filter(r => r.priority === filters.priority)
        }
        if (filters?.category) {
            reports = reports.filter(r => r.category === filters.category)
        }

        return reports
    } catch (error) {
        console.error('Error getting reports:', error)
        return []
    }
}

// Rapor istatistikleri
export async function getReportStats(): Promise<ReportStats> {
    try {
        const allReports = await getReports({ limit: 1000 })

        const stats: ReportStats = {
            totalReports: allReports.length,
            newReports: allReports.filter(r => r.status === 'new').length,
            reviewingReports: allReports.filter(r => r.status === 'reviewing' || r.status === 'under_review').length,
            resolvedReports: allReports.filter(r => r.status === 'resolved').length,
            rejectedReports: allReports.filter(r => r.status === 'rejected').length,
            byCategory: {
                spam: allReports.filter(r => r.category === 'spam').length,
                inappropriate: allReports.filter(r => r.category === 'inappropriate').length,
                harassment: allReports.filter(r => r.category === 'harassment').length,
                copyright: allReports.filter(r => r.category === 'copyright').length,
                scam: allReports.filter(r => r.category === 'scam').length,
                adult: allReports.filter(r => r.category === 'adult').length,
                other: allReports.filter(r => r.category === 'other').length
            },
            byPriority: {
                low: allReports.filter(r => r.priority === 'low').length,
                medium: allReports.filter(r => r.priority === 'medium').length,
                high: allReports.filter(r => r.priority === 'high').length,
                critical: allReports.filter(r => r.priority === 'critical').length
            }
        }

        return stats
    } catch (error) {
        console.error('Error getting report stats:', error)
        return {
            totalReports: 0,
            newReports: 0,
            reviewingReports: 0,
            resolvedReports: 0,
            rejectedReports: 0,
            byCategory: {
                spam: 0,
                inappropriate: 0,
                harassment: 0,
                copyright: 0,
                scam: 0,
                adult: 0,
                other: 0
            },
            byPriority: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0
            }
        }
    }
}
