'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getListById, getUserList, type CustomList, type UserListItem } from '@/lib/user-lists'
import { getUserProfile, type UserProfile } from '@/lib/user'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface ListDetailPageProps {
    params: {
        id: string
    }
}

export default function ListDetailPage({ params }: ListDetailPageProps) {
    const [list, setList] = useState<CustomList | null>(null)
    const [items, setItems] = useState<UserListItem[]>([])
    const [creator, setCreator] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const listData = await getListById(params.id)
                if (listData) {
                    setList(listData)
                    // Fetch Creator
                    const creatorData = await getUserProfile(listData.userId)
                    setCreator(creatorData)

                    // Fetch Items
                    const listItems = await getUserList(listData.userId, listData.slug)
                    setItems(listItems)
                }
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [params.id])

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Icons.spinner className="w-10 h-10 animate-spin text-purple-500" /></div>
    }

    if (!list) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white">
                <h1 className="text-2xl font-bold mb-4">Liste Bulunamadı</h1>
                <Link href="/kesfet"><Button>Keşfet'e Dön</Button></Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-20 pt-24 px-4 container mx-auto">
            {/* Header */}
            <div className="mb-10">
                {/* Breadcrumb-ish */}
                <div className="flex items-center gap-2 text-sm text-white/50 mb-4">
                    <Link href="/kesfet" className="hover:text-white transition-colors">Keşfet</Link>
                    <Icons.chevronRight className="w-4 h-4" />
                    <span className="text-white">Liste Detayı</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">{list.name}</h1>

                        <div className="flex items-center gap-4">
                            {creator ? (
                                <Link href={`/profil/${creator.uid}`} className="flex items-center gap-2 group">
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 border border-white/10 group-hover:border-purple-500 transition-colors">
                                        {creator.photoURL ? (
                                            <Image src={creator.photoURL} alt="" width={40} height={40} className="object-cover w-full h-full" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                                                {(creator.displayName || 'U')[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm text-white font-medium group-hover:text-purple-400 transition-colors">{creator.displayName}</p>
                                        <p className="text-xs text-white/50">
                                            {list.createdAt && formatDistanceToNow(list.createdAt, { addSuffix: true, locale: tr })} oluşturuldu
                                        </p>
                                    </div>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-zinc-800" />
                                    <span className="text-white/50">Bilinmeyen Kullanıcı</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="gap-2">
                            <Icons.share className="w-4 h-4" />
                            Paylaş
                        </Button>
                        {/* Like button could go here in future */}
                    </div>
                </div>
            </div>

            {/* List Content */}
            {items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {items.map(item => (
                        <Link
                            key={item.id}
                            href={item.mediaType === 'movie' ? `/filmler/${item.mediaId}` : item.mediaType === 'anime' ? `/animeler/${item.mediaId}` : `/diziler/${item.mediaId}`}
                            className="group relative aspect-[2/3] bg-zinc-900 rounded-xl overflow-hidden shadow-lg hover:ring-2 hover:ring-purple-500 transition-all"
                        >
                            {item.posterPath ? (
                                <Image src={`https://image.tmdb.org/t/p/w500${item.posterPath}`} alt={item.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Icons.film className="w-12 h-12 text-white/10" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                <h3 className="text-white font-semibold text-sm line-clamp-2">{item.title}</h3>
                                <span className="text-xs text-purple-400 mt-1 capitalize inline-block">{item.mediaType === 'movie' ? 'Film' : item.mediaType === 'anime' ? 'Anime' : 'Dizi'}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <Icons.film className="w-16 h-16 text-white/20 mb-4" />
                    <p className="text-lg text-white/50">Bu listede henüz içerik yok.</p>
                </div>
            )}
        </div>
    )
}
