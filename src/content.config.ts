// Colecciones de contenido (SPEC 01). Campos en español y snake_case para que
// coincidan con las columnas de Postgres de la SPEC 06.
// Las páginas no leen estas colecciones directo: siempre pasan por src/lib/datos.ts.
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const es_ejemplo = z.boolean();

const refugio = defineCollection({
	loader: file('src/data/refugio.json'),
	schema: ({ image }) =>
		z.object({
			nombre: z.string(),
			frase: z.string(),
			ubicacion: z.string(),
			// Solo dígitos con lada, listo para wa.me: "5215500000000".
			whatsapp: z.string().regex(/^\d{10,15}$/),
			logo: image(),
			foto_principal: image(),
			es_ejemplo,
		}),
});

const redes = defineCollection({
	loader: file('src/data/redes.json'),
	schema: z.object({
		red: z.enum(['facebook', 'instagram', 'facebook_sos', 'tiktok']),
		etiqueta: z.string(),
		url: z.url(),
		orden: z.number().int(),
		es_ejemplo,
	}),
});

const categorias = defineCollection({
	loader: file('src/data/categorias.json'),
	schema: z.object({
		nombre: z.string(),
		orden: z.number().int(),
		es_ejemplo,
	}),
});

const bloques_contenido = defineCollection({
	loader: file('src/data/bloques-contenido.json'),
	schema: ({ image }) =>
		z.object({
			seccion: z.string(),
			titulo: z.string(),
			texto: z.string(),
			imagenes: z.array(image()),
			orden: z.number().int(),
			publicado: z.boolean(),
			es_ejemplo,
		}),
});

const problematicas = defineCollection({
	loader: file('src/data/problematicas.json'),
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

const peludos = defineCollection({
	loader: file('src/data/peludos.json'),
	schema: ({ image }) =>
		z.object({
			nombre: z.string(),
			especie: z.enum(['perro', 'gato']),
			// Cómo se nombra en la tarjeta: "Perrita", "Cachorro", "Gata".
			descripcion_especie: z.string(),
			edad: z.string(),
			tamano: z.enum(['pequeño', 'mediano', 'grande']),
			descripcion: z.string().nullable(),
			rasgos: z.tuple([z.string(), z.string()]),
			fotos: z.array(image()),
			orden: z.number().int(),
			estado: z.enum(['disponible', 'en_proceso', 'adoptado']),
			es_ejemplo,
		}),
});

const campanas = defineCollection({
	loader: file('src/data/campanas.json'),
	schema: ({ image }) =>
		z.object({
			fecha: z.coerce.date(),
			costo: z.number(),
			lugar: z.string(),
			horario: z.string(),
			forma_pago: z.string(),
			cupo: z.number().int().nullable(),
			cartel: image().nullable(),
			estado: z.enum(['proxima', 'pasada']),
			es_ejemplo,
		}),
});

const necesidades = defineCollection({
	loader: file('src/data/necesidades.json'),
	schema: z.object({
		tipo: z.enum(['alimento', 'medicina', 'cobijas', 'limpieza', 'otro']),
		descripcion: z.string(),
		urgencia: z.enum(['urgente', 'necesaria']),
		fecha_vigencia: z.coerce.date(),
		es_ejemplo,
	}),
});

const destinos_donativo = defineCollection({
	loader: file('src/data/destinos-donativo.json'),
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

const informes_transparencia = defineCollection({
	loader: file('src/data/informes-transparencia.json'),
	schema: z.object({
		// Mes del informe como "AAAA-MM".
		mes: z.string().regex(/^\d{4}-\d{2}$/),
		ingresos: z.array(z.object({ fuente: z.string(), monto: z.number() })),
		gastos: z.array(montoPorConcepto),
		monto_entregado_refugio: z.number(),
		comprobantes: z.array(z.url()),
		publicado: z.boolean(),
		es_ejemplo,
	}),
});

const registros_cifras = defineCollection({
	loader: file('src/data/registros-cifras.json'),
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
	loader: file('src/data/anuncios.json'),
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
	// Un archivo por negocio; el id es el nombre del archivo y sirve de slug.
	loader: glob({ pattern: '*.json', base: './src/data/negocios' }),
	schema: ({ image }) =>
		z.object({
			nombre: z.string(),
			categoria: reference('categorias'),
			descripcion_corta: z.string(),
			logo: image().nullable(),
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
	informes_transparencia,
	registros_cifras,
	anuncios,
	negocios,
};
