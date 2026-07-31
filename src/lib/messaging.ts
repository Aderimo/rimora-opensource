import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  updateDoc,
  onSnapshot,
  addDoc,
  startAt,
  endAt,
  runTransaction,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { db } from './firebase'

export interface SearchedUser {
  uid: string
  displayName: string
  photoURL: string | null
  email?: string
}

export interface EditHistoryEntry {
  originalContent: string
  editedContent: string
  editedAt: Date
  editedBy: string
}

export interface ReplyTo {
  messageId: string
  senderId: string
  senderName: string
  quotedContent: string
}

export interface PinnedMessageRef {
  messageId: string
  pinnedBy: string
  pinnedAt: Date
}

export interface Conversation {
  id: string
  participants: string[]
  participantNames: { [key: string]: string }
  participantPhotos: { [key: string]: string | null }
  lastMessage: string
  lastMessageTime: Date
  lastMessageBy: string
  unreadCount: { [key: string]: number }
  createdAt: Date
  pinnedMessages?: PinnedMessageRef[]
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderPhoto: string | null
  content: string
  read: boolean
  createdAt: Date
  isEdited?: boolean
  lastEditedAt?: Date
  editHistory?: EditHistoryEntry[]
  pinnedBy?: string[]
  replyTo?: ReplyTo
}

// Get or create conversation between two users
export async function getOrCreateConversation(
  user1Id: string,
  user1Name: string,
  user1Photo: string | null,
  user2Id: string,
  user2Name: string,
  user2Photo: string | null
): Promise<string> {
  // Check if conversation exists
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', user1Id)
  )

  const snapshot = await getDocs(q)
  const existing = snapshot.docs.find(doc => {
    const data = doc.data()
    return data.participants.includes(user2Id)
  })

  if (existing) {
    return existing.id
  }

  // Create new conversation
  const docRef = doc(collection(db, 'conversations'))
  await setDoc(docRef, {
    participants: [user1Id, user2Id],
    participantNames: {
      [user1Id]: user1Name,
      [user2Id]: user2Name,
    },
    participantPhotos: {
      [user1Id]: user1Photo,
      [user2Id]: user2Photo,
    },
    lastMessage: '',
    lastMessageTime: serverTimestamp(),
    lastMessageBy: '',
    unreadCount: {
      [user1Id]: 0,
      [user2Id]: 0,
    },
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

// Get user's conversations
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTime', 'desc'),
    limit(50)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    lastMessageTime: (doc.data().lastMessageTime as Timestamp)?.toDate() || new Date(),
    createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
  })) as Conversation[]
}

// Send message
export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  content: string,
  receiverId: string
): Promise<void> {
  // Add message
  await addDoc(collection(db, 'messages'), {
    conversationId,
    senderId,
    senderName,
    senderPhoto,
    content,
    read: false,
    createdAt: serverTimestamp(),
  })

  // Update conversation
  const convRef = doc(db, 'conversations', conversationId)
  const convDoc = await getDoc(convRef)
  const convData = convDoc.data()

  await updateDoc(convRef, {
    lastMessage: content,
    lastMessageTime: serverTimestamp(),
    lastMessageBy: senderId,
    [`unreadCount.${receiverId}`]: (convData?.unreadCount?.[receiverId] || 0) + 1,
  })
}

// Get messages for conversation
export async function getMessages(
  conversationId: string,
  limitCount: number = 50
): Promise<Message[]> {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc'),
    limit(limitCount)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
  })) as Message[]
}

// Mark messages as read
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const convRef = doc(db, 'conversations', conversationId)
  await updateDoc(convRef, {
    [`unreadCount.${userId}`]: 0,
  })
}

// Get total unread count
export async function getTotalUnreadCount(userId: string): Promise<number> {
  const conversations = await getUserConversations(userId)
  return conversations.reduce((total, conv) => total + (conv.unreadCount[userId] || 0), 0)
}

