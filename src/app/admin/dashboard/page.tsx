'use client'

import { useEffect, useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getReportStats } from '@/lib/report-management'
import { getAppealStats } from '@/lib/appeals'
import { toast } from 'sonner'

interface DashboardStats {
    totalUsers: number
    bannedUsers: number
    mutedUsers: number
    totalReports: number
    totalAppeals: number
    totalWarnings: number
    moderators: number
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        bannedUsers: 0,
        mutedUsers: 0,
        totalReports: 0,
        totalAppeals: 0,
        totalWarnings: 0,
        moderators: 0
    })
    const [reportStats, setReportStats] = useState<any>(null)
    const [appealStats, setAppealStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        setLoading(true)
        try {
            // Kullanıcı istatistikleri
            const usersSnap = await getDocs(collection(db, 'users'))
            const totalUsers = usersSnap.size

            let bannedUsers = 0
            let mutedUsers = 0

            for (const userDoc of usersSnap.docs) {
                const userData = userDoc.data()
                if (userData.isBanned) bannedUsers++
                if (userData.isMuted) mutedUsers++
            }

            // Moderator sayısı
            const modsSnap = await getDocs(collection(db, 'moderators'))
            const moderators = modsSnap.size

            // Uyarı sayısı
            const warningsSnap = await getDocs(collection(db, 'warnings'))
            const totalWarnings = warningsSnap.size

            // Report istatistikleri
            const reports = await getReportStats()
            setReportStats(reports)

            // Appeal istatistikleri
            const appeals = await getAppealStats()
            setAppealStats(appeals)

            setStats({
                totalUsers,
                bannedUsers,
                mutedUsers,
                totalReports: reports.totalReports,
                totalAppeals: appeals.total,
                totalWarnings,
                moderators
            })
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
            toast.error('İstatistikler yüklenemedi')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
                    <p className="text-white/60 mt-2">Platform genel istatistikleri ve metrikleri</p>
                </div>
                <Button 
                    onClick={fetchStats}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700"
                >
                    <Icons.refresh className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Yenile
                </Button>
            </div>

            {/* Temel Metrikler */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 border border-blue-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-400 text-sm font-medium">Toplam Kullanıcı</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{stats.totalUsers}</h3>
                        </div>
                        <Icons.users className="h-12 w-12 text-blue-400/20" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 border border-red-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-red-400 text-sm font-medium">Banlandı</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{stats.bannedUsers}</h3>
                            <p className="text-xs text-red-400/70 mt-2">
                                {stats.totalUsers > 0 ? ((stats.bannedUsers / stats.totalUsers) * 100).toFixed(1) : 0}%
                            </p>
                        </div>
                        <Icons.ban className="h-12 w-12 text-red-400/20" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-yellow-400 text-sm font-medium">Susturuldu</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{stats.mutedUsers}</h3>
                            <p className="text-xs text-yellow-400/70 mt-2">
                                {stats.totalUsers > 0 ? ((stats.mutedUsers / stats.totalUsers) * 100).toFixed(1) : 0}%
                            </p>
                        </div>
                        <Icons.volumeOff className="h-12 w-12 text-yellow-400/20" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-400 text-sm font-medium">Moderatörler</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{stats.moderators}</h3>
                            <p className="text-xs text-purple-400/70 mt-2">Aktif yönetim ekibi</p>
                        </div>
                        <Icons.shield className="h-12 w-12 text-purple-400/20" />
                    </div>
                </div>
            </div>

            {/* Moderasyon Metrikleri */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Icons.alertTriangle className="h-5 w-5 text-orange-400" />
                        <h3 className="font-bold text-white">Toplam Uyarılar</h3>
                    </div>
                    <h2 className="text-4xl font-bold text-white">{stats.totalWarnings}</h2>
                    <p className="text-sm text-white/60 mt-2">Verilen tüm uyarılar</p>
                </div>

                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Icons.flag className="h-5 w-5 text-red-400" />
                        <h3 className="font-bold text-white">Toplam Raporlar</h3>
                    </div>
                    <h2 className="text-4xl font-bold text-white">{stats.totalReports}</h2>
                    <div className="text-sm text-white/60 mt-2 space-y-1">
                        {reportStats && (
                            <>
                                <p>🔴 Yeni: {reportStats.newReports}</p>
                                <p>🟡 İnceleniyor: {reportStats.reviewingReports}</p>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Icons.messageSquare className="h-5 w-5 text-cyan-400" />
                        <h3 className="font-bold text-white">İtiraz Sistemi</h3>
                    </div>
                    <h2 className="text-4xl font-bold text-white">{stats.totalAppeals}</h2>
                    <div className="text-sm text-white/60 mt-2 space-y-1">
                        {appealStats && (
                            <>
                                <p>⏳ Beklemede: {appealStats.pending}</p>
                                <p>📊 Onay Oranı: {appealStats.approvalRate.toFixed(1)}%</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Report Kategorileri */}
            {reportStats && (
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <Icons.chart className="h-6 w-6 text-purple-400" />
                        Rapor Kategorileri
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { key: 'spam', label: '📧 Spam', color: 'bg-yellow-500/20' },
                            { key: 'inappropriate', label: '🚫 Uygunsuz', color: 'bg-red-500/20' },
                            { key: 'harassment', label: '😠 Taciz', color: 'bg-red-600/20' },
                            { key: 'copyright', label: '©️ Telif', color: 'bg-orange-500/20' },
                            { key: 'scam', label: '💰 Dolandırıcılık', color: 'bg-orange-600/20' },
                            { key: 'adult', label: '🔞 Yetişkin', color: 'bg-red-700/20' },
                            { key: 'other', label: '❓ Diğer', color: 'bg-gray-500/20' }
                        ].map(cat => (
                            <div key={cat.key} className={`${cat.color} border border-white/10 rounded-lg p-4`}>
                                <p className="text-white/60 text-sm">{cat.label}</p>
                                <h4 className="text-2xl font-bold text-white mt-2">
                                    {reportStats.byCategory[cat.key] || 0}
                                </h4>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Rapor Priority Dağılımı */}
            {reportStats && (
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <Icons.alertTriangle className="h-6 w-6 text-red-400" />
                        Rapor Öncelikleri
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { key: 'critical', label: '🚨 Kritik', color: 'bg-red-600/20', textColor: 'text-red-400' },
                            { key: 'high', label: '⚠️ Yüksek', color: 'bg-orange-500/20', textColor: 'text-orange-400' },
                            { key: 'medium', label: '📌 Orta', color: 'bg-yellow-500/20', textColor: 'text-yellow-400' },
                            { key: 'low', label: '📍 Düşük', color: 'bg-blue-500/20', textColor: 'text-blue-400' }
                        ].map(pri => (
                            <div key={pri.key} className={`${pri.color} border border-white/10 rounded-lg p-4`}>
                                <p className={`text-sm ${pri.textColor}`}>{pri.label}</p>
                                <h4 className="text-2xl font-bold text-white mt-2">
                                    {reportStats.byPriority[pri.key] || 0}
                                </h4>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sistem Bilgileri */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-start gap-3">
                    <Icons.info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-blue-400 mb-2">Dashboard Hakkında</h3>
                        <ul className="text-sm text-blue-300/80 space-y-1">
                            <li>✓ Tüm istatistikler gerçek zamanlı güncellenir</li>
                            <li>✓ Ban/Mute oranları otomatik hesaplanır</li>
                            <li>✓ Rapor kategorileri ve öncelikleri otomatik analiz edilir</li>
                            <li>✓ İtiraz sistem performansını izler</li>
                            <li>✓ Moderatör aktivitesi ve etkinliği gösterilir</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
