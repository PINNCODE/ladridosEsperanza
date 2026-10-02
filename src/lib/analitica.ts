// Eventos de Umami (SPEC 11). Los clics se marcan con atributos data-umami-event en el HTML;
// aquí solo van las búsquedas y Súmate, que llaman los <script> que ya existen.
// Sin dependencias de Astro. Si un bloqueador impide cargar Umami, no pasa nada.
import { normalizar } from './busqueda';

type Datos = Record<string, string>;

declare global {
	interface Window {
		umami?: { track: (evento: string, datos?: Datos) => void };
	}
}

export function registrar(evento: string, datos?: Datos): void {
	window.umami?.track(evento, datos);
}

const espera = 1000;
const pendientes = new Map<string, ReturnType<typeof setTimeout>>();
const ultimos = new Map<string, string>();

/**
 * Una búsqueda por intención: se manda 1 s después de la última tecla, con 2 letras o más,
 * normalizada y recortada a 60 caracteres, y no se repite si es igual a la última de `lugar`.
 */
export function registrarBusqueda(lugar: string, texto: string, extra: Datos = {}): void {
	clearTimeout(pendientes.get(lugar));
	pendientes.set(
		lugar,
		setTimeout(() => {
			const normalizado = normalizar(texto).slice(0, 60);
			if (normalizado.length < 2 || normalizado === ultimos.get(lugar)) return;
			ultimos.set(lugar, normalizado);
			registrar('busqueda', { lugar, ...extra, texto: normalizado });
		}, espera),
	);
}
