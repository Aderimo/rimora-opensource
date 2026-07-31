/**
 * AniList GraphQL API
 * Anime için gerçek veri kaynağı
 * TMDB yerine AniList kullanarak daha doğru anime verisi
 */

const ANILIST_URL = 'https://graphql.anilist.co'

interface AniListMedia {
  id: number
  title: {
    romaji: string
    english: string | null
    native: string
  }
  description: string | null
  coverImage: {
    large: string
    medium: string
  }
  bannerImage: string | null
  averageScore: number | null
  popularity: number
  episodes: number | null
  status: string
  season: string | null
  seasonYear: number | null
  genres: string[]
  studios: {
    nodes: Array<{ name: string }>
  }
  startDate: {
    year: number | null
    month: number | null
    day: number | null
  }
}

interface AniListResponse {
  data: {
    Page: {
      pageInfo: {
        total: number
        currentPage: number
        lastPage: number
        hasNextPage: boolean
        perPage: number
      }
      media: AniListMedia[]
    }
  }
}

// AniList medyasını Rimora formatına dönüştür
function transformAniListMedia(media: AniListMedia) {
  return {
    id: media.id,
    title: media.title.english || media.title.romaji,
    originalTitle: media.title.native,
    overview: media.description?.replace(/<[^>]*>/g, '') || '', // HTML temizle
    posterPath: media.coverImage.large,
    backdropPath: media.bannerImage,
    voteAverage: media.averageScore ? media.averageScore / 10 : 0,
    popularity: media.popularity,
    releaseDate: media.seasonYear?.toString() || '',
    type: 'anime' as const,
    genres: media.genres,
    episodeCount: media.episodes,
    status: media.status,
    season: media.season,
    studios: media.studios.nodes.map(s => s.name),
  }
}

/**
 * Anime ara
 */
export async function searchAnime(query: string, page = 1, perPage = 20) {
  const graphqlQuery = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english native }
          description
          coverImage { large medium }
          bannerImage
          averageScore
          popularity
          episodes
          status
          season
          seasonYear
          genres
          studios { nodes { name } }
          startDate { year month day }
        }
      }
    }
  `

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { search: query, page, perPage },
      }),
    })

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`)
    }

    const data: AniListResponse = await response.json()
    const pageInfo = data.data.Page.pageInfo

    return {
      results: data.data.Page.media.map(transformAniListMedia),
      totalResults: pageInfo.total,
      totalPages: pageInfo.lastPage,
      page: pageInfo.currentPage,
    }
  } catch (error) {
    console.error('AniList search error:', error)
    throw error
  }
}

/**
 * Popüler animeleri getir
 */
export async function getPopularAnime(page = 1, perPage = 20) {
  const graphqlQuery = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(type: ANIME, sort: POPULARITY_DESC, status_in: [RELEASING, FINISHED]) {
          id
          title { romaji english native }
          description
          coverImage { large medium }
          bannerImage
          averageScore
          popularity
          episodes
          status
          season
          seasonYear
          genres
          studios { nodes { name } }
          startDate { year month day }
        }
      }
    }
  `

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { page, perPage },
      }),
    })

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`)
    }

    const data: AniListResponse = await response.json()
    const pageInfo = data.data.Page.pageInfo

    return {
      results: data.data.Page.media.map(transformAniListMedia),
      totalResults: pageInfo.total,
      totalPages: pageInfo.lastPage,
      page: pageInfo.currentPage,
    }
  } catch (error) {
    console.error('AniList popular error:', error)
    throw error
  }
}

/**
 * Sezona göre anime getir
 */
