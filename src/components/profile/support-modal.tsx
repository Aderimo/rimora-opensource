'use client'

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { createFeedback, getUserFeedbacks, getFeedbackMessages, subscribeToFeedbackMessages, sendFeedbackMessage, FeedbackType, FeedbackPriority, Feedback, FeedbackMessage } from '@/lib/feedback'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface SupportModalProps {
    userId: string
    userEmail?: string
    isOpen: boolean
    onClose: () => void
}

export function SupportModal({ userId, userEmail, isOpen, onClose }: SupportModalProps) {
    const { user } = useAuth()
    const [view, setView] = useState<'list' | 'create' | 'chat'>('list')
    const [tickets, setTickets] = useState<Feedback[]>([])
    const [selectedTicket, setSelectedTicket] = useState<Feedback | null>(null)
    const [messages, setMessages] = useState<FeedbackMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    // Create Form State
    const [newType, setNewType] = useState<FeedbackType>('bug')
    const [newPriority, setNewPriority] = useState<FeedbackPriority>('medium')
    const [newMessage, setNewMessage] = useState('')

    // Chat State
    const [chatInput, setChatInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const unsubscribeRef = useRef<(() => void) | null>(null)

    // Load tickets on open
    useEffect(() => {
        if (isOpen) {
            loadTickets()
        }
    }, [isOpen])

    // Load messages when ticket selected
    useEffect(() => {
        if (selectedTicket) {
            loadMessages(selectedTicket.id)
            setView('chat')
        }
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current()
            }
        }
    }, [selectedTicket])

    // Scroll to bottom
    useEffect(() => {
        if (view === 'chat' && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, view])

    const loadTickets = async () => {
        setRefreshing(true)
        try {
            const data = await getUserFeedbacks(userId)
            setTickets(data)
            if (data.length === 0) setView('create')
            else if (view !== 'chat' && view !== 'create') setView('list')
        } catch (error) {
            console.error('Error loading tickets', error)
        } finally {
            setRefreshing(false)
        }
    }

    const loadMessages = async (ticketId: string) => {
        setLoading(true)
        try {
            // Set up real-time listener
            const unsubscribe = subscribeToFeedbackMessages(ticketId, (updatedMessages) => {
                setMessages(updatedMessages)
            })
            unsubscribeRef.current = unsubscribe
        } catch (error) {
            console.error('Error loading messages', error)
        } finally {
            setLoading(false)
        }
    }

    // Check if current user can write to ticket
    const canWriteToTicket = (ticket: Feedback): boolean => {
        if (!user) return false
        if (ticket.isClosed) return false
        // Owner can always write
        if (ticket.userId === user.uid) return true
        return false
    }

    const getPermissionMessage = (ticket: Feedback): string => {
        if (ticket.isClosed) {
            return 'Bu talep kapalı'
        }
        if (ticket.userId !== user?.uid) {
            return 'Bu talebe yazı yazma izniniz yok'
        }
        return ''
    }

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim()) return

        setLoading(true)
        try {
            console.log('📝 Destek talebi oluşturuluyor...', {
                userId,
                type: newType,
                message: newMessage,
                email: userEmail
            })
            const id = await createFeedback(userId, newType, newMessage, userEmail, newPriority)
            console.log('✅ Destek talebi başarıyla oluşturuldu! ID:', id)
            toast.success('Destek talebi oluşturuldu')
            setNewMessage('')
            setNewType('bug')
            setNewPriority('medium')
            await loadTickets()

            // Select the new ticket
            const newTicket = tickets.find(t => t.id === id) || {
                id,
                userId,
                type: newType,
                message: newMessage,
                priority: newPriority,
                status: 'pending',
                createdAt: new Date()
            } as Feedback

            setSelectedTicket(newTicket)
        } catch (error) {
            console.error('❌ Destek talebi oluşturma hatası:', error)
            const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata'
            toast.error(`Talep oluşturulamadı: ${errorMsg}`)
        } finally {
            setLoading(false)
        }
    }

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedTicket) return

        const msg = chatInput
        setChatInput('') // Optimistic clear

        // Optimistic update
        const optimisticMsg: FeedbackMessage = {
            id: 'temp-' + Date.now(),
            feedbackId: selectedTicket.id,
            senderId: userId,
            message: msg,
            role: 'user',
            createdAt: new Date()
        }
        setMessages(prev => [...prev, optimisticMsg])

        try {
            console.log('📨 Mesaj gönderiliyor...', {
                feedbackId: selectedTicket.id,
                userId,
                message: msg,
                timestamp: new Date()
            })
            await sendFeedbackMessage(selectedTicket.id, userId, msg, 'user')
            console.log('✅ Mesaj başarıyla gönderildi!')
            // Reload real messages
            await loadMessages(selectedTicket.id)
        } catch (error) {
            console.error('❌ Destek mesajı gönderme hatası:', error)
            const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata'
            toast.error(`Mesaj gönderilemedi: ${errorMsg}`)
            // Revert optimistic? For now just reload
            await loadMessages(selectedTicket.id)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-4xl bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">

                {/* Sidebar (List) */}
                <div className={cn(
                    "w-full md:w-1/3 border-r border-white/10 flex flex-col bg-[#151515]",
                    view === 'chat' ? 'hidden md:flex' : 'flex'
                )}>
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h2 className="font-bold text-white">Destek Taleplerim</h2>
                        <Button size="sm" variant="ghost" onClick={() => setView('create')}>
                            <Icons.plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {refreshing && tickets.length === 0 ? (
                            <div className="p-4 text-center"><Icons.spinner className="animate-spin h-5 w-5 mx-auto" /></div>
                        ) : tickets.length === 0 ? (
                            <div className="p-8 text-center text-white/40 text-sm">
                                Henüz bir destek talebiniz yok.
                                <Button variant="link" onClick={() => setView('create')} className="text-purple-400">Yeni Oluştur</Button>
                            </div>
                        ) : (
                            tickets.map(ticket => (
                                <div
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={cn(
                                        "p-3 rounded-lg cursor-pointer transition-colors border border-transparent",
                                        selectedTicket?.id === ticket.id ? "bg-purple-500/10 border-purple-500/50" : "hover:bg-white/5 border-white/5"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold",
                                            ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                                ticket.status === 'reviewing' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                        )}>
                                            {ticket.status}
                                        </span>
                                        <span className="text-[10px] text-white/40">
                                            {ticket.updatedAt ? formatDistanceToNow(ticket.updatedAt, { addSuffix: true, locale: tr }) : 'Yeni'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-white line-clamp-1">{ticket.message}</p>
                                    <p className="text-xs text-white/50 mt-1 capitalize">{ticket.type}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className={cn(
                    "flex-1 flex flex-col bg-[#111]",
                    view === 'list' ? 'hidden md:flex' : 'flex'
                )}>
                    {view === 'create' ? (
                        /* Create Form */
                        <div className="flex-1 p-6 flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">Yeni Destek Talebi</h3>
                                <Button variant="ghost" size="sm" onClick={() => {
                                    if (tickets.length > 0) setView('list')
                                    else onClose()
                                }}>
                                    <Icons.close className="h-4 w-4" />
                                </Button>
                            </div>

                            <form onSubmit={handleCreateTicket} className="space-y-4 flex-1">
                                <div>
                                    <label className="text-sm text-white/60 mb-1.5 block">Konu</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'bug', label: 'Hata', icon: Icons.alertTriangle },
                                            { id: 'account', label: 'Hesap', icon: Icons.user },
                                            { id: 'suggestion', label: 'Öneri', icon: Icons.star },
                                            { id: 'other', label: 'Diğer', icon: Icons.help }
                                        ].map((t) => (
                                            <div
                                                key={t.id}
                                                onClick={() => setNewType(t.id as FeedbackType)}
                                                className={cn(
                                                    "cursor-pointer p-3 rounded-lg border flex items-center gap-2 transition-all",
                                                    newType === t.id ? "bg-purple-500/20 border-purple-500 text-purple-200" : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                                                )}
                                            >
                                                <t.icon className="h-4 w-4" />
                                                <span className="text-sm">{t.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col">
                                    <label className="text-sm text-white/60 mb-1.5 block">Mesajınız</label>
                                    <textarea
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 text-white resize-none focus:border-purple-500/50 outline-none"
                                        placeholder="Detaylı açıklama..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-white/60 mb-1.5 block">Öncelik</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'low', label: '🟢 Düşük', emoji: '🟢' },
                                            { id: 'medium', label: '🟡 Orta', emoji: '🟡' },
                                            { id: 'high', label: '🔴 Yüksek', emoji: '🔴' }
                                        ].map((p) => (
                                            <div
                                                key={p.id}
                                                onClick={() => setNewPriority(p.id as FeedbackPriority)}
                                                className={cn(
                                                    "cursor-pointer p-2 rounded-lg border flex items-center justify-center gap-1 transition-all text-sm",
                                                    newPriority === p.id ? "bg-purple-500/20 border-purple-500 text-purple-200" : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                                                )}
                                            >
                                                {p.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    {tickets.length > 0 && (
                                        <Button type="button" variant="ghost" onClick={() => setView('list')}>İptal</Button>
                                    )}
                                    <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                                        {loading ? <Icons.spinner className="animate-spin h-4 w-4" /> : 'Talebi Gönder'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    ) : selectedTicket ? (
                        /* Chat View */
                        <>
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#151515]">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => {
                                        setSelectedTicket(null)
                                        setView('list')
                                    }}>
                                        <Icons.chevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white capitalize">{selectedTicket.type}</span>
                                            <span className={cn(
                                                "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold",
                                                selectedTicket.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                                    selectedTicket.status === 'reviewing' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                            )}>
                                                {selectedTicket.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/40">ID: {selectedTicket.id}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={onClose}>
                                    <Icons.close className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
                                {loading && messages.length === 0 ? (
                                    <div className="flex justify-center p-4"><Icons.spinner className="animate-spin h-6 w-6 text-purple-500" /></div>
                                ) : (
                                    <>
                                        {messages.map((msg, i) => {
                                            const isMe = msg.role === 'user' // or senderId === userId
                                            const isStaff = !isMe
                                            return (
                                                <div key={msg.id || i} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                                                    <div className={cn(
                                                        "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                                                        isMe ? "bg-purple-600 text-white rounded-br-none" : "bg-[#222] text-white/90 rounded-bl-none border border-white/5"
                                                    )}>
                                                        {isStaff && <p className="text-[10px] text-purple-400 font-bold mb-1 uppercase tracking-wider">{msg.role || 'Yetkili'}</p>}
                                                        <p className="whitespace-pre-wrap">{msg.message}</p>
                                                        <p className={cn("text-[10px] mt-1 opacity-50", isMe ? "text-white" : "text-white/60")}>
                                                            {msg.createdAt ? formatDistanceToNow(msg.createdAt, { locale: tr }) : 'Şimdi'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/10 bg-[#151515]">
                                {!canWriteToTicket(selectedTicket) ? (
                                    <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <p className="text-red-400 text-sm font-medium">{getPermissionMessage(selectedTicket)}</p>
                                        {selectedTicket.isClosed && (
                                            <p className="text-xs text-red-400/60 mt-1">Yeni bir sorununuz varsa yeni talep oluşturabilirsiniz.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Mesajınızı yazın..."
                                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500/50 outline-none"
                                        />
                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={!chatInput.trim()}
                                            size="icon"
                                            className="bg-purple-600 hover:bg-purple-700"
                                        >
                                            <Icons.send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center text-white/30 p-8 text-center">
                            <div className="p-4 bg-white/5 rounded-full mb-4">
                                <Icons.messageSquare className="h-8 w-8" />
                            </div>
                            <p>Detaylarını görüntülemek için soldan bir talep seçin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
