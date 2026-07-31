'use client'

import { useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface UserPenalties {
    userId: string
    username: string
    email?: string
    warnings: WarningRecord[]
    mutes: MuteRecord[]
    bans: BanRecord[]
    totalWarnings: number
    activeMutes: number
    activeBans: number
}

interface WarningRecord {
    id: string
    reason: string
    issuedAt: Date
    issuedBy: string
    isAuto: boolean
    expiresAt?: Date
}

interface MuteRecord {
    id: string
    reason: string
    issuedAt: Date
    issuedBy: string
    durationMinutes: number
    expiresAt: Date
    isActive: boolean
}

interface BanRecord {
    id: string
    reason: string
    issuedAt: Date
    issuedBy: string
    durationDays?: number
    expiresAt?: Date
    permanent: boolean
    isActive: boolean
}

export default function PenaltySearchPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [searching, setSearching] = useState(false)
    const [results, setResults] = useState<UserPenalties | null>(null)
    const [showDetails, setShowDetails] = useState(false)
    const [selectedPenalty, setSelectedPenalty] = useState<any>(null)

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) {
            toast.error('Lütfen bir kullanıcı ID\'si veya adı girin')
            return
        }

        setSearching(true)
        try {
            // Search in users collection
            const usersQuery = query(
                collection(db, 'users'),
                where('id', '==', searchQuery)
            )
            const userDocs = await getDocs(usersQuery)

            if (userDocs.empty) {
                // Try searching by username
                const allUserDocs = await getDocs(collection(db, 'users'))
                const userDoc = allUserDocs.docs.find(doc => 
                    doc.data().username?.toLowerCase() === searchQuery.toLowerCase()
                )
                
                if (!userDoc) {
                    toast.error('Kullanıcı bulunamadı')
                    setSearching(false)
                    return
                }

                await fetchUserPenalties(userDoc.id, userDoc.data())
            } else {
                await fetchUserPenalties(userDocs.docs[0].id, userDocs.docs[0].data())
            }
        } catch (error) {
            console.error('Search error:', error)
            toast.error('Arama sırasında hata oluştu')
        } finally {
            setSearching(false)
        }
    }

    const fetchUserPenalties = async (userId: string, userData: any) => {
        try {
            // Fetch warnings
            const warningsQuery = query(
                collection(db, 'warnings'),
                where('userId', '==', userId)
            )
            const warningDocs = await getDocs(warningsQuery)

            // Fetch mutes
            const mutesQuery = query(
                collection(db, 'mutes'),
                where('userId', '==', userId)
            )
            const muteDocs = await getDocs(mutesQuery)

            // Fetch bans
            const bansQuery = query(
                collection(db, 'bans'),
                where('userId', '==', userId)
            )
            const banDocs = await getDocs(bansQuery)

            const warnings: WarningRecord[] = warningDocs.docs.map(doc => ({
                id: doc.id,
                reason: doc.data().reason || 'Belirtilmedi',
                issuedAt: doc.data().issuedAt?.toDate?.() || new Date(),
                issuedBy: doc.data().issuedBy || 'Sistem',
                isAuto: doc.data().isAuto || false,
                expiresAt: doc.data().expiresAt?.toDate?.()
            }))

            const mutes: MuteRecord[] = muteDocs.docs.map(doc => ({
                id: doc.id,
                reason: doc.data().reason || 'Belirtilmedi',
                issuedAt: doc.data().issuedAt?.toDate?.() || new Date(),
                issuedBy: doc.data().issuedBy || 'Sistem',
                durationMinutes: doc.data().durationMinutes || 0,
                expiresAt: doc.data().expiresAt?.toDate?.() || new Date(),
                isActive: (doc.data().expiresAt?.toDate?.() || new Date()) > new Date()
            }))

            const bans: BanRecord[] = banDocs.docs.map(doc => ({
                id: doc.id,
                reason: doc.data().reason || 'Belirtilmedi',
                issuedAt: doc.data().issuedAt?.toDate?.() || new Date(),
                issuedBy: doc.data().issuedBy || 'Sistem',
                durationDays: doc.data().durationDays,
                expiresAt: doc.data().expiresAt?.toDate?.(),
                permanent: doc.data().permanent || false,
                isActive: doc.data().permanent || ((doc.data().expiresAt?.toDate?.() || new Date()) > new Date())
            }))

            const activeMutes = mutes.filter(m => m.isActive).length
            const activeBans = bans.filter(b => b.isActive).length

            setResults({
                userId,
                username: userData.username || userData.displayName || 'Bilinmiyor',
                email: userData.email,
                warnings: warnings.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()),
                mutes: mutes.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()),
                bans: bans.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()),
                totalWarnings: warnings.length,
                activeMutes,
                activeBans
            })
        } catch (error) {
            console.error('Error fetching penalties:', error)
            toast.error('Cezalar yüklenirken hata oluştu')
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

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes} dakika`
        if (minutes < 1440) return `${(minutes / 60).toFixed(1)} saat`
        return `${(minutes / 1440).toFixed(1)} gün`
    }

    const getDaysUntilExpire = (expiresAt: Date) => {
        const now = new Date()
        const diff = expiresAt.getTime() - now.getTime()
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
        return days > 0 ? days : 0
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Ceza Sorgulama</h1>
                <p className="text-white/60 mt-2">Kullanıcının tüm cezalarını ve disiplin kayıtlarını görüntüle</p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="bg-[#151515] border border-white/5 rounded-xl p-6">
                <div className="flex gap-3">
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Kullanıcı ID'si veya adını girin..."
                        className="flex-1 bg-white/5 border-white/10"
                    />
                    <Button
                        type="submit"
                        disabled={searching}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {searching && <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />}
                        Ara
                    </Button>
                </div>
            </form>

            {/* Results */}
            {results && (
                <div className="space-y-6">
                    {/* User Info Card */}
                    <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{results.username}</h2>
                                <p className="text-white/60 mt-1 font-mono text-sm">{results.userId}</p>
                                {results.email && (
                                    <p className="text-white/60 mt-1 text-sm">{results.email}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold text-red-400">{results.totalWarnings}</div>
                                <div className="text-sm text-white/60">Toplam Uyarı</div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                            <div className="text-yellow-400 text-sm font-medium">⚠️ Uyarılar</div>
                            <div className="text-3xl font-bold text-yellow-300 mt-2">{results.totalWarnings}</div>
                            <div className="text-xs text-yellow-300/60 mt-1">
                                {results.warnings.filter(w => w.isAuto).length} otomatik
                            </div>
                        </div>

                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                            <div className="text-orange-400 text-sm font-medium">🔇 Aktif Muteler</div>
                            <div className="text-3xl font-bold text-orange-300 mt-2">{results.activeMutes}</div>
                        </div>

                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                            <div className="text-red-400 text-sm font-medium">🚫 Aktif Banlar</div>
                            <div className="text-3xl font-bold text-red-300 mt-2">{results.activeBans}</div>
                        </div>
                    </div>

                    {/* Warnings Section */}
                    {results.warnings.length > 0 && (
                        <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">⚠️ Uyarılar ({results.warnings.length})</h3>
                            <div className="space-y-3">
                                {results.warnings.map((warning, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-4 bg-white/2.5 border border-white/5 rounded p-4 hover:border-yellow-500/30 transition-colors cursor-pointer"
                                        onClick={() => {
                                            setSelectedPenalty(warning)
                                            setShowDetails(true)
                                        }}
                                    >
                                        <div className="flex-shrink-0 mt-1">
                                            {warning.isAuto ? (
                                                <Icons.zap className="h-5 w-5 text-yellow-400" />
                                            ) : (
                                                <Icons.alertCircle className="h-5 w-5 text-yellow-400" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-white">{warning.reason}</p>
                                                {warning.isAuto && (
                                                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Otomatik</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-white/50 mt-1">
                                                {formatDate(warning.issuedAt)} - {warning.issuedBy}
                                            </div>
                                            {warning.expiresAt && (
                                                <div className="text-xs text-white/40 mt-0.5">
                                                    Bitiş: {formatDate(warning.expiresAt)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mutes Section */}
                    {results.mutes.length > 0 && (
                        <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">🔇 Muteler ({results.mutes.length})</h3>
                            <div className="space-y-3">
                                {results.mutes.map((mute, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "flex items-start gap-4 border rounded p-4 hover:border-orange-500/30 transition-colors cursor-pointer",
                                            mute.isActive
                                                ? "bg-orange-500/5 border-orange-500/10"
                                                : "bg-white/2.5 border-white/5"
                                        )}
                                        onClick={() => {
                                            setSelectedPenalty(mute)
                                            setShowDetails(true)
                                        }}
                                    >
                                        <div className="flex-shrink-0 mt-1">
                                            <Icons.volumeOff className={cn(
                                                "h-5 w-5",
                                                mute.isActive ? "text-orange-400" : "text-white/40"
                                            )} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-white">{mute.reason}</p>
                                                {mute.isActive ? (
                                                    <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">Aktif</span>
                                                ) : (
                                                    <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">Süresi Doldu</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-white/50 mt-1">
                                                {formatDate(mute.issuedAt)} - {mute.issuedBy}
                                            </div>
                                            <div className="text-xs text-white/40 mt-0.5">
                                                Süre: {formatDuration(mute.durationMinutes)} • Bitiş: {formatDate(mute.expiresAt)}
                                            </div>
                                            {mute.isActive && (
                                                <div className="text-xs text-orange-300 mt-0.5">
                                                    ⏱️ Kalan: {getDaysUntilExpire(mute.expiresAt)} gün
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bans Section */}
                    {results.bans.length > 0 && (
                        <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">🚫 Banlar ({results.bans.length})</h3>
                            <div className="space-y-3">
                                {results.bans.map((ban, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "flex items-start gap-4 border rounded p-4 hover:border-red-500/30 transition-colors cursor-pointer",
                                            ban.isActive
                                                ? "bg-red-500/5 border-red-500/10"
                                                : "bg-white/2.5 border-white/5"
                                        )}
                                        onClick={() => {
                                            setSelectedPenalty(ban)
                                            setShowDetails(true)
                                        }}
                                    >
                                        <div className="flex-shrink-0 mt-1">
                                            <Icons.ban className={cn(
                                                "h-5 w-5",
                                                ban.isActive ? "text-red-400" : "text-white/40"
                                            )} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-white">{ban.reason}</p>
                                                {ban.isActive ? (
                                                    <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">Aktif</span>
                                                ) : (
                                                    <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">Çözüldü</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-white/50 mt-1">
                                                {formatDate(ban.issuedAt)} - {ban.issuedBy}
                                            </div>
                                            <div className="text-xs text-white/40 mt-0.5">
                                                {ban.permanent ? (
                                                    'Kalıcı Ban'
                                                ) : (
                                                    <>Süre: {ban.durationDays} gün • Bitiş: {ban.expiresAt ? formatDate(ban.expiresAt) : '—'}</>
                                                )}
                                            </div>
                                            {ban.isActive && !ban.permanent && ban.expiresAt && (
                                                <div className="text-xs text-red-300 mt-0.5">
                                                    ⏱️ Kalan: {getDaysUntilExpire(ban.expiresAt)} gün
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {results.warnings.length === 0 && results.mutes.length === 0 && results.bans.length === 0 && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center">
                            <Icons.checkCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                            <p className="text-green-300 font-medium">Bu kullanıcı temiz!</p>
                            <p className="text-green-300/60 text-sm mt-1">Herhangi bir uyarı, mute veya ban kaydı yok.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Details Dialog */}
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="bg-[#1A1A1A] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Ceza Detayları</DialogTitle>
                    </DialogHeader>
                    {selectedPenalty && (
                        <div className="space-y-4 py-4">
                            <div>
                                <p className="text-xs text-white/60 mb-1">Neden</p>
                                <p className="text-white">{selectedPenalty.reason}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-white/60 mb-1">Verildi</p>
                                    <p className="text-white text-sm">{formatDate(selectedPenalty.issuedAt)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-white/60 mb-1">Veren</p>
                                    <p className="text-white text-sm">{selectedPenalty.issuedBy}</p>
                                </div>
                            </div>
                            {selectedPenalty.durationMinutes !== undefined && (
                                <div>
                                    <p className="text-xs text-white/60 mb-1">Süre</p>
                                    <p className="text-white text-sm">{formatDuration(selectedPenalty.durationMinutes)}</p>
                                </div>
                            )}
                            {selectedPenalty.expiresAt && (
                                <div>
                                    <p className="text-xs text-white/60 mb-1">Bitiş Tarihi</p>
                                    <p className="text-white text-sm">{formatDate(selectedPenalty.expiresAt)}</p>
                                </div>
                            )}
                            {selectedPenalty.isAuto && (
                                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded p-3">
                                    <p className="text-sm text-yellow-300">⚡ Bu ceza otomatik olarak atılmıştır</p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowDetails(false)}>
                            Kapat
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
