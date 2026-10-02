// Formato de montos, fechas y textos en español de México.
// Las fechas de los datos ("2026-10-24") se crean a medianoche UTC con z.coerce.date(),
// por eso todo se formatea en UTC: en hora de México saldría el día anterior.

const pesos = new Intl.NumberFormat('es-MX', {
	style: 'currency',
	currency: 'MXN',
	maximumFractionDigits: 0,
});

const fecha = new Intl.DateTimeFormat('es-MX', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	timeZone: 'UTC',
});

const mes = new Intl.DateTimeFormat('es-MX', {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC',
});

/** 15000 → "$15,000" */
export function formatearPesos(monto: number): string {
	return pesos.format(monto);
}

type Precio = { etiqueta: string | null; monto: number | null; texto_alterno: string | null };

/**
 * { etiqueta: "Caliente", monto: 49 } → "Caliente $49"; sin monto, su `texto_alterno` ("Incluido").
 * Un extra se suma a otro platillo: "+$12".
 */
export function formatearPrecio({ etiqueta, monto, texto_alterno }: Precio, esExtra: boolean): string {
	const valor = monto === null ? (texto_alterno ?? '') : `${esExtra ? '+' : ''}${formatearPesos(monto)}`;
	return etiqueta ? `${etiqueta} ${valor}` : valor;
}

/** 2026-10-24 → "sábado 24 de octubre" */
export function formatearFecha(dia: Date): string {
	return fecha.format(dia).replace(',', '');
}

/** "2026-09" o una fecha → "septiembre de 2026" */
export function formatearMes(valor: string | Date): string {
	const dia = typeof valor === 'string' ? new Date(`${valor}-01`) : valor;
	return mes.format(dia);
}

/** "Uno.\n\nDos." → ["Uno.", "Dos."]: un párrafo por cada línea en blanco, sin vacíos. */
export function parrafos(texto: string): string[] {
	return texto
		.split(/\n\s*\n/)
		.map((parrafo) => parrafo.trim())
		.filter(Boolean);
}

const tallas = { pequeño: 'Talla pequeña', mediano: 'Talla mediana', grande: 'Talla grande' } as const;

/** "mediano" → "Talla mediana" (SPEC 13). */
export function textoTalla(tamano: keyof typeof tallas): string {
	return tallas[tamano];
}
