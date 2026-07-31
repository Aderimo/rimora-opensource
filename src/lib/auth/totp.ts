/**
 * TOTP (Time-based One-Time Password) Authentication
 * Google Authenticator, Authy, Microsoft Authenticator desteği
 */

import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import * as crypto from 'crypto'

export interface TOTPSecret {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface TOTPConfig {
  userId: string
  secret: string
  enabled: boolean
  createdAt: Date
  lastUsedAt?: Date
}

/**
 * TOTP secret oluştur
 */
export function generateTOTPSecret(): string {
  // 32 karakter base32 secret
  const buffer = crypto.randomBytes(20)
  return base32Encode(buffer)
}

/**
 * TOTP QR kod URL'i oluştur
 */
export function generateQRCodeURL(
  secret: string,
  email: string,
  issuer: string = 'Rimora'
): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)
  
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}`
}

/**
 * TOTP token doğrula
 */
export function verifyTOTPToken(secret: string, token: string): boolean {
  const window = 1 // ±30 saniye tolerans
  const currentTime = Math.floor(Date.now() / 1000 / 30)

  // Mevcut zaman ve ±1 pencere için kontrol et
  for (let i = -window; i <= window; i++) {
    const timeStep = currentTime + i
    const expectedToken = generateTOTPToken(secret, timeStep)
    
    if (expectedToken === token) {
      return true
    }
  }

  return false
}

/**
 * TOTP token oluştur
 */
function generateTOTPToken(secret: string, timeStep: number): string {
  const key = base32Decode(secret)
  const time = Buffer.alloc(8)
  time.writeBigInt64BE(BigInt(timeStep))

  const hmac = crypto.createHmac('sha1', key)
  hmac.update(time)
  const hash = hmac.digest()

  const offset = hash[hash.length - 1] & 0xf
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  const otp = binary % 1000000
  return otp.toString().padStart(6, '0')
}

/**
 * TOTP'yi kullanıcı için kaydet
 */
export async function saveTOTPConfig(
  userId: string,
  secret: string
): Promise<void> {
  try {
    const config: TOTPConfig = {
      userId,
      secret,
      enabled: true,
      createdAt: new Date(),
    }

    await setDoc(doc(db, 'users', userId, 'security', 'totp'), config)
  } catch (error) {
    console.error('TOTP kaydetme hatası:', error)
    throw new Error('TOTP kaydedilemedi')
  }
}

/**
 * TOTP config'i getir
 */
export async function getTOTPConfig(userId: string): Promise<TOTPConfig | null> {
  try {
    const docRef = doc(db, 'users', userId, 'security', 'totp')
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    return docSnap.data() as TOTPConfig
  } catch (error) {
    console.error('TOTP getirme hatası:', error)
    return null
  }
}

/**
 * TOTP'yi devre dışı bırak
 */
export async function disableTOTP(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'security', 'totp'))
  } catch (error) {
    console.error('TOTP devre dışı bırakma hatası:', error)
    throw new Error('TOTP devre dışı bırakılamadı')
  }
}

/**
 * TOTP son kullanım tarihini güncelle
 */
export async function updateTOTPLastUsed(userId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId, 'security', 'totp'),
      {
        lastUsedAt: new Date(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('TOTP son kullanım güncelleme hatası:', error)
  }
}

/**
 * Base32 encode
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Base32 decode
 */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let index = 0
  const output = Buffer.alloc(Math.ceil((input.length * 5) / 8))

  for (let i = 0; i < input.length; i++) {
    const char = input[i].toUpperCase()
    const charValue = alphabet.indexOf(char)

    if (charValue === -1) continue

    value = (value << 5) | charValue
    bits += 5

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255
      bits -= 8
    }
  }

  return output.slice(0, index)
}

/**
 * QR kod için data URL oluştur (client-side)
 */
export async function generateQRCodeDataURL(text: string): Promise<string> {
  // Bu fonksiyon client-side'da kullanılmalı
  if (typeof window === 'undefined') {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  }
  
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
  } catch (error) {
    console.error('QR kod oluşturma hatası:', error)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  }
}

/**
 * TOTP kurulum bilgilerini oluştur
 */
export async function setupTOTP(
  userId: string,
  email: string
): Promise<TOTPSecret> {
  const secret = generateTOTPSecret()
  const qrCodeUrl = generateQRCodeURL(secret, email)
  
  // Yedek kodlar oluştur
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  )

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  }
}

/**
 * TOTP hata mesajlarını Türkçeleştir
 */
export function getTOTPErrorMessage(error: any): string {
  const errorMessages: Record<string, string> = {
    'invalid-token': 'Geçersiz doğrulama kodu',
    'expired-token': 'Doğrulama kodu süresi doldu',
    'already-enabled': 'TOTP zaten aktif',
    'not-enabled': 'TOTP aktif değil',
    'setup-required': 'TOTP kurulumu gerekli',
  }

  return errorMessages[error.code || error.message] || 'Bir hata oluştu'
}
