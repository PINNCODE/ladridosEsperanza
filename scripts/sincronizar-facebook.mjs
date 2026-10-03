// Sincronización diaria desde Facebook (SPEC 15). Lee los posts recientes de las dos páginas del refugio
// con Apify, clasifica cada uno con Gemini y lo registra con la RPC importar_post_facebook: un peludo o una
// campaña entran como borrador (`por_revisar`), que el refugio revisa y publica desde el panel.
// Nunca inventa un dato obligatorio: si falta, el post queda `incompleto` con su motivo.
//
// Uso: node scripts/sincronizar-facebook.mjs [--dry-run]
// Variables: SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY y APIFY_TOKEN (GEMINI_MODELO, opcional).
// Con --dry-run lee Apify y Gemini, reduce las fotos e imprime lo que haría, sin subir ni escribir nada;
// no pide las de Supabase (si están, solo las usa para saltar los posts ya registrados).
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const PAGINAS = [
	'https://www.facebook.com/p/Sos-Ladridos-de-Esperanza-Tenancingo-100067644922613/',
	'https://www.facebook.com/ladridos.esperanza.5/',
];
const POSTS_POR_PAGINA = 10;
// GEMINI_MODELO (opcional) cambia el modelo sin tocar el código, por ejemplo si uno deja de estar disponible.
const MODELO = process.env.GEMINI_MODELO || 'gemini-flash-lite-latest';
const MAXIMO_FOTOS = 8;
// Igual que reducir() del panel (src/lib/imagenesPanel.ts).
const LADO_FOTO = 1600;
const LADO_CARTEL = 2400;
const CALIDAD = 85;
const POR_CONFIRMAR = 'Por confirmar';

const simulacion = process.argv.includes('--dry-run');

const requeridas = simulacion
	? ['GEMINI_API_KEY', 'APIFY_TOKEN']
	: ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'GEMINI_API_KEY', 'APIFY_TOKEN'];
const faltan = requeridas.filter((nombre) => !process.env[nombre]);
if (faltan.length > 0) {
	console.error(`Faltan variables de entorno: ${faltan.join(', ')}.`);
	process.exit(1);
}

const supabase =
	process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
		? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
		: null;

/** "2026-10-24" de hoy en Ciudad de México. */
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

/** Minúsculas, sin acentos y con un solo espacio, para buscar un dato en el texto del post. */
const normalizar = (texto) =>
	texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

const espera = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/** Respuesta de error de una API en una línea corta. */
const unaLinea = (texto) => texto.replace(/\s+/g, ' ').slice(0, 300);

// ─── Apify ───────────────────────────────────────────────────────────────────────────────────────

/** Posts recientes de las dos páginas, con el texto y las URL de sus fotos. */
async function leerPosts() {
	const respuesta = await fetch(
		'https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items',
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${process.env.APIFY_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				startUrls: PAGINAS.map((url) => ({ url })),
				resultsLimit: POSTS_POR_PAGINA,
			}),
		},
	);
	if (!respuesta.ok) {
		throw new Error(`Apify respondió ${respuesta.status}: ${unaLinea(await respuesta.text())}`);
	}
	const elementos = await respuesta.json();
	return elementos.filter((elemento) => elemento.postId && !elemento.error).map(post);
}

/** Lo que el script usa de un elemento de Apify. */
function post(elemento) {
	const fotos = (elemento.media ?? [])
		.filter((medio) => !medio.__typename || medio.__typename === 'Photo')
		.map((medio) => medio.photo_image?.uri ?? medio.image?.uri ?? medio.thumbnail)
		.filter(Boolean);
	return {
		id: String(elemento.postId),
		url: elemento.url ?? elemento.topLevelUrl,
		pagina: elemento.facebookUrl ?? elemento.inputUrl ?? elemento.pageUrl ?? '',
		texto: elemento.text ?? '',
		publicadoEn: elemento.time ?? (elemento.timestamp ? new Date(elemento.timestamp * 1000).toISOString() : null),
		fotos: [...new Set(fotos)].slice(0, MAXIMO_FOTOS),
	};
}

// ─── Gemini ──────────────────────────────────────────────────────────────────────────────────────

const texto = { type: 'STRING', nullable: true };
const convivencia = { type: 'STRING', enum: ['si', 'no', 'no_sabemos'] };

