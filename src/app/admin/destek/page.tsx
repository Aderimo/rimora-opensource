'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getFeedbacks, updateFeedbackStatus, getFeedbackMessages, sendFeedbackMessage, type Feedback, type FeedbackMessage, type FeedbackStatus } from '@/lib/feedback'
import { getUserRole, hasPermission, type UserRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

export default function SupportPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [myRole, setMyRole] = useState<UserRole>('user')
  const [checkingAuth, setCheckingAuth] = useState(true)
  
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [messages, setMessages] = useState<FeedbackMessage[]>([])
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all')
  const [loading2, setLoading2] = useState(false)
  const [replyInput, setReplyInput] = useState('')
  const [sending, setSending] = useState(false)

  const statusColors: Record<FeedbackStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    reviewing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
    unresolved: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const typeLabels: Record<string, string> = {
    bug: '🐛 Hata Raporu',
    suggestion: '💡 Önerisi',
    account: '👤 Hesap Sorunu',
    other: '❓ Diğer'
  }

  useEffect(() => {
    async function init() {
      if (!user) {
        setCheckingAuth(false)
        return
      }

      const role = await getUserRole(user.uid, user.email || undefined)
      setMyRole(role)
      setCheckingAuth(false)

      if (hasPermission(role, 'moderator')) {
        loadFeedbacks()
      } else {
        router.push('/admin')
      }
    }

    if (!loading) init()
  }, [user, loading, router])

  const loadFeedbacks = async (status?: FeedbackStatus | 'all') => {
    setLoading2(true)
    try {
      const data = await getFeedbacks(status === 'all' || !status ? undefined : status)
      setFeedbacks(data)
    } catch (error) {
      console.error('Destek talepleri yüklenemedi:', error)
      toast.error('Destek talepleri yüklenemedi')
    } finally {
      setLoading2(false)
    }
  }

  const loadMessages = async (feedbackId: string) => {
    setLoading2(true)
    try {
      const msgs = await getFeedbackMessages(feedbackId)
      setMessages(msgs)
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error)
      toast.error('Mesajlar yüklenemedi')
    } finally {
      setLoading2(false)
    }
  }

  const handleSelectFeedback = async (feedback: Feedback) => {
    setSelectedFeedback(feedback)
    await loadMessages(feedback.id)
  }

  const handleStatusChange = async (feedbackId: string, newStatus: FeedbackStatus) => {
    try {
      await updateFeedbackStatus(feedbackId, newStatus)
      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, status: newStatus } : f))
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback({ ...selectedFeedback, status: newStatus })
      }
      toast.success(`Durum güncellendi: ${newStatus}`)
    } catch (error) {
      console.error('Durum güncellenemedi:', error)
      toast.error('Durum güncellenemedi')
    }
  }

  const handleSendReply = async () => {
    if (!replyInput.trim() || !selectedFeedback) return

    setSending(true)
    try {
      await sendFeedbackMessage(selectedFeedback.id, user!.uid, replyInput, 'admin')
      setReplyInput('')
      await loadMessages(selectedFeedback.id)
      toast.success('Yanıt gönderildi')
    } catch (error) {
      console.error('Yanıt gönderilemedi:', error)
      toast.error('Yanıt gönderilemedi')
    } finally {
      setSending(false)
    }
  }

  if (loading || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Icons.spinner className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !hasPermission(myRole, 'moderator')) {
    return null
  }

  const filteredFeedbacks = filterStatus === 'all' 
    ? feedbacks 
    : feedbacks.filter(f => f.status === filterStatus)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="border-b border-white/10">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Icons.help className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-white">Destek Talepleri</h1>
          </div>
          <p className="text-white/60">Kullanıcılardan gelen destek taleplerini ve geri bildirimleri yönetin</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Liste */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#151515] rounded-xl border border-white/10 p-4">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <Icons.settings className="h-5 w-5" />
                Filtrele
              </h2>

              <div className="space-y-2">
                {(['all', 'pending', 'reviewing', 'resolved', 'unresolved'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilterStatus(status)
                      loadFeedbacks(status === 'all' ? undefined : status)
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 rounded-lg transition-all font-medium',
                      filterStatus === status
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    )}
                  >
                    {status === 'all' && 'Tümü'}
                    {status === 'pending' && '⏳ Bekleniyor'}
                    {status === 'reviewing' && '👀 İnceleniyor'}
                    {status === 'resolved' && '✅ Çözüldü'}
                    {status === 'unresolved' && '❌ Çözülemedi'}
                    <span className="ml-auto text-xs opacity-70">
                      {feedbacks.filter(f => status === 'all' ? true : f.status === status).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Destek Talepleri Listesi */}
            <div className="bg-[#151515] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/5 font-bold text-white">
                Talep Listesi ({filteredFeedbacks.length})
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {loading2 ? (
                  <div className="p-8 flex justify-center">
                    <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredFeedbacks.length === 0 ? (
                  <div className="p-8 text-center text-white/40">
                    <p>Destek talebi bulunamadı</p>
                  </div>
                ) : (
                  filteredFeedbacks.map(feedback => (
                    <button
                      key={feedback.id}
                      onClick={() => handleSelectFeedback(feedback)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-white/5 transition-all hover:bg-white/5',
                        selectedFeedback?.id === feedback.id && 'bg-primary/10 border-l-2 border-l-primary'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{feedback.message.substring(0, 30)}...</div>
                          <div className="text-xs text-white/50 mt-1">
                            {feedback.user?.displayName || feedback.userEmail || 'Bilinmiyor'}
                          </div>
                        </div>
                        <div className={cn('px-2 py-1 rounded text-xs font-medium whitespace-nowrap border', statusColors[feedback.status])}>
                          {feedback.status === 'pending' && '⏳'}
                          {feedback.status === 'reviewing' && '👀'}
                          {feedback.status === 'resolved' && '✅'}
                          {feedback.status === 'unresolved' && '❌'}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Detay */}
          <div className="lg:col-span-2">
            {selectedFeedback ? (
              <div className="bg-[#151515] rounded-xl border border-white/10 overflow-hidden flex flex-col h-full">
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{selectedFeedback.message}</h3>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <Icons.user className="h-4 w-4" />
                        {selectedFeedback.user?.displayName || selectedFeedback.userEmail || 'Bilinmiyor'}
                      </div>
                    </div>
                    <div className={cn('px-3 py-1 rounded-lg font-medium border', statusColors[selectedFeedback.status])}>
                      {selectedFeedback.status}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 bg-white/5 text-white/70 rounded-full text-xs">
                      {typeLabels[selectedFeedback.type] || selectedFeedback.type}
                    </span>
                    <span className="px-3 py-1 bg-white/5 text-white/70 rounded-full text-xs">
                      {formatDistanceToNow(selectedFeedback.createdAt, { locale: tr })} önce
                    </span>
                  </div>

                  {/* Durum Değiştirme */}
                  <div className="flex gap-2 flex-wrap">
                    {(['pending', 'reviewing', 'resolved', 'unresolved'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(selectedFeedback.id, status)}
                        disabled={selectedFeedback.status === status}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          selectedFeedback.status === status
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        )}
                      >
                        {status === 'pending' && '⏳ Bekle'}
                        {status === 'reviewing' && '👀 İncele'}
                        {status === 'resolved' && '✅ Çöz'}
                        {status === 'unresolved' && '❌ Çözülemedi'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mesajlar */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {loading2 ? (
                    <div className="flex justify-center py-8">
                      <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-white/40 py-8">
                      Henüz mesaj yok
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isAdmin = msg.role === 'admin'
                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={cn(
                              'max-w-[70%] rounded-xl px-4 py-2',
                              isAdmin
                                ? 'bg-primary text-white rounded-br-none'
                                : 'bg-white/10 text-white/90 rounded-bl-none'
                            )}
                          >
                            {!isAdmin && (
                              <p className="text-[10px] text-white/60 font-bold mb-1 uppercase">Kullanıcı</p>
                            )}
                            <p className="text-sm">{msg.message}</p>
                            <p className={cn('text-[10px] mt-1', isAdmin ? 'text-white/50' : 'text-white/40')}>
                              {formatDistanceToNow(msg.createdAt, { locale: tr })} önce
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Yanıt Gönder */}
                {selectedFeedback.status !== 'resolved' && selectedFeedback.status !== 'unresolved' && !selectedFeedback.isClosed && (
                  <div className="p-4 border-t border-white/10 bg-[#1a1a1a]">
                    <div className="flex gap-2">
                      <input
                        value={replyInput}
                        onChange={e => setReplyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                        placeholder="Yanıt yazın..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:border-primary/50 outline-none"
                      />
                      <Button
                        onClick={handleSendReply}
                        disabled={!replyInput.trim() || sending}
                        className="gap-2"
                      >
                        {sending ? (
                          <Icons.spinner className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icons.send className="h-4 w-4" />
                        )}
                        Gönder
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#151515] rounded-xl border border-white/10 h-full flex items-center justify-center text-white/40">
                <div className="text-center">
                  <Icons.help className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Detayları görüntülemek için soldan bir talep seçin</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
