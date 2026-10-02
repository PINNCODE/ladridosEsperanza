// Enlaces "Cómo llegar" de cada negocio (SPEC 05, RF-08) y del refugio (SPEC 12) con la búsqueda de Google Maps,
// que abre la aplicación en el teléfono y no necesita clave.
import type { Negocio, Refugio } from './datos';

const busqueda = (consulta: string) =>
	`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;

/**
 * Con coordenadas, el punto exacto. Sin ellas, nombre, dirección y la ubicación del refugio
 * ("Tenancingo, Estado de México") para que Maps no busque la calle en otro estado.
 */
export function enlaceMapa({ data }: Negocio, ubicacion: string): string {
	const consulta =
		data.latitud !== null && data.longitud !== null
			? `${data.latitud},${data.longitud}`
			: `${data.nombre}, ${data.direccion}, ${ubicacion}`;
	return busqueda(consulta);
}

/**
 * "Cómo llegar" del refugio (SPEC 12): su ficha de Google Maps, si no el punto exacto, o null sin ninguno.
 * No busca por nombre ni por dirección para no mandar a nadie a un punto equivocado.
 */
export function enlaceMapaRefugio({ enlace_mapa, latitud, longitud }: Refugio): string | null {
	if (enlace_mapa) return enlace_mapa;
	return latitud !== null && longitud !== null ? busqueda(`${latitud},${longitud}`) : null;
}