const ESQUEMA = {
	type: 'OBJECT',
	properties: {
		categoria: { type: 'STRING', enum: ['adopcion', 'campana', 'adoptado', 'otro'] },
		motivo: { type: 'STRING' },
		varios_peludos: { type: 'BOOLEAN' },
		nombre: texto,
		especie: { type: 'STRING', enum: ['perro', 'gato'], nullable: true },
		descripcion_especie: texto,
		edad: texto,
		tamano: { type: 'STRING', enum: ['pequeño', 'mediano', 'grande'] },
		descripcion: texto,
		rasgos: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
		convive_perros: convivencia,
		convive_gatos: convivencia,
		convive_ninos: convivencia,
		fecha: texto,
		costo: { type: 'NUMBER', nullable: true },
		lugar: texto,
		horario: texto,
		forma_pago: texto,
		cupo: { type: 'INTEGER', nullable: true },
		nombre_adoptado: texto,
		texto_en_foto: texto,
	},
	required: ['categoria', 'motivo', 'varios_peludos', 'tamano', 'convive_perros', 'convive_gatos', 'convive_ninos'],
};

const instrucciones = (fecha) => `Clasificas publicaciones de Facebook del refugio de animales "Ladridos de Esperanza" en Tenancingo, Estado de México. Hoy es ${fecha}.

Categorías:
- "adopcion": un perro o gato rescatado que busca hogar (adopción o casa temporal).
- "campana": una campaña de esterilización con fecha.
- "adoptado": celebra que un peludo con nombre ya fue adoptado.
- "otro": cualquier otra cosa (agradecimientos, donativos, rifas, extravíos, reflexiones).

Reglas:
- Nunca inventes un dato. Si el texto no lo dice, deja el campo en null. No pongas un nombre que no esté escrito en el texto.
- "varios_peludos" es true si la publicación ofrece en adopción a más de un animal.
- "tamano" siempre lo estimas con la foto (o el texto); los demás datos solo salen del texto.
- "descripcion_especie" es cómo se nombra: "Perrita", "Perro", "Cachorro", "Cachorrita", "Gato", "Gata", "Gatito"…
- "descripcion": dos o tres frases en español sobre su historia y carácter, solo con lo que dice el texto.
- "rasgos": exactamente dos adjetivos cortos que el texto mencione (por ejemplo "Juguetón", "Cariñosa"), o null.
- Convivencia: "si" o "no" solo si el texto lo dice; si no, "no_sabemos".
- "fecha" en formato AAAA-MM-DD; si el texto no dice el año, usa el de la próxima vez que caiga esa fecha a partir de hoy.
- "costo" y "cupo" solo como números escritos en el texto.
- "texto_en_foto": copia literal del texto que se lee en la foto (un cartel, por ejemplo), o null si no tiene texto.
- Los datos pueden venir del texto o de la foto (la fecha y el costo de una campaña suelen estar en el cartel).
- "motivo": una frase corta que explique la categoría.`;

/** Clasifica un post con su texto y, si tiene, su primera foto ya reducida. */
async function clasificar(textoPost, primeraFoto) {
	const partes = [{ text: instrucciones(hoy) }, { text: `Publicación:\n"""\n${textoPost}\n"""` }];
	if (primeraFoto) {
		partes.push({ inline_data: { mime_type: 'image/jpeg', data: primeraFoto.toString('base64') } });
	}
	for (let intento = 1; ; intento++) {
		const respuesta = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
			{
				method: 'POST',
				headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ role: 'user', parts: partes }],
					generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0 },
				}),
			},
		);
		const cuerpoError = respuesta.ok ? '' : await respuesta.text();
		// La cuota diaria no vuelve en unos segundos; el límite por minuto o un servicio saturado, sí.
		const cuotaDiaria = respuesta.status === 429 && cuerpoError.includes('PerDay');
		if ((respuesta.status === 429 || respuesta.status >= 500) && !cuotaDiaria && intento < 3) {
			await espera(20_000 * intento);
			continue;
		}
		if (!respuesta.ok) {
			const error = new Error(
				cuotaDiaria
					? `Gemini: se acabó la cuota diaria de ${MODELO}.`
					: `Gemini respondió ${respuesta.status}: ${unaLinea(cuerpoError)}`,
			);
			// Llave o modelo rechazados, o sin cuota: fallaría igual con todos los posts.
			error.detenerse = cuotaDiaria || [400, 401, 403, 404].includes(respuesta.status);
			throw error;
		}
		const cuerpo = await respuesta.json();
		const salida = cuerpo.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!salida) throw new Error('Gemini no devolvió respuesta.');
		return JSON.parse(salida);
	}
}

// ─── Fotos ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Descarga una foto de Facebook. Sin el parámetro `ctp` (el recorte de la vista previa) la misma URL
 * firmada entrega la foto al tamaño que permite `cstp` (hasta 1600 px); si falla, la vista previa.
 */
async function descargar(url) {
	const grande = new URL(url);
	grande.searchParams.delete('ctp');
	for (const intento of [grande, url]) {
		const respuesta = await fetch(intento);
		if (respuesta.ok) return Buffer.from(await respuesta.arrayBuffer());
	}
	throw new Error('No se pudo descargar una foto.');
}