export async function getSeasonalAnime(
  year: number,
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL',
  page = 1,
  perPage = 20
) {
  const graphqlQuery = `
    query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
        }
        media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
          id
          title { romaji english native }
          description
          coverImage { large medium }
          bannerImage
          averageScore
          popularity
          episodes
          status
          season
          seasonYear
          genres
          studios { nodes { name } }
          startDate { year month day }
        }
      }
    }
  `

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { page, perPage, season, seasonYear: year },
      }),
    })

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`)
    }

    const data: AniListResponse = await response.json()
    const pageInfo = data.data.Page.pageInfo

    return {
      results: data.data.Page.media.map(transformAniListMedia),
      totalResults: pageInfo.total,
      totalPages: pageInfo.lastPage,
      page: pageInfo.currentPage,
    }
  } catch (error) {
    console.error('AniList seasonal error:', error)
    throw error
  }
}

/**
 * Anime detayı getir
 */
export async function getAnimeDetails(id: number) {
  const graphqlQuery = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        description
        coverImage { large extraLarge }
        bannerImage
        averageScore
        popularity
        episodes
        duration
        status
        season
        seasonYear
        genres
        tags { name rank }
        studios { nodes { name } }
        startDate { year month day }
        endDate { year month day }
        trailer { id site }
        recommendations {
          nodes {
            mediaRecommendation {
              id
              title { romaji english }
              coverImage { large }
              averageScore
            }
          }
        }
        relations {
          edges {
            relationType
            node {
              id
              title { romaji english }
              coverImage { large }
              type
            }
          }
        }
      }
    }
  `

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { id },
      }),
    })

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`)
    }

    const data = await response.json()
    const media = data.data.Media
    
    // Detaylı format
    return {
      id: media.id,
      title: media.title.english || media.title.romaji,
      originalTitle: media.title.native,
      overview: media.description?.replace(/<[^>]*>/g, '') || '',
      posterPath: media.coverImage.extraLarge || media.coverImage.large,
      backdropPath: media.bannerImage,
      voteAverage: media.averageScore ? media.averageScore / 10 : 0,
      voteCount: media.popularity,
      popularity: media.popularity,
      releaseDate: media.seasonYear?.toString() || '',
      firstAirDate: media.startDate.year ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}` : '',
      type: 'anime' as const,
      genres: media.genres.map((g: string) => ({ id: 0, name: g })),
      genreIds: [],
      episodeCount: media.episodes,
      numberOfEpisodes: media.episodes,
      numberOfSeasons: 1,
      status: media.status,
      season: media.season,
      studios: media.studios.nodes.map((s: any) => s.name),
      runtime: media.duration,
      tagline: '',
      homepage: '',
      cast: [],
      crew: [],
      videos: media.trailer ? [{
        id: media.trailer.id,
        key: media.trailer.id,
        site: media.trailer.site,
        type: 'Trailer',
        name: 'Official Trailer'
      }] : [],
      similar: [],
      recommendations: media.recommendations.nodes
        .filter((n: any) => n.mediaRecommendation)
        .map((n: any) => ({
          id: n.mediaRecommendation.id,
          title: n.mediaRecommendation.title.english || n.mediaRecommendation.title.romaji,
          posterPath: n.mediaRecommendation.coverImage.large,
          voteAverage: n.mediaRecommendation.averageScore ? n.mediaRecommendation.averageScore / 10 : 0,
          type: 'anime' as const,
        })),
      seasons: media.episodes ? [{
        id: 1,
        name: 'Season 1',
        seasonNumber: 1,
        episodeCount: media.episodes,
        overview: '',
        posterPath: media.coverImage.large,
        airDate: media.startDate.year ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-01` : '',
        episodes: Array.from({ length: media.episodes || 0 }, (_, i) => ({
          id: i + 1,
          name: `Episode ${i + 1}`,
          episodeNumber: i + 1,
          seasonNumber: 1,
          overview: '',
          stillPath: null,
          airDate: '',
          voteAverage: 0,
          runtime: media.duration || 24,
        }))
      }] : [],
    }
  } catch (error) {
    console.error('AniList details error:', error)
    throw error
  }
}

/**
 * Türe göre anime getir
 */
export async function getAnimeByGenre(genre: string, page = 1, perPage = 20) {
  const graphqlQuery = `
    query ($page: Int, $perPage: Int, $genre: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
        }
        media(type: ANIME, genre: $genre, sort: POPULARITY_DESC) {
          id
          title { romaji english native }
          description
          coverImage { large medium }
          bannerImage
          averageScore
          popularity
          episodes
          status
          season
          seasonYear
          genres
          studios { nodes { name } }
          startDate { year month day }
        }
      }
    }
  `

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { page, perPage, genre },
      }),
    })

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`)
    }

    const data: AniListResponse = await response.json()
    const pageInfo = data.data.Page.pageInfo

    return {
      results: data.data.Page.media.map(transformAniListMedia),
      totalResults: pageInfo.total,
      totalPages: pageInfo.lastPage,
      page: pageInfo.currentPage,
    }
  } catch (error) {
    console.error('AniList genre error:', error)
    throw error
  }
}
