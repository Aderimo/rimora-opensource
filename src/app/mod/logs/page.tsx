'use client'

import { useEffect, useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AdminLog {
    id: string
    moderatorId: string
    moderatorName?: string
    action: string
    targetUserId: string
    targetUsername?: string
    timestamp: Date
    details?: Record<string, any>
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    assign_role: { label: 'Rol Atandı', icon: '👤', color: 'text-blue-400' },
    remove_role: { label: 'Rol Kaldırıldı', icon: '❌', color: 'text-red-400' },
    ban_user: { label: 'Kullanıcı Banlandı', icon: '🚫', color: 'text-red-600' },
    unban_user: { label: 'Ban Kaldırıldı', icon: '✅', color: 'text-green-400' },
    mute_user: { label: 'Kullanıcı Susturuldu', icon: '🔇', color: 'text-yellow-400' },
    unmute_user: { label: 'Susturma Kaldırıldı', icon: '🔊', color: 'text-green-400' },
    issue_warning: { label: 'Uyarı Verildi', icon: '⚠️', color: 'text-orange-400' },
    delete_content: { label: 'İçerik Silindi', icon: '🗑️', color: 'text-red-400' },
    review_report: { label: 'Rapor İncelendi', icon: '📋', color: 'text-purple-400' },
    create_report: { label: 'Rapor Oluşturuldu', icon: '📝', color: 'text-cyan-400' },
    default: { label: 'İşlem Yapıldı', icon: '⚙️', color: 'text-white/50' }
}

export default function ModLogsPage() {
    const [logs, setLogs] = useState<AdminLog[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [actionFilter, setActionFilter] = useState('all')

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const q = query(
                collection(db, 'adminLogs'),
                orderBy('timestamp', 'desc'),
                limit(500)
            )
            const snapshot = await getDocs(q)
            const logsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            })) as AdminLog[]
            setLogs(logsData)
        } catch (error) {
            console.error('Error fetching logs:', error)
            toast.error('Loglar yüklenemedi')
        } finally {
            setLoading(false)
        }
    }

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            log.moderatorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.targetUsername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.targetUserId.includes(searchTerm)
        
        const matchesAction = actionFilter === 'all' || log.action === actionFilter

        return matchesSearch && matchesAction
    })

    const getActionInfo = (action: string) => {
        return ACTION_LABELS[action] || ACTION_LABELS.default
    }

    const actions = Array.from(
        new Set(logs.map(log => log.action))
    ).sort()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Moderatör Aktivite Logu</h1>
                <p className="text-white/60 mt-2">Yönetim ekibinin tüm işlemleri</p>
            </div>

            {/* Filtreler */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                    <Input
                        placeholder="Moderatör, hedef kullanıcı veya ID ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-[#151515] border-white/10 text-white"
                    />
                </div>

                <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                    <option value="all">Tüm İşlemler</option>
                    {actions.map(action => (
                        <option key={action} value={action}>
                            {getActionInfo(action).label}
                        </option>
                    ))}
                </select>

                <Button 
                    onClick={fetchLogs}
                    disabled={loading}
                    variant="outline"
                >
                    <Icons.refresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Logs Tablosu */}
            <div className="bg-[#151515] border border-white/5 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-white/40 uppercase tracking-wider">
                    <div className="col-span-2">İşlem</div>
                    <div className="col-span-3">Moderatör</div>
                    <div className="col-span-3">Hedef</div>
                    <div className="col-span-2">Zaman</div>
                    <div className="col-span-2">Detay</div>
                </div>

                <div className="divide-y divide-white/5">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Icons.spinner className="h-8 w-8 animate-spin text-purple-500" />
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="p-12 text-center text-white/40">
                            {searchTerm || actionFilter !== 'all'
                                ? 'Eşleşen log bulunamadı'
                                : 'Henüz aktivite yok'
                            }
                        </div>
                    ) : (
                        filteredLogs.map((log) => {
                            const actionInfo = getActionInfo(log.action)
                            return (
                                <div key={log.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors">
                                    {/* İşlem */}
                                    <div className="col-span-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{actionInfo.icon}</span>
                                            <span className={cn("text-xs font-bold", actionInfo.color)}>
                                                {actionInfo.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Moderatör */}
                                    <div className="col-span-3">
                                        <div>
                                            <p className="text-white font-medium text-sm">
                                                {log.moderatorName || 'Sistem'}
                                            </p>
                                            <p className="text-xs text-white/40">
                                                {log.moderatorId.slice(0, 8)}...
                                            </p>
                                        </div>
                                    </div>

                                    {/* Hedef */}
                                    <div className="col-span-3">
                                        <div>
                                            <p className="text-white font-medium text-sm">
                                                {log.targetUsername || 'Bilinmiyor'}
                                            </p>
                                            <p className="text-xs text-white/40">
                                                {log.targetUserId.slice(0, 8)}...
                                            </p>
                                        </div>
                                    </div>

                                    {/* Zaman */}
                                    <div className="col-span-2">
                                        <div className="text-right">
                                            <p className="text-white text-sm">
                                                {log.timestamp.toLocaleTimeString('tr-TR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                            <p className="text-xs text-white/40">
                                                {log.timestamp.toLocaleDateString('tr-TR')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Detay */}
                                    <div className="col-span-2">
                                        {log.details && (
                                            <div className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 max-h-12 overflow-y-auto">
                                                {Object.entries(log.details).map(([key, value]) => (
                                                    <div key={key} className="text-white/60">
                                                        <span className="text-white/40">{key}:</span> {String(value)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* İstatistikler */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <p className="text-white/60 text-sm font-medium">Toplam İşlem</p>
                    <h3 className="text-3xl font-bold text-white mt-2">{logs.length}</h3>
                </div>
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <p className="text-white/60 text-sm font-medium">Benzersiz Moderatör</p>
                    <h3 className="text-3xl font-bold text-white mt-2">
                        {new Set(logs.map(l => l.moderatorId)).size}
                    </h3>
                </div>
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <p className="text-white/60 text-sm font-medium">Etkilenen Kullanıcı</p>
                    <h3 className="text-3xl font-bold text-white mt-2">
                        {new Set(logs.map(l => l.targetUserId)).size}
                    </h3>
                </div>
            </div>
        </div>
    )
}