// Search users by display name
export async function searchUsers(
  searchTerm: string,
  currentUserId: string,
  limitCount: number = 10
): Promise<SearchedUser[]> {
  if (!searchTerm.trim()) return []

  const searchLower = searchTerm.toLowerCase()

  try {
    // Tüm kullanıcıları çek (limit ile)
    const q = query(
      collection(db, 'users'),
      limit(200)
    )

    const snapshot = await getDocs(q)
    
    return snapshot.docs
      .map(doc => ({
        uid: doc.id,
        displayName: doc.data().displayName || 'Kullanıcı',
        photoURL: doc.data().photoURL || null,
        email: doc.data().email,
      }))
      .filter(user =>
        user.uid !== currentUserId &&
        (user.displayName.toLowerCase().includes(searchLower) ||
          (user.email && user.email.toLowerCase().includes(searchLower)))
      )
      .slice(0, limitCount)
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

// Create a new conversation with a user
export async function createConversation(
  currentUserId: string,
  currentUserName: string,
  currentUserPhoto: string | null,
  targetUserId: string,
  targetUserName: string,
  targetUserPhoto: string | null
): Promise<string> {
  // Check if conversation already exists
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', currentUserId)
  )

  const snapshot = await getDocs(q)
  const existing = snapshot.docs.find(doc => {
    const data = doc.data()
    return data.participants.includes(targetUserId)
  })

  if (existing) {
    return existing.id
  }

  // Create new conversation
  const docRef = doc(collection(db, 'conversations'))
  await setDoc(docRef, {
    participants: [currentUserId, targetUserId],
    participantNames: {
      [currentUserId]: currentUserName,
      [targetUserId]: targetUserName,
    },
    participantPhotos: {
      [currentUserId]: currentUserPhoto,
      [targetUserId]: targetUserPhoto,
    },
    lastMessage: '',
    lastMessageTime: serverTimestamp(),
    lastMessageBy: '',
    unreadCount: {
      [currentUserId]: 0,
      [targetUserId]: 0,
    },
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

// Pin a message in a conversation
export async function pinMessage(
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const convRef = doc(db, 'conversations', conversationId)
      const msgRef = doc(db, 'messages', messageId)
      
      const convDoc = await transaction.get(convRef)
      const msgDoc = await transaction.get(msgRef)
      
      if (!convDoc.exists()) {
        throw new Error('Conversation not found')
      }
      
      if (!msgDoc.exists()) {
        throw new Error('Message not found')
      }
      
      const convData = convDoc.data()
      const pinnedMessages = convData.pinnedMessages || []
      
      // Pin limit kontrolü (max 30)
      if (pinnedMessages.length >= 30) {
        throw new Error('PIN_LIMIT_REACHED')
      }
      
      // Mesaj zaten sabitlenmiş mi kontrol et
      const alreadyPinned = pinnedMessages.some(
        (pin: PinnedMessageRef) => pin.messageId === messageId
      )
      
      if (alreadyPinned) {
        return // Zaten sabitlenmiş, işlem yapma
      }
      
      // Conversation'a pinnedMessages ekle
      transaction.update(convRef, {
        pinnedMessages: arrayUnion({
          messageId,
          pinnedBy: userId,
          pinnedAt: serverTimestamp(),
        }),
      })
      
      // Message'a pinnedBy ekle
      transaction.update(msgRef, {
        pinnedBy: arrayUnion(userId),
      })
    })
  } catch (error: any) {
    if (error.message === 'PIN_LIMIT_REACHED') {
      throw new Error('Maksimum 30 mesaj sabitleyebilirsiniz. Eski mesajları kaldırın.')
    }
    console.error('Error pinning message:', error)
    throw new Error('Mesaj sabitlenemedi. Lütfen tekrar deneyin.')
  }
}

// Unpin a message from a conversation
export async function unpinMessage(
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const convRef = doc(db, 'conversations', conversationId)
      const msgRef = doc(db, 'messages', messageId)
      
      const convDoc = await transaction.get(convRef)
      const msgDoc = await transaction.get(msgRef)
      
      if (!convDoc.exists()) {
        throw new Error('Conversation not found')
      }
      
      if (!msgDoc.exists()) {
        throw new Error('Message not found')
      }
      
      const convData = convDoc.data()
      const pinnedMessages = convData.pinnedMessages || []
      
      // Sabitlenmiş mesajı bul
      const pinnedMessage = pinnedMessages.find(
        (pin: PinnedMessageRef) => pin.messageId === messageId
      )
      
      if (!pinnedMessage) {
        return // Zaten sabitlenmemiş, işlem yapma
      }
      
      // Conversation'dan pinnedMessages çıkar
      transaction.update(convRef, {
        pinnedMessages: arrayRemove(pinnedMessage),
      })
      
      // Message'dan pinnedBy çıkar
      transaction.update(msgRef, {
        pinnedBy: arrayRemove(userId),
      })
    })
  } catch (error) {
    console.error('Error unpinning message:', error)
    throw new Error('Mesaj kaldırılamadı. Lütfen tekrar deneyin.')
  }
}

