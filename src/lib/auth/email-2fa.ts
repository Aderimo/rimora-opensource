/**
 * Email-based 2FA
 * E-posta ile doğrulama kodu gönderme
 */

import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { sendEmail } from '@/lib/email/resend'
import * as crypto from 'crypto'

export interface EmailVerificationCode {
  userId: string
  code: string
  email: string
  createdAt: Date
  expiresAt: Date
  attempts: number
  verified: boolean
}

export interface RecoveryEmail {
  userId: string
  email: string
  verified: boolean
  createdAt: Date
  verifiedAt?: Date
}

/**
 * 6 haneli doğrulama kodu oluştur
 */
function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * E-posta doğrulama kodu gönder
 */
export async function sendEmailVerificationCode(
  userId: string,
  email: string,
  purpose: 'login' | 'recovery' | 'setup' = 'login'
): Promise<void> {
  try {
    // Kod oluştur
    const code = generateVerificationCode()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000) // 10 dakika

    // Firestore'a kaydet
    const verificationData: EmailVerificationCode = {
      userId,
      code,
      email,
      createdAt: now,
      expiresAt,
      attempts: 0,
      verified: false,
    }

    await setDoc(
      doc(db, 'users', userId, 'security', 'emailVerification'),
      verificationData
    )

    // E-posta gönder
    const purposeText = {
      login: 'giriş yapmak',
      recovery: 'hesabınızı kurtarmak',
      setup: 'e-posta 2FA kurmak',
    }[purpose]

    await sendEmail({
      to: email,
      subject: 'Rimora - Doğrulama Kodu',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Rimora Doğrulama Kodu</h2>
          <p>Merhaba,</p>
          <p>${purposeText} için doğrulama kodunuz:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            Bu kod 10 dakika içinde geçerliliğini yitirecektir.
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            Bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.
          </p>
        </div>
      `,
    })
  } catch (error) {
    console.error('E-posta doğrulama kodu gönderme hatası:', error)
    throw new Error('Doğrulama kodu gönderilemedi')
  }
}

/**
 * E-posta doğrulama kodunu kontrol et
 */
export async function verifyEmailCode(
  userId: string,
  code: string
): Promise<boolean> {
  try {
    const docRef = doc(db, 'users', userId, 'security', 'emailVerification')
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      throw new Error('Doğrulama kodu bulunamadı')
    }

    const data = docSnap.data() as EmailVerificationCode

    // Süre kontrolü
    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(docRef)
      throw new Error('Doğrulama kodu süresi doldu')
    }

    // Deneme sayısı kontrolü
    if (data.attempts >= 5) {
      await deleteDoc(docRef)
      throw new Error('Çok fazla hatalı deneme')
    }

    // Kod kontrolü
    if (data.code !== code) {
      // Deneme sayısını artır
      await setDoc(
        docRef,
        { attempts: data.attempts + 1 },
        { merge: true }
      )
      throw new Error('Geçersiz doğrulama kodu')
    }

    // Başarılı doğrulama
    await setDoc(
      docRef,
      { verified: true },
      { merge: true }
    )

    return true
  } catch (error: any) {
    console.error('E-posta kodu doğrulama hatası:', error)
    throw error
  }
}

/**
 * Recovery email kaydet
 */
export async function saveRecoveryEmail(
  userId: string,
  email: string
): Promise<void> {
  try {
    const recoveryData: RecoveryEmail = {
      userId,
      email,
      verified: false,
      createdAt: new Date(),
    }

    await setDoc(
      doc(db, 'users', userId, 'security', 'recoveryEmail'),
      recoveryData
    )

    // Doğrulama kodu gönder
    await sendEmailVerificationCode(userId, email, 'setup')
  } catch (error) {
    console.error('Recovery email kaydetme hatası:', error)
    throw new Error('Recovery email kaydedilemedi')
  }
}

/**
 * Recovery email doğrula
 */
export async function verifyRecoveryEmail(
  userId: string,
  code: string
): Promise<void> {
  try {
    // Kodu doğrula
    const isValid = await verifyEmailCode(userId, code)

    if (!isValid) {
      throw new Error('Geçersiz doğrulama kodu')
    }

    // Recovery email'i doğrulanmış olarak işaretle
    await setDoc(
      doc(db, 'users', userId, 'security', 'recoveryEmail'),
      {
        verified: true,
        verifiedAt: new Date(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Recovery email doğrulama hatası:', error)
    throw error
  }
}

/**
 * Recovery email getir
 */
export async function getRecoveryEmail(
  userId: string
): Promise<RecoveryEmail | null> {
  try {
    const docRef = doc(db, 'users', userId, 'security', 'recoveryEmail')
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    return docSnap.data() as RecoveryEmail
  } catch (error) {
    console.error('Recovery email getirme hatası:', error)
    return null
  }
}

/**
 * Recovery email sil
 */
export async function deleteRecoveryEmail(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'security', 'recoveryEmail'))
  } catch (error) {
    console.error('Recovery email silme hatası:', error)
    throw new Error('Recovery email silinemedi')
  }
}

/**
 * E-posta 2FA durumunu kontrol et
 */
export async function isEmail2FAEnabled(userId: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'users', userId, 'security', 'email2FA')
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return false
    }

    return docSnap.data()?.enabled === true
  } catch (error) {
    console.error('E-posta 2FA durum kontrolü hatası:', error)
    return false
  }
}

/**
 * E-posta 2FA'yı aktif et
 */
export async function enableEmail2FA(
  userId: string,
  email: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'users', userId, 'security', 'email2FA'), {
      enabled: true,
      email,
      enabledAt: new Date(),
    })
  } catch (error) {
    console.error('E-posta 2FA aktif etme hatası:', error)
    throw new Error('E-posta 2FA aktif edilemedi')
  }
}

/**
 * E-posta 2FA'yı devre dışı bırak
 */
export async function disableEmail2FA(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'security', 'email2FA'))
  } catch (error) {
    console.error('E-posta 2FA devre dışı bırakma hatası:', error)
    throw new Error('E-posta 2FA devre dışı bırakılamadı')
  }
}

/**
 * Hata mesajlarını Türkçeleştir
 */
export function getEmail2FAErrorMessage(error: any): string {
  const errorMessages: Record<string, string> = {
    'invalid-code': 'Geçersiz doğrulama kodu',
    'expired-code': 'Doğrulama kodu süresi doldu',
    'too-many-attempts': 'Çok fazla hatalı deneme',
    'code-not-found': 'Doğrulama kodu bulunamadı',
    'email-send-failed': 'E-posta gönderilemedi',
  }

  return errorMessages[error.code || error.message] || error.message || 'Bir hata oluştu'
}