/** JPEG con lado máximo `lado`, girado según su EXIF, con su ancho y alto reales. */
async function reducir(original, lado) {
	const { data, info } = await sharp(original)
		.rotate()
		.resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
		.jpeg({ quality: CALIDAD })
		.toBuffer({ resolveWithObject: true });
	return { datos: data, ancho: info.width, alto: info.height };
}

/** Nombre de archivo válido para guardar_imagen: fb-{post}-{n}.jpg. */
const archivo = (carpeta, postId, n) => `${carpeta}/fb-${postId.replace(/[^A-Za-z0-9_-]/g, '-')}-${n}.jpg`;

async function subir(fotos, carpeta, postId) {
	const subidas = [];
	try {
		for (const [indice, foto] of fotos.entries()) {
			const ruta = archivo(carpeta, postId, indice + 1);
			const { error } = await supabase.storage
				.from('imagenes')
				.upload(ruta, foto.datos, { contentType: 'image/jpeg', upsert: true });
			if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`);
			subidas.push({ ruta, ancho: foto.ancho, alto: foto.alto });
		}
	} catch (error) {
		await borrar(subidas);
		throw error;
	}
	return subidas;
}

async function borrar(fotos) {
	if (fotos.length === 0) return;
	const { error } = await supabase.storage.from('imagenes').remove(fotos.map(({ ruta }) => ruta));
	if (error) console.error(`  No se pudieron borrar las fotos subidas: ${error.message}`);
}

// ─── Decisión ────────────────────────────────────────────────────────────────────────────────────

/** ¿El número aparece escrito en el texto? ("$350", "350 pesos", "1,200"). */
const numeroEnTexto = (numero, textoPost) =>
	textoPost.replace(/(\d)[,.](\d{3})/g, '$1$2').match(/\d+/g)?.includes(String(numero)) ?? false;

/** ¿El nombre aparece escrito en el texto? */
const nombreEnTexto = (nombre, textoPost) => normalizar(textoPost).includes(normalizar(nombre));

const valor = (dato) => (typeof dato === 'string' && dato.trim() ? dato.trim() : null);

/**
 * Convierte la clasificación en los `datos` de importar_post_facebook (sin fotos) o en un post
 * `ignorado` / `incompleto` con el motivo del primer dato obligatorio que falte. Cada dato obligatorio
 * debe aparecer en el post: su texto o el texto de su foto (el cartel de una campaña).
 */
function decidir(clasificacion, post) {
	const c = clasificacion;
	const incompleto = (motivo) => ({ resultado: 'incompleto', motivo });
	const enPost = `${post.texto}\n${valor(c.texto_en_foto) ?? ''}`;

	if (c.categoria === 'adopcion') {
		const nombre = valor(c.nombre);
		if (!nombre || !nombreEnTexto(nombre, enPost)) return incompleto('sin_nombre');
		if (!c.especie) return incompleto('sin_especie');
		if (post.fotos.length === 0) return incompleto('sin_foto');
		if (c.varios_peludos) return incompleto('varios_peludos');
		const rasgos = (c.rasgos ?? [])
			.map(valor)
			.filter(Boolean)
			.map((rasgo) => rasgo[0].toLocaleUpperCase('es-MX') + rasgo.slice(1));
		return {
			resultado: 'peludo',
			peludo: {
				nombre,
				especie: c.especie,
				descripcion_especie: valor(c.descripcion_especie) ?? POR_CONFIRMAR,
				edad: valor(c.edad) ?? POR_CONFIRMAR,
				tamano: c.tamano,
				descripcion: valor(c.descripcion) ?? valor(post.texto),
				rasgos: rasgos.length === 2 ? rasgos : [POR_CONFIRMAR, POR_CONFIRMAR],
				convive_perros: c.convive_perros,
				convive_gatos: c.convive_gatos,
				convive_ninos: c.convive_ninos,
			},
		};
	}

	if (c.categoria === 'campana') {
		const fecha = valor(c.fecha);
		if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !numeroEnTexto(Number(fecha.slice(8)), enPost)) {
			return incompleto('sin_fecha');
		}
		if (fecha < hoy) return incompleto('fecha_pasada');
		const lugar = valor(c.lugar);
		if (!lugar) return incompleto('sin_lugar');
		if (typeof c.costo !== 'number' || c.costo < 0 || !numeroEnTexto(c.costo, enPost)) {
			return incompleto('sin_costo');
		}
		return {
			resultado: 'campana',
			campana: {
				fecha,
				costo: c.costo,
				lugar,
				horario: valor(c.horario) ?? POR_CONFIRMAR,
				forma_pago: valor(c.forma_pago) ?? POR_CONFIRMAR,
				cupo: Number.isInteger(c.cupo) && numeroEnTexto(c.cupo, enPost) ? c.cupo : null,
			},
		};
	}

	if (c.categoria === 'adoptado') {
		const nombre = valor(c.nombre_adoptado);
		if (!nombre || !nombreEnTexto(nombre, enPost)) return incompleto('sin_nombre');
		return { resultado: 'adoptado', adoptado: { nombre } };
	}

	return { resultado: 'ignorado', motivo: 'otro_tema' };
}

// ─── Un post ─────────────────────────────────────────────────────────────────────────────────────

async function procesar(post) {
	const originales = await Promise.all(post.fotos.map(descargar));
	const paraGemini = originales[0] ? (await reducir(originales[0], 1024)).datos : null;
	const clasificacion = await clasificar(post.texto, paraGemini);
	const decision = decidir(clasificacion, post);
	console.log(`  Gemini: ${clasificacion.categoria} (${clasificacion.motivo})`);

	let fotos = [];
	if (decision.resultado === 'peludo') {
		fotos = await Promise.all(originales.map((original) => reducir(original, LADO_FOTO)));
	} else if (decision.resultado === 'campana' && originales[0]) {
		fotos = [await reducir(originales[0], LADO_CARTEL)];
	}

	const datos = {
		post_id: post.id,
		url_post: post.url,
		pagina: post.pagina,
		texto: post.texto,
		publicado_en: post.publicadoEn,
		...decision,
	};

	if (simulacion) {
		const medidas = fotos.map(({ ancho, alto }) => `${ancho}×${alto}`).join(', ');
		console.log(`  Haría: ${JSON.stringify(datos.peludo ?? datos.campana ?? datos.adoptado ?? { motivo: datos.motivo })}`);
		if (medidas) console.log(`  Fotos: ${medidas}`);
		return decision.resultado;
	}

	const carpeta = decision.resultado === 'peludo' ? 'peludos' : 'campanas';
	const subidas = await subir(fotos, carpeta, post.id);
	if (decision.resultado === 'peludo') datos.peludo.fotos = subidas;
	if (decision.resultado === 'campana') datos.campana.cartel = subidas[0] ?? null;

	const { data: resultado, error } = await supabase.rpc('importar_post_facebook', { datos });
	if (error || resultado?.duplicado) {
		await borrar(subidas);
		if (error) throw new Error(`importar_post_facebook: ${error.message}${error.details ? ` (${error.details})` : ''}`);
		return 'duplicado';
	}
	const creado = resultado.peludo_id ?? resultado.campana_id;
	console.log(`  Registrado: ${resultado.resultado}${creado ? ` → ${creado}` : ''}${datos.motivo ? ` (${datos.motivo})` : ''}`);
	return resultado.resultado;
}

// ─── Principal ───────────────────────────────────────────────────────────────────────────────────

async function yaRegistrados(ids) {
	if (!supabase || ids.length === 0) return new Set();
	const { data, error } = await supabase.from('publicaciones_facebook').select('post_id').in('post_id', ids);
	if (error) throw new Error(`No se pudo leer publicaciones_facebook: ${error.message}`);
	return new Set(data.map(({ post_id }) => post_id));
}

const conteo = { peludo: 0, campana: 0, adoptado: 0, ignorado: 0, incompleto: 0, duplicado: 0, error: 0 };

console.log(`Sincronización desde Facebook${simulacion ? ' (simulación: no se sube ni se escribe nada)' : ''}.`);
let posts;
try {
	posts = await leerPosts();
} catch (error) {
	console.error(`No se pudieron leer los posts: ${error.message}`);
	process.exit(1);
}
console.log(`${posts.length} posts leídos de Apify.`);

const registrados = await yaRegistrados(posts.map(({ id }) => id));
for (const post of posts) {
	console.log(`\nPost ${post.id} · ${post.url}`);
	if (registrados.has(post.id)) {
		console.log('  Ya registrado.');
		conteo.duplicado++;
		continue;
	}
	try {
		conteo[await procesar(post)]++;
	} catch (error) {
		// Sin registrar: se reintenta en la siguiente ejecución.
		console.error(`  Error: ${error.message}`);
		conteo.error++;
		if (error.detenerse) {
			console.error('Se detiene la sincronización: los demás posts fallarían igual.');
			break;
		}
	}
}

console.log(
	`\nResumen: ${conteo.peludo} peludos, ${conteo.campana} campañas, ${conteo.adoptado} avisos de adopción, ` +
		`${conteo.ignorado} ignorados, ${conteo.incompleto} incompletos, ${conteo.duplicado} duplicados, ` +
		`${conteo.error} errores.`,
);
if (conteo.error > 0) process.exit(1);
