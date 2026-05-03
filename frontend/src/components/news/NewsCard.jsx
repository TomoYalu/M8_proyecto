/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Noticias
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import Badge from '../common/Badge';
import { formatFecha } from '../../utils/formatters';

/**
 * Tarjeta de noticia individual con título, fuente, fecha,
 * score de sentimiento y badge de sector.
 *
 * @param {object} props
 * @param {object} props.noticia - Objeto de noticia
 * @param {string} props.noticia.titulo - Título de la noticia
 * @param {string} [props.noticia.fuente] - Fuente (Yahoo, El Financiero, etc.)
 * @param {string|Date} [props.noticia.fecha_publicacion] - Fecha de publicación
 * @param {number} [props.noticia.score_sentimiento] - Score [-1, +1]
 * @param {string} [props.noticia.sector] - Sector/tema del ticker
 * @param {string} [props.noticia.url] - URL del artículo original
 *
 * Requisitos cubiertos: 6.5, 6.6
 */
export default function NewsCard({ noticia }) {
  const { titulo, fuente, fecha_publicacion, score_sentimiento, sector, url } = noticia;

  // Color del score según sentimiento
  const scoreColor =
    score_sentimiento > 0.2
      ? 'text-bloomberg-green'
      : score_sentimiento < -0.2
        ? 'text-bloomberg-red'
        : 'text-bloomberg-yellow';

  const scoreBg =
    score_sentimiento > 0.2
      ? 'bg-bloomberg-green/10'
      : score_sentimiento < -0.2
        ? 'bg-bloomberg-red/10'
        : 'bg-bloomberg-yellow/10';

  const scoreLabel =
    score_sentimiento > 0.2
      ? 'Positivo'
      : score_sentimiento < -0.2
        ? 'Negativo'
        : 'Neutral';

  return (
    <article
      className="rounded-lg border border-white/5 bg-bloomberg-panel/50 p-4
                 hover:border-bloomberg-accent/30 transition-colors"
      aria-label={`Noticia: ${titulo}`}
    >
      {/* Encabezado: título + enlace */}
      <div className="mb-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-bloomberg-text hover:text-bloomberg-accent
                       transition-colors line-clamp-2"
            aria-label={`Leer artículo: ${titulo}`}
          >
            {titulo}
          </a>
        ) : (
          <h3 className="text-sm font-medium text-bloomberg-text line-clamp-2">
            {titulo}
          </h3>
        )}
      </div>

      {/* Metadatos: fuente, fecha, score */}
      <div className="flex items-center flex-wrap gap-2 text-xs text-bloomberg-text-muted">
        {fuente && <span>{fuente}</span>}
        {fuente && fecha_publicacion && <span aria-hidden="true">·</span>}
        {fecha_publicacion && (
          <time dateTime={new Date(fecha_publicacion).toISOString()}>
            {formatFecha(fecha_publicacion)}
          </time>
        )}

        {score_sentimiento != null && (
          <span
            className={`ml-auto px-2 py-0.5 rounded-md font-medium ${scoreColor} ${scoreBg}`}
            aria-label={`Sentimiento: ${scoreLabel} (${score_sentimiento.toFixed(2)})`}
          >
            {score_sentimiento > 0 ? '+' : ''}
            {score_sentimiento.toFixed(2)}
          </span>
        )}
      </div>

      {/* Badge de sector */}
      {sector && (
        <div className="mt-2">
          <Badge texto={sector} variante="azul" ariaLabel={`Sector: ${sector}`} />
        </div>
      )}
    </article>
  );
}
