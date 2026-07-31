'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  getUserConversations,
  getMessages,
  sendMessage,
  sendReplyMessage,
  markMessagesAsRead,
  searchUsers,
  createConversation,
  pinMessage,
  unpinMessage,
  editMessage,
  getPinnedMessages,
  scrollToMessage,
  type Conversation,
  type Message,
  type SearchedUser
} from '@/lib/messaging'
import { cn } from '@/lib/utils'
import { formatRelativeTimeTR } from '@/lib/utils/format'
import { MessageBubble } from '@/components/messaging/message-bubble'
import { PinnedMessagesPanel } from '@/components/messaging/pinned-messages-panel'
import { MessageInput } from '@/components/messaging/message-input'

export default function MessagesPage() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeConvId = searchParams.get('conv')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [pinnedLoading, setPinnedLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Search states
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/giris')
    }
  }, [user, authLoading, router])

  // Load conversations
  useEffect(() => {
    async function loadConversations() {
      if (!user) return
      try {
        const convs = await getUserConversations(user.uid)
        setConversations(convs)

        // Auto-select conversation from URL
        if (activeConvId) {
          const conv = convs.find(c => c.id === activeConvId)
          if (conv) setActiveConversation(conv)
        }
      } catch {
        // Sessiz hata - index oluşturulana kadar boş liste göster
        setConversations([])
      } finally {
        setLoading(false)
      }
    }
    loadConversations()
  }, [user, activeConvId])

  // Load messages when conversation changes
  useEffect(() => {
    async function loadMessages() {
      if (!activeConversation || !user) return
      setMessagesLoading(true)
      setPinnedLoading(true)
      try {
        const [msgs, pinned] = await Promise.all([
          getMessages(activeConversation.id),
          getPinnedMessages(activeConversation.id)
        ])
        setMessages(msgs)
        setPinnedMessages(pinned)
        await markMessagesAsRead(activeConversation.id, user.uid)
      } catch {
        setMessages([])
        setPinnedMessages([])
      } finally {
        setMessagesLoading(false)
        setPinnedLoading(false)
      }
    }
    loadMessages()
  }, [activeConversation, user])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() || !activeConversation || !user || !userProfile) return

    const otherUserId = activeConversation.participants.find(p => p !== user.uid)!

    setSending(true)
    try {
      if (replyingTo) {
        await sendReplyMessage(
          activeConversation.id,
          user.uid,
          userProfile.displayName || 'Kullanıcı',
          userProfile.photoURL,
          newMessage.trim(),
          otherUserId,
          {
            messageId: replyingTo.id,
            senderId: replyingTo.senderId,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
          }
        )
      } else {
        await sendMessage(
          activeConversation.id,
          user.uid,
          userProfile.displayName || 'Kullanıcı',
          userProfile.photoURL,
          newMessage.trim(),
          otherUserId
        )
      }

      // Reload messages
      const msgs = await getMessages(activeConversation.id)
      setMessages(msgs)
      setNewMessage('')
      setReplyingTo(null)
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Mesaj gönderilemedi. Lütfen tekrar deneyin.')
    } finally {
      setSending(false)
    }
  }

  const handlePin = async (messageId: string) => {
    if (!activeConversation || !user) return
    try {
      await pinMessage(activeConversation.id, messageId, user.uid)
      const pinned = await getPinnedMessages(activeConversation.id)
      setPinnedMessages(pinned)
    } catch (error: any) {
      alert(error.message || 'Mesaj sabitlenemedi.')
    }
  }

  const handleUnpin = async (messageId: string) => {
    if (!activeConversation || !user) return
    try {
      await unpinMessage(activeConversation.id, messageId, user.uid)
      const pinned = await getPinnedMessages(activeConversation.id)
      setPinnedMessages(pinned)
    } catch (error: any) {
      alert(error.message || 'Mesaj kaldırılamadı.')
    }
  }

  const handleEdit = async (messageId: string, newContent: string) => {
    if (!user) return
    try {
      await editMessage(messageId, newContent, user.uid)
      const msgs = await getMessages(activeConversation!.id)
      setMessages(msgs)
    } catch (error: any) {
      alert(error.message || 'Mesaj düzenlenemedi.')
    }
  }

  const handleReply = (message: Message) => {
    setReplyingTo(message)
  }

  const handleQuoteClick = (messageId: string) => {
    if (messagesContainerRef.current) {
      scrollToMessage(messageId, messagesContainerRef)
    }
  }

  const selectConversation = (conv: Conversation) => {
    setActiveConversation(conv)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    router.push(`/mesajlar?conv=${conv.id}`, { scroll: false })
  }

  // Search users with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!searchQuery.trim() || !user) {
      setSearchResults([])
      return
    }

    setSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(searchQuery, user.uid)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, user])

  const handleStartConversation = async (targetUser: SearchedUser) => {
    if (!user || !userProfile) {
      alert('Kullanıcı bilgileri yüklenemedi. Lütfen sayfayı yenileyin.')
      return
    }

    try {
      const convId = await createConversation(
        user.uid,
        userProfile.displayName || 'Kullanıcı',
        userProfile.photoURL || null,
        targetUser.uid,
        targetUser.displayName,
        targetUser.photoURL
      )

      // Reload conversations
      const convs = await getUserConversations(user.uid)
      setConversations(convs)

      // Select the new/existing conversation
      const conv = convs.find(c => c.id === convId)
      if (conv) {
        selectConversation(conv)
      } else {
        alert('Sohbet bulunamadı. Lütfen tekrar deneyin.')
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
      alert('Sohbet oluşturulamadı. Lütfen tekrar deneyin.')
    }
  }

  const getOtherUser = (conv: Conversation) => {
    if (!user) return { name: '', photo: null }
    const otherId = conv.participants.find(p => p !== user.uid)!
    return {
      id: otherId,
      name: conv.participantNames[otherId] || 'Kullanıcı',
      photo: conv.participantPhotos[otherId],
    }
  }

  const formatTime = (date: Date) => {
    return formatRelativeTimeTR(date)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-card border border-border rounded-2xl overflow-hidden h-[calc(100vh-180px)] flex">
        {/* Conversations List */}
        <div className={cn(
          'w-full md:w-80 border-r border-border flex flex-col',
          activeConversation && 'hidden md:flex'
        )}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold">Mesajlar</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSearch(!showSearch)}
                className={cn(showSearch && 'bg-muted')}
              >
                {showSearch ? <Icons.close className="h-5 w-5" /> : <Icons.search className="h-5 w-5" />}
              </Button>
            </div>

            {/* Search Input */}
            {showSearch && (
              <div className="relative">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Kullanıcı ara..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Search Results */}
            {showSearch && searchQuery.trim() && (
              <div className="border-b border-border">
                {searching ? (
                  <div className="flex justify-center py-4">
                    <Icons.spinner className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <p className="px-4 py-2 text-xs text-muted-foreground font-medium">Kullanıcılar</p>
                    {searchResults.map((searchUser) => (
                      <div
                        key={searchUser.uid}
                        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/50 bg-card"
                      >
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {searchUser.photoURL ? (
                            <Image src={searchUser.photoURL} alt={searchUser.displayName} fill className="object-cover" sizes="40px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                              <span className="text-white font-bold text-sm">{searchUser.displayName[0].toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{searchUser.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{searchUser.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            onClick={() => router.push(`/kullanici/${searchUser.uid}`)}
                          >
                            Profil
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-purple-600 hover:bg-purple-700"
                            onClick={() => handleStartConversation(searchUser)}
                          >
                            <Icons.messageSquare className="h-3 w-3 mr-1" />
                            Mesaj
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">Kullanıcı bulunamadı</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Tam kullanıcı adını yazmayı deneyin.</p>
                  </div>
                )}
              </div>
            )}

            {/* Conversations */}
            {(!showSearch || !searchQuery.trim()) && (
              conversations.length > 0 ? (
                conversations.map((conv) => {
                  const other = getOtherUser(conv)
                  const unread = conv.unreadCount[user.uid] || 0

                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left',
                        activeConversation?.id === conv.id && 'bg-muted'
                      )}
                    >
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {other.photo ? (
                          <Image src={other.photo} alt={other.name} fill className="object-cover" sizes="48px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                            <span className="text-white font-bold">{other.name[0].toUpperCase()}</span>
                          </div>
                        )}
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{other.name}</p>
                          <span className="text-xs text-muted-foreground">{formatTime(conv.lastMessageTime)}</span>
                        </div>
                        <p className={cn(
                          'text-sm truncate',
                          unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                        )}>
                          {conv.lastMessage || 'Henüz mesaj yok'}
                        </p>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <Icons.comment className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Henüz mesajınız yok</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSearch(true)}
                  >
                    <Icons.search className="h-4 w-4 mr-2" />
                    Kullanıcı Ara
                  </Button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={cn(
          'flex-1 flex flex-col',
          !activeConversation && 'hidden md:flex'
        )}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setActiveConversation(null)}
                >
                  <Icons.chevronLeft className="h-5 w-5" />
                </Button>
                {(() => {
                  const other = getOtherUser(activeConversation)
                  return (
                    <>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                        {other.photo ? (
                          <Image src={other.photo} alt={other.name} width={40} height={40} className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                            <span className="text-white font-bold">{other.name[0].toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{other.name}</p>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Pinned Messages Panel */}
              <PinnedMessagesPanel
                pinnedMessages={pinnedMessages}
                onMessageClick={handleQuoteClick}
                onUnpin={handleUnpin}
                loading={pinnedLoading}
              />

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => {
                    const isOwn = msg.senderId === user.uid
                    const isPinned = pinnedMessages.some(p => p.id === msg.id)
                    const canPin = pinnedMessages.length < 30
                    
                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={isOwn}
                        isPinned={isPinned}
                        canPin={canPin}
                        onPin={handlePin}
                        onUnpin={handleUnpin}
                        onEdit={handleEdit}
                        onReply={handleReply}
                        onQuoteClick={handleQuoteClick}
                      />
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">Henüz mesaj yok. İlk mesajı gönder!</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <MessageInput
                value={newMessage}
                onChange={setNewMessage}
                onSubmit={handleSend}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                disabled={sending}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <Icons.comment className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Mesajlarınız</h2>
              <p className="text-muted-foreground">Bir sohbet seçin veya yeni bir sohbet başlatın</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
