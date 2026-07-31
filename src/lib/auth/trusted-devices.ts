/**
 * Trusted Devices Management
 * Güvenilir cihaz yönetimi
 */

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DeviceInfo } from './session-management'

export interface TrustedDevice {
  id: string
  userId: string
  deviceInfo: DeviceInfo
  deviceFingerprint: string
  trustedAt: Date
  lastUsedAt: Date
  expiresAt: Date
  nickname?: string
}

/**
 * Cihaz fingerprint oluştur
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
    navigator.deviceMemory,
  ]

  const fingerprint = components.join('|')
  
  // Hash oluştur
  const encoder = new TextEncoder()
  const data = encoder.encode(fingerprint)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * Cihazı güvenilir olarak işaretle
 */
export async function trustDevice(
  userId: string,
  deviceInfo: DeviceInfo,
  nickname?: string,
  expiryDays: number = 90
): Promise<string> {
  try {
    const fingerprint = await generateDeviceFingerprint()
    const deviceId = `device_${fingerprint.substring(0, 16)}`

    const trustedDevice: TrustedDevice = {
      id: deviceId,
      userId,
      deviceInfo,
      deviceFingerprint: fingerprint,
      trustedAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
      nickname,
    }

    await setDoc(doc(db, 'trustedDevices', deviceId), trustedDevice)

    return deviceId
  } catch (error) {
    console.error('Cihaz güvenilir işaretleme hatası:', error)
    throw new Error('Cihaz güvenilir işaretlenemedi')
  }
}

/**
 * Cihazın güvenilir olup olmadığını kontrol et
 */
export async function isDeviceTrusted(userId: string): Promise<boolean> {
  try {
    const fingerprint = await generateDeviceFingerprint()
    const devicesRef = collection(db, 'trustedDevices')
    const q = query(
      devicesRef,
      where('userId', '==', userId),
      where('deviceFingerprint', '==', fingerprint)
    )

    const snapshot = await getDocs(q)

    if (snapshot.empty) return false

    // Cihazın süresinin dolmadığını kontrol et
    const device = snapshot.docs[0].data() as TrustedDevice
    const isValid = new Date() < device.expiresAt

    if (isValid) {
      // Son kullanım tarihini güncelle
      await updateDeviceLastUsed(device.id)
    }

    return isValid
  } catch (error) {
    console.error('Cihaz güvenilirlik kontrolü hatası:', error)
    return false
  }
}

/**
 * Güvenilir cihazları getir
 */
export async function getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
  try {
    const devicesRef = collection(db, 'trustedDevices')
    const q = query(devicesRef, where('userId', '==', userId))

    const snapshot = await getDocs(q)
    return snapshot.docs
      .map((doc) => doc.data() as TrustedDevice)
      .filter((device) => new Date() < device.expiresAt)
  } catch (error) {
    console.error('Güvenilir cihazları getirme hatası:', error)
    return []
  }
}

/**
 * Cihazı güvenilir listesinden kaldır
 */
export async function removeTrustedDevice(deviceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'trustedDevices', deviceId))
  } catch (error) {
    console.error('Güvenilir cihaz kaldırma hatası:', error)
    throw new Error('Cihaz kaldırılamadı')
  }
}

/**
 * Tüm güvenilir cihazları kaldır
 */
export async function removeAllTrustedDevices(userId: string): Promise<void> {
  try {
    const devices = await getTrustedDevices(userId)
    const promises = devices.map((device) => removeTrustedDevice(device.id))
    await Promise.all(promises)
  } catch (error) {
    console.error('Tüm güvenilir cihazları kaldırma hatası:', error)
    throw new Error('Cihazlar kaldırılamadı')
  }
}

/**
 * Cihazın son kullanım tarihini güncelle
 */
async function updateDeviceLastUsed(deviceId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'trustedDevices', deviceId),
      {
        lastUsedAt: new Date(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Cihaz son kullanım güncelleme hatası:', error)
  }
}

/**
 * Cihaz nickname güncelle
 */
export async function updateDeviceNickname(
  deviceId: string,
  nickname: string
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'trustedDevices', deviceId),
      {
        nickname,
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Cihaz nickname güncelleme hatası:', error)
    throw new Error('Nickname güncellenemedi')
  }
}

/**
 * Süresi dolmuş cihazları temizle
 */
export async function cleanupExpiredDevices(userId: string): Promise<void> {
  try {
    const devicesRef = collection(db, 'trustedDevices')
    const q = query(devicesRef, where('userId', '==', userId))

    const snapshot = await getDocs(q)
    const now = new Date()

    const promises = snapshot.docs
      .filter((doc) => {
        const device = doc.data() as TrustedDevice
        return now >= device.expiresAt
      })
      .map((doc) => deleteDoc(doc.ref))

    await Promise.all(promises)
  } catch (error) {
    console.error('Süresi dolmuş cihazları temizleme hatası:', error)
  }
}
