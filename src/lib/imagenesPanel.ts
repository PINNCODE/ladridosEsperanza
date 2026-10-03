// Fotos del panel /admin (SPEC 08 y 09): se reducen en el navegador, se suben al bucket `imagenes`
// y se mandan a las funciones RPC como { imagen_id } (ya existe) o { ruta, ancho, alto } (nueva).
// Las RPC devuelven las rutas que quedaron sin uso, y el navegador las borra del bucket.
import { supabaseNavegador } from './supabaseNavegador';

export type Carpeta = 'peludos' | 'campanas' | 'bloques' | 'negocios';
/** JPEG para fotos y carteles; PNG para logos, que conserva la transparencia (SPEC 09). */
export type Formato = 'jpeg' | 'png';
export type FotoReducida = { blob: Blob; ancho: number; alto: number };
/** Lo que reciben las RPC por cada foto, en orden. */
export type FotoDatos = { imagen_id: string } | { ruta: string; ancho: number; alto: number };
/** Una foto que el registro ya tiene: su fila de `imagenes`. */
export type FotoGuardada = { id: string; ruta: string };

const bucket = 'imagenes';

/** URL pública de una ruta del bucket, para las vistas previas. */
export function urlPublica(ruta: string): string {
	return supabaseNavegador().storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

/**
 * Reduce la imagen a `ladoMaximo` px en su lado mayor (sin agrandarla) y la pasa a JPEG 0.85
 * o a PNG. Lanza 'imagen_ilegible' si el navegador no puede leer el archivo.
 */
export async function reducir(archivo: File, ladoMaximo: number, formato: Formato = 'jpeg'): Promise<FotoReducida> {
	let imagen: ImageBitmap;
	try {
		imagen = await createImageBitmap(archivo);
	} catch {
		throw new Error('imagen_ilegible');
	}
	const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
	const ancho = Math.round(imagen.width * escala);
	const alto = Math.round(imagen.height * escala);

	const lienzo = document.createElement('canvas');
	lienzo.width = ancho;
	lienzo.height = alto;
	const contexto = lienzo.getContext('2d')!;
	if (formato === 'jpeg') {
		// Un PNG con transparencia quedaría negro en JPEG.
		contexto.fillStyle = '#ffffff';
		contexto.fillRect(0, 0, ancho, alto);
	}
	contexto.drawImage(imagen, 0, 0, ancho, alto);
	imagen.close();

	const blob = await new Promise<Blob | null>((resolver) =>
		formato === 'png' ? lienzo.toBlob(resolver, 'image/png') : lienzo.toBlob(resolver, 'image/jpeg', 0.85),
	);
	if (!blob) throw new Error('imagen_ilegible');
	return { blob, ancho, alto };
}

/** Sube la foto a {carpeta}/{uuid}.jpg (o .png, según el formato del blob) y devuelve su ruta. */
export async function subir(carpeta: Carpeta, blob: Blob): Promise<string> {
	const png = blob.type === 'image/png';
	const ruta = `${carpeta}/${crypto.randomUUID()}.${png ? 'png' : 'jpg'}`;
	const { error } = await supabaseNavegador()
		.storage.from(bucket)
		.upload(ruta, blob, { contentType: png ? 'image/png' : 'image/jpeg' });
	if (error) throw error;
	return ruta;
}

/** Borra archivos del bucket. Si falla, el archivo queda huérfano pero sin fila: no se muestra. */
export async function borrarRutas(rutas: string[]): Promise<void> {
	if (rutas.length === 0) return;
	await supabaseNavegador().storage.from(bucket).remove(rutas);
}

type Elemento =
	| { tipo: 'guardada'; imagen_id: string; url: string }
	| { tipo: 'nueva'; foto: FotoReducida; url: string };

/** Control de un CampoFotos de la página: lista, orden, alta y baja de fotos. */
export type CampoFotos = {
	/** Pone las fotos que el registro ya tiene, en orden. */
	cargar: (fotos: FotoGuardada[]) => void;
	/** Cuántas fotos tiene el campo ahora, guardadas y nuevas. */
	cantidad: () => number;
	/** Sube las fotos nuevas y devuelve los datos para la RPC y las rutas que subió. */
	subirNuevas: () => Promise<{ fotos: FotoDatos[]; subidas: string[] }>;
};

/**
 * Conecta un CampoFotos (src/components/admin/CampoFotos.astro). `alCambiar` se llama cuando
 * la persona agrega, quita o mueve una foto, para el aviso de cambios sin guardar.
 */
export function campoFotos(raiz: HTMLElement, alCambiar: () => void): CampoFotos {
	const carpeta = raiz.dataset.carpeta as Carpeta;
	const maximo = Number(raiz.dataset.maximo);
	const ladoMaximo = Number(raiz.dataset.ladoMaximo);
	const formato = raiz.dataset.formato as Formato;
	const lista = raiz.querySelector<HTMLUListElement>('[data-fotos]')!;
	const plantilla = raiz.querySelector<HTMLTemplateElement>('[data-plantilla-foto]')!;
	const entrada = raiz.querySelector<HTMLInputElement>('[data-archivo]')!;
	const agregar = raiz.querySelector<HTMLButtonElement>('[data-agregar-foto]')!;
	const mensaje = raiz.querySelector<HTMLElement>('[data-mensaje-foto]')!;
	const elementos: Elemento[] = [];

	function pintar() {
		lista.replaceChildren(
			...elementos.map((elemento, indice) => {
				const fila = plantilla.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
				const numero = indice + 1;
				const imagen = fila.querySelector<HTMLImageElement>('img')!;
				imagen.src = elemento.url;
				imagen.alt = maximo > 1 ? `Foto ${numero}` : 'Imagen actual';
				fila.querySelector<HTMLElement>('[data-principal]')!.hidden = !(maximo > 1 && indice === 0);

				const acciones: [string, string, () => void][] = [
					['subir', 'Subir', () => mover(indice, -1)],
					['bajar', 'Bajar', () => mover(indice, 1)],
					['quitar', 'Quitar', () => quitar(indice)],
				];
				for (const [accion, texto, hacer] of acciones) {
					const boton = fila.querySelector<HTMLButtonElement>(`[data-${accion}]`)!;
					if (maximo === 1 && accion !== 'quitar') {
						boton.remove();
						continue;
					}
					boton.setAttribute('aria-label', maximo > 1 ? `${texto} foto ${numero}` : `${texto} imagen`);
					boton.disabled =
						(accion === 'subir' && indice === 0) || (accion === 'bajar' && indice === elementos.length - 1);
					boton.addEventListener('click', hacer);
				}
				return fila;
			}),
		);
		agregar.disabled = elementos.length >= maximo;
	}

	function mover(indice: number, direccion: -1 | 1) {
		const [elemento] = elementos.splice(indice, 1);
		elementos.splice(indice + direccion, 0, elemento);
		pintar();
		lista.querySelectorAll<HTMLButtonElement>(direccion < 0 ? '[data-subir]' : '[data-bajar]')[indice + direccion]
			?.focus();
		alCambiar();
	}

	function quitar(indice: number) {
		const [elemento] = elementos.splice(indice, 1);
		if (elemento.tipo === 'nueva') URL.revokeObjectURL(elemento.url);
		pintar();
		agregar.focus();
		alCambiar();
	}

	agregar.addEventListener('click', () => entrada.click());
	entrada.addEventListener('change', async () => {
		const archivos = [...(entrada.files ?? [])].slice(0, maximo - elementos.length);
		entrada.value = '';
		mensaje.textContent = '';
		for (const archivo of archivos) {
			try {
				const foto = await reducir(archivo, ladoMaximo, formato);
				elementos.push({ tipo: 'nueva', foto, url: URL.createObjectURL(foto.blob) });
			} catch {
				mensaje.textContent = 'No pudimos leer esta imagen. Prueba con una foto JPG o PNG.';
			}
		}
		pintar();
		alCambiar();
	});

	pintar();

	return {
		cantidad: () => elementos.length,
		cargar(fotos) {
			elementos.splice(0, elementos.length, ...fotos.map(({ id, ruta }) => ({
				tipo: 'guardada' as const,
				imagen_id: id,
				url: urlPublica(ruta),
			})));
			pintar();
		},
		async subirNuevas() {
			const subidas: string[] = [];
			const fotos: FotoDatos[] = [];
			try {
				for (const elemento of elementos) {
					if (elemento.tipo === 'guardada') {
						fotos.push({ imagen_id: elemento.imagen_id });
						continue;
					}
					const ruta = await subir(carpeta, elemento.foto.blob);
					subidas.push(ruta);
					fotos.push({ ruta, ancho: elemento.foto.ancho, alto: elemento.foto.alto });
				}
			} catch (error) {
				await borrarRutas(subidas);
				throw error;
			}
			return { fotos, subidas };
		},
	};
}

/**
 * El orden de un guardado con fotos (SPEC 08): sube las nuevas, llama a la RPC, y borra del bucket
 * lo recién subido si la RPC falla o las `rutas_borradas` si responde. Lanza el error si falla.
 */
export async function guardarConFotos(
	campos: CampoFotos[],
	llamar: (fotos: FotoDatos[][]) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<void> {
	const subidas: string[] = [];
	const fotos: FotoDatos[][] = [];
	try {
		for (const campo of campos) {
			const resultado = await campo.subirNuevas();
			subidas.push(...resultado.subidas);
			fotos.push(resultado.fotos);
		}
	} catch (error) {
		await borrarRutas(subidas);
		throw error;
	}

	const { data, error } = await llamar(fotos);
	if (error) {
		await borrarRutas(subidas);
		throw error;
	}
	await borrarRutas((data as { rutas_borradas?: string[] } | null)?.rutas_borradas ?? []);
}
