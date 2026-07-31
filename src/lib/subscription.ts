import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy
} from 'firebase/firestore'
import { db } from './firebase'

// ============ YENİ TIER SİSTEMİ ============

export type SubscriptionTier = 'free' | 'bronze' | 'gold' | 'diamond' | 'ruby'

// Legacy uyumluluk
export type SubscriptionPlan = 'free' | 'standard' | 'premium' | 'family'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial'

// Fiyatlandırma (TL)
// İlk yıllık alımda 3 ay bedava (9 ay fiyatı), sonraki yıllarda tam fiyat (12 ay)
export const TIER_PRICING = {
  bronze: {
    monthly: 40,
    yearlyFirstTime: 360,   // 9 ay fiyatı (3 ay bedava)
    yearlyRenewal: 480,     // 12 ay tam fiyat
  },
  gold: {
    monthly: 70,
    yearlyFirstTime: 630,
    yearlyRenewal: 840,
  },
  diamond: {
    monthly: 100,
    yearlyFirstTime: 900,
    yearlyRenewal: 1200,
  },
  ruby: {
    monthly: 150,
    yearlyFirstTime: 1350,
    yearlyRenewal: 1800,
  },
} as const

// Tier bilgileri
export const TIER_INFO: Record<SubscriptionTier, {
  label: string
  color: string
  gradient: string
  crown: string
  frameColor: string
  glowColor: string
  features: string[]
}> = {
  free: {
    label: 'Ücretsiz',
    color: '#6B7280',
    gradient: 'from-gray-500 to-gray-600',
    crown: '',
    frameColor: 'transparent',
    glowColor: 'transparent',
    features: ['Temel özellikler', 'Liste oluşturma'],
  },
  bronze: {
    label: 'Bronz',
    color: '#CD7F32',
    gradient: 'from-amber-700 to-amber-900',
    crown: '🥉',
    frameColor: '#CD7F32',
    glowColor: 'rgba(205, 127, 50, 0.5)',
    features: ['Reklamsız deneyim', 'Bronz profil çerçevesi', 'Özel rozet'],
  },
  gold: {
    label: 'Altın',
    color: '#FFD700',
    gradient: 'from-yellow-400 to-yellow-600',
    crown: '👑',
    frameColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.5)',
    features: ['Tüm Bronz özellikleri', 'Altın profil çerçevesi', 'Öncelikli destek'],
  },
  diamond: {
    label: 'Elmas',
    color: '#00BFFF',
    gradient: 'from-cyan-400 to-blue-500',
    crown: '💎',
    frameColor: '#00BFFF',
    glowColor: 'rgba(0, 191, 255, 0.5)',
    features: ['Tüm Altın özellikleri', 'Elmas profil çerçevesi', 'Özel animasyonlar'],
  },
  ruby: {
    label: 'Yakut',
    color: '#E0115F',
    gradient: 'from-red-500 to-pink-600',
    crown: '💎❤️',
    frameColor: '#E0115F',
    glowColor: 'rgba(224, 17, 95, 0.5)',
    features: ['Tüm Elmas özellikleri', 'Yakut profil çerçevesi', 'VIP etkinlikler', 'Özel içerik erişimi'],
  },
}

// Tier sıralaması
export const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  bronze: 1,
  gold: 2,
  diamond: 3,
  ruby: 4,
}

export interface Subscription {
  tier: SubscriptionTier
  plan?: SubscriptionPlan // Legacy uyumluluk
  status: SubscriptionStatus
  startDate: Date
  endDate: Date
  autoRenew: boolean
  billingCycle: 'monthly' | 'yearly'
  price: number
  paymentMethod?: string
  lastPaymentDate?: Date
  nextPaymentDate?: Date
  cancelledAt?: Date
}

// Legacy plan features (geriye uyumluluk)
export interface PlanFeatures {
  maxDevices: number
  maxQuality: '480p' | '1080p' | '4K'
  adsEnabled: boolean
  downloadEnabled: boolean
  maxDownloads: number
  earlyAccess: boolean
  maxProfiles: number
  parentalControls: boolean
}

export const PLAN_FEATURES: Record<SubscriptionPlan, PlanFeatures> = {
  free: {
    maxDevices: 1,
    maxQuality: '480p',
    adsEnabled: true,
    downloadEnabled: false,
    maxDownloads: 0,
    earlyAccess: false,
    maxProfiles: 1,
    parentalControls: false,
  },
  standard: {
    maxDevices: 2,
    maxQuality: '1080p',
    adsEnabled: false,
    downloadEnabled: true,
    maxDownloads: 5,
    earlyAccess: false,
    maxProfiles: 2,
    parentalControls: false,
  },
  premium: {
    maxDevices: 4,
    maxQuality: '4K',
    adsEnabled: false,
    downloadEnabled: true,
    maxDownloads: -1,
    earlyAccess: true,
    maxProfiles: 4,
    parentalControls: true,
  },
  family: {
    maxDevices: 6,
    maxQuality: '4K',
    adsEnabled: false,
    downloadEnabled: true,
    maxDownloads: -1,
    earlyAccess: true,
    maxProfiles: 6,
    parentalControls: true,
  },
}

