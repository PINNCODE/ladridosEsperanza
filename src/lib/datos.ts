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
			'Falta el registro real de refugio en src/data/refugio.json. ' +
				'El único registro es de ejemplo y PUBLIC_MOSTRAR_EJEMPLOS no es "true".',
		);
	}
	return refugio.data;
}
