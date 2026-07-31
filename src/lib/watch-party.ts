import {
  ref, set, onValue, push, remove, update, get, onDisconnect,
} from 'firebase/database'
import { rtdb } from './firebase'

// ─── Sabitler ───
export const MAX_PARTICIPANTS = 50
export const DEFAULT_MAX_PARTICIPANTS = 10
export const EMPTY_ROOM_TIMEOUT = 2 * 60 * 1000
export const STALE_ROOM_TIMEOUT = 60 * 60 * 1000 // 1 saat inaktifse sil

// ─── Tipler ───
export interface Participant {
  name: string
  avatar?: string
  joinedAt: number
  isHost?: boolean
  permissions?: ParticipantPermissions
}

export interface ParticipantPermissions {
  canControlPlayback: boolean
  canKickUsers: boolean
  canChangeSettings: boolean
}

export interface WatchPartyRoom {
  id: string
  hostId: string
  hostName: string
  hostAvatar?: string
  roomName: string
  password?: string
  isPublic: boolean
  maxParticipants: number
  // İçerik
  contentType: 'internal' | 'external'
  mediaId?: number
  mediaType?: 'movie' | 'tv' | 'anime'
  mediaTitle?: string
  mediaPoster?: string
  season?: number
  episode?: number
  externalUrl?: string
  externalPlatform?: 'youtube' | 'twitch' | 'other'
  // Video Senkronizasyon
  videoState?: VideoSyncState
  // Katılımcılar
  participants: Record<string, Participant>
  kickedUsers: Record<string, boolean>
  // Parti Ayarları
  settings?: PartySettings
  // Meta
  createdAt: number
  lastActivity: number
  emptyAt?: number
}

export interface VideoSyncState {
  isPlaying: boolean
  currentTime: number
  lastUpdated: number
  lastUpdatedBy: string
}

export interface PartySettings {
  allowGuestControl: boolean
  autoSaveProgress: boolean
  showReactions: boolean
  allowVoiceChat: boolean
}

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  text: string
  timestamp: number
  type: 'chat' | 'system' | 'join' | 'leave' | 'kick' | 'video_control'
}

export interface Reaction {
  id: string
  userId: string
  emoji: string
  timestamp: number
  x?: number // Ekran pozisyonu
  y?: number
}

export interface CreateRoomParams {
  hostId: string
  hostName: string
  hostAvatar?: string
  roomName: string
  password?: string
  isPublic: boolean
  maxParticipants: number
  contentType: 'internal' | 'external'
  mediaId?: number
  mediaType?: 'movie' | 'tv' | 'anime'
  mediaTitle?: string
  mediaPoster?: string
  season?: number
  episode?: number
  externalUrl?: string
  externalPlatform?: 'youtube' | 'twitch' | 'other'
  settings?: PartySettings
}

// ─── Oda CRUD ───

export async function createRoom(params: CreateRoomParams): Promise<string> {
  const roomRef = push(ref(rtdb, 'watchParties'))
  const roomId = roomRef.key!
  const now = Date.now()

  const data: Omit<WatchPartyRoom, 'id'> = {
    hostId: params.hostId,
    hostName: params.hostName,
    roomName: params.roomName,
    isPublic: params.isPublic,
    maxParticipants: Math.min(params.maxParticipants, MAX_PARTICIPANTS),
    contentType: params.contentType,
    participants: {
      [params.hostId]: {
        name: params.hostName,
        joinedAt: now,
        ...(params.hostAvatar && { avatar: params.hostAvatar }),
      },
    },
    kickedUsers: {},
    createdAt: now,
    lastActivity: now,
    ...(params.hostAvatar && { hostAvatar: params.hostAvatar }),
    ...(params.password && { password: params.password }),
    ...(params.mediaId && { mediaId: params.mediaId }),
    ...(params.mediaType && { mediaType: params.mediaType }),
    ...(params.mediaTitle && { mediaTitle: params.mediaTitle }),
    ...(params.mediaPoster && { mediaPoster: params.mediaPoster }),
    ...(params.season !== undefined && { season: params.season }),
    ...(params.episode !== undefined && { episode: params.episode }),
    ...(params.externalUrl && { externalUrl: params.externalUrl }),
    ...(params.externalPlatform && { externalPlatform: params.externalPlatform }),
  }

  await set(roomRef, data)
  await sendSystemMessage(roomId, `${params.hostName} odayı oluşturdu.`)
  return roomId
}

