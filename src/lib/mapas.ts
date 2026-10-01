// Enlace "Cómo llegar" de cada negocio (SPEC 05, RF-08) con la búsqueda de Google Maps,
// que abre la aplicación en el teléfono y no necesita clave.
import type { Negocio } from './datos';

/**
 * Con coordenadas, el punto exacto. Sin ellas, nombre, dirección y la ubicación del refugio
 * ("Tenancingo, Estado de México") para que Maps no busque la calle en otro estado.
 */
export function enlaceMapa({ data }: Negocio, ubicacion: string): string {
	const consulta =
		data.latitud !== null && data.longitud !== null
			? `${data.latitud},${data.longitud}`
			: `${data.nombre}, ${data.direccion}, ${ubicacion}`;
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
