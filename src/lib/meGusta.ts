// "Me gusta" de los peludos (SPEC 13). El corazón es también el favorito del dispositivo:
// `favoritos:v1` guarda los ids y alimenta el chip "Mis favoritos" de /adopta.
// El contador público vive en Supabase (tabla me_gusta) y se lee y escribe con fetch a dos RPC,
// sin supabase-js. Si algo falla, el corazón sigue funcionando en el dispositivo y solo falta el número.
// Sin imports de Astro: lo usan los <script> de TarjetaPeludo y de la ficha.
import { registrar } from './analitica';

const CLAVE_FAVORITOS = 'favoritos:v1';
const CLAVE_DISPOSITIVO = 'dispositivo:v1';

/** Evento de `document` cuando cambian los favoritos, para que la galería recuente sus chips. */
export const EVENTO_FAVORITOS = 'favoritos';

/** Favoritos de esta visita; sin localStorage solo duran hasta recargar. */
let favoritos: Set<string> | undefined;

export function leerFavoritos(): Set<string> {
	if (!favoritos) {
		try {
			const guardado = JSON.parse(localStorage.getItem(CLAVE_FAVORITOS) ?? '[]');
			favoritos = new Set(Array.isArray(guardado) ? guardado.filter((id) => typeof id === 'string') : []);
		} catch {
			favoritos = new Set();
		}
	}
	return favoritos;
}

/** Cambia el favorito de `id` en este dispositivo y devuelve si quedó marcado. */
export function alternar(id: string): boolean {
	const lista = leerFavoritos();
	const activo = !lista.has(id);
	if (activo) lista.add(id);
	else lista.delete(id);
	try {
		localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify([...lista]));
	} catch {
		// Sin almacenamiento: el favorito dura solo esta visita.
	}
	document.dispatchEvent(new CustomEvent(EVENTO_FAVORITOS));
	return activo;
}

/**
 * Uuid al azar de este navegador, creado con el primer "me gusta". Sin localStorage devuelve null
 * y no se manda nada: sin un id estable, cada visita contaría otra vez.
 */
function dispositivo(): string | null {
	try {
		let id = localStorage.getItem(CLAVE_DISPOSITIVO);
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(CLAVE_DISPOSITIVO, id);
		}
		return id;
	} catch {
		return null;
	}
}

async function rpc<T>(funcion: string, cuerpo: object): Promise<T> {
	const llave = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	const respuesta = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
		method: 'POST',
		headers: { apikey: llave, 'Content-Type': 'application/json' },
		body: JSON.stringify(cuerpo),
	});
	if (!respuesta.ok) throw new Error(`${funcion}: ${respuesta.status}`);
	return respuesta.json();
}

let conteos: Promise<Map<string, number> | null> | undefined;

/** Totales por peludo, en una sola petición por página. null si no se pudieron leer. */
export function cargarConteos(): Promise<Map<string, number> | null> {
	conteos ??= rpc<{ peludo_id: string; total: number }[]>('conteos_me_gusta', {})
		.then((filas) => new Map(filas.map(({ peludo_id, total }) => [peludo_id, total])))
		.catch(() => null);
	return conteos;
}

/** Da o quita el "me gusta" en Supabase y devuelve el total nuevo, o null si no se pudo. */
export async function enviar(id: string, activo: boolean): Promise<number | null> {
	const propio = dispositivo();
	if (!propio) return null;
	try {
		return await rpc<number>('marcar_me_gusta', { peludo_id: id, dispositivo: propio, activo });
	} catch {
		return null;
	}
}

// Corazones de la página: botones [data-me-gusta="{id}"] con un [data-total] y un [data-corazon] dentro
// (ver BotonMeGusta.astro). Varios botones del mismo peludo comparten estado y número.

const totales = new Map<string, number | null>();

function botones(id: string) {
	return document.querySelectorAll<HTMLButtonElement>(`[data-me-gusta="${CSS.escape(id)}"]`);
}

/** Pinta corazón y número de `id`; sin número o con 0 no se muestra nada. */
function pintar(id: string) {
	const activo = leerFavoritos().has(id);
	const total = totales.get(id);
	for (const boton of botones(id)) {
		boton.setAttribute('aria-pressed', String(activo));
		boton.querySelector('[data-total]')!.textContent = total ? String(total) : '';
	}
}

/** Reinicia una animación CSS de una sola vez. */
function animar(elemento: Element, clase: string) {
	elemento.classList.remove(clase);
	void (elemento as HTMLElement).offsetWidth;
	elemento.classList.add(clase);
}

/** Latido y seis corazones pequeños que salen del botón. Con "reducir movimiento" no se ven. */
function celebrar(boton: HTMLButtonElement) {
	const corazon = boton.querySelector('[data-corazon]');
	if (corazon) animar(corazon, 'estallido');
	for (let i = 0; i < 6; i++) {
		const chispa = document.createElement('span');
		chispa.className = 'chispa';
		chispa.setAttribute('aria-hidden', 'true');
		chispa.style.setProperty('--angulo', `${i * 60 + 30}deg`);
		chispa.textContent = '♥';
		boton.append(chispa);
		setTimeout(() => chispa.remove(), 800);
	}
}

/** Marca o desmarca el "me gusta" de `id`. `forzar` true solo lo da (doble toque en la ficha). */
export async function cambiarMeGusta(id: string, nombre: string, origen: string, forzar = false) {
	const yaEstaba = leerFavoritos().has(id);
	if (forzar && yaEstaba) return;
	const activo = alternar(id);
	const antes = totales.get(id) ?? null;
	if (antes !== null) totales.set(id, Math.max(0, antes + (activo ? 1 : -1)));
	pintar(id);
	if (activo) {
		for (const boton of botones(id)) celebrar(boton);
		registrar('me_gusta', { peludo: nombre, origen });
	}

	const total = await enviar(id, activo);
	totales.set(id, total ?? antes);
	pintar(id);
}

/** Conecta todos los corazones de la página y pone los números cuando llegan. */
export function iniciarCorazones() {
	const todos = [...document.querySelectorAll<HTMLButtonElement>('[data-me-gusta]')];
	if (todos.length === 0) return;
	const ids = new Set(todos.map((boton) => boton.dataset.meGusta!));

	for (const boton of todos) {
		boton.addEventListener('click', (evento) => {
			// La tarjeta es un enlace a la ficha: el corazón no navega.
			evento.preventDefault();
			evento.stopPropagation();
			const { meGusta: id, nombre, origen } = boton.dataset;
			cambiarMeGusta(id!, nombre!, origen!);
		});
	}
	for (const id of ids) pintar(id);

	cargarConteos().then((mapa) => {
		if (!mapa) return;
		for (const id of ids) {
			// Un clic antes de que llegaran los conteos ya trae el total de marcar_me_gusta.
			if (!totales.has(id) || totales.get(id) === null) totales.set(id, mapa.get(id) ?? 0);
			pintar(id);
		}
	});
}