export const PLAN_PRICES = {
  standard: { monthly: 49, yearly: 490 },
  premium: { monthly: 89, yearly: 890 },
  family: { monthly: 129, yearly: 1290 },
}

// ============ TIER FONKSİYONLARI ============

// Kullanıcı tier'ını al
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  try {
    const docRef = doc(db, 'subscriptions', userId)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return 'free'

    const data = docSnap.data()
    const endDate = (data.endDate as Timestamp)?.toDate() || new Date()

    if (data.status !== 'active' || new Date() > endDate) {
      return 'free'
    }

    return (data.tier as SubscriptionTier) || 'free'
  } catch (error) {
    console.error('Error getting user tier:', error)
    return 'free'
  }
}

// Premium mi?
export function isPremium(tier: SubscriptionTier): boolean {
  return tier !== 'free'
}

// Tier karşılaştırma
export function hasTier(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier]
}

// Fiyat hesaplama (ilk alım için yearlyFirstTime, yenileme için yearlyRenewal)
export function calculateTierPrice(
  tier: Exclude<SubscriptionTier, 'free'>,
  isYearly: boolean,
  isFirstTime: boolean = true
): number {
  if (!isYearly) return TIER_PRICING[tier].monthly
  return isFirstTime ? TIER_PRICING[tier].yearlyFirstTime : TIER_PRICING[tier].yearlyRenewal
}

// Yıllık tasarruf (ilk alım için)
export function calculateYearlySavings(tier: Exclude<SubscriptionTier, 'free'>): number {
  const monthly = TIER_PRICING[tier].monthly * 12
  const yearly = TIER_PRICING[tier].yearlyFirstTime
  return monthly - yearly
}

// Kullanıcının daha önce abone olup olmadığını kontrol et
export async function hasHadSubscriptionBefore(userId: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'subscriptions', userId)
    const docSnap = await getDoc(docRef)
    return docSnap.exists()
  } catch {
    return false
  }
}

