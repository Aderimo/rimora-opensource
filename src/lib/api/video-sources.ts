/**
 * Video Kaynak Saglayicilari
 *
 * Bu dosya bilerek BOS gelir. Proje herhangi bir video kaynagi ile birlikte
 * dagitilmaz; kaynaklari calistiran kisi kendisi tanimlar ve yayin hakkina
 * sahip oldugu icerikleri baglamakla yukumludur.
 *
 * Tanimlamak icin .env dosyasina NEXT_PUBLIC_VIDEO_SOURCES ekleyin.
 * Ornek icin .env.example dosyasina bakin.
 *
 * Desteklenen sablon degiskenleri: {tmdbId} {season} {episode}
 * Tanimli kaynak yoksa oynatici "kaynak yapilandirilmamis" durumunu gosterir.
 */

export interface VideoSource {
  id: string
  name: string
  quality: string
  language: string
  url: string
  type: 'iframe'
  priority: number
  features?: string[]
  audioLanguages?: string[]
}

/** .env icinde tanimlanan ham kaynak sablonu. */
interface VideoSourceTemplate {
  id: string
  name: string
  quality?: string
  language?: string
  priority?: number
  features?: string[]
  audioLanguages?: string[]
  /** Film icin URL sablonu. {tmdbId} desteklenir. */
  movie?: string
  /** Dizi icin URL sablonu. {tmdbId} {season} {episode} desteklenir. */
  tv?: string
  /** Anime icin URL sablonu. Verilmezse tv sablonu kullanilir. */
  anime?: string
}

function readTemplates(): VideoSourceTemplate[] {
  const raw = process.env.NEXT_PUBLIC_VIDEO_SOURCES

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.warn(
      '[video-sources] NEXT_PUBLIC_VIDEO_SOURCES gecerli bir JSON dizisi degil, yok sayildi.'
    )
    return []
  }
}

function fillTemplate(
  template: string,
  tmdbId: number,
  season: number,
  episode: number
): string {
  return template
    .replace(/\{tmdbId\}/g, String(tmdbId))
    .replace(/\{season\}/g, String(season))
    .replace(/\{episode\}/g, String(episode))
}

function build(
  kind: 'movie' | 'tv' | 'anime',
  tmdbId: number,
  season: number,
  episode: number
): VideoSource[] {
  return readTemplates()
    .map((t) => {
      const pattern = kind === 'anime' ? t.anime || t.tv : t[kind]

      if (!pattern) {
        return null
      }

      return {
        id: t.id,
        name: t.name,
        quality: t.quality || 'auto',
        language: t.language || '-',
        url: fillTemplate(pattern, tmdbId, season, episode),
        type: 'iframe' as const,
        priority: t.priority ?? 1,
        features: t.features,
        audioLanguages: t.audioLanguages,
      }
    })
    .filter((s): s is VideoSource => s !== null)
    .sort((a, b) => a.priority - b.priority)
}

export function getMovieSources(tmdbId: number): VideoSource[] {
  return build('movie', tmdbId, 1, 1)
}

export function getTVSources(
  tmdbId: number,
  season: number,
  episode: number
): VideoSource[] {
  return build('tv', tmdbId, season, episode)
}

export function getAnimeSources(tmdbId: number, episode?: number): VideoSource[] {
  if (episode) {
    return build('anime', tmdbId, 1, episode)
  }

  return getMovieSources(tmdbId)
}

export function getAllSources(
  mediaType: 'movie' | 'tv' | 'anime',
  tmdbId: number,
  season?: number,
  episode?: number
): VideoSource[] {
  if (mediaType === 'movie') {
    return getMovieSources(tmdbId)
  }

  if (mediaType === 'anime') {
    return getAnimeSources(tmdbId, episode)
  }

  return getTVSources(tmdbId, season || 1, episode || 1)
}
