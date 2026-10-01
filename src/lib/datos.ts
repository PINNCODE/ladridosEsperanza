// Única puerta de entrada a las colecciones de contenido.
// Los registros con `es_ejemplo: true` solo salen si PUBLIC_MOSTRAR_EJEMPLOS=true,
// así el sitio real nunca publica datos de ejemplo.
import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

export const mostrarEjemplos: boolean = import.meta.env.PUBLIC_MOSTRAR_EJEMPLOS === 'true';

export async function obtener<C extends CollectionKey>(coleccion: C): Promise<CollectionEntry<C>[]> {
	const entradas = await getCollection(coleccion);
	return mostrarEjemplos
		? entradas
		: entradas.filter((entrada) => !(entrada.data as { es_ejemplo: boolean }).es_ejemplo);
}

export type Refugio = CollectionEntry<'refugio'>['data'];

export async function obtenerRefugio(): Promise<Refugio> {
	const [refugio] = await obtener('refugio');
	if (!refugio) {
		throw new Error(
			'Falta el registro real en la tabla refugio de Supabase. ' +
				'El único registro es de ejemplo y PUBLIC_MOSTRAR_EJEMPLOS no es "true".',
		);
	}
	return refugio.data;
}

// Consultas de la portada (SPEC 02) y de las páginas del refugio (SPEC 03).

export type Peludo = CollectionEntry<'peludos'>;
export type Bloque = CollectionEntry<'bloques_contenido'>;
export type Problematica = CollectionEntry<'problematicas'>;
export type Campana = CollectionEntry<'campanas'>;
export type Necesidad = CollectionEntry<'necesidades'>;
export type Destino = CollectionEntry<'destinos_donativo'>;

/**
 * Día de calendario de `hoy` a medianoche UTC, igual que las fechas de los datos,
 * para comparar solo la fecha sin la hora.
 */
function soloFecha(hoy: Date): number {
	return Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
}

export async function peludosDisponibles(): Promise<Peludo[]> {
	return (await obtener('peludos'))
		.filter(({ data }) => data.estado === 'disponible')
		.sort((a, b) => a.data.orden - b.data.orden);
}

/** Bloques publicados de una sección, por `orden`. Sin bloques, la parte no se muestra. */
export async function bloquesDeSeccion(seccion: string): Promise<Bloque[]> {
	return (await obtener('bloques_contenido'))
		.filter(({ data }) => data.seccion === seccion && data.publicado)
		.sort((a, b) => a.data.orden - b.data.orden);
}

export async function bloqueQuienesSomos(): Promise<Bloque | null> {
	const [bloque] = await bloquesDeSeccion('quienes_somos');
	return bloque ?? null;
}

export async function problematicasPublicadas(): Promise<Problematica[]> {
	return (await obtener('problematicas'))
		.filter(({ data }) => data.publicada)
		.sort((a, b) => a.data.orden - b.data.orden);
}

/** Una cifra solo se publica con su fecha y su fuente (RF-23, RF-29). */
export function cifraVisible({ data }: Problematica): boolean {
	return data.cifra !== null && data.fecha_cifra !== null && data.fuente !== null;
}

export async function proximaCampana(hoy: Date): Promise<Campana | null> {
	const dia = soloFecha(hoy);
	const proximas = (await obtener('campanas'))
		.filter(({ data }) => data.estado === 'proxima' && data.fecha.getTime() >= dia)
		.sort((a, b) => a.data.fecha.getTime() - b.data.fecha.getTime());
	return proximas[0] ?? null;
}

/** La campaña marcada como pasada más reciente; el refugio decide cuándo terminó. */
export async function campanaAnterior(): Promise<Campana | null> {
	const pasadas = (await obtener('campanas'))
		.filter(({ data }) => data.estado === 'pasada')
		.sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime());
	return pasadas[0] ?? null;
}

/**
 * Necesidades que no han vencido; una vencida deja de mostrarse (RF-26).
 * Urgentes primero, luego la que vence antes y, con la misma vigencia, por descripción.
 * La colección no tiene `orden` y getCollection no respeta el orden del archivo.
 */
export async function necesidadesVigentes(hoy: Date): Promise<Necesidad[]> {
	const dia = soloFecha(hoy);
	const prioridad = { urgente: 0, necesaria: 1 };
	return (await obtener('necesidades'))
		.filter(({ data }) => data.fecha_vigencia.getTime() >= dia)
		.sort(
			(a, b) =>
				prioridad[a.data.urgencia] - prioridad[b.data.urgencia] ||
				a.data.fecha_vigencia.getTime() - b.data.fecha_vigencia.getTime() ||
				a.data.descripcion.localeCompare(b.data.descripcion, 'es-MX'),
		);
}

export async function destinosDonativo(): Promise<Destino[]> {
	return (await obtener('destinos_donativo')).sort((a, b) => a.data.orden - b.data.orden);
}

// Consultas del catálogo /colabora (SPEC 04).

export type Negocio = CollectionEntry<'negocios'>;
export type Categoria = CollectionEntry<'categorias'>;
export type Promocion = NonNullable<Negocio['data']['promocion']>;

export async function negociosPublicados(): Promise<Negocio[]> {
	return (await obtener('negocios'))
		.filter(({ data }) => data.estado === 'publicado')
		.sort((a, b) => a.data.nombre.localeCompare(b.data.nombre, 'es-MX'));
}

/**
 * La promoción solo se muestra entre su inicio y su fin (RF-09).
 * Se filtra al compilar, como las necesidades; la recompilación diaria la retira (SPEC 06).
 */
export function promocionVigente({ data }: Negocio, hoy: Date): Promocion | null {
	const promocion = data.promocion;
	if (!promocion) return null;
	const dia = soloFecha(hoy);
	if (promocion.fecha_inicio.getTime() > dia) return null;
	if (promocion.fecha_fin && promocion.fecha_fin.getTime() < dia) return null;
	return promocion;
}

/** Categorías con al menos uno de `negocios`, por `orden`; una chip sin negocios no sirve. */
export async function categoriasConNegocios(negocios: Negocio[]): Promise<Categoria[]> {
	const usadas = new Set(negocios.map(({ data }) => data.categoria.id));
	return (await obtener('categorias'))
		.filter(({ id }) => usadas.has(id))
		.sort((a, b) => a.data.orden - b.data.orden);
}

/** Todas las categorías por `orden`, para el tipo de negocio del formulario Súmate (SPEC 07). */
export async function categoriasOrdenadas(): Promise<Categoria[]> {
	return (await obtener('categorias')).sort((a, b) => a.data.orden - b.data.orden);
}

// Consultas de la página de cada negocio (SPEC 05).

export type GrupoMenu = Negocio['data']['menu'][number];

/**
 * Menú sin los platillos con `disponible: false`, ni secciones o grupos que quedan vacíos,
 * por `orden`. Un platillo que no se puede pedir no se muestra ni se encuentra.
 */
export function menuDisponible({ data }: Negocio): GrupoMenu[] {
	return data.menu
		.map((grupo) => ({
			...grupo,
			secciones: grupo.secciones
				.map((seccion) => ({
					...seccion,
					platillos: seccion.platillos.filter(({ disponible }) => disponible),
				}))
				.filter(({ platillos }) => platillos.length > 0)
				.sort((a, b) => a.orden - b.orden),
		}))
		.filter(({ secciones }) => secciones.length > 0)
		.sort((a, b) => a.orden - b.orden);
}
