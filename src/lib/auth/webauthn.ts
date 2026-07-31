/**
 * WebAuthn/FIDO2 Authentication
 * Biometric authentication (parmak izi, yüz tanıma, hardware keys)
 */

import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface WebAuthnCredential {
  id: string
  credentialId: string
  publicKey: string
  counter: number
  deviceName: string
  createdAt: Date
  lastUsedAt?: Date
}

/**
 * WebAuthn desteğini kontrol et
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  )
}

/**
 * Platform authenticator desteğini kontrol et (Touch ID, Face ID, Windows Hello)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * WebAuthn kayıt başlat
 */
export async function startWebAuthnRegistration(
  userId: string,
  username: string
): Promise<PublicKeyCredentialCreationOptions> {
  // Challenge oluştur (server'dan alınmalı)
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const options: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Rimora',
      id: window.location.hostname,
    },
    user: {
      id: new TextEncoder().encode(userId),
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Touch ID, Face ID, Windows Hello
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  }

  return options
}

/**
 * WebAuthn credential oluştur
 */
export async function createWebAuthnCredential(
  options: PublicKeyCredentialCreationOptions
): Promise<PublicKeyCredential> {
  try {
    const credential = await navigator.credentials.create({
      publicKey: options,
    })

    if (!credential || !(credential instanceof PublicKeyCredential)) {
      throw new Error('Credential oluşturulamadı')
    }

    return credential
  } catch (error: any) {
    console.error('WebAuthn kayıt hatası:', error)
    throw new Error(getWebAuthnErrorMessage(error))
  }
}

/**
 * WebAuthn credential'ı kaydet
 */
export async function saveWebAuthnCredential(
  userId: string,
  credential: PublicKeyCredential,
  deviceName: string
): Promise<void> {
  try {
    const response = credential.response as AuthenticatorAttestationResponse
    
    const credentialData: WebAuthnCredential = {
      id: credential.id,
      credentialId: arrayBufferToBase64(credential.rawId),
      publicKey: arrayBufferToBase64(response.getPublicKey()!),
      counter: 0,
      deviceName,
      createdAt: new Date(),
    }

    await setDoc(
      doc(db, 'users', userId, 'webauthn', credential.id),
      credentialData
    )
  } catch (error) {
    console.error('WebAuthn kaydetme hatası:', error)
    throw new Error('Credential kaydedilemedi')
  }
}

/**
 * WebAuthn authentication başlat
 */
export async function startWebAuthnAuthentication(
  userId: string
): Promise<PublicKeyCredentialRequestOptions> {
  // Kullanıcının kayıtlı credential'larını al
  const credentials = await getWebAuthnCredentials(userId)

  if (credentials.length === 0) {
    throw new Error('Kayıtlı credential bulunamadı')
  }

  // Challenge oluştur
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const options: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: credentials.map((cred) => ({
      type: 'public-key',
      id: base64ToArrayBuffer(cred.credentialId),
    })),
    userVerification: 'required',
    timeout: 60000,
  }

  return options
}

/**
 * WebAuthn ile authenticate ol
 */
export async function authenticateWithWebAuthn(
  options: PublicKeyCredentialRequestOptions
): Promise<PublicKeyCredential> {
  try {
    const credential = await navigator.credentials.get({
      publicKey: options,
    })

    if (!credential || !(credential instanceof PublicKeyCredential)) {
      throw new Error('Authentication başarısız')
    }

    return credential
  } catch (error: any) {
    console.error('WebAuthn authentication hatası:', error)
    throw new Error(getWebAuthnErrorMessage(error))
  }
}

/**
 * WebAuthn credential'larını getir
 */
export async function getWebAuthnCredentials(
  userId: string
): Promise<WebAuthnCredential[]> {
  try {
    const credentialsRef = collection(db, 'users', userId, 'webauthn')
    const snapshot = await getDocs(credentialsRef)

    return snapshot.docs.map((doc) => doc.data() as WebAuthnCredential)
  } catch (error) {
    console.error('WebAuthn credential getirme hatası:', error)
    return []
  }
}

/**
 * WebAuthn credential'ı sil
 */
export async function deleteWebAuthnCredential(
  userId: string,
  credentialId: string
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId, 'webauthn', credentialId),
      { deleted: true },
      { merge: true }
    )
  } catch (error) {
    console.error('WebAuthn credential silme hatası:', error)
    throw new Error('Credential silinemedi')
  }
}

/**
 * ArrayBuffer'ı Base64'e çevir
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Base64'ü ArrayBuffer'a çevir
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * WebAuthn hata mesajlarını Türkçeleştir
 */
function getWebAuthnErrorMessage(error: any): string {
  const errorName = error.name || error.message

  const errorMessages: Record<string, string> = {
    NotAllowedError: 'İşlem iptal edildi veya zaman aşımına uğradı',
    InvalidStateError: 'Bu cihaz zaten kayıtlı',
    NotSupportedError: 'Bu tarayıcı WebAuthn desteklemiyor',
    SecurityError: 'Güvenlik hatası. HTTPS gerekli',
    AbortError: 'İşlem iptal edildi',
    ConstraintError: 'Geçersiz parametre',
    UnknownError: 'Bilinmeyen hata oluştu',
  }

  return errorMessages[errorName] || 'Bir hata oluştu'
}

/**
 * Cihaz türünü belirle
 */
export function getDeviceType(): string {
  const ua = navigator.userAgent

  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'iOS Cihazı'
  } else if (/Android/.test(ua)) {
    return 'Android Cihazı'
  } else if (/Windows/.test(ua)) {
    return 'Windows PC'
  } else if (/Mac/.test(ua)) {
    return 'Mac'
  } else if (/Linux/.test(ua)) {
    return 'Linux'
  }

  return 'Bilinmeyen Cihaz'
}
