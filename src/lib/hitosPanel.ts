// Hitos del formulario de peludo del panel (SPEC 13). Conecta un CampoHitos
// (src/components/admin/CampoHitos.astro) y arma lo que recibe la RPC guardar_peludo en `hitos`.
// Sin imports de Astro: lo usa el <script> de la página.

import { hoyEnMexico } from './formularioPanel';

export type TipoHito = 'llegada' | 'esterilizacion' | 'vacunas' | 'desparasitacion' | 'otro';

export type Hito = { fecha: string; tipo: TipoHito; texto: string | null; padrino: string | null };

/** Tipos en el orden del `<select>`, con su texto. */
export const tiposHito: { valor: TipoHito; texto: string }[] = [
	{ valor: 'llegada', texto: 'Llegada al refugio' },
	{ valor: 'esterilizacion', texto: 'Esterilización' },
	{ valor: 'vacunas', texto: 'Vacunas' },
	{ valor: 'desparasitacion', texto: 'Desparasitación' },
	{ valor: 'otro', texto: 'Otro' },
];

export const maximoHitos = 20;

/** Control de un CampoHitos de la página. */
export type CampoHitos = {
	/** Pone los hitos guardados del peludo. */
	cargar: (hitos: Hito[]) => void;
	/** Lee los hitos para la RPC. */
	leer: () => Hito[];
};

/**
 * Conecta un CampoHitos. `alCambiar` se llama cuando "Agregar hito" o "Quitar" cambian el formulario,
 * para el aviso de cambios sin guardar.
 */
export function campoHitos(raiz: HTMLElement, alCambiar: () => void): CampoHitos {
	const lista = raiz.querySelector<HTMLOListElement>('[data-lista]')!;
	const plantilla = raiz.querySelector<HTMLTemplateElement>('[data-plantilla]')!;
	const agregar = raiz.querySelector<HTMLButtonElement>('[data-agregar]')!;
	const hoy = hoyEnMexico();

	const filas = () => [...lista.querySelectorAll<HTMLElement>('[data-hito]')];
	const control = <T extends HTMLElement>(fila: HTMLElement, nombre: string) =>
		fila.querySelector<T>(`[data-${nombre}]`)!;

	/** El padrino solo existe en la esterilización y el texto es obligatorio en "Otro". */
	function pintar(fila: HTMLElement) {
		const tipo = control<HTMLSelectElement>(fila, 'tipo').value;
		const padrino = control<HTMLInputElement>(fila, 'padrino');
		const texto = control<HTMLInputElement>(fila, 'texto');
		control(fila, 'bloque-padrino').hidden = tipo !== 'esterilizacion';
		padrino.disabled = tipo !== 'esterilizacion';
		texto.required = tipo === 'otro';
		control(fila, 'opcional').hidden = tipo === 'otro';
	}

	function actualizar() {
		agregar.disabled = filas().length >= maximoHitos;
	}

	function nueva(hito?: Hito): HTMLElement {
		const fila = (plantilla.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
		const fecha = control<HTMLInputElement>(fila, 'fecha');
		fecha.max = hoy;
		fecha.value = hito?.fecha ?? hoy;
		control<HTMLSelectElement>(fila, 'tipo').value = hito?.tipo ?? 'llegada';
		control<HTMLInputElement>(fila, 'texto').value = hito?.texto ?? '';
		control<HTMLInputElement>(fila, 'padrino').value = hito?.padrino ?? '';
		control(fila, 'tipo').addEventListener('change', () => pintar(fila));
		control(fila, 'quitar').addEventListener('click', () => {
			const indice = filas().indexOf(fila);
			fila.remove();
			actualizar();
			const vecina = filas()[indice] ?? filas().at(-1);
			if (vecina) control(vecina, 'fecha').focus();
			else agregar.focus();
			alCambiar();
		});
		pintar(fila);
		lista.append(fila);
		return fila;
	}

	agregar.addEventListener('click', () => {
		nueva().querySelector<HTMLElement>('[data-fecha]')!.focus();
		actualizar();
		alCambiar();
	});
	actualizar();

	const valor = (fila: HTMLElement, nombre: string) => {
		const texto = control<HTMLInputElement>(fila, nombre).value.trim();
		return texto === '' ? null : texto;
	};

	return {
		cargar(hitos) {
			lista.replaceChildren();
			for (const hito of hitos) nueva(hito);
			actualizar();
		},
		leer() {
			return filas().map((fila) => {
				const tipo = control<HTMLSelectElement>(fila, 'tipo').value as TipoHito;
				return {
					fecha: control<HTMLInputElement>(fila, 'fecha').value,
					tipo,
					texto: valor(fila, 'texto'),
					padrino: tipo === 'esterilizacion' ? valor(fila, 'padrino') : null,
				};
			});
		},
	};
}
