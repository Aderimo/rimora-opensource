'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  subscribeToRoom, subscribeToMessages, subscribeToReactions, subscribeToTyping,
  joinRoom, leaveRoom, deleteRoom, kickUser, sendChatMessage, sendReaction,
  setTyping, clearTyping, getShareLink, roomHasPassword, getParticipantCount,
  type WatchPartyRoom, type ChatMessage, type Participant,
} from '@/lib/watch-party'
import { getAllSources } from '@/lib/api/video-sources'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Users, MessageCircle, Crown, X, Send, ChevronLeft,
  LogOut, AlertCircle, UserMinus, Smile, Copy, Volume2
} from 'lucide-react'

// ─── Şifre Modal ───
function PasswordModal({ roomName, onSubmit, onCancel }: {
  roomName: string; onSubmit: (pw: string) => void; onCancel: () => void
}) {
  const [pw, setPw] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
            <Icons.lock className="w-6 h-6 text-yellow-500" />
          </div>
          <h2 className="text-lg font-bold">Şifreli Oda</h2>
          <p className="text-sm text-muted-foreground mt-1">{roomName}</p>
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

// ─── Floating Reaction ───
function FloatingReaction({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  const left = useRef(Math.random() * 70 + 5)
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="absolute bottom-24 pointer-events-none z-40 text-4xl" style={{ left: `${left.current}%`, animation: 'floatUp 3s ease-out forwards' }}>
      {emoji}
    </div>
  )
}

const QUICK_EMOJIS = ['😂', '❤️', '🔥', '👏', '😱', '😢', '🎉', '💀']

interface WatchPartyRoomPageProps {
  params: { roomId: string }
}

export default function WatchPartyRoomPage({ params }: WatchPartyRoomPageProps) {
  const { roomId } = params
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<NodeJS.Timeout | null>(null)

  const [room, setRoom] = useState<WatchPartyRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [floats, setFloats] = useState<{ id: string; emoji: string }[]>([])
  const [typingNames, setTypingNames] = useState<string[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [showChat, setShowChat] = useState(true)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [kickingUser, setKickingUser] = useState<string | null>(null)

  const isHost = user?.uid === room?.hostId
  const pCount = room ? getParticipantCount(room) : 0

  // ─── Room subscription ───
  useEffect(() => {
    const unsub = subscribeToRoom(roomId, (r) => {
      setRoom(r); setLoading(false)
      if (r && user && r.kickedUsers?.[user.uid]) { toast.error('Bu odadan atıldınız'); router.push('/izle-birlikte'); return }
      if (r?.contentType === 'internal' && r.mediaId) {
        const sources = getAllSources(r.mediaType || 'movie', r.mediaId, r.season || 1, r.episode || 1)
        const src = sources[0]
        if (src) setEmbedUrl(src.url)
      } else if (r?.contentType === 'external' && r.externalUrl) {
        if (r.externalPlatform === 'youtube') {
          const m = r.externalUrl.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/)([^"&?\/\s]{11})/)
          if (m) { setEmbedUrl(`https://www.youtube.com/embed/${m[1]}?autoplay=1`); return }
        }
        if (r.externalPlatform === 'twitch') {
          const m = r.externalUrl.match(/twitch\.tv\/([^\/\?]+)/)
          if (m) { setEmbedUrl(`https://player.twitch.tv/?channel=${m[1]}&parent=${window.location.hostname}`); return }
        }
        setEmbedUrl(r.externalUrl)
      }
    })
    return unsub
  }, [roomId, user, router])

  // Messages
  useEffect(() => {
    const unsub = subscribeToMessages(roomId, (msgs) => {
      setMessages(msgs)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    })
    return unsub
  }, [roomId])

  // Reactions
  useEffect(() => {
    const unsub = subscribeToReactions(roomId, (reactions) => {
      reactions.forEach((r) => {
        setFloats(prev => prev.find(p => p.id === r.id) ? prev : [...prev, { id: r.id, emoji: r.emoji }])
      })
    })
    return unsub
  }, [roomId])

  // Typing
  useEffect(() => {
    if (!user) return
    return subscribeToTyping(roomId, user.uid, setTypingNames)
  }, [roomId, user])

  // Auto-join
  useEffect(() => {
    if (!user || !userProfile || !room || joined) return
    if (room.participants?.[user.uid]) { setJoined(true); return }
    const tryJoin = async () => {
      const hasPw = await roomHasPassword(roomId)
      if (hasPw) { setNeedsPassword(true); return }
      const res = await joinRoom(roomId, user.uid, userProfile.displayName || 'Anonim', userProfile.photoURL || undefined)
      if (res.success) setJoined(true)
      else { toast.error(res.error); router.push('/izle-birlikte') }
    }
    tryJoin()
  }, [user, userProfile, room, roomId, joined, router])

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (user && joined) leaveRoom(roomId, user.uid, userProfile?.displayName || undefined) }
  }, [user, joined, roomId, userProfile])

  const handlePasswordSubmit = async (pw: string) => {
    if (!user || !userProfile) return
    setNeedsPassword(false)
    const res = await joinRoom(roomId, user.uid, userProfile.displayName || 'Anonim', userProfile.photoURL || undefined, pw)
    if (res.success) setJoined(true)
    else { toast.error(res.error || 'Yanlış şifre'); router.push('/izle-birlikte') }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !userProfile || !newMsg.trim()) return
    await sendChatMessage(roomId, user.uid, userProfile.displayName || 'Anonim', newMsg.trim(), userProfile.photoURL || undefined)
    setNewMsg('')
    clearTyping(roomId, user.uid)
  }

  const handleTyping = useCallback(() => {
    if (!user || !userProfile) return
    setTyping(roomId, user.uid, userProfile.displayName || 'Anonim')
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => { if (user) clearTyping(roomId, user.uid) }, 2000)
  }, [roomId, user, userProfile])

  const handleReaction = async (emoji: string) => {
    if (!user) return
    await sendReaction(roomId, user.uid, emoji)
    setShowEmojis(false)
  }

  const removeFloat = useCallback((id: string) => setFloats(prev => prev.filter(r => r.id !== id)), [])

  // ─── States ───
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-black">
      <div className="text-center text-white"><Icons.spinner className="h-10 w-10 animate-spin mx-auto mb-4" /><p>Bağlanılıyor...</p></div>
    </div>
  )
  if (!room) return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
      <AlertCircle className="h-16 w-16 text-red-500 mb-4" /><h1 className="text-2xl font-bold mb-2">Oda Bulunamadı</h1>
      <p className="text-white/60 mb-6">Bu oda artık mevcut değil.</p>
      <Link href="/izle-birlikte"><Button>Odalara Dön</Button></Link>
    </div>
  )
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
      <Users className="h-16 w-16 text-white/30 mb-4" /><h1 className="text-2xl font-bold mb-2">Giriş Yapın</h1>
      <p className="text-white/60 mb-6">Katılmak için giriş yapmalısınız.</p>
      <Link href="/giris"><Button>Giriş Yap</Button></Link>
    </div>
  )
  if (needsPassword) return <PasswordModal roomName={room.roomName} onSubmit={handlePasswordSubmit} onCancel={() => router.push('/izle-birlikte')} />

  // ─── Main UI ───
  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden relative">
      <style jsx global>{`
        @keyframes floatUp { 0% { opacity:1; transform:translateY(0) scale(1); } 100% { opacity:0; transform:translateY(-280px) scale(1.4); } }
      `}</style>

      {/* Floating Reactions */}
      {floats.map(r => <FloatingReaction key={r.id} emoji={r.emoji} onDone={() => removeFloat(r.id)} />)}

      {/* Header */}
      <div className="h-12 flex-shrink-0 bg-gradient-to-r from-purple-900/80 to-pink-900/80 backdrop-blur-md border-b border-white/5 px-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/izle-birlikte">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-sm truncate">{room.roomName}</h1>
            <p className="text-white/40 text-[11px] truncate">{room.mediaTitle || 'İçerik'}{room.season ? ` • S${room.season}E${room.episode}` : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Avatars */}
          <button onClick={() => setShowParticipants(!showParticipants)} className="flex items-center -space-x-1.5 mr-2 hover:opacity-80">
            {Object.entries(room.participants || {}).slice(0, 4).map(([id, p]) => {
              const pt = p as Participant
              return (
                <div key={id} className="w-6 h-6 rounded-full border-2 border-purple-900 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                  {pt.avatar ? <Image src={pt.avatar} alt="" width={24} height={24} className="rounded-full" /> : <span className="text-[10px] text-white font-bold">{pt.name[0]}</span>}
                </div>
              )
            })}
            {pCount > 4 && <div className="w-6 h-6 rounded-full border-2 border-purple-900 bg-white/20 flex items-center justify-center"><span className="text-[9px] text-white">+{pCount-4}</span></div>}
          </button>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => { navigator.clipboard.writeText(getShareLink(roomId)); toast.success('Link kopyalandı!') }}><Copy className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8 text-white/70 hover:text-white hover:bg-white/10", showChat && "text-white bg-white/10")} onClick={() => setShowChat(!showChat)}><MessageCircle className="h-3.5 w-3.5" /></Button>
          {isHost ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-500/20" onClick={async () => { await deleteRoom(roomId); toast.success('Oda kapatıldı'); router.push('/izle-birlikte') }}><X className="h-4 w-4" /></Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-500/20" onClick={async () => { if(user) { await leaveRoom(roomId, user.uid, userProfile?.displayName ?? undefined); router.push('/izle-birlikte') } }}><LogOut className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      </div>

      {/* Participants Panel */}
      {showParticipants && (
        <div className="absolute top-12 right-2 z-40 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 w-60 max-h-72 overflow-y-auto">
          <p className="text-xs text-white/40 mb-2 font-medium">Katılımcılar ({pCount})</p>
          {Object.entries(room.participants || {}).map(([id, p]) => {
            const pt = p as Participant
            return (
              <div key={id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {pt.avatar ? <Image src={pt.avatar} alt="" width={28} height={28} className="rounded-full" /> : <span className="text-xs text-white font-bold">{pt.name[0]}</span>}
                  </div>
                  <span className="text-sm text-white truncate">{pt.name}</span>
                  {id === room.hostId && <Crown className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                </div>
                {isHost && id !== user.uid && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-500/20" onClick={() => kickUser(roomId, user.uid, id, pt.name)} disabled={kickingUser === id}>
                    {kickingUser === id ? <Icons.spinner className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Video + Chat Overlay ─── */}
      <div className="flex-1 relative">
        {embedUrl ? (
          <iframe src={embedUrl} className="absolute inset-0 w-full h-full border-0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><div className="text-center text-white"><Volume2 className="w-16 h-16 mx-auto mb-4 opacity-30" /><p className="text-white/50">Video yükleniyor...</p></div></div>
        )}

        {/* Emoji Bar */}
        <div className="absolute bottom-3 left-3 z-30">
          {showEmojis ? (
            <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full px-3 py-2 border border-white/10">
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => handleReaction(e)} className="text-2xl hover:scale-125 transition-transform">{e}</button>
              ))}
              <button onClick={() => setShowEmojis(false)} className="ml-2 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => setShowEmojis(true)} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/70 transition text-white/70 hover:text-white">
              <Smile className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Floating Chat */}
        {showChat && (
          <div className="absolute bottom-0 right-0 top-0 w-full md:w-80 z-20 flex flex-col pointer-events-none">
            <div className="flex-1" />
            <div className="pointer-events-auto bg-black/35 backdrop-blur-md border-l border-white/10 md:rounded-l-2xl">
              <div className="max-h-[45vh] overflow-y-auto px-3 pb-1 space-y-1" style={{ maskImage: 'linear-gradient(transparent 0%, black 15%)' }}>
                {messages.map(msg => (
                  <div key={msg.id}>
                    {msg.type === 'chat' ? (
                      <div className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 inline-block max-w-[95%]">
                        <span className={cn('font-bold text-[11px]', msg.userId === room.hostId ? 'text-yellow-400' : 'text-purple-300')}>
                          {msg.userId === room.hostId && '👑 '}{msg.userName}
                        </span>
                        <p className="text-white text-[13px] leading-snug break-words">{msg.text}</p>
                      </div>
                    ) : (
                      <p className={cn('text-[11px] px-2 py-0.5',
                        msg.type === 'join' ? 'text-green-400/70' : msg.type === 'leave' ? 'text-yellow-400/70' : msg.type === 'kick' ? 'text-red-400/70' : 'text-blue-400/70'
                      )}>{msg.text}</p>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {typingNames.length > 0 && (
                <div className="px-3 py-0.5">
                  <span className="text-[11px] text-white/40 italic">{typingNames.join(', ')} yazıyor...</span>
                </div>
              )}

              <form onSubmit={handleSend} className="p-3 pt-1.5">
                <div className="flex gap-2">
                  <Input value={newMsg} onChange={(e) => { setNewMsg(e.target.value); handleTyping() }} placeholder="Mesaj yaz..." className="flex-1 bg-black/70 border-white/15 text-white placeholder:text-white/25 h-9 text-sm rounded-full px-4" maxLength={500} />
                  <Button type="submit" size="icon" className="h-9 w-9 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" disabled={!newMsg.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
