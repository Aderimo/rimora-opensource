import { NextRequest, NextResponse } from 'next/server'
import { ref, get, remove } from 'firebase/database'
import { rtdb } from '@/lib/firebase'

// 24 saat (milisaniye cinsinden)
const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000

/**
 * Watch Party Cleanup API Endpoint
 * 24 saatten eski odaları temizler
 * Vercel Cron veya manuel olarak çağrılabilir
 * 
 * Requirements: 12.1 - Cloud Function ile eski odaları temizleme (24 saatten eski)
 */
export async function POST(request: NextRequest) {
  try {
    // Cron secret doğrulama (opsiyonel güvenlik)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim' },
        { status: 401 }
      )
    }

    const now = Date.now()
    const expiryThreshold = now - ROOM_EXPIRY_MS

    // Tüm watch party odalarını al
    const roomsRef = ref(rtdb, 'watchParties')
    const snapshot = await get(roomsRef)

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        message: 'Temizlenecek oda bulunamadı',
        deletedCount: 0
      })
    }

    const rooms = snapshot.val()
    const roomsToDelete: string[] = []

    // 24 saatten eski odaları bul
    for (const [roomId, room] of Object.entries(rooms)) {
      const roomData = room as { createdAt?: number; lastActivity?: number }
      
      // lastActivity varsa onu kullan, yoksa createdAt'i kullan
      const lastActivityTime = roomData.lastActivity || roomData.createdAt || 0
      
      if (lastActivityTime < expiryThreshold) {
        roomsToDelete.push(roomId)
      }
    }

    // Eski odaları ve mesajlarını sil
    const deletePromises: Promise<void>[] = []
    
    for (const roomId of roomsToDelete) {
      // Oda verisini sil
      deletePromises.push(remove(ref(rtdb, `watchParties/${roomId}`)))
      // Oda mesajlarını sil
      deletePromises.push(remove(ref(rtdb, `watchPartyMessages/${roomId}`)))
    }

    await Promise.all(deletePromises)

    return NextResponse.json({
      success: true,
      message: `${roomsToDelete.length} eski oda temizlendi`,
      deletedCount: roomsToDelete.length,
      deletedRoomIds: roomsToDelete
    })

  } catch (error) {
    console.error('Watch party cleanup hatası:', error)
    return NextResponse.json(
      { 
        error: 'Temizleme işlemi başarısız',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}

// GET endpoint - durum kontrolü için
export async function GET() {
  return NextResponse.json({
    status: 'active',
    description: 'Watch Party Cleanup API',
    usage: 'POST isteği ile 24 saatten eski odaları temizler'
  })
}
