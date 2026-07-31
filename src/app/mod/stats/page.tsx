'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ROLE_INFO, UserRole, getUserRole, hasPermission } from '@/lib/roles'
import { toast } from 'sonner'

interface RoleStats {
    role: UserRole
    count: number
    percentage: number
}

export default function ModStatsPage() {
    const { user, loading } = useAuth()
    const router = useRouter()
    const [roleStats, setRoleStats] = useState<RoleStats[]>([])
    const [totalUsers, setTotalUsers] = useState(0)
    const [loading2, setLoading2] = useState(true)
    const [isAuthorized, setIsAuthorized] = useState(false)

    const roles: UserRole[] = ['founder', 'admin', 'moderator', 'user']

    useEffect(() => {
        const checkAuth = async () => {
            if (!user) {
                setLoading2(false)
                return
            }
            
            try {
                const role = await getUserRole(user.uid, user.email || undefined)
                if (hasPermission(role, 'moderator')) {
                    setIsAuthorized(true)
                } else {
                    toast.error('Bu sayfaya erişme yetkiniz yok')
                    router.push('/mod')
                }
            } catch (error) {
                console.error('Auth check error:', error)
                toast.error('Yetkilendirme hatası')
                router.push('/mod')
            } finally {
                setLoading2(false)
            }
        }
        
        if (!loading) {
            checkAuth()
        }
    }, [user, loading, router])

    useEffect(() => {
        if (isAuthorized) {
            fetchStats()
        }
    }, [isAuthorized])

    const fetchStats = async () => {
        setLoading2(true)
        try {
            // Toplam kullanıcı
            const usersSnap = await getDocs(collection(db, 'users'))
            const total = usersSnap.size
            setTotalUsers(total)

            // Her rol için sayı
            const stats: RoleStats[] = []
            for (const role of roles) {
                let count = 0
                if (role === 'user') {
                    // user = moderators'da olmayan
                    const modsSnap = await getDocs(collection(db, 'moderators'))
                    count = total - modsSnap.size
                } else {
                    const q = query(collection(db, 'moderators'), where('role', '==', role))
                    const snap = await getDocs(q)
                    count = snap.size
                }

                stats.push({
                    role,
                    count,
                    percentage: total > 0 ? (count / total) * 100 : 0
                })
            }

            setRoleStats(stats)
        } catch (error) {
            console.error('Error fetching stats:', error)
            toast.error('İstatistikler yüklenemedi')
        } finally {
            setLoading2(false)
        }
    }

    const getColor = (role: UserRole) => {
        const colors: Record<UserRole, string> = {
            founder: 'from-orange-600 to-orange-700',
            admin: 'from-orange-500 to-orange-600',
            moderator: 'from-purple-500 to-purple-600',
            user: 'from-gray-500 to-gray-600'
        }
        return colors[role]
    }

    const getBgColor = (role: UserRole) => {
        const colors: Record<UserRole, string> = {
            founder: 'bg-orange-600/20 border-orange-500/30',
            admin: 'bg-orange-500/20 border-orange-500/30',
            moderator: 'bg-purple-500/20 border-purple-500/30',
            user: 'bg-gray-500/20 border-gray-500/30'
        }
        return colors[role]
    }

    if (loading || loading2) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Icons.spinner className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        )
    }

    if (!isAuthorized) {
        return null
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Rol İstatistikleri</h1>
                <p className="text-white/60 mt-2">Platformdaki kullanıcıların rol dağılımı</p>
            </div>

            {/* Özet Kart */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm font-medium">Toplam Kullanıcı</p>
                            <h2 className="text-4xl font-bold text-white mt-2">{totalUsers}</h2>
                        </div>
                        <Icons.users className="h-12 w-12 text-blue-400/20" />
                    </div>
                </div>

                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm font-medium">Yönetim Ekibi</p>
                            <h2 className="text-4xl font-bold text-white mt-2">
                                {roleStats.reduce((sum, s) => s.role !== 'user' ? sum + s.count : sum, 0)}
                            </h2>
                        </div>
                        <Icons.shield className="h-12 w-12 text-purple-400/20" />
                    </div>
                </div>

                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm font-medium">Yönetim Oranı</p>
                            <h2 className="text-4xl font-bold text-white mt-2">
                                {totalUsers > 0 
                                    ? ((roleStats.reduce((sum, s) => s.role !== 'user' ? sum + s.count : sum, 0) / totalUsers) * 100).toFixed(1)
                                    : 0
                                }%
                            </h2>
                        </div>
                        <Icons.chart className="h-12 w-12 text-cyan-400/20" />
                    </div>
                </div>

                <div className="bg-[#151515] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/60 text-sm font-medium">Son Güncelleme</p>
                            <h2 className="text-sm font-bold text-white mt-2">
                                {new Date().toLocaleTimeString('tr-TR')}
                            </h2>
                        </div>
                        <Icons.refresh className="h-12 w-12 text-green-400/20" />
                    </div>
                </div>
            </div>

            {/* Rol Detayları */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Rol Dağılımı</h2>
                    <Button 
                        size="sm" 
                        variant="outline"
                        onClick={fetchStats}
                        disabled={loading}
                    >
                        <Icons.refresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Yenile
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {loading ? (
                        <div className="col-span-2 flex justify-center py-12">
                            <Icons.spinner className="h-8 w-8 animate-spin text-purple-500" />
                        </div>
                    ) : (
                        roleStats.map((stat) => (
                            <div
                                key={stat.role}
                                className={`${getBgColor(stat.role)} border rounded-xl p-4 backdrop-blur-sm`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="text-2xl">
                                            {ROLE_INFO[stat.role].emoji}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">
                                                {ROLE_INFO[stat.role].label}
                                            </h3>
                                            <p className="text-xs text-white/50">
                                                {stat.role === 'user' ? 'Standart Kullanıcı' : 'Yönetim Ekibi'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Sayı ve Yüzde */}
                                <div className="flex items-end justify-between">
                                    <div>
                                        <p className="text-2xl font-bold text-white">
                                            {stat.count}
                                        </p>
                                        <p className="text-xs text-white/50 mt-1">
                                            {stat.percentage.toFixed(1)}%
                                        </p>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="flex-1 mx-3">
                                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${getColor(stat.role)}`}
                                                style={{ width: `${Math.max(stat.percentage, 5)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bilgi */}
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <p className="text-xs text-white/50">
                                        {stat.role === 'founder' && '👑 Platform kurucusu - Tüm yetkiler'}
                                        {stat.role === 'admin' && '⚙️ Yönetici - Neredeyse tüm yetkiler'}
                                        {stat.role === 'moderator' && '🛡️ Moderatör - Moderat erişim'}
                                        {stat.role === 'user' && '👤 Normal kullanıcı - Mod paneline erişim yok'}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Grafik Tavsiyesi */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                <div className="flex items-start gap-3">
                    <Icons.info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-blue-400 mb-2">İstatistikler Hakkında</h3>
                        <ul className="text-sm text-blue-300/80 space-y-1">
                            <li>• Toplam {totalUsers} kullanıcı arasında rol dağılımı</li>
                            <li>• Yönetim ekibi boyutu ve bileşimi</li>
                            <li>• Her rol seviyesinin işlevleri ve yetkileri</li>
                            <li>• Otomatik olarak güncellenir</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