// Tier aboneliği oluştur
export async function createTierSubscription(
  userId: string,
  tier: SubscriptionTier,
  billingCycle: 'monthly' | 'yearly',
  paymentMethod: string,
  isFirstTime: boolean = true
): Promise<void> {
  if (tier === 'free') return

  const now = new Date()
  const endDate = new Date(now)
  if (billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1)
  } else {
    endDate.setMonth(endDate.getMonth() + 1)
  }

  const price = calculateTierPrice(tier, billingCycle === 'yearly', isFirstTime)

  await setDoc(doc(db, 'subscriptions', userId), {
    tier,
    status: 'active',
    startDate: serverTimestamp(),
    endDate: Timestamp.fromDate(endDate),
    autoRenew: true,
    billingCycle,
    price,
    paymentMethod,
    isFirstPurchase: isFirstTime,
    lastPaymentDate: serverTimestamp(),
    nextPaymentDate: Timestamp.fromDate(endDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// ============ İADE SİSTEMİ ============

export interface RefundRequest {
  id: string
  userId: string
  subscriptionTier: SubscriptionTier
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: Date
  processedAt?: Date
  processedBy?: string
  rejectionReason?: string
}

// İade talebi oluştur (7 gün içinde)
export async function requestRefund(
  userId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const subscription = await getUserSubscription(userId)
    if (!subscription) {
      return { success: false, message: 'Aktif abonelik bulunamadı.' }
    }

    // 7 gün kontrolü
    const daysSinceStart = Math.floor(
      (new Date().getTime() - subscription.startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceStart > 7) {
      return { success: false, message: 'İade talebi sadece ilk 7 gün içinde yapılabilir.' }
    }

    // İade talebi kaydet
    const refundRef = doc(db, 'refundRequests', `${userId}_${Date.now()}`)
    await setDoc(refundRef, {
      userId,
      subscriptionTier: subscription.tier,
      amount: subscription.price,
      reason,
      status: 'pending',
      requestedAt: serverTimestamp(),
    })

    return { success: true, message: 'İade talebiniz alındı. En kısa sürede işleme alınacaktır.' }
  } catch (error) {
    console.error('Refund request error:', error)
    return { success: false, message: 'İade talebi oluşturulurken hata oluştu.' }
  }
}

// İade talebini onayla (Admin için) - Manuel onay (iyzico API entegrasyonu sonra eklenecek)
export async function approveRefund(refundId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Önce refund request'i al
    const refundDoc = await getDoc(doc(db, 'refundRequests', refundId))
    if (!refundDoc.exists()) {
      return { success: false, error: 'İade talebi bulunamadı' }
    }
    
    const refundData = refundDoc.data()
    
    // Payment transaction ID'yi kullanıcının subscription'ından al
    const subscriptionDoc = await getDoc(doc(db, 'subscriptions', refundData.userId))
    const subscriptionData = subscriptionDoc.exists() ? subscriptionDoc.data() : null
    
    // TODO: iyzico ile para iadesi - API route'a taşınacak
    // Şimdilik sadece DB güncelle (manuel iade işlemi)
    await updateDoc(doc(db, 'refundRequests', refundId), {
      status: 'approved',
      processedAt: serverTimestamp(),
      processedBy: adminId,
      note: 'Manuel onay - iyzico entegrasyonu API route\'a taşınacak'
    })
    
    // Kullanıcının aboneliğini iptal et
    await updateDoc(doc(db, 'subscriptions', refundData.userId), {
      status: 'cancelled',
      tier: 'free',
      cancelledAt: serverTimestamp(),
      cancelReason: 'refund_approved'
    })
    
    return { success: true }
  } catch (error) {
    console.error('Refund approval error:', error)
    return { success: false, error: 'İade işlemi sırasında hata oluştu' }
  }
}

// İade talebini reddet (Admin için)
export async function rejectRefund(
  refundId: string,
  adminId: string,
  rejectionReason: string
): Promise<void> {
  await updateDoc(doc(db, 'refundRequests', refundId), {
    status: 'rejected',
    processedAt: serverTimestamp(),
    processedBy: adminId,
    rejectionReason,
  })
}

// ============ ESKİ FONKSİYONLAR (Uyumluluk) ============

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    const docRef = doc(db, 'subscriptions', userId)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    const data = docSnap.data()
    return {
      tier: data.tier || 'free',
      plan: data.plan,
      status: data.status,
      startDate: (data.startDate as Timestamp)?.toDate() || new Date(),
      endDate: (data.endDate as Timestamp)?.toDate() || new Date(),
      autoRenew: data.autoRenew ?? true,
      billingCycle: data.billingCycle || 'monthly',
      price: data.price || 0,
      paymentMethod: data.paymentMethod,
      lastPaymentDate: data.lastPaymentDate?.toDate(),
      nextPaymentDate: data.nextPaymentDate?.toDate(),
      cancelledAt: data.cancelledAt?.toDate(),
    }
  } catch (error) {
    console.error('Error getting subscription:', error)
    return null
  }
}

export async function hasActivePremium(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId)
  return isPremium(tier)
}

export async function getUserPlanFeatures(userId: string): Promise<PlanFeatures> {
  const sub = await getUserSubscription(userId)
  if (!sub || sub.status !== 'active' || new Date() > sub.endDate) {
    return PLAN_FEATURES.free
  }
  return PLAN_FEATURES[sub.plan || 'free']
}

export async function createSubscription(
  userId: string,
  plan: SubscriptionPlan,
  billingCycle: 'monthly' | 'yearly',
  paymentMethod: string
): Promise<void> {
  const now = new Date()
  const endDate = new Date(now)
  if (billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1)
  } else {
    endDate.setMonth(endDate.getMonth() + 1)
  }
  const price = plan === 'free' ? 0 : PLAN_PRICES[plan][billingCycle]
  await setDoc(doc(db, 'subscriptions', userId), {
    plan,
    tier: 'free', // legacy
    status: 'active',
    startDate: serverTimestamp(),
    endDate: Timestamp.fromDate(endDate),
    autoRenew: true,
    billingCycle,
    price,
    paymentMethod,
    lastPaymentDate: serverTimestamp(),
    nextPaymentDate: Timestamp.fromDate(endDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function cancelSubscription(userId: string): Promise<void> {
  await updateDoc(doc(db, 'subscriptions', userId), {
    autoRenew: false,
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function canAccessContent(userPlan: SubscriptionPlan, requiredPlan: SubscriptionPlan = 'free'): boolean {
  const hierarchy: SubscriptionPlan[] = ['free', 'standard', 'premium', 'family']
  return hierarchy.indexOf(userPlan) >= hierarchy.indexOf(requiredPlan)
}

export function getAvailableQualities(plan: SubscriptionPlan): string[] {
  switch (plan) {
    case 'free': return ['480p']
    case 'standard': return ['480p', '720p', '1080p']
    default: return ['480p', '720p', '1080p', '4K']
  }
}
