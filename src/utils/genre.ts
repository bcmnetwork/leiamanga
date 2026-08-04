/** Converts a provider genre slug (e.g. "acao-aventura") into a display label ("Acao Aventura"). */
export function genreLabelFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
