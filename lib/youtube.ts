/**
 * Convierte cualquier enlace de YouTube que un tutor pueda pegar en la URL
 * de embebido. Acepta watch (con v= en cualquier posición y con parámetros
 * extra como t= o list=), youtu.be, embed, shorts y live.
 */
export function getYoutubeEmbedUrl(url: string): string | null {
  const limpio = url.trim();
  const patterns = [
    /youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube-nocookie\.com\/embed\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = limpio.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}
