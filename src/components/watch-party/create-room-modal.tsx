'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Icons } from '@/components/icons'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createRoom, MAX_PARTICIPANTS, DEFAULT_MAX_PARTICIPANTS } from '@/lib/watch-party'
import { getImageUrl } from '@/lib/api/tmdb'
import { toast } from 'sonner'
import {
  Plus, Lock, Globe, Users, Film, Search, Youtube, Twitch,
  ExternalLink, Link2, Check, X
} from 'lucide-react'
import type { Media } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (roomId: string) => void
}

export function CreateRoomModal({ open, onClose, onSuccess }: Props) {
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [contentType, setContentType] = useState<'internal' | 'external'>('internal')

  // Room
  const [roomName, setRoomName] = useState('')
  const [password, setPassword] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [maxP, setMaxP] = useState(DEFAULT_MAX_PARTICIPANTS)

  // Internal content
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Media[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Media | null>(null)
  const [season, setSeason] = useState<number | undefined>()
  const [episode, setEpisode] = useState<number | undefined>()

  // External
  const [extUrl, setExtUrl] = useState('')
  const [extPlatform, setExtPlatform] = useState<'youtube' | 'twitch' | 'other'>('other')

  const searchToken = useRef(0)

  const handleSearch = async (rawQuery?: string) => {
    const q = (rawQuery ?? query).trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    const token = ++searchToken.current
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=1`)
      if (!response.ok) throw new Error('API hatasi')
      const data = await response.json()
      if (token !== searchToken.current) return
      setResults((data.results || []).slice(0, 10))
    } catch {
      if (token !== searchToken.current) return
      toast.error('Arama başarısız')
      setResults([])
    } finally {
      if (token === searchToken.current) setSearching(false)
    }
  }

  useEffect(() => {
    if (contentType !== 'internal') return
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    const t = setTimeout(() => handleSearch(q), 450)
    return () => clearTimeout(t)
  }, [query, contentType])

  const detectPlatform = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) setExtPlatform('youtube')
    else if (url.includes('twitch.tv')) setExtPlatform('twitch')
    else setExtPlatform('other')
  }

  const handleCreate = async () => {
    if (!user || !userProfile) { toast.error('Giriş yapmalısınız'); return }
    if (!roomName.trim()) { toast.error('Oda adı gerekli'); return }
    if (contentType === 'internal' && !selected) { toast.error('Bir içerik seçin'); return }
    if (contentType === 'external' && !extUrl.trim()) { toast.error('Link gerekli'); return }

    setLoading(true)
    try {
      const roomId = await createRoom({
        hostId: user.uid,
        hostName: userProfile.displayName || 'Anonim',
        hostAvatar: userProfile.photoURL || undefined,
        roomName: roomName.trim(),
        password: password || undefined,
        isPublic,
        maxParticipants: maxP,
        contentType,
        mediaId: selected?.id,
        mediaType: selected?.type as 'movie' | 'tv' | 'anime' | undefined,
        mediaTitle: selected?.title,
        mediaPoster: selected?.posterPath || undefined,
        season,
        episode,
        externalUrl: contentType === 'external' ? extUrl : undefined,
        externalPlatform: contentType === 'external' ? extPlatform : undefined,
      })
      toast.success('Oda oluşturuldu!')
      onSuccess(roomId)
    } catch (err) {
      console.error(err)
      toast.error('Oda oluşturulamadı')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-purple-500" /> Yeni Oda</DialogTitle>
          <DialogDescription>Arkadaşlarınla birlikte izlemek için oda oluştur</DialogDescription>
        </DialogHeader>

        <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <input type="text" name="username" autoComplete="username" className="hidden" />
          <input type="password" name="password" autoComplete="current-password" className="hidden" />
          <div className="space-y-5 py-3">
          {/* Room Name */}
          <div>
            <Label>Oda Adı *</Label>
            <Input
              placeholder="Film Gecesi 🎬"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={50}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              name="room-title"
            />
          </div>

          {/* Password + Max */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Şifre (Opsiyonel)</Label>
              <Input
                type="password"
                placeholder="Koyma da olur"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={20}
                autoComplete="new-password"
                name="room-password"
              />
            </div>
            <div>
              <Label>Maks. Kişi</Label>
              <Input type="number" min={2} max={MAX_PARTICIPANTS} value={maxP} onChange={(e) => setMaxP(Math.min(MAX_PARTICIPANTS, Math.max(2, parseInt(e.target.value) || 2)))} />
            </div>
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              {isPublic ? <Globe className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-yellow-500" />}
              <div>
                <p className="text-sm font-medium">{isPublic ? 'Herkese Açık' : 'Gizli'}</p>
                <p className="text-[11px] text-muted-foreground">{isPublic ? 'Lobide görünür' : 'Sadece davet linki ile'}</p>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {/* Content */}
          <Tabs value={contentType} onValueChange={(v: string) => setContentType(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="internal" className="gap-1.5 text-sm"><Film className="w-3.5 h-3.5" /> Site İçeriği</TabsTrigger>
              <TabsTrigger value="external" className="gap-1.5 text-sm"><Link2 className="w-3.5 h-3.5" /> Harici Link</TabsTrigger>
            </TabsList>

            <TabsContent value="internal" className="space-y-3 mt-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Film, dizi ara..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                  autoComplete="off"
                  name="wp-search"
                />
                <Button onClick={() => handleSearch()} disabled={searching} size="sm">
                  {searching ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {selected && (
                <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  {selected.posterPath && (
                    <div className="relative w-10 h-14 rounded-lg overflow-hidden flex-shrink-0">
                      <Image src={getImageUrl(selected.posterPath, 'w92') || ''} alt="" fill sizes="40px" className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selected.title}</p>
                    <p className="text-xs text-muted-foreground">{selected.type === 'movie' ? 'Film' : selected.type === 'anime' ? 'Anime' : 'Dizi'}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
                </div>
              )}

              {selected && selected.type !== 'movie' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sezon</Label><Input type="number" min={1} placeholder="1" value={season || ''} onChange={(e) => setSeason(parseInt(e.target.value) || undefined)} /></div>
                  <div><Label>Bölüm</Label><Input type="number" min={1} placeholder="1" value={episode || ''} onChange={(e) => setEpisode(parseInt(e.target.value) || undefined)} /></div>
                </div>
              )}

              {results.length > 0 && !selected && (
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                  {results.map((m) => (
                    <button key={m.id} onClick={() => setSelected(m)} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted transition text-left">
                      <div className="relative w-9 h-[54px] rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {m.posterPath ? <Image src={getImageUrl(m.posterPath, 'w92') || ''} alt="" fill sizes="36px" className="object-cover" /> : <Film className="w-4 h-4 text-muted-foreground m-auto" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <p className="text-[11px] text-muted-foreground">{m.type === 'movie' ? 'Film' : m.type === 'anime' ? 'Anime' : 'Dizi'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!searching && query.trim() && results.length === 0 && !selected && (
                <div className="text-xs text-muted-foreground">Sonuç bulunamadı.</div>
              )}
            </TabsContent>

            <TabsContent value="external" className="space-y-3 mt-3">
              <div>
                <Label>Video Linki</Label>
                <Input placeholder="https://youtube.com/watch?v=..." value={extUrl} onChange={(e) => { setExtUrl(e.target.value); detectPlatform(e.target.value) }} />
              </div>
              <div className="flex gap-2">
                {(['youtube', 'twitch', 'other'] as const).map(p => (
                  <Button key={p} type="button" variant={extPlatform === p ? 'default' : 'outline'} size="sm" onClick={() => setExtPlatform(p)} className="gap-1.5">
                    {p === 'youtube' && <Youtube className="w-3.5 h-3.5 text-red-500" />}
                    {p === 'twitch' && <Twitch className="w-3.5 h-3.5 text-purple-500" />}
                    {p === 'other' && <ExternalLink className="w-3.5 h-3.5" />}
                    {p === 'youtube' ? 'YouTube' : p === 'twitch' ? 'Twitch' : 'Diğer'}
                  </Button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={onClose}>İptal</Button>
            <Button onClick={handleCreate} disabled={loading} className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              {loading ? <Icons.spinner className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Oda Oluştur
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
