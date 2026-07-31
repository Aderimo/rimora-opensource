'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getUserSubscription,
  requestRefund,
  TIER_INFO,
  type Subscription,
  calculateYearlySavings,
  TIER_PRICING
} from '@/lib/subscription'
import { formatDateTR, formatNumberTR } from '@/lib/utils/format'

export default function SubscriptionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [refundLoading, setRefundLoading] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/giris')
  }, [user, loading, router])

  useEffect(() => {
    async function loadSub() {
      if (user) {
        const sub = await getUserSubscription(user.uid)
        setSubscription(sub)
        setDataLoading(false)
      }
    }
    loadSub()
  }, [user])

  const handleRefundRequest = async () => {
    if (!user || !refundReason.trim()) return

    setRefundLoading(true)
    try {
      const result = await requestRefund(user.uid, refundReason)
      if (result.success) {
        alert(result.message)
        setShowRefundModal(false)
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error('Refund error:', error)
      alert('Bir hata oluştu.')
    } finally {
      setRefundLoading(false)
    }
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentTier = subscription?.tier || 'free'
  const isPremium = currentTier !== 'free'
  const tierInfo = TIER_INFO[currentTier]

  // Calculate days since start for refund eligibility
  const daysSinceStart = subscription
    ? Math.floor((new Date().getTime() - subscription.startDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999

  const canRefund = isPremium && daysSinceStart <= 7

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <Icons.chevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Abonelik Yönetimi</h1>
            <p className="text-muted-foreground">Mevcut planınız ve faturalandırma</p>
          </div>
        </div>

        {/* Current Plan Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: isPremium ? `linear-gradient(135deg, ${tierInfo.color}, ${tierInfo.color}80)` : 'bg-muted' }}
              >
                <div className="text-3xl">{tierInfo.crown || '👤'}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Mevcut Plan</p>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {tierInfo.label}
                  {isPremium && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">Aktif</span>}
                </h2>
                {isPremium && subscription && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Bitiş: {formatDateTR(subscription.endDate)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {!isPremium ? (
                <Button onClick={() => router.push('/premium')} className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black border-0">
                  <Icons.crown className="h-4 w-4 mr-2" />
                  Premium'a Geç
                </Button>
              ) : (
                <>
                  <Button variant="outline">Planı Değiştir</Button>
                  {canRefund && (
                    <Button variant="destructive" onClick={() => setShowRefundModal(true)}>
                      <Icons.refresh className="h-4 w-4 mr-2" />
                      İade Talep Et
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Icons.info className="h-4 w-4 text-primary" />
              Ödeme Bilgileri
            </h3>
            {isPremium ? (
              <div className="space-y-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Son Ödeme:</span>
                  <span>{formatDateTR(subscription?.startDate)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Tutar:</span>
                  <span className="font-bold">{formatNumberTR(subscription?.price || 0, { currency: true, decimals: 2 })}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Yöntem:</span>
                  <span>{subscription?.billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Premium üyeliğiniz bulunmuyor.</p>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Icons.shield className="h-4 w-4 text-green-500" />
              İade Politikası
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Premium aboneliklerde ilk satın alımdan itibaren <strong>7 gün</strong> içinde koşulsuz iade talep edebilirsiniz.
            </p>
            {isPremium && !canRefund && (
              <p className="text-xs text-red-500">
                7 günlük iade süreniz dolmuştur.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRefundModal(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">İade Talebi</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Lütfen iade nedenini kısaca belirtin. İade işlemleri 1-3 iş günü içinde tamamlanacaktır.
            </p>
            <textarea
              className="w-full h-24 p-3 rounded-lg bg-muted resize-none text-sm mb-4"
              placeholder="Neden iade etmek istiyorsunuz?"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowRefundModal(false)}>İptal</Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleRefundRequest}
                disabled={refundLoading || !refundReason.trim()}
              >
                {refundLoading ? 'Gönderiliyor...' : 'Talebi Gönder'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
