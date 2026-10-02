// Colecciones de contenido (SPEC 01). Campos en español y snake_case, iguales a las columnas
// de Postgres; desde la SPEC 06 los datos vienen de Supabase por los loaders de src/lib/cargadores.ts.
// Las páginas no leen estas colecciones directo: siempre pasan por src/lib/datos.ts.
import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import {
	cargadorAnuncios,
	cargadorBloquesContenido,
	cargadorCampanas,
	cargadorCategorias,
	cargadorDestinosDonativo,
	cargadorNecesidades,
	cargadorNegocios,
	cargadorPeludos,
	cargadorProblematicas,
	cargadorRedes,
	cargadorRefugio,
	cargadorRegistrosCifras,
} from './lib/cargadores';

const es_ejemplo = z.boolean();

// Imagen del bucket `imagenes` de Supabase con sus medidas; se pinta con medidas() de src/lib/imagenes.ts.
const imagen = z.object({ url: z.url(), ancho: z.number().int(), alto: z.number().int() });

const refugio = defineCollection({
	loader: cargadorRefugio(),
	schema: z.object({
		nombre: z.string(),
		frase: z.string(),
		ubicacion: z.string(),
		// Calle sin el municipio, que ya está en `ubicacion`. Opcionales (SPEC 12).
		direccion: z.string().nullable(),
		// Punto del enlace "Cómo llegar"; las dos juntas o ninguna.
		latitud: z.number().nullable(),
		longitud: z.number().nullable(),
		// Ficha del refugio en Google Maps; si existe, "Cómo llegar" la prefiere a las coordenadas.
		enlace_mapa: z.string().url().nullable(),
		// Solo dígitos con lada, listo para wa.me: "5215500000000".
		whatsapp: z.string().regex(/^\d{10,15}$/),
		logo: imagen,
		foto_principal: imagen,
		es_ejemplo,
	}),
});

const redes = defineCollection({
	loader: cargadorRedes(),
	schema: z.object({
		red: z.enum(['facebook', 'instagram', 'facebook_sos', 'tiktok']),
		etiqueta: z.string(),
		url: z.url(),
		orden: z.number().int(),
		es_ejemplo,
	}),
});

const categorias = defineCollection({
	loader: cargadorCategorias(),
	schema: z.object({
		nombre: z.string(),
		orden: z.number().int(),
		es_ejemplo,
	}),
});

const bloques_contenido = defineCollection({
	loader: cargadorBloquesContenido(),
	schema: z.object({
		seccion: z.string(),
		titulo: z.string(),
		texto: z.string(),
		imagenes: z.array(imagen),
		orden: z.number().int(),
		publicado: z.boolean(),
		es_ejemplo,
	}),
});

const problematicas = defineCollection({
	loader: cargadorProblematicas(),
	schema: z.object({
		titulo: z.string(),
		texto: z.string(),
		// Nombre de Lucide en kebab-case; Icono.astro falla si no existe.
		icono: z.string(),
		etiqueta_cifra: z.string(),
		cifra: z.string().nullable(),
		fecha_cifra: z.coerce.date().nullable(),
		fuente: z.string().nullable(),
		enlace: z
			.object({
				texto: z.string(),
				url: z.url(),
				sensible: z.boolean(),
			})
			.nullable(),
		orden: z.number().int(),
		publicada: z.boolean(),
		es_ejemplo,
	}),
});

// Si convive con perros, gatos o niños; muchas veces el refugio no lo ha probado (SPEC 13).
const convivencia = z.enum(['si', 'no', 'no_sabemos']);

const peludos = defineCollection({
	loader: cargadorPeludos(),
	schema: z.object({
		nombre: z.string(),
		especie: z.enum(['perro', 'gato']),
		// Cómo se nombra en la tarjeta: "Perrita", "Cachorro", "Gata".
		descripcion_especie: z.string(),
		edad: z.string(),
		tamano: z.enum(['pequeño', 'mediano', 'grande']),
		descripcion: z.string().nullable(),
		rasgos: z.tuple([z.string(), z.string()]),
		fotos: z.array(imagen),
		orden: z.number().int(),
		estado: z.enum(['disponible', 'en_proceso', 'adoptado']),
		convive_perros: convivencia,
		convive_gatos: convivencia,
		convive_ninos: convivencia,
		// "Su camino en el refugio", en orden de fecha; `padrino` solo en la esterilización.
		hitos: z.array(
			z.object({
				fecha: z.coerce.date(),
				tipo: z.enum(['llegada', 'esterilizacion', 'vacunas', 'desparasitacion', 'otro']),
				texto: z.string().nullable(),
				padrino: z.string().nullable(),
			}),
		),
		es_ejemplo,
	}),
});

