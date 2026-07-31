'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getUserProfile, type UserProfile } from '@/lib/user'
import { getPublicListsByUser, type CustomList, getUserList, type UserListItem } from '@/lib/user-lists'
import { Timestamp } from 'firebase/firestore'
import { getFollowCounts } from '@/lib/social'
import { getUserStats, type UserStats } from '@/lib/user-stats'
import { FollowButton } from '@/components/profile/follow-button'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface PublicProfilePageProps {
    params: {
        id: string
    }
}

export default function PublicProfilePage({ params }: PublicProfilePageProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [lists, setLists] = useState<CustomList[]>([])
    const [listPreviews, setListPreviews] = useState<Record<string, UserListItem[]>>({})
    const [stats, setStats] = useState({ followers: 0, following: 0 })
    const [userActivityStats, setUserActivityStats] = useState<UserStats | null>(null)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [userProfile, userLists, followStats, activityStats] = await Promise.all([
                    getUserProfile(params.id),
                    getPublicListsByUser(params.id),
                    getFollowCounts(params.id),
                    getUserStats(params.id).catch(() => null)
                ])

                setProfile(userProfile)
                setLists(userLists)
                setStats(followStats)
                setUserActivityStats(activityStats)

                // Load previews for lists (first 3 items) - This might be heavy if many lists, consider optimizing
                if (userLists.length > 0) {
                    const previewData: Record<string, UserListItem[]> = {}
                    await Promise.all(userLists.map(async (list) => {
                        const items = await getUserList(params.id, list.slug)
                        previewData[list.id] = items.slice(0, 3)
                    }))
                    setListPreviews(previewData)
                }

            } catch (error) {
                console.error('Error loading profile:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [params.id])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-10 h-10 animate-spin text-purple-500" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white">
                <Icons.userX className="w-16 h-16 text-white/20 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Kullanıcı Bulunamadı</h1>
                <Link href="/">
                    <Button variant="secondary">Ana Sayfaya Dön</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Cover / Header */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 animate-gradient-x" />
                <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

                <div className="absolute bottom-0 left-0 w-full p-6 md:p-10">
                    <div className="container mx-auto flex flex-col md:flex-row items-end gap-6">
                        {/* Avatar */}
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-4 border-background shadow-2xl bg-zinc-800 relative z-10">
                            {profile.photoURL ? (
                                <Image src={profile.photoURL} alt={profile.displayName || 'User'} fill className="object-cover" sizes="(max-width: 768px) 128px, 160px" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white">
                                    {(profile.displayName || 'U')[0].toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* User Info */}
                        <div className="flex-1 mb-2">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg">
                                    {profile.displayName || 'İsimsiz Kullanıcı'}
                                </h1>
                                {profile.role === 'admin' || profile.role === 'moderator' ? (
                                    <span className="bg-red-500/20 text-red-500 text-xs px-2 py-1 rounded border border-red-500/20 font-bold uppercase">
                                        {profile.role}
                                    </span>
                                ) : null}
                            </div>
                            {profile.bio && (
                                <p className="text-white/80 max-w-2xl text-lg mt-2">{profile.bio}</p>
                            )}

                            {/* Stats */}
                            <div className="flex gap-6 mt-4 text-white/90">
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl font-bold">{stats.followers}</span>
                                    <span className="text-xs uppercase tracking-wider opacity-70">Takipçi</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl font-bold">{stats.following}</span>
                                    <span className="text-xs uppercase tracking-wider opacity-70">Takip</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl font-bold">{userActivityStats?.moviesWatched || 0}</span>
                                    <span className="text-xs uppercase tracking-wider opacity-70">Film</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mb-2">
                            <FollowButton targetUserId={profile.uid} />
                            {/* <Button variant="secondary" size="icon">
                  <Icons.moreHorizontal className="w-5 h-5" />
               </Button> */}
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-12">
                {/* Public Lists */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <Icons.list className="text-purple-500" />
                        Paylaşılan Listeler
                    </h2>

                    {lists.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {lists.map(list => (
                                <Link key={list.id} href={`/liste/${list.id}`} className="group block bg-[#151515] border border-white/5 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-colors">
                                    {/* Preview Images */}
                                    <div className="h-32 bg-zinc-900 relative flex items-center justify-center overflow-hidden">
                                        {listPreviews[list.id]?.length > 0 ? (
                                            <div className="flex w-full h-full">
                                                {listPreviews[list.id].map((item, i) => (
                                                    <div key={item.id} className="flex-1 relative border-r border-black/20 last:border-0">
                                                        {item.posterPath ? (
                                                            <Image src={`https://image.tmdb.org/t/p/w342${item.posterPath}`} alt="" fill className="object-cover" sizes="33vw" />
                                                        ) : <div className="w-full h-full bg-zinc-800" />}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <Icons.film className="w-10 h-10 text-white/10" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#151515] to-transparent opacity-80" />
                                    </div>

                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-white group-hover:text-purple-400 transition-colors">{list.name}</h3>
                                            <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">
                                                {list.createdAt && formatDistanceToNow(
                                                    list.createdAt instanceof Timestamp
                                                        ? list.createdAt.toDate()
                                                        : new Date(list.createdAt as any),
                                                    { addSuffix: true, locale: tr }
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-white/50">
                                            <Icons.layers className="w-4 h-4" />
                                            <span>{listPreviews[list.id]?.length || 0} İçerik</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-white/50">Bu kullanıcının henüz herkese açık bir listesi yok.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
