/**
 * `view-transition-name` debe ser un <custom-ident> válido (sin `/` ni otros
 * caracteres especiales sin escapar). Se deriva de la misma ruta (`href`) que
 * ya comparten la miniatura del catálogo/dashboard y la portada del detalle
 * del curso, así ambos lados quedan sincronizados sin necesitar el id del
 * curso como prop adicional.
 */
export function coursePhotoTransitionName(href: string): string {
  return `course-photo-${href.replace(/[^a-zA-Z0-9-]+/g, "-")}`;
}
