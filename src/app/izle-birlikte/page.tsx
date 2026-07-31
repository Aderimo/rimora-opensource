'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/icons'
import {
  subscribeToPublicRooms, joinRoom, roomHasPassword, getParticipantCount,
  type WatchPartyRoom,
} from '@/lib/watch-party'
import { getImageUrl } from '@/lib/api/tmdb'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Users, Lock, Globe, Play, Plus, Search, Film, Tv, Sparkles,
  Youtube, Twitch, ExternalLink, Crown, Clock
} from 'lucide-react'
import { CreateRoomModal } from '@/components/watch-party/create-room-modal'

// ─── Inline Password Modal ───
function PasswordModal({ roomName, onSubmit, onCancel }: {
  roomName: string; onSubmit: (pw: string) => void; onCancel: () => void
}) {
  const [pw, setPw] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="text-center">
          <Lock className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <h2 className="text-lg font-bold">Şifreli Oda</h2>
          <p className="text-sm text-muted-foreground">{roomName}</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); pw.trim() && onSubmit(pw) }}>
          <Input type="password" placeholder="Şifreyi girin..." value={pw} onChange={(e) => setPw(e.target.value)} autoFocus className="mb-3" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">İptal</Button>
            <Button type="submit" disabled={!pw.trim()} className="flex-1">Katıl</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function WatchPartyLobbyPage() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const [rooms, setRooms] = useState<WatchPartyRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [passwordRoom, setPasswordRoom] = useState<WatchPartyRoom | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToPublicRooms((r) => { setRooms(r); setLoading(false) })
    return unsub
  }, [])

  const filtered = rooms.filter(r => {
    const q = search.toLowerCase()
    return r.roomName.toLowerCase().includes(q) || r.hostName.toLowerCase().includes(q) || r.mediaTitle?.toLowerCase().includes(q)
  })

  const handleJoin = async (room: WatchPartyRoom) => {
    if (!user) { toast.error('Giriş yapmalısınız'); router.push('/giris'); return }
    if (room.password) { setPasswordRoom(room); return }
    await doJoin(room.id)
  }

  const doJoin = async (roomId: string, password?: string) => {
    if (!user || !userProfile) return
    setJoiningId(roomId)
    try {
      const res = await joinRoom(roomId, user.uid, userProfile.displayName || 'Anonim', userProfile.photoURL || undefined, password)
      if (res.success) router.push(`/izle-birlikte/${roomId}`)
      else toast.error(res.error || 'Katılınamadı')
    } catch { toast.error('Bir hata oluştu') }
    finally { setJoiningId(null) }
  }

  const getIcon = (r: WatchPartyRoom) => {
    if (r.contentType === 'external') {
      if (r.externalPlatform === 'youtube') return <Youtube className="w-3.5 h-3.5 text-red-500" />
      if (r.externalPlatform === 'twitch') return <Twitch className="w-3.5 h-3.5 text-purple-500" />
      return <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
    }
    if (r.mediaType === 'movie') return <Film className="w-3.5 h-3.5 text-blue-400" />
    if (r.mediaType === 'anime') return <Sparkles className="w-3.5 h-3.5 text-pink-400" />
    return <Tv className="w-3.5 h-3.5 text-green-400" />
  }

  const totalViewers = rooms.reduce((a, r) => a + getParticipantCount(r), 0)

  return (
    <div className="container mx-auto px-4 py-8 pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 p-8 mb-8">
        <div className="absolute inset-0 bg-[url('/patterns/dots.svg')] opacity-10" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">🎬 Birlikte İzle</h1>
            <p className="text-white/70 text-sm md:text-base">Arkadaşlarınla aynı anda film ve dizi izle, sohbet et, tepki ver!</p>
            <div className="flex items-center gap-4 mt-3 text-white/60 text-sm">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {rooms.length} oda</span>
              <span className="flex items-center gap-1"><Play className="w-4 h-4" /> {totalViewers} izleyici</span>
            </div>
          </div>
          <Button
            onClick={() => { if (!user) { toast.error('Giriş yapmalısınız'); router.push('/giris'); return }; setShowCreate(true) }}
            size="lg"
            className="gap-2 bg-white text-purple-700 hover:bg-white/90 font-bold shadow-xl"
          >
            <Plus className="w-5 h-5" /> Oda Oluştur
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input placeholder="Oda, kullanıcı veya içerik ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11" />
      </div>

      {/* Rooms */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-16 h-24 bg-muted rounded-xl" />
                <div className="flex-1"><div className="h-5 bg-muted rounded w-3/4 mb-2" /><div className="h-4 bg-muted rounded w-1/2" /></div>
              </div>
              <div className="h-9 bg-muted rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-purple-500/50" />
          </div>
          <h3 className="text-xl font-bold mb-2">{search ? 'Sonuç bulunamadı' : 'Henüz aktif oda yok'}</h3>
          <p className="text-muted-foreground mb-6">{search ? 'Farklı bir arama deneyin' : 'İlk odayı sen oluştur!'}</p>
          {!search && (
            <Button onClick={() => { if(!user) { toast.error('Giriş yapmalısınız'); router.push('/giris'); return }; setShowCreate(true) }} className="gap-2">
              <Plus className="w-4 h-4" /> Oda Oluştur
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((room) => {
            const pc = getParticipantCount(room)
            const isFull = pc >= room.maxParticipants
            return (
              <div key={room.id} className={cn(
                "group bg-card border border-border rounded-2xl overflow-hidden transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5",
                isFull && "opacity-50"
              )}>
                {/* Poster Banner */}
                <div className="relative h-28 bg-gradient-to-br from-purple-900 to-pink-900">
                  {room.mediaPoster && (
                    <Image src={getImageUrl(room.mediaPoster, 'w500') || ''} alt="" fill className="object-cover opacity-40 group-hover:opacity-50 transition" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-full">
                      {getIcon(room)}
                      {room.mediaType === 'movie' ? 'Film' : room.mediaType === 'anime' ? 'Anime' : room.contentType === 'external' ? room.externalPlatform === 'youtube' ? 'YouTube' : 'Harici' : 'Dizi'}
                    </span>
                    {room.password && <Lock className="w-3.5 h-3.5 text-yellow-400" />}
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-full">
                    <Users className="w-3 h-3" /> {pc}/{room.maxParticipants}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 pt-2">
                  <h3 className="font-bold text-base truncate mb-0.5">{room.roomName}</h3>
                  <p className="text-sm text-muted-foreground truncate mb-2">
                    {room.mediaTitle || room.externalUrl || 'İçerik'}
                    {room.season && ` • S${room.season}E${room.episode}`}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Crown className="w-3 h-3 text-yellow-500" />
                      <span className="truncate max-w-[100px]">{room.hostName}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{formatDistanceToNow(room.createdAt, { addSuffix: true, locale: tr })}</span>
                    </div>
                    <Button size="sm" disabled={isFull || joiningId === room.id} onClick={() => handleJoin(room)} className="gap-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-xs h-8 px-4">
                      {joiningId === room.id ? <Icons.spinner className="w-3.5 h-3.5 animate-spin" /> : <><Play className="w-3 h-3" /> Katıl</>}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={(id) => { setShowCreate(false); router.push(`/izle-birlikte/${id}`) }} />}
      {passwordRoom && <PasswordModal roomName={passwordRoom.roomName} onSubmit={(pw) => { const id = passwordRoom.id; setPasswordRoom(null); doJoin(id, pw) }} onCancel={() => setPasswordRoom(null)} />}
    </div>
  )
}
