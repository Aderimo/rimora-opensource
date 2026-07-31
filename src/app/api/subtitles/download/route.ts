/**
 * Altyazı İndirme ve İşleme Endpoint
 * 
 * OpenSubtitles'dan altyazı indirir, güvenlik kontrolü yapar ve format dönüştürür
 * - Güvenlik validasyonu
 * - Format dönüştürme (SRT, VTT, ASS)
 * - Zararlı içerik temizleme
 * 
 * Requirements: 6.2 (Altyazı güvenlik ve işleme)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOpenSubtitlesClient } from '@/lib/api/opensubtitles'
import {
  processSubtitleFile,
  type SubtitleFormat
} from '@/lib/api/subtitle-processor'

// ============================================================================
// Request Types
// ============================================================================

interface DownloadRequestBody {
  fileId: number
  targetFormat?: SubtitleFormat
}

// ============================================================================
// POST Handler - Altyazı İndir ve İşle
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Request body'yi parse et
    const body: DownloadRequestBody = await request.json()

    // Validasyon
    if (!body.fileId || typeof body.fileId !== 'number') {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'fileId gerekli ve sayı olmalı'
        },
        { status: 400 }
      )
    }

    // Target format validasyonu
    if (body.targetFormat && !['srt', 'vtt', 'ass'].includes(body.targetFormat)) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Geçersiz format. Desteklenen formatlar: srt, vtt, ass'
        },
        { status: 400 }
      )
    }

    // OpenSubtitles client'ı al
    const client = getOpenSubtitlesClient()

    // API yapılandırılmış mı kontrol et
    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: 'OpenSubtitles API yapılandırılmamış'
        },
        { status: 503 }
      )
    }

    // İndirme URL'ini al
    const downloadUrl = await client.getDownloadUrl(body.fileId)

    // Altyazı dosyasını indir
    const subtitleResponse = await fetch(downloadUrl)
    
    if (!subtitleResponse.ok) {
      return NextResponse.json(
        {
          error: 'Download Error',
          message: 'Altyazı dosyası indirilemedi'
        },
        { status: 502 }
      )
    }

    // İçeriği al
    const subtitleContent = await subtitleResponse.text()

    // Dosya adını al (Content-Disposition header'dan)
    const contentDisposition = subtitleResponse.headers.get('content-disposition')
    let filename = 'subtitle.srt'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
      }
    }

    // Güvenlik kontrolü ve format dönüştürme
    const processResult = processSubtitleFile(
      subtitleContent,
      filename,
      body.targetFormat
    )

    if (!processResult.success) {
      return NextResponse.json(
        {
          error: 'Processing Error',
          message: processResult.error || 'Altyazı işlenemedi',
          details: {
            filename,
            requestedFormat: body.targetFormat
          }
        },
        { status: 422 }
      )
    }

    // Başarılı yanıt
    return NextResponse.json(
      {
        success: true,
        content: processResult.content,
        format: processResult.format,
        filename: filename.replace(/\.[^.]+$/, `.${processResult.format}`),
        size: new Blob([processResult.content]).size,
        processed: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Sanitized': 'true'
        }
      }
    )

  } catch (error) {
    console.error('Subtitle Download Error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET Handler - URL ile İndirme
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const fileIdStr = searchParams.get('fileId')
    const targetFormat = searchParams.get('format') as SubtitleFormat | null

    // Validasyon
    if (!fileIdStr) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'fileId parametresi gerekli'
        },
        { status: 400 }
      )
    }

    const fileId = parseInt(fileIdStr, 10)
    if (isNaN(fileId)) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'fileId geçerli bir sayı olmalı'
        },
        { status: 400 }
      )
    }

    // Target format validasyonu
    if (targetFormat && !['srt', 'vtt', 'ass'].includes(targetFormat)) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Geçersiz format. Desteklenen formatlar: srt, vtt, ass'
        },
        { status: 400 }
      )
    }

    // OpenSubtitles client'ı al
    const client = getOpenSubtitlesClient()

    // API yapılandırılmış mı kontrol et
    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: 'OpenSubtitles API yapılandırılmamış'
        },
        { status: 503 }
      )
    }

    // İndirme URL'ini al
    const downloadUrl = await client.getDownloadUrl(fileId)

    // Altyazı dosyasını indir
    const subtitleResponse = await fetch(downloadUrl)
    
    if (!subtitleResponse.ok) {
      return NextResponse.json(
        {
          error: 'Download Error',
          message: 'Altyazı dosyası indirilemedi'
        },
        { status: 502 }
      )
    }

    // İçeriği al
    const subtitleContent = await subtitleResponse.text()

    // Dosya adını al
    const contentDisposition = subtitleResponse.headers.get('content-disposition')
    let filename = 'subtitle.srt'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
      }
    }

    // Güvenlik kontrolü ve format dönüştürme
    const processResult = processSubtitleFile(
      subtitleContent,
      filename,
      targetFormat || undefined
    )

    if (!processResult.success) {
      return NextResponse.json(
        {
          error: 'Processing Error',
          message: processResult.error || 'Altyazı işlenemedi'
        },
        { status: 422 }
      )
    }

    // Dosya olarak döndür
    const finalFilename = filename.replace(/\.[^.]+$/, `.${processResult.format}`)
    
    return new NextResponse(processResult.content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'X-Content-Sanitized': 'true'
      }
    })

  } catch (error) {
    console.error('Subtitle Download Error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}
