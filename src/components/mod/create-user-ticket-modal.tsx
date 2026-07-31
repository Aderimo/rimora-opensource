'use client'

import { useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { collection, doc, setDoc, serverTimestamp, addDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'

interface CreateUserTicketModalProps {
    isOpen: boolean
    onClose: () => void
}

export function CreateUserTicketModal({ isOpen, onClose }: CreateUserTicketModalProps) {
    const { user } = useAuth()
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !message.trim() || !user) return

        setLoading(true)
        try {
            // Email'e göre kullanıcı bul
            const usersQuery = query(
                collection(db, 'users'),
                where('email', '==', email.trim()),
                limit(1)
            )
            const usersSnapshot = await getDocs(usersQuery)
            
            if (usersSnapshot.empty) {
                toast.error('Bu email adresine sahip kullanıcı bulunamadı')
                setLoading(false)
                return
            }

            const targetUser = usersSnapshot.docs[0]
            const targetUserId = targetUser.id

            // Feedback oluştur
            const docRef = doc(collection(db, 'feedbacks'))
            await setDoc(docRef, {
                userId: targetUserId,
                userEmail: email.trim(),
                type: 'other',
                message: message.trim(),
                status: 'pending',
                priority: 'high',
                modCreated: true,
                createdByMod: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessageAt: serverTimestamp()
            })

            // İlk mesajı ekle
            await addDoc(collection(docRef, 'messages'), {
                feedbackId: docRef.id,
                senderId: user.uid,
                message: message.trim(),
                role: 'moderator',
                createdAt: serverTimestamp()
            })

            toast.success('Ticket başarıyla oluşturuldu')
            onClose()
        } catch (error) {
            console.error('Error creating ticket:', error)
            toast.error('Ticket oluşturulurken bir hata oluştu')
        } finally {
            setLoading(false)
            setEmail('')
            setMessage('')
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg max-w-md w-full p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">Kullanıcıya Karşı Ticket</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition"
                    >
                        <Icons.close className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">Kullanıcı Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:border-purple-500 outline-none"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">Şikayet Nedeni</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Şikayet açıklaması..."
                            rows={4}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:border-purple-500 outline-none resize-none"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1"
                        >
                            İptal
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !email.trim() || !message.trim()}
                            className="flex-1"
                        >
                            {loading ? (
                                <>
                                    <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                    Oluşturuluyor...
                                </>
                            ) : (
                                'Ticket Oluştur'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
