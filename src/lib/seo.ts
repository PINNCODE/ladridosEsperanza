// Datos estructurados schema.org (SPEC 11): AnimalShelter en la portada y un tipo de negocio
// por categoría en cada /colabora/{id}. Layout los escribe en <head> con jsonLd().
import type { Negocio, Refugio } from './datos';
import type { Dia } from './horarios';

type Objeto = Record<string, unknown>;

const tipoPorCategoria: Record<string, string> = {
	cafeterias: 'CafeOrCoffeeShop',
	panaderias: 'Bakery',
	taquerias: 'Restaurant',
	'comida-corrida': 'Restaurant',
	pizzas: 'Restaurant',
};

/** Tipo de schema.org del negocio; una categoría sin tipo propio es `LocalBusiness`. */
export function tipoNegocio(categoriaId: string): string {
	return tipoPorCategoria[categoriaId] ?? 'LocalBusiness';
}

export function datosRefugio(refugio: Refugio, redes: string[], sitio: URL): Objeto {
	return {
		'@context': 'https://schema.org',
		'@type': 'AnimalShelter',
		name: refugio.nombre,
		url: sitio.href,
		logo: refugio.logo.url,
		image: refugio.foto_principal.url,
		address: refugio.ubicacion,
		telephone: `+${refugio.whatsapp}`,
		sameAs: redes,
	};
}

const diaEnIngles: Record<Dia, string> = {
	lun: 'Monday',
	mar: 'Tuesday',
	mie: 'Wednesday',
	jue: 'Thursday',
	vie: 'Friday',
	sab: 'Saturday',
	dom: 'Sunday',
};

/**
 * Una entrada por turno de cada día abierto. Los días "por confirmar" (ausentes) y "cerrado"
 * no aparecen; un turno que cruza la medianoche queda con `closes` menor que `opens`.
 */
function horariosSchema(horarios: Negocio['data']['horarios']): Objeto[] {
	return (Object.keys(diaEnIngles) as Dia[]).flatMap((dia) => {
		const turnos = horarios[dia];
		if (!Array.isArray(turnos)) return [];
		return turnos.map(({ abre, cierra }) => ({
			'@type': 'OpeningHoursSpecification',
			dayOfWeek: `https://schema.org/${diaEnIngles[dia]}`,
			opens: abre,
			closes: cierra,
		}));
	});
}

export function datosNegocio({ data }: Negocio, url: string): Objeto {
	const horarios = horariosSchema(data.horarios);
	return {
		'@context': 'https://schema.org',
		'@type': tipoNegocio(data.categoria.id),
		name: data.nombre,
		url,
		description: data.descripcion_corta,
		...(data.logo && { image: data.logo.url }),
		address: {
			'@type': 'PostalAddress',
			streetAddress: data.direccion,
			addressLocality: 'Tenancingo',
			addressRegion: 'Estado de México',
			addressCountry: 'MX',
		},
		...(data.latitud !== null &&
			data.longitud !== null && {
				geo: { '@type': 'GeoCoordinates', latitude: data.latitud, longitude: data.longitud },
			}),
		...(data.whatsapp && { telephone: `+${data.whatsapp}` }),
		...(horarios.length > 0 && { openingHoursSpecification: horarios }),
	};
}

/** JSON para un <script type="application/ld+json">; `<` se escapa para que un texto no lo cierre. */
export function jsonLd(objeto: Objeto): string {
	return JSON.stringify(objeto).replace(/</g, '\\u003c');
}
