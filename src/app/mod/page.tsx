'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icons, IconName } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { collection, getCountFromServer, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getFeedbackStats } from '@/lib/feedback'
import { CreateUserTicketModal } from '@/components/mod/create-user-ticket-modal'
import { RoomChat } from '@/components/mod/room-chat'

interface StatCard {
    label: string
    value: string
    iconName: IconName
    color: string
    bg: string
    border: string
    status: string
    statusColor: string
}

export default function ModDashboard() {
    const [stats, setStats] = useState({
        userCount: 0,
        reportCount: 0, // Şimdilik mock veya reports colelction'dan
        feedbackCount: 0,
        feedbackPending: 0
    })
    const [showCreateTicketModal, setShowCreateTicketModal] = useState(false)

    const renderIcon = (iconName: IconName, colorClass: string) => {
        const iconProps = { className: cn("h-6 w-6", colorClass) }
        
        switch(iconName) {
            case 'users':
                return <Icons.users {...iconProps} />
            case 'messageSquare':
                return <Icons.messageSquare {...iconProps} />
            case 'check':
                return <Icons.check {...iconProps} />
            case 'flag':
                return <Icons.flag {...iconProps} />
            default:
                return null
        }
    }

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Kullanıcı Sayısı (Fallback logic)
                let userCount = 0
                try {
                    const usersSnap = await getCountFromServer(collection(db, 'users'))
                    userCount = usersSnap.data().count
                } catch (e) {
                    console.log('Count aggregation failed, trying getDocs fallback', e)
                    const usersSnap = await getDocs(collection(db, 'users'))
                    userCount = usersSnap.size
                }

                // Destek Talepleri
                const feedbackStats = await getFeedbackStats()

                setStats({
                    userCount: userCount,
                    reportCount: 0,
                    feedbackCount: feedbackStats.total,
                    feedbackPending: feedbackStats.pending
                })
            } catch (error) {
                console.error('Stats loading failed', error)
            }
        }
        fetchStats()
    }, [])

    const statCards: StatCard[] = [
        {
            label: 'Toplam Kullanıcı',
            value: stats.userCount.toString(),
            iconName: 'users',
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20',
            status: 'Kayıtlı',
            statusColor: 'text-green-400'
        },
        {
            label: 'Bekleyen Destek',
            value: stats.feedbackPending.toString(),
            iconName: 'messageSquare',
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            status: 'Aktif',
            statusColor: 'text-blue-400'
        },
        {
            label: 'Toplam Talepler',
            value: stats.feedbackCount.toString(),
            iconName: 'check',
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20',
            status: 'Yönetiliyor',
            statusColor: 'text-purple-400'
        },
        {
            label: 'Raporlar',
            value: stats.reportCount.toString(),
            iconName: 'flag',
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            status: 'İncelenmeli',
            statusColor: 'text-red-400'
        },
    ]

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">Yönetim Paneli</h1>
                    <p className="text-white/60 mt-2">Sitenin durumunu izleyin ve yönetin</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/mod/feedback">
                        <Button variant="outline" size="sm">
                            <Icons.messageSquare className="h-4 w-4 mr-2" />
                            Destek Talepleri
                        </Button>
                    </Link>
                </div>
            </div>

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <div
                        key={i}
                        className={cn(
                            "relative overflow-hidden rounded-xl p-6 border transition-all hover:scale-[1.02]",
                            "bg-[#151515] border-white/5",
                            stat.border
                        )}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={cn("p-3 rounded-xl", stat.bg)}>
                                {renderIcon(stat.iconName, stat.color)}
                            </div>
                            <span className={cn("text-xs font-bold px-2 py-1 rounded-full bg-white/5", stat.statusColor)}>
                                {stat.status}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-4xl font-bold text-white">{stat.value}</h3>
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Yetki Bilgilendirmesi */}
            <div className="p-6 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 flex items-center gap-6">
                <div className="p-4 bg-orange-500 rounded-xl text-white shadow-lg shadow-orange-500/20">
                    <Icons.crown className="h-8 w-8" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-orange-400">Yönetim Paneline Hoş Geldiniz</h3>
                    <p className="text-white/60 mt-1">Buradan kullanıcıları yönetebilir, destek taleplerini yanıtlayabilir ve site güvenliğini sağlayabilirsiniz.</p>
                </div>
            </div>

            {/* Hızlı Erişim Linkler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/mod/feedback">
                    <div className="p-6 rounded-xl bg-[#1a1a1a] border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500/10 rounded-lg">
                                <Icons.messageSquare className="h-6 w-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Destek Talepleri</h3>
                                <p className="text-sm text-white/50">Gelen destek taleplerini yönet</p>
                            </div>
                            <Icons.chevronRight className="h-5 w-5 text-white/30 ml-auto" />
                        </div>
                    </div>
                </Link>
                <div className="p-6 rounded-xl bg-[#1a1a1a] border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer">
                    <button
                        onClick={() => setShowCreateTicketModal(true)}
                        className="w-full text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <Icons.flag className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Kullanıcıya Karşı Ticket</h3>
                                <p className="text-sm text-white/50">Şikayet veya uyarı oluştur</p>
                            </div>
                            <Icons.chevronRight className="h-5 w-5 text-white/30 ml-auto" />
                        </div>
                    </button>
                </div>
            </div>

            {/* Mod Odası */}
            <div className="mt-8">
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Icons.messageCircle className="h-6 w-6 text-cyan-400" />
                        Moderatör Odası
                    </h2>
                    <p className="text-white/60 mt-1">Moderatörler arası özel sohbet alanı</p>
                </div>
                <div className="bg-[#1a1a1a] border border-white/5 rounded-lg overflow-hidden">
                    <RoomChat roomId="mod-main" />
                </div>
            </div>

            {/* Modal */}
            <CreateUserTicketModal 
                isOpen={showCreateTicketModal} 
                onClose={() => setShowCreateTicketModal(false)} 
            />

        </div>
    )
}
