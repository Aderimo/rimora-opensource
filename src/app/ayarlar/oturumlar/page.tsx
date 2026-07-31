'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import {
  getUserSessions,
  terminateSession,
  terminateOtherSessions,
  getLoginHistory,
  type Session,
  type LoginHistory,
} from '@/lib/auth/session-management'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { toast } from 'sonner'
import {
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

export default function SessionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [sessions, setSessions] = useState<Session[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [terminating, setTerminating] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return

    setLoading(true)
    try {
      const [sessionsData, historyData] = await Promise.all([
        getUserSessions(user.uid),
        getLoginHistory(user.uid, 20),
      ])

      setSessions(sessionsData)
      setLoginHistory(historyData)
    } catch (error) {
      toast.error('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleTerminateSession = async (sessionId: string) => {
    setTerminating(sessionId)
    try {
      await terminateSession(sessionId)
      toast.success('Oturum sonlandırıldı')
      loadData()
    } catch (error) {
      toast.error('Oturum sonlandırılamadı')
    } finally {
      setTerminating(null)
    }
  }

  const handleTerminateOthers = async () => {
    if (!user || !confirm('Diğer tüm oturumları sonlandırmak istediğinizden emin misiniz?')) {
      return
    }

    const currentSession = sessions.find((s) => s.isCurrentSession)
    if (!currentSession) return

    try {
      await terminateOtherSessions(user.uid, currentSession.id)
      toast.success('Diğer oturumlar sonlandırıldı')
      loadData()
    } catch (error) {
      toast.error('Oturumlar sonlandırılamadı')
    }
  }

  const getDeviceIcon = (device: string) => {
    if (device === 'Mobil') return Smartphone
    if (device === 'Tablet') return Tablet
    return Monitor
  }

  if (!user) {
    router.push('/giris')
    return null
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/ayarlar')}
          className="mb-4"
        >
          <Icons.arrowLeft className="h-4 w-4 mr-2" />
          Ayarlara Dön
        </Button>
        
        <h1 className="text-3xl font-bold mb-2">Oturum Yönetimi</h1>
        <p className="text-muted-foreground">
          Aktif oturumlarınızı ve giriş geçmişinizi görüntüleyin
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Sessions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Aktif Oturumlar</h2>
              {sessions.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTerminateOthers}
                >
                  Diğerlerini Sonlandır
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.deviceInfo.device)
                
                return (
                  <div
                    key={session.id}
                    className={cn(
                      'p-4 rounded-xl border',
                      session.isCurrentSession
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-card'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'p-3 rounded-lg',
                          session.isCurrentSession
                            ? 'bg-primary/10'
                            : 'bg-muted'
                        )}>
                          <DeviceIcon className="h-5 w-5" />
                        </div>

                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {session.deviceInfo.browser} • {session.deviceInfo.os}
                              </p>
                              {session.isCurrentSession && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                                  Mevcut Oturum
                                </span>
                              )}
                              {session.isTrusted && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {session.deviceInfo.device}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {session.location.city || 'Bilinmeyen'}, {session.location.country || 'Bilinmeyen'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatDistanceToNow(session.lastActivityAt, {
                                  addSuffix: true,
                                  locale: tr,
                                })}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            IP: {session.ipAddress}
                          </p>
                        </div>
                      </div>

                      {!session.isCurrentSession && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTerminateSession(session.id)}
                          disabled={terminating === session.id}
                        >
                          {terminating === session.id ? (
                            <Icons.spinner className="h-4 w-4 animate-spin" />
                          ) : (
                            'Sonlandır'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Login History */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Giriş Geçmişi</h2>

            <div className="space-y-2">
              {loginHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'p-4 rounded-lg border',
                    entry.suspicious && 'border-yellow-500/30 bg-yellow-500/5',
                    !entry.success && 'border-destructive/30 bg-destructive/5'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {entry.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {entry.deviceInfo.browser} • {entry.deviceInfo.os}
                          </p>
                          {entry.suspicious && (
                            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="text-xs">Şüpheli</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>
                            {entry.location.city || 'Bilinmeyen'}, {entry.location.country || 'Bilinmeyen'}
                          </span>
                          <span>•</span>
                          <span>{entry.ipAddress}</span>
                        </div>

                        {!entry.success && entry.failureReason && (
                          <p className="text-sm text-destructive">
                            {entry.failureReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(entry.timestamp, {
                        addSuffix: true,
                        locale: tr,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
