// Estado "abierto ahora" de un negocio (SPEC 04, RF-07).
// Sin dependencias de Astro: lo importa el <script> del catálogo y lo reutiliza la SPEC 05.
// Siempre con la hora de Tenancingo, aunque el visitante esté en otra zona horaria.
import type { Negocio } from './datos';

export type Horarios = Negocio['data']['horarios'];
export type Dia = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
export type Momento = { dia: Dia; minutos: number };

type Turno = { abre: string; cierra: string };

const dias: Dia[] = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const diaEnIngles: Record<string, Dia> = {
	Sun: 'dom',
	Mon: 'lun',
	Tue: 'mar',
	Wed: 'mie',
	Thu: 'jue',
	Fri: 'vie',
	Sat: 'sab',
};

const horaEnMexico = new Intl.DateTimeFormat('en-US', {
	timeZone: 'America/Mexico_City',
	weekday: 'short',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
});

const lista = new Intl.ListFormat('es-MX', { type: 'conjunction' });

/** Día de la semana y minutos desde la medianoche en Ciudad de México. */
export function momentoEnMexico(fecha: Date): Momento {
	const partes = Object.fromEntries(
		horaEnMexico.formatToParts(fecha).map(({ type, value }) => [type, value]),
	);
	return {
		dia: diaEnIngles[partes.weekday],
		minutos: Number(partes.hour) * 60 + Number(partes.minute),
	};
}

/** "08:00" → "8:00", "00:30" → "0:30" */
export function formatearHora(hora: string): string {
	return hora.replace(/^0(\d)/, '$1');
}

function enMinutos(hora: string): number {
	const [h, m] = hora.split(':').map(Number);
	return h * 60 + m;
}

/** Un turno con `cierra` menor que `abre` cruza la medianoche y sigue abierto hasta el día siguiente. */
function cruzaMedianoche({ abre, cierra }: Turno): boolean {
	return enMinutos(cierra) < enMinutos(abre);
}

function abiertoHoy(turno: Turno, minutos: number): boolean {
	const abre = enMinutos(turno.abre);
	return cruzaMedianoche(turno)
		? minutos >= abre
		: minutos >= abre && minutos < enMinutos(turno.cierra);
}

function turnosDeHoy(turnos: Turno[]): string {
	return `Hoy ${lista.format(turnos.map((t) => `${formatearHora(t.abre)} a ${formatearHora(t.cierra)}`))}`;
}

/**
 * Abierto si un turno de hoy incluye `minutos`, o si un turno de ayer cruza la medianoche
 * y aún no cierra. Un día ausente es "por confirmar" y nunca cuenta como abierto.
 */
export function estadoHorario(horarios: Horarios, { dia, minutos }: Momento): {
	abierto: boolean;
	texto: string;
} {
	const hoy = horarios[dia];
	const ayer = horarios[dias[(dias.indexOf(dia) + 6) % 7]];

	if (Array.isArray(hoy) && hoy.some((turno) => abiertoHoy(turno, minutos))) {
		return { abierto: true, texto: `Abierto ahora · ${turnosDeHoy(hoy)}` };
	}

	const turnoDeAyer = Array.isArray(ayer)
		? ayer.find((turno) => cruzaMedianoche(turno) && minutos < enMinutos(turno.cierra))
		: undefined;
	if (turnoDeAyer) {
		return { abierto: true, texto: `Abierto ahora · Hasta las ${formatearHora(turnoDeAyer.cierra)}` };
	}

	if (hoy === undefined) return { abierto: false, texto: 'Horario por confirmar' };
	if (hoy === 'cerrado') return { abierto: false, texto: 'Cerrado ahora · Hoy cerrado' };
	return { abierto: false, texto: `Cerrado ahora · ${turnosDeHoy(hoy)}` };
}
