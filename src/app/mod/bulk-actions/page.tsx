'use client'

import { useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { bulkIssueWarnings, bulkMuteUsers, bulkBanUsers } from '@/lib/bulk-actions'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

interface BulkActionResult {
    totalCount: number
    successCount: number
    failureCount: number
    actionType: 'warning' | 'mute' | 'ban'
    timestamp: Date
}

export default function BulkActionsPage() {
    // Auth
    const { user } = useAuth()
    
    // State
    const [actionType, setActionType] = useState<'warning' | 'mute' | 'ban'>('warning')
    const [userInput, setUserInput] = useState('')
    const [reason, setReason] = useState('')
    const [durationYears, setDurationYears] = useState('0')
    const [durationMonths, setDurationMonths] = useState('0')
    const [durationDays, setDurationDays] = useState('1')
    const [durationHours, setDurationHours] = useState('0')
    const [executing, setExecuting] = useState(false)
    const [results, setResults] = useState<BulkActionResult[]>([])
    const [showPreview, setShowPreview] = useState(false)

    // Calculate total duration in the appropriate unit
    const calculateDuration = (): number => {
        if (actionType === 'warning') {
            // Warning duration in hours
            return (
                parseInt(durationYears || '0') * 24 * 365 +
                parseInt(durationMonths || '0') * 24 * 30 +
                parseInt(durationDays || '0') * 24 +
                parseInt(durationHours || '0')
            )
        } else if (actionType === 'mute') {
            // Mute duration in minutes
            return (
                parseInt(durationYears || '0') * 365 * 24 * 60 +
                parseInt(durationMonths || '0') * 30 * 24 * 60 +
                parseInt(durationDays || '0') * 24 * 60 +
                parseInt(durationHours || '0') * 60
            )
        } else {
            // Ban duration in days
            return (
                parseInt(durationYears || '0') * 365 +
                parseInt(durationMonths || '0') * 30 +
                parseInt(durationDays || '0')
            )
        }
    }

    const getDurationLabel = (): string => {
        if (actionType === 'warning') return 'Saat'
        if (actionType === 'mute') return 'Dakika'
        return 'Gün'
    }

    // Parse user IDs from input
    const parseUserIds = (): string[] => {
        return userInput
            .split(/[\n,;]+/)
            .map(id => id.trim())
            .filter(id => id.length > 0)
    }

    const userIds = parseUserIds()

    // Execute bulk action
    const handleExecuteBulkAction = async () => {
        if (userIds.length === 0) {
            toast.error("Lütfen en az bir kullanıcı ID'si girin")
            return
        }

        if (!reason.trim()) {
            toast.error('Lütfen bir neden girin')
            return
        }

        const duration = calculateDuration()
        if (duration <= 0) {
            toast.error('Lütfen geçerli bir süre girin')
            return
        }

        if (!window.confirm(`${userIds.length} kullanıcıya ${
            actionType === 'warning' ? 'uyarı' :
            actionType === 'mute' ? 'mute' : 'ban'
        } işlemini uygulamak istediğinize emin misiniz?`)) {
            return
        }

        setExecuting(true)
        try {
            let result

            if (actionType === 'warning') {
                result = await bulkIssueWarnings(
                    userIds,
                    reason,
                    duration,
                    user?.uid || ''
                )
            } else if (actionType === 'mute') {
                result = await bulkMuteUsers(
                    userIds,
                    reason,
                    duration,
                    user?.uid || ''
                )
            } else {
                result = await bulkBanUsers(
                    userIds,
                    reason,
                    false,
                    duration,
                    user?.uid || ''
                )
            }

            const bulkResult: BulkActionResult = {
                totalCount: userIds.length,
                successCount: result.successCount,
                failureCount: result.failureCount,
                actionType,
                timestamp: new Date()
            }

            setResults([bulkResult, ...results])
            
            toast.success(
                `${result.successCount}/${userIds.length} işlem başarılı`
            )

            // Reset form
            setUserInput('')
            setReason('')
            setDurationYears('0')
            setDurationMonths('0')
            setDurationDays('1')
            setDurationHours('0')
        } catch (error) {
            console.error('Error executing bulk action:', error)
            toast.error('Toplu işlem başarısız oldu')
        } finally {
            setExecuting(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Toplu İşlemler</h1>
                <p className="text-white/60 mt-2">Birden fazla kullanıcıya aynı işlemi uygula</p>
            </div>

            {/* Step 1: İşlem Tipi Seçimi */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full font-bold text-sm">1</div>
                    <h3 className="text-lg font-bold text-white">Adım 1: İşlem Türünü Seç</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {(['warning', 'mute', 'ban'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => {
                                setActionType(type)
                                setDurationYears('0')
                                setDurationMonths('0')
                                setDurationDays(type === 'warning' ? '1' : type === 'mute' ? '0' : '7')
                                setDurationHours(type === 'mute' ? '1' : '0')
                            }}
                            className={cn(
                                "py-4 px-4 rounded-lg font-medium transition-all text-base",
                                actionType === type
                                    ? "bg-purple-600 text-white ring-2 ring-purple-400 scale-105"
                                    : "bg-white/5 text-white/70 hover:bg-white/10"
                            )}
                        >
                            {type === 'warning' && '⚠️ Uyarı Verme'}
                            {type === 'mute' && '🔇 Mute Etme'}
                            {type === 'ban' && '🚫 Ban Etme'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2: Kullanıcı IDs */}
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm">2</div>
                    <h3 className="text-lg font-bold text-white">Adım 2: Kullanıcı ID'lerini Gir</h3>
                </div>
                <div className="space-y-3">
                    <p className="text-sm text-white/70">
                        Her satıra bir kullanıcı ID'si yazın veya virgülle ayrılmış şekilde yazabilirsiniz. Örnek:
                    </p>
                    <div className="bg-black/30 border border-white/10 rounded p-3 text-xs text-white/60 font-mono">
                        user123<br/>
                        user456<br/>
                        user789<br/>
                        <br/>
                        Veya: user123, user456, user789
                    </div>
                    <textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Kullanıcı ID'lerini buraya yapıştırın..."
                        className="w-full h-40 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/30 focus:border-blue-500 outline-none resize-none"
                    />
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2">
                        <Icons.checkCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                        <span className="text-sm text-blue-300">
                            <span className="font-bold">{userIds.length} kullanıcı</span> tespit edildi
                        </span>
                    </div>
                </div>
            </div>

            {/* Step 3: Neden ve Süre */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-cyan-600 text-white rounded-full font-bold text-sm">3</div>
                    <h3 className="text-lg font-bold text-white">Adım 3: Neden ve Süreyi Ayarla</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <Label className="text-white">Neden</Label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Cezanın nedenini açıklayın..."
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder:text-white/30 focus:border-cyan-500 outline-none resize-none"
                        />
                    </div>

                    <div className="space-y-4">
                        <Label className="text-white">
                            Süre ({getDurationLabel()})
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <label className="text-xs text-white/60 block mb-1.5">Yıl</label>
                                <Input
                                    type="number"
                                    value={durationYears}
                                    onChange={(e) => setDurationYears(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60 block mb-1.5">Ay</label>
                                <Input
                                    type="number"
                                    value={durationMonths}
                                    onChange={(e) => setDurationMonths(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60 block mb-1.5">Gün</label>
                                <Input
                                    type="number"
                                    value={durationDays}
                                    onChange={(e) => setDurationDays(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60 block mb-1.5">Saat</label>
                                <Input
                                    type="number"
                                    value={durationHours}
                                    onChange={(e) => setDurationHours(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                        </div>
                        <div className="bg-cyan-500/20 border border-cyan-500/30 rounded px-3 py-2">
                            <p className="text-sm text-cyan-300">
                                Toplam: <span className="font-bold text-cyan-200">{calculateDuration()} {getDurationLabel()}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 4: Uyarı */}
            {userIds.length > 10 && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                    <div className="flex gap-3">
                        <Icons.alertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-orange-400">⚠️ Dikkat Uyarısı</p>
                            <p className="text-sm text-orange-300/80 mt-1">
                                {userIds.length} kullanıcıya işlem uygulanacak. Lütfen dikkatle kontrol edin.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 5: Çalıştır */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full font-bold text-sm">4</div>
                    <h3 className="text-lg font-bold text-white">Adım 4: İşlemi Çalıştır</h3>
                </div>
                <div className="flex gap-3">
                    {userIds.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => setShowPreview(true)}
                            className="flex-1"
                        >
                            <Icons.eye className="h-4 w-4 mr-2" />
                            Önizle ({userIds.length} kullanıcı)
                        </Button>
                    )}
                    <Button
                        onClick={handleExecuteBulkAction}
                        disabled={executing || userIds.length === 0 || !reason.trim()}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 h-auto"
                    >
                        {executing && <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />}
                        {executing ? 'İşlem Yapılıyor...' : `Cezaları Uygula (${userIds.length})`}
                    </Button>
                </div>
            </div>

            {/* Neden ve Süre */}
            <div className="space-y-6 hidden">
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="space-y-3">
                        <Label className="text-white">Neden</Label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Bu işlemin nedenini açıklayın..."
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder:text-white/30 focus:border-purple-500 outline-none resize-none"
                        />
                    </div>
                </div>

                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="space-y-4">
                        <Label className="text-white">
                            Süre ({getDurationLabel()})
                        </Label>
                        <div className="grid grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs text-white/60 block mb-2">Yıl</label>
                                <Input
                                    type="number"
                                    value={durationYears}
                                    onChange={(e) => setDurationYears(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60 block mb-2">Ay</label>
                                <Input
                                    type="number"
                                    value={durationMonths}
                                    onChange={(e) => setDurationMonths(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60 block mb-2">Gün</label>
                                <Input
                                    type="number"
                                    value={durationDays}
                                    onChange={(e) => setDurationDays(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60 block mb-2">Saat</label>
                                <Input
                                    type="number"
                                    value={durationHours}
                                    onChange={(e) => setDurationHours(e.target.value)}
                                    min="0"
                                    className="bg-white/5 border-white/10 text-center"
                                />
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded px-3 py-2">
                            <p className="text-sm text-white">
                                Toplam: <span className="font-bold text-purple-400">{calculateDuration()} {getDurationLabel()}</span>
                            </p>
                        </div>
                        <div className="text-xs text-white/50">
                            {actionType === 'warning' && 'Uyarı geçerlilik süresi (saat cinsinden)'}
                            {actionType === 'mute' && 'Mute süresi (dakika cinsinden)'}
                            {actionType === 'ban' && 'Ban süresi (gün cinsinden)'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Uyarı */}
            {userIds.length > 10 && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                    <div className="flex gap-3">
                        <Icons.alertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-orange-400">Dikkat!</p>
                            <p className="text-sm text-orange-300/80 mt-1">
                                {userIds.length} kullanıcıya işlem uygulanacak. Lütfen dikkatle kontrol edin.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-2">
                {userIds.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={() => setShowPreview(true)}
                    >
                        <Icons.eye className="h-4 w-4 mr-2" />
                        Önizle
                    </Button>
                )}
                <Button
                    onClick={handleExecuteBulkAction}
                    disabled={executing || userIds.length === 0 || !reason.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                >
                    {executing && <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />}
                    İşlemi Uygula ({userIds.length})
                </Button>
            </div>

            {/* Geçmiş */}
            {results.length > 0 && (
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">İşlem Geçmişi</h3>
                    <div className="space-y-3">
                        {results.map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded p-4">
                                <div>
                                    <p className="font-medium text-white">
                                        {result.actionType === 'warning' ? '⚠️ Uyarı' :
                                         result.actionType === 'mute' ? '🔇 Mute' : '🚫 Ban'} - {result.totalCount} kullanıcı
                                    </p>
                                    <p className="text-sm text-white/60 mt-1">
                                        {result.timestamp.toLocaleString('tr-TR')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={cn(
                                        "font-bold text-lg",
                                        result.failureCount === 0 ? "text-green-400" : "text-orange-400"
                                    )}>
                                        {result.successCount}/{result.totalCount}
                                    </p>
                                    <p className="text-xs text-white/50">Başarılı</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="bg-[#1A1A1A] border-white/10 text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Önizle - {userIds.length} Kullanıcı</DialogTitle>
                    </DialogHeader>

                    <div className="max-h-96 overflow-y-auto space-y-2 py-4">
                        {userIds.map((id, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded px-3 py-2"
                            >
                                <span className="text-sm text-white/60">#{idx + 1}</span>
                                <span className="font-mono text-sm text-white">{id}</span>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setShowPreview(false)}
                        >
                            Kapat
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
