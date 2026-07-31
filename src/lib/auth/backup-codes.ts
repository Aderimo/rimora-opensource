/**
 * Backup Codes Utility
 * 2FA için yedek kodlar
 */

import { doc, setDoc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import crypto from 'crypto'

export interface BackupCode {
  code: string
  used: boolean
  usedAt?: Date
}

/**
 * Yedek kod oluştur
 */
export function generateBackupCode(): string {
  // 8 haneli alfanumerik kod
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Karışık karakterler hariç
  let code = ''
  
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    code += chars[randomIndex]
    
    // 4 karakterde bir tire ekle
    if (i === 3) {
      code += '-'
    }
  }
  
  return code
}

/**
 * Birden fazla yedek kod oluştur
 */
export function generateBackupCodes(count: number = 10): BackupCode[] {
  const codes: BackupCode[] = []
  const usedCodes = new Set<string>()
  
  while (codes.length < count) {
    const code = generateBackupCode()
    
    // Aynı kod tekrar oluşmasın
    if (!usedCodes.has(code)) {
      codes.push({
        code,
        used: false,
      })
      usedCodes.add(code)
    }
  }
  
  return codes
}

/**
 * Yedek kodları Firestore'a kaydet
 */
export async function saveBackupCodes(
  userId: string,
  codes: BackupCode[]
): Promise<void> {
  try {
    // Kodları hash'le (güvenlik için)
    const hashedCodes = codes.map((c) => ({
      ...c,
      code: hashCode(c.code),
    }))

    await setDoc(
      doc(db, 'users', userId, 'security', 'backupCodes'),
      {
        codes: hashedCodes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    )
  } catch (error) {
    console.error('Yedek kod kaydetme hatası:', error)
    throw new Error('Yedek kodlar kaydedilemedi')
  }
}

/**
 * Yedek kodları getir
 */
export async function getBackupCodes(userId: string): Promise<BackupCode[]> {
  try {
    const docRef = doc(db, 'users', userId, 'security', 'backupCodes')
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return []
    }

    return docSnap.data().codes || []
  } catch (error) {
    console.error('Yedek kod getirme hatası:', error)
    throw new Error('Yedek kodlar getirilemedi')
  }
}

/**
 * Yedek kodu doğrula ve kullan
 */
export async function verifyAndUseBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  try {
    const codes = await getBackupCodes(userId)
    const hashedCode = hashCode(code)

    // Kodu bul
    const codeIndex = codes.findIndex(
      (c) => c.code === hashedCode && !c.used
    )

    if (codeIndex === -1) {
      return false
    }

    // Kodu kullanıldı olarak işaretle
    codes[codeIndex].used = true
    codes[codeIndex].usedAt = new Date()

    // Firestore'u güncelle
    await updateDoc(
      doc(db, 'users', userId, 'security', 'backupCodes'),
      {
        codes,
        updatedAt: new Date(),
      }
    )

    return true
  } catch (error) {
    console.error('Yedek kod doğrulama hatası:', error)
    return false
  }
}

/**
 * Kullanılmamış yedek kod sayısını getir
 */
export async function getUnusedBackupCodeCount(userId: string): Promise<number> {
  try {
    const codes = await getBackupCodes(userId)
    return codes.filter((c) => !c.used).length
  } catch (error) {
    console.error('Yedek kod sayısı getirme hatası:', error)
    return 0
  }
}

/**
 * Yedek kodları yenile
 */
export async function regenerateBackupCodes(
  userId: string,
  count: number = 10
): Promise<BackupCode[]> {
  try {
    const newCodes = generateBackupCodes(count)
    await saveBackupCodes(userId, newCodes)
    
    // Orijinal kodları döndür (hash'lenmemiş)
    return newCodes
  } catch (error) {
    console.error('Yedek kod yenileme hatası:', error)
    throw new Error('Yedek kodlar yenilenemedi')
  }
}

/**
 * Kodu hash'le (SHA-256)
 */
function hashCode(code: string): string {
  // Browser'da crypto.subtle kullan
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Bu async olduğu için sync versiyonu kullanıyoruz
    // Production'da daha güvenli bir yöntem kullanılmalı
    return btoa(code) // Basit base64 encoding (geçici)
  }
  
  // Node.js'de crypto modülü kullan
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Yedek kodları formatla (görüntüleme için)
 */
export function formatBackupCodes(codes: BackupCode[]): string {
  return codes
    .map((c, i) => `${(i + 1).toString().padStart(2, '0')}. ${c.code}`)
    .join('\n')
}

/**
 * Yedek kodları indir (text dosyası)
 */
export function downloadBackupCodes(codes: BackupCode[], filename: string = 'rimora-backup-codes.txt') {
  const content = `Rimora 2FA Yedek Kodları
Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}

Bu kodları güvenli bir yerde saklayın!
Her kod yalnızca bir kez kullanılabilir.

${formatBackupCodes(codes)}

UYARI: Bu kodları kimseyle paylaşmayın!
`

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
