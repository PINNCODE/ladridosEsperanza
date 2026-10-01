// Imágenes del bucket `imagenes` de Supabase (SPEC 06). Los loaders entregan la URL pública
// con sus medidas, y Astro las descarga y optimiza al compilar.
export type Imagen = { url: string; ancho: number; alto: number };

/** `width` y `height` para `<Image>` a un ancho dado, con el alto proporcional redondeado. */
export function medidas(imagen: Imagen, ancho: number): { width: number; height: number } {
	return { width: ancho, height: Math.round((ancho * imagen.alto) / imagen.ancho) };
}