export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
  userAvatar?: string,
  password?: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = ref(rtdb, `watchParties/${roomId}`)
  const snap = await get(roomRef)
  if (!snap.exists()) return { success: false, error: 'Oda bulunamadı' }

  const room = snap.val() as Omit<WatchPartyRoom, 'id'>

  if (room.kickedUsers?.[userId]) {
    return { success: false, error: 'Bu odadan atıldınız.' }
  }
  if (room.password && room.password !== password) {
    return { success: false, error: 'Yanlış şifre.' }
  }

  const participants = room.participants || {}
  if (participants[userId]) {
    return { success: true } // Zaten odada
  }

  const count = Object.keys(participants).length
  if (count >= (room.maxParticipants || MAX_PARTICIPANTS)) {
    return { success: false, error: `Oda dolu (${room.maxParticipants} kişi).` }
  }

  const pRef = ref(rtdb, `watchParties/${roomId}/participants/${userId}`)
  await set(pRef, { name: userName, joinedAt: Date.now(), ...(userAvatar && { avatar: userAvatar }) })
  await update(roomRef, { lastActivity: Date.now(), emptyAt: null })
  onDisconnect(pRef).remove()

  await sendSystemMessage(roomId, `${userName} odaya katıldı.`, 'join')
  return { success: true }
}

export async function leaveRoom(
  roomId: string,
  userId: string,
  userName?: string
): Promise<void> {
  const roomRef = ref(rtdb, `watchParties/${roomId}`)
  const snap = await get(roomRef)
  if (!snap.exists()) return

  const room = snap.val() as Omit<WatchPartyRoom, 'id'>

  if (userName) {
    await sendSystemMessage(roomId, `${userName} ayrıldı.`, 'leave')
  }

  await remove(ref(rtdb, `watchParties/${roomId}/participants/${userId}`))

  const remaining = Object.entries(room.participants || {}).filter(([id]) => id !== userId)

  if (remaining.length === 0) {
    await update(roomRef, { emptyAt: Date.now(), lastActivity: Date.now() })
    return
  }

  // Host çıktıysa en eski kişiyi yeni host yap
  if (room.hostId === userId) {
    const sorted = remaining.sort((a, b) => (a[1] as Participant).joinedAt - (b[1] as Participant).joinedAt)
    const [newHostId, newHostData] = sorted[0]
    const p = newHostData as Participant
    await update(roomRef, { hostId: newHostId, hostName: p.name, hostAvatar: p.avatar || null, lastActivity: Date.now() })
    await sendSystemMessage(roomId, `${p.name} yeni oda sahibi oldu.`)
  } else {
    await update(roomRef, { lastActivity: Date.now() })
  }
}

export async function deleteRoom(roomId: string): Promise<void> {
  await Promise.all([
    remove(ref(rtdb, `watchParties/${roomId}`)),
    remove(ref(rtdb, `wpMessages/${roomId}`)),
    remove(ref(rtdb, `wpReactions/${roomId}`)),
    remove(ref(rtdb, `wpTyping/${roomId}`)),
  ])
}

export async function kickUser(
  roomId: string,
  hostId: string,
  targetId: string,
  targetName: string
): Promise<{ success: boolean; error?: string }> {
  const snap = await get(ref(rtdb, `watchParties/${roomId}`))
  if (!snap.exists()) return { success: false, error: 'Oda bulunamadı' }
  const room = snap.val()
  if (room.hostId !== hostId) return { success: false, error: 'Yetkiniz yok' }
  if (targetId === hostId) return { success: false, error: 'Kendinizi atamazsınız' }

  await remove(ref(rtdb, `watchParties/${roomId}/participants/${targetId}`))
  await update(ref(rtdb, `watchParties/${roomId}/kickedUsers`), { [targetId]: true })
  await sendSystemMessage(roomId, `${targetName} odadan atıldı.`, 'kick')
  return { success: true }
}

export async function roomHasPassword(roomId: string): Promise<boolean> {
  const snap = await get(ref(rtdb, `watchParties/${roomId}`))
  return snap.exists() && !!snap.val().password
}

// ─── Mesajlaşma ───

export async function sendChatMessage(
  roomId: string,
  userId: string,
  userName: string,
  text: string,
  userAvatar?: string
): Promise<void> {
  const msgRef = push(ref(rtdb, `wpMessages/${roomId}`))
  await set(msgRef, {
    userId,
    userName,
    text,
    timestamp: Date.now(),
    type: 'chat',
    ...(userAvatar && { userAvatar }),
  })
}

export async function sendSystemMessage(
  roomId: string,
  text: string,
  type: 'system' | 'join' | 'leave' | 'kick' = 'system'
): Promise<void> {
  const msgRef = push(ref(rtdb, `wpMessages/${roomId}`))
  await set(msgRef, { userId: 'system', userName: 'Sistem', text, timestamp: Date.now(), type })
}

