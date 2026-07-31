'use client'

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getFeedbacks, getFeedbackMessages, subscribeToFeedbackMessages, sendFeedbackMessage, updateFeedbackStatus, resolveFeedback, assignFeedback, Feedback, FeedbackMessage, FeedbackStatus, FeedbackPriority } from '@/lib/feedback'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useAuth } from '@/contexts/auth-context'
import { UserRole } from '@/lib/roles'

export default function ModFeedbackPage() {
    const { user, userProfile } = useAuth()
    const [tickets, setTickets] = useState<Feedback[]>([])
    const [selectedTicket, setSelectedTicket] = useState<Feedback | null>(null)
    const [messages, setMessages] = useState<FeedbackMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all')
    const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | 'all'>('all')
    const unsubscribeRef = useRef<(() => void) | null>(null)

    // Resolution dialog state
    const [showResolutionDialog, setShowResolutionDialog] = useState(false)
    const [resolutionNote, setResolutionNote] = useState('')
    const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'unresolved'>('resolved')

    useEffect(() => {
        loadTickets()
    }, [filter, priorityFilter])

    useEffect(() => {
        if (selectedTicket) {
            loadMessages(selectedTicket.id)
        }
        // Cleanup listener on unmount or ticket change
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current()
            }
        }
    }, [selectedTicket])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const loadTickets = async () => {
        setLoading(true)
        try {
            const status = filter === 'all' ? undefined : filter
            let data = await getFeedbacks(status)

            // Apply priority filter
            if (priorityFilter !== 'all') {
                data = data.filter(t => t.priority === priorityFilter)
            }

            setTickets(data)
        } catch (error) {
            console.error('Error loading tickets', error)
            toast.error('Talepler yüklenemedi')
        } finally {
            setLoading(false)
        }
    }

    const loadMessages = async (ticketId: string) => {
        setLoadingMessages(true)
        try {
            // Set up real-time listener
            const unsubscribe = subscribeToFeedbackMessages(ticketId, (updatedMessages) => {
                setMessages(updatedMessages)
            })
            unsubscribeRef.current = unsubscribe
        } catch (error) {
            console.error('Error loading messages', error)
        } finally {
            setLoadingMessages(false)
        }
    }

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedTicket || !user) return

        const msg = chatInput
        setChatInput('')

        // Optimistic
        const roleLabel = (userProfile?.role === 'motorcu' || userProfile?.role === 'arabaci' || userProfile?.role === 'admin') ? 'Yetkili' : 'Moderatör'

        const optimisticMsg: FeedbackMessage = {
            id: 'temp-' + Date.now(),
            feedbackId: selectedTicket.id,
            senderId: user.uid,
            message: msg,
            role: roleLabel, // Show actual role label
            createdAt: new Date()
        }
        setMessages(prev => [...prev, optimisticMsg])

        try {
            await sendFeedbackMessage(selectedTicket.id, user.uid, msg, roleLabel)

            // If ticket was pending, mark as reviewing automatically?
            if (selectedTicket.status === 'pending') {
                await updateStatus(selectedTicket.id, 'reviewing')
            }

            loadMessages(selectedTicket.id)
        } catch (error) {
            toast.error('Mesaj gönderilemedi')
            loadMessages(selectedTicket.id)
        }
    }

    const updateStatus = async (ticketId: string, status: FeedbackStatus) => {
        try {
            await updateFeedbackStatus(ticketId, status)
            toast.success('Durum güncellendi')

            // Update local state
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t))
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket(prev => prev ? { ...prev, status } : null)
            }
        } catch (error) {
            toast.error('Güncelleme başarısız')
        }
    }

    // Check if current moderator can write to this ticket
    const canWriteToTicket = (ticket: Feedback): boolean => {
        if (!user) return false
        if (ticket.isClosed) return false
        // If not assigned yet, no one can write
        if (!ticket.assignedTo) return false
        // Only assigned moderator can write
        if (ticket.assignedTo === user.uid) return true
        return false
    }

    const getWritePermissionMessage = (ticket: Feedback): string => {
        if (ticket.isClosed) {
            return 'Bu talep kapalı'
        }
        if (!ticket.assignedTo) {
            return 'Bu talep henüz üstlenilmemiş'
        }
        if (ticket.assignedTo !== user?.uid) {
            return `Bu talep ${ticket.assignedToName || 'başka bir moderatör'} tarafından üstlenilmiş`
        }
        return ''
    }

    const handleAssign = async () => {
        if (!selectedTicket || !user || !userProfile?.displayName) {
            toast.error('Hata oluştu')
            return
        }

        try {
            await assignFeedback(selectedTicket.id, user.uid, userProfile.displayName)
            toast.success('Ticket üstlenildi')

            // Update local state
            setTickets(prev => prev.map(t =>
                t.id === selectedTicket.id
                    ? { ...t, assignedTo: user.uid, assignedToName: userProfile.displayName!, status: 'reviewing' }
                    : t
            ))
            setSelectedTicket(prev => prev ? {
                ...prev,
                assignedTo: user.uid,
                assignedToName: userProfile.displayName!,
                status: 'reviewing'
            } : null)
        } catch (error) {
            toast.error('Üstlenme başarısız')
        }
    }

    const handleResolve = async () => {
        if (!selectedTicket || !user || !resolutionNote.trim()) {
            toast.error('Lütfen bir not yazınız')
            return
        }

        try {
            await resolveFeedback(selectedTicket.id, resolutionStatus, resolutionNote, user.uid)
            toast.success(resolutionStatus === 'resolved' ? 'Talep çözüldü olarak işaretlendi' : 'Talep çözülemedi olarak işaretlendi')

            // Update local state
            setTickets(prev => prev.map(t =>
                t.id === selectedTicket.id
                    ? {
                        ...t,
                        status: resolutionStatus,
                        resolutionNote,
                        resolvedBy: user.uid,
                        resolvedAt: new Date()
                    }
                    : t
            ))

            setSelectedTicket(prev => prev ? {
                ...prev,
                status: resolutionStatus,
                resolutionNote,
                resolvedBy: user.uid,
                resolvedAt: new Date()
            } : null)

            setShowResolutionDialog(false)
            setResolutionNote('')
            setResolutionStatus('resolved')
        } catch (error) {
            toast.error('Hata oluştu')
            console.error(error)
        }
    }

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4">
            {/* Sidebar List */}
            <div className="w-full md:w-1/3 bg-[#151515] border border-white/5 rounded-xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/5">
                    <h2 className="font-bold text-white mb-4">Destek Talepleri</h2>
                    <div className="flex flex-col gap-3">
                        {/* Status Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {(['all', 'pending', 'reviewing', 'resolved', 'unresolved'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                                        filter === status
                                            ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                                            : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10"
                                    )}
                                >
                                    {status === 'all' ? 'Tümü' :
                                        status === 'pending' ? 'Beklemede' :
                                            status === 'reviewing' ? 'İnceleniyor' :
                                                status === 'resolved' ? 'Çözüldü' :
                                                    'Çözülemedi'}
                                </button>
                            ))}
                        </div>

                        {/* Priority Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {(['all', 'high', 'medium', 'low'] as const).map(priority => (
                                <button
                                    key={priority}
                                    onClick={() => setPriorityFilter(priority)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                                        priorityFilter === priority
                                            ? priority === 'all' ? "bg-purple-500/20 text-purple-400 border-purple-500/50" :
                                                priority === 'high' ? "bg-red-500/20 text-red-400 border-red-500/50" :
                                                    priority === 'medium' ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" :
                                                        "bg-green-500/20 text-green-400 border-green-500/50"
                                            : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10"
                                    )}
                                >
                                    {priority === 'all' ? 'Tüm Öncelikler' :
                                        priority === 'high' ? '🔴 Yüksek' :
                                            priority === 'medium' ? '🟡 Orta' :
                                                '🟢 Düşük'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loading ? (
                        <div className="p-8 flex justify-center"><Icons.spinner className="animate-spin h-6 w-6 text-purple-500" /></div>
                    ) : tickets.length === 0 ? (
                        <div className="p-8 text-center text-white/40 text-sm">Talep bulunamadı.</div>
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
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                                        {ticket.user?.photoURL ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={ticket.user.photoURL} alt="" className="object-cover w-full h-full" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/50">
                                                {(ticket.user?.displayName || 'U')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-white text-sm truncate">
                                                {ticket.user?.displayName || ticket.userEmail || 'Kullanıcı'}
                                            </span>
                                            <span className="text-[10px] text-white/40 whitespace-nowrap ml-1">
                                                {ticket.lastMessageAt ? formatDistanceToNow(ticket.lastMessageAt, { addSuffix: true, locale: tr }) : 'Yeni'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-white/40 truncate">{ticket.userId}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-1">
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold",
                                        ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                            ticket.status === 'reviewing' ? 'bg-blue-500/20 text-blue-400' :
                                                ticket.status === 'unresolved' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                    )}>
                                        {ticket.status === 'resolved' ? 'Çözüldü' :
                                            ticket.status === 'reviewing' ? 'İnceleniyor' :
                                                ticket.status === 'unresolved' ? 'Çözülemedi' :
                                                    'Beklemede'}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold",
                                        ticket.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                            ticket.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-green-500/20 text-green-400'
                                    )}>
                                        {ticket.priority === 'high' ? 'Yüksek' :
                                            ticket.priority === 'medium' ? 'Orta' :
                                                'Düşük'}
                                    </span>
                                    <span className="text-[10px] text-white/50 capitalize border border-white/10 px-1.5 py-0.5 rounded">
                                        {ticket.type === 'bug' ? '🐛 Hata' :
                                            ticket.type === 'suggestion' ? '💡 Önerisi' :
                                                ticket.type === 'account' ? '👤 Hesap' :
                                                    '❓ Diğer'}
                                    </span>
                                    <p className="text-xs text-white/60 line-clamp-1 ml-2">{ticket.message}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#151515] border border-white/5 rounded-xl flex flex-col overflow-hidden">
                {selectedTicket ? (
                    <>
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#1a1a1a]">
                            <div className="flex items-center gap-3">
                                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white/10">
                                    {selectedTicket.user?.photoURL ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={selectedTicket.user.photoURL} alt="" className="object-cover w-full h-full" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center font-bold text-white/50">
                                            {(selectedTicket.user?.displayName || 'U')[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        {selectedTicket.user?.displayName || selectedTicket.userEmail || 'Kullanıcı'}
                                        {selectedTicket.assignedTo && (
                                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                                                ✓ {selectedTicket.assignedToName}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-white/40">ID: {selectedTicket.userId}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!selectedTicket.isClosed && !selectedTicket.assignedTo && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                                        onClick={handleAssign}
                                    >
                                        <Icons.check className="h-4 w-4 mr-1" />
                                        Üstlen
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
                                    disabled={selectedTicket.isClosed}
                                    onClick={() => {
                                        setShowResolutionDialog(true)
                                        setResolutionStatus('resolved')
                                    }}
                                >
                                    <Icons.check className="h-4 w-4 mr-1" />
                                    Çözüldü
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-red-500/20 text-red-400 hover:bg-red-500/10"
                                    disabled={selectedTicket.isClosed}
                                    onClick={() => {
                                        setShowResolutionDialog(true)
                                        setResolutionStatus('unresolved')
                                    }}
                                >
                                    <Icons.close className="h-4 w-4 mr-1" />
                                    Çözülemedi
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 hover:bg-white/10"
                                    disabled={selectedTicket.isClosed}
                                    onClick={() => updateStatus(selectedTicket.id, 'reviewing')}
                                >
                                    İnceleniyor
                                </Button>
                            </div>
                        </div>

                        {/* Resolution Info */}
                        {(selectedTicket.status === 'resolved' || selectedTicket.status === 'unresolved') && selectedTicket.resolutionNote && (
                            <div className={cn(
                                "p-4 border-t",
                                selectedTicket.status === 'resolved' ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/20 bg-orange-500/5'
                            )}>
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "mt-1 flex-shrink-0",
                                        selectedTicket.status === 'resolved' ? 'text-green-400' : 'text-orange-400'
                                    )}>
                                        {selectedTicket.status === 'resolved' ? <Icons.check className="h-5 w-5" /> : <Icons.alertCircle className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-sm font-bold mb-2",
                                            selectedTicket.status === 'resolved' ? 'text-green-400' : 'text-orange-400'
                                        )}>
                                            {selectedTicket.status === 'resolved' ? 'Çözüldü' : 'Çözülemedi'}
                                        </p>
                                        <p className="text-sm text-white/70 whitespace-pre-wrap">{selectedTicket.resolutionNote}</p>
                                        <p className="text-xs text-white/40 mt-2">
                                            {selectedTicket.resolvedAt && format(selectedTicket.resolvedAt, 'd MMMM yyyy HH:mm', { locale: tr })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/20">
                            {messages.map((msg, i) => {
                                const isUser = msg.role === 'user'
                                return (
                                    <div key={msg.id || i} className={cn("flex", isUser ? "justify-start" : "justify-end")}>
                                        <div className={cn(
                                            "flex flex-col max-w-[80%]",
                                            isUser ? "items-start" : "items-end"
                                        )}>
                                            <span className="text-[10px] text-white/40 mb-1 px-1">
                                                {isUser ? 'Kullanıcı' : msg.role}
                                            </span>
                                            <div className={cn(
                                                "rounded-2xl px-4 py-3 text-sm border",
                                                isUser
                                                    ? "bg-[#222] text-white border-white/10 rounded-tl-none"
                                                    : "bg-purple-600/20 text-purple-100 border-purple-500/20 rounded-tr-none"
                                            )}>
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                            </div>
                                            <span className="text-[10px] text-white/20 mt-1 px-1">
                                                {msg.createdAt ? formatDistanceToNow(msg.createdAt, { locale: tr }) : 'Şimdi'}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-white/5 bg-[#1a1a1a]">
                            {!canWriteToTicket(selectedTicket) ? (
                                <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <p className="text-red-400 text-sm font-medium">{getWritePermissionMessage(selectedTicket)}</p>
                                    {!selectedTicket.assignedTo && (
                                        <p className="text-xs text-red-400/60 mt-1">Yazabilmek için önce bu talep üstlenmelisiniz.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <textarea
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        placeholder="Yanıt yaz..."
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 outline-none resize-none h-12 min-h-[48px]"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendMessage()
                                            }
                                        }}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!chatInput.trim()}
                                        size="icon"
                                        className="h-12 w-12 bg-purple-600 hover:bg-purple-700 rounded-xl"
                                    >
                                        <Icons.send className="h-5 w-5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/30">
                        <Icons.messageSquare className="h-12 w-12 mb-4 opacity-50" />
                        <p>Görüntülemek için bir talep seçin</p>
                    </div>
                )}
            </div>

            {/* Resolution Dialog */}
            {showResolutionDialog && selectedTicket && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1a1a] rounded-xl border border-white/10 w-full max-w-md p-6 space-y-4">
                        <div>
                            <h3 className="text-xl font-bold text-white">
                                {resolutionStatus === 'resolved' ? 'Talep Çözüldü' : 'Talep Çözülemedi'}
                            </h3>
                            <p className="text-sm text-white/50 mt-1">
                                Kullanıcıya gönderilecek notu yazın
                            </p>
                        </div>

                        <textarea
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder={resolutionStatus === 'resolved' ?
                                "Örn: Sorununuz çözülmüştür. Kontrol edebilirsiniz..." :
                                "Örn: Maalesef bu sorunu şu anda çözemiyor ve sonra çözeceğiz..."
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none min-h-24"
                        />

                        <div className="flex gap-2 justify-end pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => setShowResolutionDialog(false)}
                                className="hover:bg-white/10"
                            >
                                İptal
                            </Button>
                            <Button
                                onClick={handleResolve}
                                className={cn(
                                    "h-10",
                                    resolutionStatus === 'resolved'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                )}
                            >
                                {resolutionStatus === 'resolved' ? 'Çözüldü Olarak Kapat' : 'Çözülemedi Olarak Kapat'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
