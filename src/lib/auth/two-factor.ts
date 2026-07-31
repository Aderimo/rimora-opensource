/**
 * Two-Factor Authentication (2FA) Utility
 * Firebase Auth Multi-Factor Authentication
 */

import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  type User,
  type MultiFactorResolver,
  type MultiFactorInfo,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

/**
 * 2FA enrollment için telefon numarası doğrulama başlat
 */
export async function startPhoneEnrollment(
  user: User,
  phoneNumber: string,
  recaptchaContainerId: string = 'recaptcha-container'
): Promise<string> {
  try {
    // Recaptcha verifier oluştur
    const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    })

    // Multi-factor session başlat
    const multiFactorSession = await multiFactor(user).getSession()

    // Phone auth provider
    const phoneAuthProvider = new PhoneAuthProvider(auth)

    // Doğrulama kodu gönder
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      {
        phoneNumber,
        session: multiFactorSession,
      },
      recaptchaVerifier
    )

    return verificationId
  } catch (error: any) {
    console.error('2FA enrollment başlatma hatası:', error)
    throw new Error(error.message || '2FA kurulumu başlatılamadı')
  }
}

/**
 * 2FA enrollment'ı tamamla
 */
export async function completePhoneEnrollment(
  user: User,
  verificationId: string,
  verificationCode: string,
  displayName: string = 'Telefon'
): Promise<void> {
  try {
    // Phone credential oluştur
    const phoneAuthCredential = PhoneAuthProvider.credential(
      verificationId,
      verificationCode
    )

    // Multi-factor assertion oluştur
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneAuthCredential)

    // 2FA'yı kullanıcıya ekle
    await multiFactor(user).enroll(multiFactorAssertion, displayName)
  } catch (error: any) {
    console.error('2FA enrollment tamamlama hatası:', error)
    throw new Error(error.message || '2FA kurulumu tamamlanamadı')
  }
}

/**
 * 2FA faktörlerini listele
 */
export function getEnrolledFactors(user: User): MultiFactorInfo[] {
  return multiFactor(user).enrolledFactors
}

/**
 * 2FA faktörünü kaldır
 */
export async function unenrollFactor(
  user: User,
  multiFactorInfo: MultiFactorInfo
): Promise<void> {
  try {
    await multiFactor(user).unenroll(multiFactorInfo)
  } catch (error: any) {
    console.error('2FA kaldırma hatası:', error)
    throw new Error(error.message || '2FA kaldırılamadı')
  }
}

/**
 * 2FA doğrulama başlat (giriş sırasında)
 */
export async function startPhoneVerification(
  resolver: MultiFactorResolver,
  phoneInfoOptions: MultiFactorInfo,
  recaptchaContainerId: string = 'recaptcha-container'
): Promise<string> {
  try {
    // Recaptcha verifier
    const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    })

    // Phone auth provider
    const phoneAuthProvider = new PhoneAuthProvider(auth)

    // Doğrulama kodu gönder
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      {
        multiFactorHint: phoneInfoOptions,
        session: resolver.session,
      },
      recaptchaVerifier
    )

    return verificationId
  } catch (error: any) {
    console.error('2FA doğrulama başlatma hatası:', error)
    throw new Error(error.message || '2FA doğrulama başlatılamadı')
  }
}

/**
 * 2FA doğrulamayı tamamla (giriş sırasında)
 */
export async function completePhoneVerification(
  resolver: MultiFactorResolver,
  verificationId: string,
  verificationCode: string
): Promise<any> {
  try {
    // Phone credential oluştur
    const phoneAuthCredential = PhoneAuthProvider.credential(
      verificationId,
      verificationCode
    )

    // Multi-factor assertion oluştur
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneAuthCredential)

    // Doğrulamayı tamamla ve giriş yap
    const userCredential = await resolver.resolveSignIn(multiFactorAssertion)
    return userCredential
  } catch (error: any) {
    console.error('2FA doğrulama tamamlama hatası:', error)
    throw new Error(error.message || '2FA doğrulama başarısız')
  }
}

/**
 * Kullanıcının 2FA'sı aktif mi kontrol et
 */
export function is2FAEnabled(user: User): boolean {
  return multiFactor(user).enrolledFactors.length > 0
}

/**
 * 2FA hata mesajlarını Türkçeleştir
 */
export function get2FAErrorMessage(error: any): string {
  const errorCode = error.code || error.message

  const errorMessages: Record<string, string> = {
    'auth/invalid-verification-code': 'Geçersiz doğrulama kodu',
    'auth/code-expired': 'Doğrulama kodu süresi doldu',
    'auth/too-many-requests': 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin',
    'auth/phone-number-already-exists': 'Bu telefon numarası zaten kullanımda',
    'auth/invalid-phone-number': 'Geçersiz telefon numarası',
    'auth/missing-phone-number': 'Telefon numarası gerekli',
    'auth/quota-exceeded': 'SMS kotası aşıldı',
    'auth/captcha-check-failed': 'Captcha doğrulaması başarısız',
    'auth/maximum-second-factor-count-exceeded': 'Maksimum 2FA faktör sayısına ulaşıldı',
    'auth/second-factor-already-in-use': 'Bu 2FA faktörü zaten kullanımda',
    'auth/unsupported-first-factor': 'Desteklenmeyen birincil faktör',
    'auth/unverified-email': 'E-posta doğrulanmamış',
  }

  return errorMessages[errorCode] || 'Bir hata oluştu. Lütfen tekrar deneyin.'
}

/**
 * Telefon numarasını formatla
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // +90 ile başlamıyorsa ekle
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = '+90' + phoneNumber.replace(/^0/, '')
  }
  
  // Boşlukları ve tire'leri kaldır
  phoneNumber = phoneNumber.replace(/[\s-]/g, '')
  
  return phoneNumber
}

/**
 * Telefon numarasını maskele (güvenlik için)
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return ''
  
  // Son 4 haneyi göster
  const lastFour = phoneNumber.slice(-4)
  const masked = phoneNumber.slice(0, -4).replace(/\d/g, '*')
  
  return masked + lastFour
}
