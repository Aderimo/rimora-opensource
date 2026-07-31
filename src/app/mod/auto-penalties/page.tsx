'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AutoPenalty {
    id: string
    userId: string
    username: string
    penaltyType: 'warning' | 'mute' | 'ban'
    reason: string
    triggerCount: number
    issuedAt: Date
    expiresAt?: Date
    duration?: number
    durationUnit?: string
}

interface PenaltyStats {
    totalAuto: number
    warnings: number
    mutes: number
    bans: number
    today: number
    thisWeek: number
}

export default function AutoPenaltiesPage() {
    const [penalties, setPenalties] = useState<AutoPenalty[]>([])
    const [stats, setStats] = useState<PenaltyStats>({
        totalAuto: 0,
        warnings: 0,
        mutes: 0,
        bans: 0,
        today: 0,
        thisWeek: 0
    })
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'warning' | 'mute' | 'ban'>('all')
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        fetchPenalties()
    }, [])

    const fetchPenalties = async () => {
        setLoading(true)
        try {
            // Fetch automatic penalties from warnings, mutes, bans collections
            // These are marked as auto-issued when triggered by the auto-escalation system
            const warningDocs = await getDocs(
                query(
                    collection(db, 'warnings'),
                    where('isAuto', '==', true),
                    orderBy('issuedAt', 'desc'),
                    limit(100)
                )
            )

            const muteDocs = await getDocs(
                query(
                    collection(db, 'mutes'),
                    where('isAuto', '==', true),
                    orderBy('issuedAt', 'desc'),
                    limit(100)
                )
            )

            const banDocs = await getDocs(
                query(
                    collection(db, 'bans'),
                    where('isAuto', '==', true),
                    orderBy('issuedAt', 'desc'),
                    limit(100)
                )
            )

            const allPenalties: AutoPenalty[] = []

            // Process warnings
            warningDocs.forEach(doc => {
                const data = doc.data()
                allPenalties.push({
                    id: doc.id,
                    userId: data.userId,
                    username: data.username || 'Bilinmiyor',
                    penaltyType: 'warning',
                    reason: data.reason || 'Otomatik uyarı',
                    triggerCount: data.warningCount || 1,
                    issuedAt: data.issuedAt?.toDate?.() || new Date(),
                    expiresAt: data.expiresAt?.toDate?.(),
                    duration: data.duration,
                    durationUnit: 'Saat'
                })
            })

            // Process mutes
            muteDocs.forEach(doc => {
                const data = doc.data()
                allPenalties.push({
                    id: doc.id,
                    userId: data.userId,
                    username: data.username || 'Bilinmiyor',
                    penaltyType: 'mute',
                    reason: data.reason || 'Otomatik susturma',
                    triggerCount: data.warningCount || 3,
                    issuedAt: data.issuedAt?.toDate?.() || new Date(),
                    expiresAt: data.expiresAt?.toDate?.(),
                    duration: data.durationMinutes,
                    durationUnit: 'Dakika'
                })
            })

            // Process bans
            banDocs.forEach(doc => {
                const data = doc.data()
                allPenalties.push({
                    id: doc.id,
                    userId: data.userId,
                    username: data.username || 'Bilinmiyor',
                    penaltyType: 'ban',
                    reason: data.reason || 'Otomatik ban',
                    triggerCount: data.warningCount || 5,
                    issuedAt: data.issuedAt?.toDate?.() || new Date(),
                    expiresAt: data.expiresAt?.toDate?.(),
                    duration: data.durationDays,
                    durationUnit: 'Gün'
                })
            })

            // Sort by date
            allPenalties.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())

            setPenalties(allPenalties)

            // Calculate stats
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

            const todayCount = allPenalties.filter(p => p.issuedAt >= today).length
            const weekCount = allPenalties.filter(p => p.issuedAt >= weekAgo).length

            setStats({
                totalAuto: allPenalties.length,
                warnings: allPenalties.filter(p => p.penaltyType === 'warning').length,
                mutes: allPenalties.filter(p => p.penaltyType === 'mute').length,
                bans: allPenalties.filter(p => p.penaltyType === 'ban').length,
                today: todayCount,
                thisWeek: weekCount
            })
        } catch (error) {
            console.error('Error fetching auto penalties:', error)
            toast.error('Otomatik cezalar yüklenirken hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        await fetchPenalties()
        setRefreshing(false)
        toast.success('Veriler yenilendi')
    }

    const filteredPenalties = penalties.filter(p => {
        const matchesSearch = 
            p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.userId.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = filterType === 'all' || p.penaltyType === filterType
        return matchesSearch && matchesType
    })

    const getPenaltyIcon = (type: string) => {
        switch (type) {
            case 'warning':
                return '⚠️'
            case 'mute':
                return '🔇'
            case 'ban':
                return '🚫'
            default:
                return '•'
        }
    }

    const getPenaltyLabel = (type: string) => {
        switch (type) {
            case 'warning':
                return 'Uyarı'
            case 'mute':
                return 'Mute'
            case 'ban':
                return 'Ban'
            default:
                return type
        }
    }

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date)
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Otomatik Ceza Logu</h1>
                <p className="text-white/60 mt-2">Otomatik olarak atılan cezaları görüntüle ve yönet</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4">
                    <div className="text-blue-400 text-sm font-medium">Toplam Otomatik</div>
                    <div className="text-3xl font-bold text-blue-300 mt-2">{stats.totalAuto}</div>
                </div>

                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
                    <div className="text-yellow-400 text-sm font-medium">⚠️ Uyarılar</div>
                    <div className="text-3xl font-bold text-yellow-300 mt-2">{stats.warnings}</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-xl p-4">
                    <div className="text-orange-400 text-sm font-medium">🔇 Muteler</div>
                    <div className="text-3xl font-bold text-orange-300 mt-2">{stats.mutes}</div>
                </div>

                <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl p-4">
                    <div className="text-red-400 text-sm font-medium">🚫 Banlar</div>
                    <div className="text-3xl font-bold text-red-300 mt-2">{stats.bans}</div>
                </div>

                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4">
                    <div className="text-green-400 text-sm font-medium">📅 Bugün</div>
                    <div className="text-3xl font-bold text-green-300 mt-2">{stats.today}</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4">
                    <div className="text-purple-400 text-sm font-medium">📊 Bu Hafta</div>
                    <div className="text-3xl font-bold text-purple-300 mt-2">{stats.thisWeek}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#151515] border border-white/5 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm text-white/60 block mb-2">Ara (Kullanıcı adı / ID)</label>
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Kullanıcı adını veya ID'sini yazın..."
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-white/60 block mb-2">Ceza Türü</label>
                        <div className="flex gap-2">
                            {(['all', 'warning', 'mute', 'ban'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={cn(
                                        "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
                                        filterType === type
                                            ? "bg-purple-600 text-white"
                                            : "bg-white/5 text-white/70 hover:bg-white/10"
                                    )}
                                >
                                    {type === 'all' ? 'Tümü' : getPenaltyLabel(type)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-end">
                        <Button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            variant="outline"
                            className="w-full"
                        >
                            {refreshing && <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />}
                            Yenile
                        </Button>
                    </div>
                </div>
            </div>

            {/* Penalties List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Icons.spinner className="h-8 w-8 animate-spin text-purple-400" />
                </div>
            ) : filteredPenalties.length === 0 ? (
                <div className="bg-[#151515] border border-white/5 rounded-xl p-12 text-center">
                    <Icons.search className="h-12 w-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60">Ceza bulunamadı</p>
                </div>
            ) : (
                <div className="bg-[#151515] border border-white/5 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/2.5">
                                    <th className="px-6 py-4 text-left font-medium text-white/80">Ceza Tipi</th>
                                    <th className="px-6 py-4 text-left font-medium text-white/80">Kullanıcı</th>
                                    <th className="px-6 py-4 text-left font-medium text-white/80">Neden</th>
                                    <th className="px-6 py-4 text-left font-medium text-white/80">Tetikleme Sayısı</th>
                                    <th className="px-6 py-4 text-left font-medium text-white/80">Süre</th>
                                    <th className="px-6 py-4 text-left font-medium text-white/80">Tarihi</th>
                                    <th className="px-6 py-4 text-left font-medium text-white/80">Bitiş Tarihi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPenalties.map((penalty, idx) => (
                                    <tr
                                        key={idx}
                                        className="border-b border-white/5 hover:bg-white/2.5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium",
                                                penalty.penaltyType === 'warning' && "bg-yellow-500/20 text-yellow-300",
                                                penalty.penaltyType === 'mute' && "bg-orange-500/20 text-orange-300",
                                                penalty.penaltyType === 'ban' && "bg-red-500/20 text-red-300"
                                            )}>
                                                {getPenaltyIcon(penalty.penaltyType)}
                                                {getPenaltyLabel(penalty.penaltyType)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-white">{penalty.username}</div>
                                                <div className="text-xs text-white/50 font-mono">{penalty.userId}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-white/80">{penalty.reason}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded text-sm font-medium">
                                                {penalty.triggerCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-white/80">
                                            {penalty.duration ? `${penalty.duration} ${penalty.durationUnit}` : 'Kalıcı'}
                                        </td>
                                        <td className="px-6 py-4 text-white/60 text-xs">
                                            {formatDate(penalty.issuedAt)}
                                        </td>
                                        <td className="px-6 py-4 text-white/60 text-xs">
                                            {penalty.expiresAt ? formatDate(penalty.expiresAt) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex gap-3">
                    <Icons.info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-300">
                        <p className="font-bold mb-1">Otomatik Ceza Sistemi</p>
                        <p>
                            3 uyarı → 1 saat mute, 5 uyarı → 1 gün ban şeklinde otomatik cezalar atılmaktadır. 
                            Bu sayfa tüm otomatik olarak atılan cezaları görüntüler.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
