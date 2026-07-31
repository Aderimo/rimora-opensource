'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { EditProfileModal } from '@/components/profile/edit-profile-modal'
import { SupportModal } from '@/components/profile/support-modal'
import { EditListModal } from '@/components/profile/edit-list-modal'
import { CreateListModal } from '@/components/profile/create-list-modal'
import { BadgeGrid } from '@/components/profile/badge-grid'
import { getUserList, type UserListItem, getCustomLists, type CustomList, removeFromList } from '@/lib/user-lists'
import { getImageUrl } from '@/lib/api/tmdb'
import { getFollowCounts } from '@/lib/social'
import { getUserBadges, type Badge } from '@/lib/badges'
import { getUserStats, type UserStats } from '@/lib/user-stats'
import { getUserRole, isModerator as checkIsModerator } from '@/lib/roles'
import { cn } from '@/lib/utils'

type TabType = 'watchlist' | 'favorites' | 'watched' | 'badges' | string
type MediaTypeFilter = 'all' | 'movie' | 'tv' | 'anime'

export default function ProfilePage() {
  const { user, userProfile, loading, signOut } = useAuth()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabType>('watchlist')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditListModal, setShowEditListModal] = useState(false)

  const [lists, setLists] = useState<Record<string, UserListItem[]>>({
    watchlist: [],
    favorites: [],
    watched: [],
  })

  const [customLists, setCustomLists] = useState<CustomList[]>([])
  const [listsLoading, setListsLoading] = useState(true)
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [badges, setBadges] = useState<Badge[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isModerator, setIsModerator] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMediaType, setSelectedMediaType] = useState<MediaTypeFilter>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/giris')
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      setListsLoading(true)
      const loadData = async () => {
        try {
          const [watchlist, favorites, watched, counts, userBadges, stats, cLists] = await Promise.all([
            getUserList(user.uid, 'watchlist').catch(() => []),
            getUserList(user.uid, 'favorites').catch(() => []),
            getUserList(user.uid, 'watched').catch(() => []),
            getFollowCounts(user.uid).catch(() => ({ followers: 0, following: 0 })),
            getUserBadges(user.uid).catch(() => []),
            getUserStats(user.uid).catch(() => null),
            getCustomLists(user.uid).catch(() => []),
          ])

          setLists(prev => ({ ...prev, watchlist, favorites, watched }))
          setFollowCounts(counts)
          setBadges(userBadges)
          setUserStats(stats)
          setCustomLists(cLists)

          if (cLists.length > 0) {
            const results = await Promise.all(
              cLists.map(list => getUserList(user.uid, list.slug).then(items => ({ slug: list.slug, items })))
            )
            setLists(prev => {
              const next = { ...prev }
              results.forEach(({ slug, items }) => { next[slug] = items })
              return next
            })
          }
        } catch (error) {
          console.error("Error loading profile data", error)
        } finally {
          setListsLoading(false)
        }
      }
      loadData()
      checkModeratorStatus()
    }
  }, [user])

  const checkModeratorStatus = async () => {
    if (!user) return
    try {
      const role = await getUserRole(user.uid, user.email || undefined)
      setIsModerator(checkIsModerator(role))
    } catch (error) {
      console.error('Error checking permissions:', error)
    }
  }

  if (loading) return null
  if (!user) return null

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleRemoveFromList = async (item: UserListItem) => {
    if (!user) return
    setDeleting(item.id)
    try {
      await removeFromList(user.uid, item.mediaId, item.mediaType, item.listType)
      setLists(prev => ({
        ...prev,
        [activeTab]: prev[activeTab]?.filter(i => i.id !== item.id) || []
      }))
    } catch (error) {
      console.error('Error removing item:', error)
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedItems.size === filteredList.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredList.map(item => item.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return
    
    if (!confirm(`${selectedItems.size} öğe silinecek. Emin misiniz?`)) {
      return
    }

    setIsDeleting(true)
    try {
      await Promise.all(
        Array.from(selectedItems).map(itemId => {
          const item = currentList.find(i => i.id === itemId)
          if (item) {
            return removeFromList(user!.uid, item.mediaId, item.mediaType, item.listType)
          }
          return Promise.resolve()
        })
      )

      setLists(prev => ({
        ...prev,
        [activeTab]: prev[activeTab]?.filter(i => !selectedItems.has(i.id)) || []
      }))

      setSelectedItems(new Set())
    } catch (error) {
      console.error('Error deleting items:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const currentList = lists[activeTab] || []
  
  // Arama ve filtrelemeden sonra gösterilecek liste
  const filteredList = currentList.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedMediaType === 'all' || item.mediaType === selectedMediaType
    return matchesSearch && matchesType
  })

  // Menü öğelerini hazırla
  const menuItems = [
    {
      id: 'watchlist',
      label: 'İzlenecekler',
      icon: Icons.clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      count: lists.watchlist?.length
    },
    {
      id: 'favorites',
      label: 'Favorilerim',
      icon: Icons.heart,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      count: lists.favorites?.length
    },
    {
      id: 'watched',
      label: 'İzlediklerim',
      icon: Icons.check,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      count: lists.watched?.length
    },
    {
      id: 'badges',
      label: 'Rozetlerim',
      icon: Icons.award,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      count: badges.length
    },
  ]

  return (
    <div className="min-h-screen pb-20">

      {/* Header Banner - Daha geniş ve şık */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-900 via-fuchsia-900 to-rose-900 animate-gradient-x" />
        <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10">
          <div className="container mx-auto flex flex-col md:flex-row items-end gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-4 border-background shadow-2xl bg-muted relative z-10">
                {userProfile?.photoURL ? (
                  <Image src={userProfile.photoURL} alt="Profil" fill className="object-cover" sizes="(max-width: 768px) 128px, 160px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-4xl font-bold">
                    {(userProfile?.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowEditModal(true)}
                className="absolute bottom-2 right-2 z-20 p-2 bg-primary text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
              >
                <Icons.edit className="h-4 w-4" />
              </button>
              {isModerator && (
                <div className="absolute -top-2 -right-2 z-20 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg border-2 border-background flex items-center gap-1">
                  <Icons.shield className="h-3 w-3" />
                  MOD
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 mb-2">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg">
                  {userProfile?.displayName || 'Kullanıcı'}
                </h1>
              </div>
              {userProfile?.bio && <p className="text-white/80 max-w-2xl text-lg">{userProfile.bio}</p>}

              <div className="flex gap-6 mt-4 text-white/90">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">{followCounts.followers}</span>
                  <span className="text-xs uppercase tracking-wider opacity-70">Takipçi</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">{followCounts.following}</span>
                  <span className="text-xs uppercase tracking-wider opacity-70">Takip</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">{userStats?.moviesWatched || 0}</span>
                  <span className="text-xs uppercase tracking-wider opacity-70">Film</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-2">
              {isModerator && (
                <Link href="/mod">
                  <Button variant="destructive" className="gap-2 shadow-lg shadow-red-500/20">
                    <Icons.shield className="h-4 w-4" />
                    Mod Görünümü
                  </Button>
                </Link>
              )}
              <Button variant="secondary" onClick={() => setShowEditModal(true)} className="gap-2">
                <Icons.settings className="h-4 w-4" />
                Profili Düzenle
              </Button>
              <Button variant="secondary" onClick={() => setShowSupportModal(true)} className="gap-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20">
                <Icons.help className="h-4 w-4" />
                Destek
              </Button>
              <Button variant="secondary" onClick={handleSignOut} className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
                <Icons.logout className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* SOL MENÜ (SIDEBAR) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold px-2 mb-4 flex items-center gap-2">
                <Icons.menu className="h-5 w-5 text-primary" />
                Menü
              </h3>

              {/* Standart Listeler */}
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 border border-transparent group",
                    activeTab === item.id
                      ? "bg-white/10 border-white/10 shadow-lg scale-[1.02]"
                      : "hover:bg-white/5 hover:border-white/5"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-lg transition-transform group-hover:scale-110", item.bg, item.color)}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className={cn("font-medium text-lg", activeTab === item.id ? "text-white" : "text-white/70")}>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span className="bg-white/10 px-2.5 py-0.5 rounded-full text-xs font-mono">{item.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Özel Listeler */}
            <div className="space-y-2 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Icons.list className="h-5 w-5 text-purple-400" />
                  Listelerim
                </h3>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => setShowCreateModal(true)}>
                  <Icons.plus className="h-4 w-4" />
                </Button>
              </div>

              {customLists.map(list => (
                <button
                  key={list.id}
                  onClick={() => setActiveTab(list.slug)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 border border-transparent group",
                    activeTab === list.slug
                      ? "bg-purple-500/20 border-purple-500/30 text-purple-200 shadow-lg scale-[1.02]"
                      : "hover:bg-white/5 hover:border-white/5 text-white/70"
                  )}
                >
                  <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                    <Icons.list className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-lg truncate flex-1 text-left">{list.name}</span>
                  <span className="bg-white/5 px-2.5 py-0.5 rounded-full text-xs font-mono">
                    {lists[list.slug]?.length || 0}
                  </span>
                </button>
              ))}

              {customLists.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                >
                  <Icons.plus className="h-5 w-5" />
                  <span>Yeni Liste Oluştur</span>
                </button>
              )}
            </div>
          </div>

          {/* SAĞ İÇERİK ALANI */}
          <div className="lg:col-span-3">
            <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-6 min-h-[500px]">

              {/* Başlık */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  {/* Aktif tab ikonu ve başlığı */}
                  {/* Aktif tab başlığı */}
                  {(() => {
                    // Bu mantığı dışarı çıkarıp değişken olarak da kullanabilirdik ama 
                    // render içinde basit bir if-else yapısı daha güvenli.
                    // IIFE yerine doğrudan JSX expression kullanalım.

                    const activeMenuItem = menuItems.find(i => i.id === activeTab)
                    const activeCustomList = customLists.find(l => l.slug === activeTab)

                    if (activeMenuItem) {
                      const Icon = activeMenuItem.icon
                      return (
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-7 w-7", activeMenuItem.color)} />
                          <span>{activeMenuItem.label}</span>
                        </div>
                      )
                    }

                    if (activeCustomList) {
                      return (
                        <div className="flex items-center gap-2">
                          <Icons.list className="h-7 w-7 text-purple-400" />
                          <span>{activeCustomList.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 ml-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
                            onClick={() => setShowEditListModal(true)}
                          >
                            <Icons.settings className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    }

                    return <span>{activeTab}</span>
                  })()}
                </h2>
                {currentList.length > 0 && (
                  <span className="text-sm text-white/50">{filteredList.length} / {currentList.length} içerik</span>
                )}
              </div>

              {/* Arama ve Filtreleme */}
              {activeTab !== 'badges' && currentList.length > 0 && (
                <div className="mb-6 space-y-4">
                  {/* Arama Barı */}
                  <div className="relative">
                    <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <input
                      type="text"
                      placeholder="Liste içinde ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  {/* Tür Filtreleme Butonları */}
                  <div className="flex gap-2 flex-wrap items-center justify-between">
                    <div className="flex gap-2 flex-wrap">
                      {(['all', 'movie', 'tv', 'anime'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setSelectedMediaType(type)}
                          className={cn(
                            'px-4 py-2 rounded-lg font-medium transition-all duration-200 border',
                            selectedMediaType === type
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                              : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:border-white/20'
                          )}
                        >
                          {type === 'all' && 'Tümü'}
                          {type === 'movie' && '🎬 Film'}
                          {type === 'tv' && '📺 Dizi'}
                          {type === 'anime' && '🎨 Anime'}
                        </button>
                      ))}
                    </div>

                    {/* Toplu Seçim Butonları */}
                    {filteredList.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSelectAll}
                          className={cn(
                            'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border',
                            selectedItems.size > 0
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : 'bg-white/5 text-white/50 border-white/10'
                          )}
                        >
                          {selectedItems.size === filteredList.length ? 'Seçimi Temizle' : `Tümünü Seç (${filteredList.length})`}
                        </button>
                        {selectedItems.size > 0 && (
                          <button
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                            className="px-3 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                          >
                            {isDeleting ? (
                              <>
                                <Icons.spinner className="h-4 w-4 animate-spin" />
                                Siliniyor...
                              </>
                            ) : (
                              <>
                                <Icons.trash className="h-4 w-4" />
                                {selectedItems.size} Sil
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* İçerik */}
              {listsLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Icons.spinner className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : activeTab === 'badges' ? (
                <BadgeGrid
                  earnedBadges={badges}
                  userStats={{
                    moviesWatched: userStats?.moviesWatched || 0,
                    episodesWatched: userStats?.episodesWatched || 0,
                    animeWatched: userStats?.animesWatched || 0,
                    followers: followCounts.followers,
                    following: followCounts.following,
                    comments: 0,
                    favorites: lists.favorites?.length || 0,
                    watchParties: 0,
                  }}
                />
              ) : currentList.length > 0 ? (
                <>
                  {filteredList.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {filteredList.map((item, index) => (
                        <div
                          key={item.id}
                          className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                        >
                          <Link
                            href={item.mediaType === 'movie' ? `/filmler/${item.mediaId}` : item.mediaType === 'anime' ? `/animeler/${item.mediaId}` : `/diziler/${item.mediaId}`}
                            className="block w-full h-full"
                          >
                            {item.posterPath ? (
                              <Image
                                src={getImageUrl(item.posterPath, 'w342') || ''}
                                alt={item.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Icons.film className="h-10 w-10 text-white/20" />
                              </div>
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <p className="text-sm font-semibold text-white line-clamp-2 leading-tight">{item.title}</p>
                            </div>
                          </Link>

                          {/* Checkbox */}
                          <div
                            onClick={() => handleToggleSelect(item.id)}
                            className="absolute top-2 left-2 z-20 cursor-pointer"
                          >
                            <div className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                              selectedItems.has(item.id)
                                ? 'bg-primary border-primary'
                                : 'border-white/30 bg-black/40 hover:border-white/50'
                            )}>
                              {selectedItems.has(item.id) && (
                                <Icons.check className="h-3 w-3 text-white" />
                              )}
                            </div>
                          </div>

                          {/* Sil Butonu - Seçilmişse gizle */}
                          {!selectedItems.has(item.id) && (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                const confirmDelete = confirm(`"${item.title}" silinecek. Emin misiniz?`)
                                if (confirmDelete) {
                                  handleRemoveFromList(item)
                                }
                              }}
                              disabled={deleting === item.id}
                              className="absolute top-2 right-2 p-2 rounded-lg bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg z-10"
                              title="Listeden Kaldır"
                            >
                              {deleting === item.id ? (
                                <Icons.spinner className="h-4 w-4 animate-spin" />
                              ) : (
                                <Icons.trash className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                        <Icons.search className="h-10 w-10 text-white/20" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Sonuç Bulunamadı</h3>
                      <p className="text-white/50 max-w-sm">Arama kriterlerine uygun içerik bulunamadı. Filtrelemeleri yeniden deneyin.</p>
                    </div>
                  )}
                </>
              ) : currentList.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {currentList.map((item, index) => (
                    <Link
                      key={item.id}
                      href={item.mediaType === 'movie' ? `/filmler/${item.mediaId}` : item.mediaType === 'anime' ? `/animeler/${item.mediaId}` : `/diziler/${item.mediaId}`}
                      className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                    >
                      {item.posterPath ? (
                        <Image
                          src={getImageUrl(item.posterPath, 'w342') || ''}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icons.film className="h-10 w-10 text-white/20" />
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-sm font-semibold text-white line-clamp-2 leading-tight">{item.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <Icons.folderOpen className="h-10 w-10 text-white/20" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Liste Boş</h3>
                  <p className="text-white/50 max-w-sm mb-8">Bu listede henüz hiç içerik yok. Keşfetmeye başlayın!</p>
                  <Link href="/">
                    <Button size="lg" className="gap-2">
                      <Icons.compass className="h-5 w-5" />
                      Keşfet
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <EditProfileModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} />
      <SupportModal
        userId={user.uid}
        userEmail={user.email || undefined}
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
      <CreateListModal
        userId={user.uid}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onListCreated={(newList) => {
          setCustomLists(prev => [newList, ...prev])
          setLists(prev => ({ ...prev, [newList.slug]: [] }))
          setActiveTab(newList.slug)
        }}
      />

      {(() => {
        // Aktif listenin custom list olup olmadığını bul
        const activeList = customLists.find(l => l.slug === activeTab)
        if (!activeList) return null

        return (
          <EditListModal
            list={activeList}
            isOpen={showEditListModal}
            onClose={() => setShowEditListModal(false)}
            onUpdate={(updatedList) => {
              setCustomLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l))
              // Eğer slug değişmediyse sorun yok, değiştiyse tab yönetimi karışabilir ama şimdilik name değişiyor.
            }}
            onDelete={(listId) => {
              setCustomLists(prev => prev.filter(l => l.id !== listId))
              setActiveTab('watchlist') // Varsayılan taba dön
            }}
          />
        )
      })()}

    </div>
  )
}