// ─── Emoji Reactions ───

export async function sendReaction(roomId: string, userId: string, emoji: string): Promise<void> {
  const rRef = push(ref(rtdb, `wpReactions/${roomId}`))
  await set(rRef, { userId, emoji, timestamp: Date.now() })

  // 5 saniye sonra otomatik sil (temiz tut)
  setTimeout(() => remove(rRef).catch(() => {}), 5000)
}

// ─── Typing Indicator ───

export async function setTyping(roomId: string, userId: string, userName: string): Promise<void> {
  const tRef = ref(rtdb, `wpTyping/${roomId}/${userId}`)
  await set(tRef, { name: userName, at: Date.now() })
  // 3 saniye sonra otomatik kaldır
  setTimeout(() => remove(tRef).catch(() => {}), 3000)
}

export async function clearTyping(roomId: string, userId: string): Promise<void> {
  await remove(ref(rtdb, `wpTyping/${roomId}/${userId}`))
}

// ─── Subscriptions (Real-time) ───

export function subscribeToRoom(roomId: string, cb: (room: WatchPartyRoom | null) => void): () => void {
  return onValue(ref(rtdb, `watchParties/${roomId}`), (snap) => {
    cb(snap.exists() ? { id: roomId, ...snap.val() } : null)
  })
}

export function subscribeToMessages(roomId: string, cb: (msgs: ChatMessage[]) => void): () => void {
  return onValue(ref(rtdb, `wpMessages/${roomId}`), (snap) => {
    const msgs: ChatMessage[] = []
    snap.forEach((child) => {
      msgs.push({ id: child.key!, ...child.val() })
      return undefined
    })
    cb(msgs.slice(-100))
  })
}

export function subscribeToReactions(roomId: string, cb: (reactions: Reaction[]) => void): () => void {
  return onValue(ref(rtdb, `wpReactions/${roomId}`), (snap) => {
    const items: Reaction[] = []
    snap.forEach((child) => {
      items.push({ id: child.key!, ...child.val() })
      return undefined
    })
    cb(items)
  })
}

export function subscribeToTyping(
  roomId: string,
  myUserId: string,
  cb: (names: string[]) => void
): () => void {
  return onValue(ref(rtdb, `wpTyping/${roomId}`), (snap) => {
    const names: string[] = []
    const now = Date.now()
    snap.forEach((child) => {
      const d = child.val()
      if (child.key !== myUserId && now - d.at < 4000) {
        names.push(d.name)
      }
    })
    cb(names)
  })
}

export function subscribeToPublicRooms(cb: (rooms: WatchPartyRoom[]) => void): () => void {
  // Prevent infinite retry flood on permission_denied
  const attemptedDeletes = new Set<string>()
  return onValue(ref(rtdb, 'watchParties'), (snap) => {
    const rooms: WatchPartyRoom[] = []
    const now = Date.now()
    snap.forEach((child) => {
      const d = child.val()
      const pCount = Object.keys(d.participants || {}).length
      const roomId = child.key!

      // 1) emptyAt süresi dolmuş → sil
      if (d.emptyAt && now - d.emptyAt > EMPTY_ROOM_TIMEOUT) {
        if (!attemptedDeletes.has(roomId)) {
          attemptedDeletes.add(roomId)
          deleteRoom(roomId).catch(() => {})
        }
        return
      }

      // 2) 0 katılımcı (tarayıcı kapanınca onDisconnect ile düşmüş) → sil
      if (pCount === 0) {
        if (!attemptedDeletes.has(roomId)) {
          attemptedDeletes.add(roomId)
          deleteRoom(roomId).catch(() => {})
        }
        return
      }

      // 3) 1 saatten fazla inaktif → hayalet oda, sil
      if (d.lastActivity && now - d.lastActivity > STALE_ROOM_TIMEOUT) {
        if (!attemptedDeletes.has(roomId)) {
          attemptedDeletes.add(roomId)
          deleteRoom(roomId).catch(() => {})
        }
        return
      }

      if (d.isPublic) {
        rooms.push({ id: roomId, ...d })
      }
    })
    cb(rooms.sort((a, b) => b.lastActivity - a.lastActivity))
  })
}
// ...existing code...

// ─── Yardımcılar ───

export function getShareLink(roomId: string): string {
  return `${window.location.origin}/izle-birlikte/${roomId}`
}

export function getParticipantCount(room: WatchPartyRoom): number {
  return Object.keys(room.participants || {}).length
}
