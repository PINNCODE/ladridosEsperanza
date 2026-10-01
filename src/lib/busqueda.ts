// Búsqueda del catálogo (SPEC 04, RF-02): sin mayúsculas ni acentos, y cada palabra
// de la consulta debe aparecer. El texto de cada negocio se normaliza al compilar;
// el <script> del catálogo solo normaliza la consulta.
import type { Negocio } from './datos';

/** "Café  Frío" → "cafe frio" */
export function normalizar(texto: string): string {
	return texto
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** Nombre, descripción, categoría y menú del negocio, sin los platillos no disponibles. */
export function textoBusqueda({ data }: Negocio, categoria: string): string {
	const partes = [data.nombre, data.descripcion_corta, categoria];
	for (const grupo of data.menu) {
		partes.push(grupo.nombre);
		for (const seccion of grupo.secciones) {
			partes.push(seccion.nombre);
			for (const platillo of seccion.platillos) {
				if (platillo.disponible) partes.push(platillo.nombre, platillo.descripcion ?? '');
			}
		}
	}
	return normalizar(partes.join(' '));
}

/** `texto` ya normalizado; una consulta vacía coincide con todo. */
export function coincide(texto: string, consulta: string): boolean {
	return normalizar(consulta)
		.split(' ')
		.every((palabra) => texto.includes(palabra));
}
