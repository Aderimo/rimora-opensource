'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import {
    getUserRole,
    hasPermission,
    type UserRole,
    ROLE_INFO
} from '@/lib/roles'
import { RefundRequest, approveRefund, rejectRefund, TIER_INFO } from '@/lib/subscription'

export default function RefundsPage() {
    const { user, loading } = useAuth()
    const router = useRouter()

    const [myRole, setMyRole] = useState<UserRole>('user')
    const [checkingAuth, setCheckingAuth] = useState(true)
    const [refunds, setRefunds] = useState<RefundRequest[]>([])
    const [dataLoading, setDataLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending')

    // Check auth and role
    useEffect(() => {
        async function checkAuth() {
            if (!user) {
                setCheckingAuth(false)
                return
            }

            const role = await getUserRole(user.uid, user.email || undefined)
            setMyRole(role)
            setCheckingAuth(false)
        }

        if (!loading) checkAuth()
    }, [user, loading])

    // Load refunds
    useEffect(() => {
        if (!hasPermission(myRole, 'admin')) return

        async function loadRefunds() {
            setDataLoading(true)
            try {
                const q = activeTab === 'pending'
                    ? query(collection(db, 'refundRequests'), where('status', '==', 'pending'), orderBy('requestedAt', 'desc'))
                    : query(collection(db, 'refundRequests'), where('status', 'in', ['approved', 'rejected']), orderBy('processedAt', 'desc'), limit(50))

                const snap = await getDocs(q)

                const refundsData = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    requestedAt: d.data().requestedAt?.toDate(),
                    processedAt: d.data().processedAt?.toDate(),
                })) as RefundRequest[]

                setRefunds(refundsData)
            } catch (error) {
                console.error('Error loading refunds:', error)
            } finally {
                setDataLoading(false)
            }
        }

        loadRefunds()
    }, [myRole, activeTab])

    // Actions
    const handleApprove = async (refundId: string) => {
        if (!user) return
        if (!confirm('Bu iade talebini onaylamak istediğinize emin misiniz?')) return

        setActionLoading(true)
        try {
            await approveRefund(refundId, user.uid)
            setRefunds(prev => prev.filter(r => r.id !== refundId))
            alert('İade talebi onaylandı.')
        } catch (error) {
            console.error('Error approving refund:', error)
            alert('İşlem sırasında hata oluştu.')
        } finally {
            setActionLoading(false)
        }
    }

    const handleReject = async (refundId: string) => {
        if (!user) return
        const reason = prompt('Reddetme nedeni:')
        if (!reason) return

        setActionLoading(true)
        try {
            await rejectRefund(refundId, user.uid, reason)
            setRefunds(prev => prev.filter(r => r.id !== refundId))
            alert('İade talebi reddedildi.')
        } catch (error) {
            console.error('Error rejecting refund:', error)
            alert('İşlem sırasında hata oluştu.')
        } finally {
            setActionLoading(false)
        }
    }

    // Loading
    if (loading || checkingAuth) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // Not authorized
    if (!hasPermission(myRole, 'admin')) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center">
                <Icons.shield className="h-16 w-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Erişim Engellendi</h1>
                <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">İade Yönetimi</h1>
                    <p className="text-muted-foreground">
                        Bilet durumu: {activeTab === 'pending' ? 'Bekleyenler' : 'İşlenenler'}
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push('/admin')}>
                    <Icons.chevronLeft className="h-4 w-4 mr-2" />
                    Admin Panel
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        activeTab === 'pending'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                    )}
                >
                    Bekleyen Talepler
                </button>
                <button
                    onClick={() => setActiveTab('processed')}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        activeTab === 'processed'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                    )}
                >
                    Geçmiş İşlemler
                </button>
            </div>

            {/* Refunds Table */}
            {dataLoading ? (
                <div className="flex justify-center py-12">
                    <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted">
                            <tr>
                                <th className="text-left p-4">Kullanıcı ID</th>
                                <th className="text-left p-4">Abonelik</th>
                                <th className="text-left p-4">Tutar</th>
                                <th className="text-left p-4">Neden</th>
                                <th className="text-left p-4">Tarih</th>
                                <th className="text-left p-4">Durum</th>
                                {activeTab === 'pending' && <th className="text-left p-4">İşlemler</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {refunds.map((r) => {
                                const tierInfo = TIER_INFO[r.subscriptionTier]

                                return (
                                    <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                                        <td className="p-4 font-mono text-xs">{r.userId}</td>
                                        <td className="p-4">
                                            <span style={{ color: tierInfo?.color || 'inherit' }} className="font-medium">
                                                {tierInfo?.label || r.subscriptionTier}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold">₺{r.amount}</td>
                                        <td className="p-4 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                                        <td className="p-4 text-sm text-muted-foreground">
                                            {r.requestedAt?.toLocaleDateString('tr-TR')}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                'px-2 py-1 rounded text-xs',
                                                r.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                                    r.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                                        'bg-red-500/10 text-red-500'
                                            )}>
                                                {r.status === 'pending' ? 'Bekliyor'
                                                    : r.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                                            </span>
                                        </td>
                                        {activeTab === 'pending' && (
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleApprove(r.id)}
                                                        disabled={actionLoading}
                                                    >
                                                        <Icons.check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleReject(r.id)}
                                                        disabled={actionLoading}
                                                    >
                                                        <Icons.close className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    {refunds.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                            {activeTab === 'pending' ? 'Bekleyen talep yok' : 'Geçmiş işlem bulunamadı'}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
