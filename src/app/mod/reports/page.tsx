'use client'

import { useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function ModReportsPage() {
    const [filter, setFilter] = useState('pending')

    const tabs = [
        { id: 'all', label: 'Tümü' },
        { id: 'pending', label: 'Bekleyen' },
        { id: 'reviewing', label: 'İncelenen' },
        { id: 'resolved', label: 'Çözülen' },
        { id: 'rejected', label: 'Reddedilen' },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Raporlar</h1>
                    <p className="text-white/60">Kullanıcı raporlarını incele ve işle</p>
                </div>
                <div className="bg-red-600 px-3 py-1 rounded-lg text-white text-sm font-bold flex items-center gap-2 animate-pulse">
                    0 Bekleyen
                </div>
            </div>

            <div className="bg-[#151515] border border-white/5 rounded-xl min-h-[500px] flex flex-col">
                {/* Filtreler */}
                <div className="p-4 border-b border-white/5 flex gap-2 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                filter === tab.id
                                    ? "bg-purple-600 text-white"
                                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Liste - Boş Durum */}
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground">
                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                        <Icons.flag className="h-10 w-10 opacity-20" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Rapor bulunamadı</h3>
                    <p className="text-sm">Seçilen filtre için rapor yok</p>
                </div>
            </div>
        </div>
    )
}
