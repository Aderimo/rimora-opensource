'use client'

import { useEffect, useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { issueWarning, muteUser, banUser, getUserWarnings } from '@/lib/warnings'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

interface UserWarning {
    id: string
    userId: string
    username: string
    reason: string
    type: string
    issuedBy: string
    issuedAt: Date
    expiresAt?: Date | null
    status: 'active' | 'resolved' | 'appealed'
}

const WARNING_TYPES: Record<string, { label: string; color: string; emoji: string }> = {
    spam: { label: 'Spam', color: 'text-yellow-400', emoji: '📧' },
    inappropriate: { label: 'Uygunsuz', color: 'text-red-400', emoji: '🚫' },
    harassment: { label: 'Taciz', color: 'text-red-600', emoji: '😠' },
    copyright: { label: 'Telif Hakkı', color: 'text-orange-400', emoji: '©️' },
    other: { label: 'Diğer', color: 'text-gray-400', emoji: '❓' }
}

export default function ModWarningsPage() {
    const { user } = useAuth()
    const [warnings, setWarnings] = useState<UserWarning[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedAction, setSelectedAction] = useState<'warning' | 'mute' | 'ban'>('warning')
    const [targetUserId, setTargetUserId] = useState('')
    const [targetUsername, setTargetUsername] = useState('')
    const [reason, setReason] = useState('')
    const [duration, setDuration] = useState('1') // hours for warning, minutes for mute, days for ban
    const [actionType, setActionType] = useState<'warning' | 'mute' | 'ban'>('warning')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchWarnings()
    }, [])

    const fetchWarnings = async () => {
        setLoading(true)
        try {
            const q = query(
                collection(db, 'warnings'),
                orderBy('issuedAt', 'desc'),
                limit(100)
            )
            const snapshot = await getDocs(q)
            const warningsData = snapshot.docs.map(doc => ({
                ...doc.data(),
                issuedAt: doc.data().issuedAt?.toDate() || new Date(),
                expiresAt: doc.data().expiresAt?.toDate() || null
            })) as UserWarning[]
            setWarnings(warningsData)
        } catch (error) {
            console.error('Error fetching warnings:', error)
            toast.error('Uyarılar yüklenemedi')
        } finally {
            setLoading(false)
        }
    }

    const handleIssueAction = async () => {
        if (!targetUserId || !reason) {
            toast.error('Lütfen tüm alanları doldurun')
            return
        }

        if (!user) {
            toast.error('Oturum açmanız gerekiyor')
            return
        }

        setSubmitting(true)
        try {
            if (actionType === 'warning') {
                await issueWarning(
                    targetUserId,
                    targetUsername || 'Bilinmiyor',
                    reason,
                    'other',
                    user.uid,
                    parseInt(duration)
                )
                toast.success('Uyarı verildi')
            } else if (actionType === 'mute') {
                await muteUser(
                    targetUserId,
                    targetUsername || 'Bilinmiyor',
                    reason,
                    parseInt(duration),
                    user.uid
                )
                toast.success('Kullanıcı susturuldu')
            } else if (actionType === 'ban') {
                await banUser(
                    targetUserId,
                    targetUsername || 'Bilinmiyor',
                    reason,
                    false,
                    parseInt(duration),
                    user.uid
                )
                toast.success('Kullanıcı banlandı')
            }

            // Reset form
            setTargetUserId('')
            setTargetUsername('')
            setReason('')
            setDuration('1')
            setIsModalOpen(false)
            fetchWarnings()
        } catch (error) {
            console.error('Error:', error)
            toast.error('İşlem başarısız oldu')
        } finally {
            setSubmitting(false)
        }
    }

    const filteredWarnings = warnings.filter(warning =>
        warning.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        warning.userId.includes(searchTerm) ||
        warning.reason.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Uyarı & Ceza Yönetimi</h1>
                    <p className="text-white/60 mt-2">Kullanıcılara uyarı, mute ve ban işlemleri</p>
                </div>
                <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                >
                    <Icons.plus className="h-4 w-4 mr-2" />
                    Yeni İşlem
                </Button>
            </div>

            {/* Filtre */}
            <div className="relative">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                    placeholder="Kullanıcı adı, ID veya neden ile ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-[#151515] border-white/10 text-white"
                />
            </div>

            {/* Uyarılar */}
            <div className="bg-[#151515] border border-white/5 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-white/40 uppercase">
                    <div className="col-span-3">Kullanıcı</div>
                    <div className="col-span-2">Tür</div>
                    <div className="col-span-3">Neden</div>
                    <div className="col-span-2">Tarih</div>
                    <div className="col-span-2">Durum</div>
                </div>

                <div className="divide-y divide-white/5">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Icons.spinner className="h-8 w-8 animate-spin text-purple-500" />
                        </div>
                    ) : filteredWarnings.length === 0 ? (
                        <div className="p-12 text-center text-white/40">
                            Uyarı bulunamadı
                        </div>
                    ) : (
                        filteredWarnings.map((warning) => {
                            const typeInfo = WARNING_TYPES[warning.type] || WARNING_TYPES.other
                            const isExpired = warning.expiresAt && new Date() > warning.expiresAt
                            return (
                                <div key={warning.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors">
                                    <div className="col-span-3">
                                        <p className="text-white font-medium">{warning.username}</p>
                                        <p className="text-xs text-white/40">{warning.userId.slice(0, 8)}...</p>
                                    </div>

                                    <div className="col-span-2">
                                        <span className={cn("text-xs px-2 py-1 rounded-full font-bold", typeInfo.color)}>
                                            {typeInfo.emoji} {typeInfo.label}
                                        </span>
                                    </div>

                                    <div className="col-span-3">
                                        <p className="text-sm text-white/70 truncate">{warning.reason}</p>
                                    </div>

                                    <div className="col-span-2">
                                        <p className="text-sm text-white">
                                            {warning.issuedAt.toLocaleDateString('tr-TR')}
                                        </p>
                                        <p className="text-xs text-white/40">
                                            {warning.issuedAt.toLocaleTimeString('tr-TR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>

                                    <div className="col-span-2">
                                        <span className={cn(
                                            "text-xs px-2 py-1 rounded-full font-bold border",
                                            isExpired
                                                ? "bg-gray-500/20 text-gray-400 border-gray-500/20"
                                                : warning.status === 'active'
                                                ? "bg-red-500/20 text-red-400 border-red-500/20"
                                                : "bg-green-500/20 text-green-400 border-green-500/20"
                                        )}>
                                            {isExpired ? '⏰ Süresi Doldu' : warning.status === 'active' ? '🔴 Aktif' : '✅ Çözüldü'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-[#1A1A1A] border-white/10 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Yeni İşlem Ekle</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* İşlem Tipi */}
                        <div className="space-y-2">
                            <Label>İşlem Tipi</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['warning', 'mute', 'ban'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setActionType(type)
                                            setDuration(type === 'warning' ? '1' : type === 'mute' ? '60' : '7')
                                        }}
                                        className={cn(
                                            "py-2 px-3 rounded-lg font-medium text-sm transition-colors",
                                            actionType === type
                                                ? "bg-purple-600 text-white"
                                                : "bg-white/5 text-white/70 hover:bg-white/10"
                                        )}
                                    >
                                        {type === 'warning' && '⚠️ Uyarı'}
                                        {type === 'mute' && '🔇 Mute'}
                                        {type === 'ban' && '🚫 Ban'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Kullanıcı ID */}
                        <div className="space-y-2">
                            <Label>Kullanıcı ID</Label>
                            <Input
                                value={targetUserId}
                                onChange={(e) => setTargetUserId(e.target.value)}
                                placeholder="Kullanıcı ID girin"
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        {/* Kullanıcı Adı */}
                        <div className="space-y-2">
                            <Label>Kullanıcı Adı (Opsiyonel)</Label>
                            <Input
                                value={targetUsername}
                                onChange={(e) => setTargetUsername(e.target.value)}
                                placeholder="Görüntü adını girin"
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        {/* Neden */}
                        <div className="space-y-2">
                            <Label>Neden</Label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Neden bu işlemi yapıyorsunuz?"
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder:text-white/30 focus:border-purple-500 outline-none resize-none"
                            />
                        </div>

                        {/* Süre */}
                        <div className="space-y-2">
                            <Label>
                                Süre ({actionType === 'warning' ? 'Saat' : actionType === 'mute' ? 'Dakika' : 'Gün'})
                            </Label>
                            <Input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                min="1"
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsModalOpen(false)}
                            disabled={submitting}
                        >
                            İptal
                        </Button>
                        <Button
                            onClick={handleIssueAction}
                            disabled={submitting || !targetUserId || !reason}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {submitting && <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />}
                            İşlemi Uygula
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
