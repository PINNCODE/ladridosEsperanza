// Horarios del formulario de negocio del panel (SPEC 09, RF-07). Conecta un CampoHorarios
// (src/components/admin/CampoHorarios.astro) y arma lo que recibe la RPC guardar_negocio:
// por día "cerrado" o 1 o 2 turnos; un día ausente es "por confirmar".
// Sin imports de Astro: lo usa el <script> de la página.

import type { Dia, Horarios } from './horarios';

type Turno = { abre: string; cierra: string };

/** Días en el orden del formulario, con su nombre. */
export const dias: { dia: Dia; nombre: string }[] = [
	{ dia: 'lun', nombre: 'Lunes' },
	{ dia: 'mar', nombre: 'Martes' },
	{ dia: 'mie', nombre: 'Miércoles' },
	{ dia: 'jue', nombre: 'Jueves' },
	{ dia: 'vie', nombre: 'Viernes' },
	{ dia: 'sab', nombre: 'Sábado' },
	{ dia: 'dom', nombre: 'Domingo' },
];
const claves = dias.map(({ dia }) => dia);

type Estado = 'confirmar' | 'cerrado' | 'abierto';

/** Control de un CampoHorarios de la página. */
export type CampoHorarios = {
	/** Pone los horarios guardados del negocio. */
	cargar: (horarios: Horarios) => void;
	/** Lee los horarios para la RPC. */
	leer: () => Horarios;
};

/**
 * Conecta un CampoHorarios. `alCambiar` se llama cuando "Agregar turno", "Quitar turno" o
 * "Copiar el lunes" cambian el formulario, para el aviso de cambios sin guardar.
 */
export function campoHorarios(raiz: HTMLElement, alCambiar: () => void): CampoHorarios {
	const elementos = Object.fromEntries(
		claves.map((dia) => [dia, raiz.querySelector<HTMLElement>(`[data-dia="${dia}"]`)!]),
	) as Record<Dia, HTMLElement>;

	const radios = (dia: Dia) => [...elementos[dia].querySelectorAll<HTMLInputElement>('input[type="radio"]')];
	const filas = (dia: Dia) => [...elementos[dia].querySelectorAll<HTMLElement>('[data-turno]')];
	const horas = (fila: HTMLElement) => [...fila.querySelectorAll<HTMLInputElement>('input[type="time"]')];

	function estado(dia: Dia): Estado {
		return (radios(dia).find(({ checked }) => checked)?.value ?? 'confirmar') as Estado;
	}

	/** Muestra los turnos del día si está abierto; los campos ocultos se desactivan y no se validan. */
	function pintar(dia: Dia) {
		const elemento = elementos[dia];
		const abierto = estado(dia) === 'abierto';
		const segundo = elemento.dataset.segundo === 'si';
		elemento.querySelector<HTMLElement>('[data-turnos]')!.hidden = !abierto;
		filas(dia).forEach((fila, indice) => {
			const visible = abierto && (indice === 0 || segundo);
			fila.hidden = !visible;
			for (const hora of horas(fila)) hora.disabled = !visible;
		});
		elemento.querySelector<HTMLButtonElement>('[data-agregar-turno]')!.disabled = segundo;
		validar(dia);
	}

	/** Un turno que abre y cierra a la misma hora no se puede guardar. */
	function validar(dia: Dia) {
		for (const fila of filas(dia)) {
			const [abre, cierra] = horas(fila);
			cierra.setCustomValidity(
				!cierra.disabled && abre.value && abre.value === cierra.value
					? 'La hora de cierre debe ser distinta de la de apertura.'
					: '',
			);
		}
	}

	function poner(dia: Dia, valor: Turno[] | 'cerrado' | undefined) {
		const elegido: Estado = valor === undefined ? 'confirmar' : valor === 'cerrado' ? 'cerrado' : 'abierto';
		for (const radio of radios(dia)) radio.checked = radio.value === elegido;
		const turnos = Array.isArray(valor) ? valor : [];
		elementos[dia].dataset.segundo = turnos.length > 1 ? 'si' : 'no';
		filas(dia).forEach((fila, indice) => {
			const [abre, cierra] = horas(fila);
			abre.value = turnos[indice]?.abre ?? '';
			cierra.value = turnos[indice]?.cierra ?? '';
		});
		pintar(dia);
	}

	function leerDia(dia: Dia): Turno[] | 'cerrado' | undefined {
		const actual = estado(dia);
		if (actual === 'confirmar') return undefined;
		if (actual === 'cerrado') return 'cerrado';
		return filas(dia)
			.filter((fila) => !fila.hidden)
			.map((fila) => {
				const [abre, cierra] = horas(fila);
				return { abre: abre.value, cierra: cierra.value };
			});
	}

	for (const dia of claves) {
		const elemento = elementos[dia];
		for (const radio of radios(dia)) radio.addEventListener('change', () => pintar(dia));
		for (const fila of filas(dia)) {
			for (const hora of horas(fila)) hora.addEventListener('input', () => validar(dia));
		}
		elemento.querySelector('[data-agregar-turno]')!.addEventListener('click', () => {
			elemento.dataset.segundo = 'si';
			pintar(dia);
			horas(filas(dia)[1])[0].focus();
			alCambiar();
		});
		elemento.querySelector('[data-quitar-turno]')!.addEventListener('click', () => {
			elemento.dataset.segundo = 'no';
			for (const hora of horas(filas(dia)[1])) hora.value = '';
			pintar(dia);
			elemento.querySelector<HTMLButtonElement>('[data-agregar-turno]')!.focus();
			alCambiar();
		});
		pintar(dia);
	}

	raiz.querySelector('[data-copiar-lunes]')!.addEventListener('click', () => {
		const lunes = leerDia('lun');
		for (const dia of claves.slice(1)) poner(dia, Array.isArray(lunes) ? lunes.map((turno) => ({ ...turno })) : lunes);
		raiz.querySelector<HTMLElement>('[data-copiado]')!.textContent = 'Se copió el horario del lunes a toda la semana.';
		alCambiar();
	});

	return {
		cargar(horarios) {
			for (const dia of claves) poner(dia, horarios[dia]);
		},
		leer() {
			const horarios: Horarios = {};
			for (const dia of claves) {
				const valor = leerDia(dia);
				if (valor !== undefined) horarios[dia] = valor;
			}
			return horarios;
		},
	};
}
