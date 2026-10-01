// Búsqueda del catálogo (SPEC 04, RF-02) y del menú de cada negocio (SPEC 05, RF-06):
// sin mayúsculas ni acentos, y cada palabra de la consulta debe aparecer. El texto de cada
// negocio y de cada platillo se normaliza al compilar; los <script> solo normalizan la consulta.
import type { GrupoMenu, Negocio } from './datos';

type Platillo = GrupoMenu['secciones'][number]['platillos'][number];

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

/** Nombre, descripción y sección del platillo; las notas de sección no entran. */
export function textoPlatillo(platillo: Platillo, seccion: string): string {
	return normalizar([platillo.nombre, platillo.descripcion ?? '', seccion].join(' '));
}

/** "Sin café" → "menu-sin-cafe": `id` del grupo en la página y hash de su pestaña. */
export function idGrupo(nombre: string): string {
	const base = normalizar(nombre)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `menu-${base}`;
}

/** `texto` ya normalizado; una consulta vacía coincide con todo. */
export function coincide(texto: string, consulta: string): boolean {
	return normalizar(consulta)
		.split(' ')
		.every((palabra) => texto.includes(palabra));
}