// Edit a message
export async function editMessage(
  messageId: string,
  newContent: string,
  userId: string
): Promise<void> {
  try {
    const msgRef = doc(db, 'messages', messageId)
    const msgDoc = await getDoc(msgRef)
    
    if (!msgDoc.exists()) {
      throw new Error('Message not found')
    }
    
    const msgData = msgDoc.data()
    
    // Ownership kontrolü
    if (msgData.senderId !== userId) {
      throw new Error('EDIT_UNAUTHORIZED')
    }
    
    const originalContent = msgData.content
    
    // Edit history entry oluştur
    const editHistoryEntry: EditHistoryEntry = {
      originalContent,
      editedContent: newContent,
      editedAt: new Date(),
      editedBy: userId,
    }
    
    // Message güncelle
    await updateDoc(msgRef, {
      content: newContent,
      isEdited: true,
      lastEditedAt: serverTimestamp(),
      editHistory: arrayUnion(editHistoryEntry),
    })
  } catch (error: any) {
    if (error.message === 'EDIT_UNAUTHORIZED') {
      throw new Error('Sadece kendi mesajlarınızı düzenleyebilirsiniz.')
    }
    console.error('Error editing message:', error)
    throw new Error('Mesaj düzenlenemedi. Lütfen tekrar deneyin.')
  }
}

// Send a reply message
export async function sendReplyMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  content: string,
  receiverId: string,
  replyTo: {
    messageId: string
    senderId: string
    senderName: string
    content: string
  }
): Promise<void> {
  try {
    // Original message varlık kontrolü
    const originalMsgRef = doc(db, 'messages', replyTo.messageId)
    const originalMsgDoc = await getDoc(originalMsgRef)
    
    if (!originalMsgDoc.exists()) {
      throw new Error('Original message not found')
    }
    
    // Quote content'i 100 karakterle sınırla
    const quotedContent = replyTo.content.length > 100
      ? replyTo.content.substring(0, 100) + '...'
      : replyTo.content
    
    // Reply message oluştur
    await addDoc(collection(db, 'messages'), {
      conversationId,
      senderId,
      senderName,
      senderPhoto,
      content,
      read: false,
      createdAt: serverTimestamp(),
      replyTo: {
        messageId: replyTo.messageId,
        senderId: replyTo.senderId,
        senderName: replyTo.senderName,
        quotedContent,
      },
    })
    
    // Update conversation
    const convRef = doc(db, 'conversations', conversationId)
    const convDoc = await getDoc(convRef)
    const convData = convDoc.data()
    
    await updateDoc(convRef, {
      lastMessage: content,
      lastMessageTime: serverTimestamp(),
      lastMessageBy: senderId,
      [`unreadCount.${receiverId}`]: (convData?.unreadCount?.[receiverId] || 0) + 1,
    })
  } catch (error) {
    console.error('Error sending reply message:', error)
    throw new Error('Yanıt gönderilemedi. Lütfen tekrar deneyin.')
  }
}

// Get pinned messages for a conversation
export async function getPinnedMessages(
  conversationId: string
): Promise<Message[]> {
  try {
    const convRef = doc(db, 'conversations', conversationId)
    const convDoc = await getDoc(convRef)
    
    if (!convDoc.exists()) {
      return []
    }
    
    const convData = convDoc.data()
    const pinnedMessages = convData.pinnedMessages || []
    
    if (pinnedMessages.length === 0) {
      return []
    }
    
    // Her messageId için message detaylarını fetch et
    const messagePromises = pinnedMessages.map(async (pin: PinnedMessageRef) => {
      const msgRef = doc(db, 'messages', pin.messageId)
      const msgDoc = await getDoc(msgRef)
      
      if (!msgDoc.exists()) {
        return null
      }
      
      return {
        id: msgDoc.id,
        ...msgDoc.data(),
        createdAt: (msgDoc.data().createdAt as Timestamp)?.toDate() || new Date(),
        lastEditedAt: msgDoc.data().lastEditedAt
          ? (msgDoc.data().lastEditedAt as Timestamp).toDate()
          : undefined,
      } as Message
    })
    
    const messages = await Promise.all(messagePromises)
    
    // Null değerleri filtrele ve kronolojik sırada döndür
    return messages
      .filter((msg): msg is Message => msg !== null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  } catch (error) {
    console.error('Error getting pinned messages:', error)
    return []
  }
}

// Get edit history for a message
export async function getEditHistory(
  messageId: string
): Promise<EditHistoryEntry[]> {
  try {
    const msgRef = doc(db, 'messages', messageId)
    const msgDoc = await getDoc(msgRef)
    
    if (!msgDoc.exists()) {
      return []
    }
    
    const msgData = msgDoc.data()
    return msgData.editHistory || []
  } catch (error) {
    console.error('Error getting edit history:', error)
    return []
  }
}

// Scroll to a message in the conversation
export function scrollToMessage(
  messageId: string,
  messagesContainerRef: React.RefObject<HTMLDivElement>
): void {
  if (!messagesContainerRef.current) return
  
  const messageElement = messagesContainerRef.current.querySelector(
    `[data-message-id="${messageId}"]`
  )
  
  if (messageElement) {
    messageElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    
    // Highlight animasyonu (opsiyonel)
    messageElement.classList.add('highlight-flash')
    setTimeout(() => {
      messageElement.classList.remove('highlight-flash')
    }, 2000)
  }
}
