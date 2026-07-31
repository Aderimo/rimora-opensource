'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Icons } from '@/components/icons'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface PublicList {
    id: string
    name: string
    userId: string
    slug: string
    createdAt: any
    itemCount?: number
    username?: string // Populated later
}

export default function DiscoverPage() {
    const [lists, setLists] = useState<PublicList[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchLists = async () => {
            try {
                const q = query(
                    collection(db, 'customLists'),
                    where('isPublic', '==', true),
                    orderBy('createdAt', 'desc'),
                    limit(20)
                )
                const snapshot = await getDocs(q)
                const fetchedLists = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as PublicList[]
                setLists(fetchedLists)
            } catch (error) {
                console.error('Error fetching public lists:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchLists()
    }, [])

    return (
        <div className="container mx-auto px-4 py-8 pb-20">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                    <Icons.compass className="w-8 h-8 text-purple-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Keşfet</h1>
                    <p className="text-white/50">Diğer kullanıcıların oluşturduğu listelere göz atın.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Icons.spinner className="w-10 h-10 animate-spin text-purple-500" />
                </div>
            ) : lists.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5">
                    <Icons.list className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Henüz Paylaşılan Liste Yok</h3>
                    <p className="text-white/50">İlk listeyi sen oluştur ve paylaş!</p>
                    <Link href="/profil" className="inline-block mt-4 text-purple-400 hover:text-purple-300">
                        Profilime Git &rarr;
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lists.map(list => (
                        <div key={list.id} className="bg-[#151515] border border-white/5 rounded-xl p-6 hover:border-purple-500/50 transition-colors group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-white/5 rounded-lg group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                                    <Icons.list className="w-6 h-6" />
                                </div>
                                <span className="text-xs text-white/30">
                                    {list.createdAt?.seconds ? formatDistanceToNow(new Date(list.createdAt.seconds * 1000), { addSuffix: true, locale: tr }) : 'Yeni'}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">{list.name}</h3>
                            <p className="text-sm text-white/50 mb-6">
                                Bu liste herkese açık olarak paylaşıldı.
                            </p>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-white/40">
                                    <Icons.user className="w-3 h-3" />
                                    <span>Kullanıcı Listesi</span>
                                </div>
                                <Button variant="secondary" size="sm" disabled>
                                    İncele (Yakında)
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
