'use client'

import { useEffect, useState, useRef, ChangeEvent } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { subscribeToRoomMessages, sendRoomMessage, ModRoomMessage } from '@/lib/mod-rooms'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RoomChatProps {
    roomId: string
}

export function RoomChat({ roomId }: RoomChatProps) {
    const { user } = useAuth()
    const [messages, setMessages] = useState<ModRoomMessage[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!roomId) return

        const unsubscribe = subscribeToRoomMessages(roomId, setMessages)
        return () => unsubscribe()
    }, [roomId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !user) return

        setLoading(true)
        try {
            await sendRoomMessage(
                roomId,
                user.uid,
                user.displayName || 'Anonim',
                newMessage,
                user.photoURL || ''
            )
            setNewMessage('')
        } catch (error) {
            console.error('Mesaj gönderme hatası:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-[500px] bg-[#0a0a0a] rounded-lg border border-white/5">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#111]">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-white/40">
                        <div className="text-center">
                            <Icons.messageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p>Henüz mesaj yok</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-3 ${
                                msg.senderId === user?.uid ? 'flex-row-reverse' : ''
                            }`}
                        >
                            {/* Avatar */}
                            {msg.senderPhoto && (
                                <img
                                    src={msg.senderPhoto}
                                    alt={msg.senderName}
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                />
                            )}
                            {!msg.senderPhoto && (
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white/70">
                                    {msg.senderName?.charAt(0).toUpperCase()}
                                </div>
                            )}

                            {/* Message */}
                            <div
                                className={`flex-1 max-w-xs ${
                                    msg.senderId === user?.uid
                                        ? 'flex items-end flex-col'
                                        : ''
                                }`}
                            >
                                <p className="text-xs font-semibold text-white/60 mb-1">
                                    {msg.senderName}
                                </p>
                                <div
                                    className={`px-3 py-2 rounded-lg break-words ${
                                        msg.senderId === user?.uid
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-white/10 text-white'
                                    }`}
                                >
                                    {msg.message}
                                </div>
                                <p className="text-xs text-white/40 mt-1">
                                    {msg.createdAt.toLocaleTimeString('tr-TR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t border-white/5 p-4 bg-[#0a0a0a]">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        placeholder="Mesaj yazın..."
                        value={newMessage}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                        disabled={loading}
                        className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                    <Button
                        type="submit"
                        disabled={loading || !newMessage.trim()}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <Icons.send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    )
}