const campanas = defineCollection({
	loader: cargadorCampanas(),
	schema: z.object({
		fecha: z.coerce.date(),
		costo: z.number(),
		lugar: z.string(),
		horario: z.string(),
		forma_pago: z.string(),
		cupo: z.number().int().nullable(),
		cartel: imagen.nullable(),
		estado: z.enum(['proxima', 'pasada']),
		es_ejemplo,
	}),
});

const necesidades = defineCollection({
	loader: cargadorNecesidades(),
	schema: z.object({
		tipo: z.enum(['alimento', 'medicina', 'cobijas', 'limpieza', 'otro']),
		descripcion: z.string(),
		urgencia: z.enum(['urgente', 'necesaria']),
		fecha_vigencia: z.coerce.date(),
		es_ejemplo,
	}),
});

const destinos_donativo = defineCollection({
	loader: cargadorDestinosDonativo(),
	schema: z.object({
		destino: z.string(),
		cubre: z.string(),
		monto: z.number(),
		equivalencia: z.string(),
		orden: z.number().int(),
		es_ejemplo,
	}),
});

const montoPorConcepto = z.object({ concepto: z.string(), monto: z.number() });

const registros_cifras = defineCollection({
	loader: cargadorRegistrosCifras(),
	schema: z.object({
		mes: z.string().regex(/^\d{4}-\d{2}$/),
		animales_recibidos: z.number().int().nullable(),
		rescates: z.number().int().nullable(),
		adopciones: z.number().int().nullable(),
		esterilizaciones: z.number().int().nullable(),
		gastos: z.array(montoPorConcepto),
		notas: z.string().nullable(),
		es_ejemplo,
	}),
});

const anuncios = defineCollection({
	loader: cargadorAnuncios(),
	schema: z.object({
		tipo: z.enum(['patrocinio_local', 'automatico']),
		anunciante: z.string(),
		texto: z.string(),
		enlace: z.url(),
		posicion: z.string(),
		vigencia_inicio: z.coerce.date(),
		vigencia_fin: z.coerce.date(),
		activo: z.boolean(),
		es_ejemplo,
	}),
});

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// Un turno con `cierra` menor que `abre` cruza la medianoche ("13:00" a "00:30").
const turno = z.object({ abre: hora, cierra: hora });

// Día ausente = "por confirmar".
const horarioDia = z.union([z.array(turno).min(1), z.literal('cerrado')]);

const precio = z
	.object({
		etiqueta: z.string().nullable(),
		monto: z.number().nullable(),
		texto_alterno: z.string().nullable(),
	})
	.refine((p) => p.monto !== null || p.texto_alterno !== null, {
		message: 'Un precio sin monto necesita texto_alterno (por ejemplo "Incluido").',
		path: ['texto_alterno'],
	});

const platillo = z.object({
	nombre: z.string(),
	descripcion: z.string().nullable(),
	precios: z.array(precio).min(1),
	es_extra: z.boolean(),
	disponible: z.boolean(),
});

const seccionMenu = z.object({
	nombre: z.string(),
	nota: z.string().nullable(),
	orden: z.number().int(),
	platillos: z.array(platillo),
});

const grupoMenu = z.object({
	nombre: z.string(),
	orden: z.number().int(),
	secciones: z.array(seccionMenu),
});

const negocios = defineCollection({
	// El id del negocio sirve de slug.
	loader: cargadorNegocios(),
	schema: z.object({
		nombre: z.string(),
		categoria: reference('categorias'),
		descripcion_corta: z.string(),
		logo: imagen.nullable(),
		direccion: z.string(),
		latitud: z.number().nullable(),
		longitud: z.number().nullable(),
		whatsapp: z.string().regex(/^\d{10,15}$/).nullable(),
		estado: z.enum(['borrador', 'publicado', 'pausado']),
		porcentaje_aporte: z.number().min(0).max(100),
		fecha_alta: z.coerce.date(),
		horarios: z
			.object({
				lun: horarioDia,
				mar: horarioDia,
				mie: horarioDia,
				jue: horarioDia,
				vie: horarioDia,
				sab: horarioDia,
				dom: horarioDia,
			})
			.partial(),
		promocion: z
			.object({
				texto: z.string(),
				fecha_inicio: z.coerce.date(),
				fecha_fin: z.coerce.date().nullable(),
			})
			.nullable(),
		menu: z.array(grupoMenu),
		es_ejemplo,
	}),
});

export const collections = {
	refugio,
	redes,
	categorias,
	bloques_contenido,
	problematicas,
	peludos,
	campanas,
	necesidades,
	destinos_donativo,
	registros_cifras,
	anuncios,
	negocios,
};
