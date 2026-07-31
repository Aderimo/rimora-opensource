/**
 * SEO Komponentleri
 * 
 * JSON-LD structured data komponentleri
 * schema.org markup'ları için kullanılır
 * 
 * @example
 * // Film sayfasında kullanım
 * import { MovieJsonLd, BreadcrumbJsonLd } from '@/components/seo'
 * 
 * <MovieJsonLd
 *   id={movie.id}
 *   title={movie.title}
 *   overview={movie.overview}
 *   posterPath={movie.posterPath}
 *   releaseDate={movie.releaseDate}
 *   voteAverage={movie.voteAverage}
 *   genres={movie.genres}
 *   cast={movie.cast}
 *   crew={movie.crew}
 * />
 */

export {
  MovieJsonLd,
  TVSeriesJsonLd,
  AnimeJsonLd,
  WebsiteJsonLd,
  BreadcrumbJsonLd,
  OrganizationJsonLd,
  VideoObjectJsonLd,
} from './json-ld'
