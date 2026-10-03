// Sincronización diaria desde Facebook (SPEC 15). Lee los posts recientes de las dos páginas del refugio
// con Apify, clasifica cada uno con Gemini y lo registra con la RPC importar_post_facebook: un peludo o una
// campaña entran como borrador (`por_revisar`), que el refugio revisa y publica desde el panel.
// Nunca inventa un dato obligatorio: si falta, el post queda `incompleto` con su motivo.
// SPEC 16: también reúne lo que pide el refugio como borradores de necesidad, sin repetir lo ya registrado,
// y guarda todo post de adopción aunque no traiga foto (el refugio la agrega). Los videos no se leen.
//
// Uso: node scripts/sincronizar-facebook.mjs [--dry-run] [--limite N] [--guardar carpeta | --desde carpeta] [--solo-adopcion]
// Variables: SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY y APIFY_TOKEN (GEMINI_MODELO, opcional).
// Con --dry-run lee Apify y Gemini, reduce las fotos e imprime lo que haría, sin subir ni escribir nada;
// no pide las de Supabase (si están, solo las usa para saltar los posts ya registrados).
//
// Carga del historial, a mano (docs/configuracion-facebook-sync.md): --limite cambia los posts por página;
// --guardar lee Apify una sola vez, descarga las fotos de los posts sin registrar a la carpeta y termina
// sin usar Gemini; --desde procesa esa carpeta en lugar de Apify, en varios días si se acaba la cuota de
// Gemini (las URL firmadas de las fotos caducan, por eso se guardan los archivos); --solo-adopcion manda
// a Gemini solo los posts que parecen de adopción y deja los demás sin registrar.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const PAGINAS = [
	'https://www.facebook.com/p/Sos-Ladridos-de-Esperanza-Tenancingo-100067644922613/',
	'https://www.facebook.com/ladridos.esperanza.5/',
];
/** Valor de una opción `--nombre valor`, o null. */
const opcion = (nombre) => {
	const indice = process.argv.indexOf(nombre);
	return indice === -1 ? null : (process.argv[indice + 1] ?? null);
};
const POSTS_POR_PAGINA = Number(opcion('--limite') ?? 10);
const carpetaGuardar = opcion('--guardar');
const carpetaDesde = opcion('--desde');
const soloAdopcion = process.argv.includes('--solo-adopcion');
if (!Number.isInteger(POSTS_POR_PAGINA) || POSTS_POR_PAGINA < 1 || (carpetaGuardar && carpetaDesde)) {
	console.error('Uso: --limite N (entero de 1 o más) y solo una de --guardar o --desde.');
	process.exit(1);
}
// GEMINI_MODELO (opcional) cambia el modelo sin tocar el código, por ejemplo si uno deja de estar disponible.
const MODELO = process.env.GEMINI_MODELO || 'gemini-flash-lite-latest';
const MAXIMO_FOTOS = 8;
// Igual que reducir() del panel (src/lib/imagenesPanel.ts).
const LADO_FOTO = 1600;
const LADO_CARTEL = 2400;
const CALIDAD = 85;
const POR_CONFIRMAR = 'Por confirmar';
const MAXIMO_NECESIDADES = 6;
// Vigencia de una necesidad cuando el post no dice hasta cuándo aplica.
const DIAS_VIGENCIA = 30;
// Un donativo en dinero no es una necesidad (SPEC 16), aunque Gemini lo liste.
const DINERO = /\b(dinero|economic[oa]s?|efectivo|transferencias?|depositos?|monetari[oa]s?|donativos?)\b/;

const simulacion = process.argv.includes('--dry-run');

const requeridas = [
	...(simulacion || carpetaGuardar ? [] : ['SUPABASE_URL', 'SUPABASE_SECRET_KEY']),
	...(carpetaGuardar ? [] : ['GEMINI_API_KEY']),
	...(carpetaDesde ? [] : ['APIFY_TOKEN']),
];
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
	// Solo fotos: los videos (y su miniatura) no se leen (SPEC 16).
	const fotos = (elemento.media ?? [])
		.filter((medio) => !medio.__typename || medio.__typename === 'Photo')
		.filter((medio) => !medio.videoId && !medio.playable_url && !medio.is_playable)
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
		categoria: { type: 'STRING', enum: ['adopcion', 'campana', 'necesidad', 'adoptado', 'otro'] },
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
		necesidades: {
			type: 'ARRAY',
			nullable: true,
			items: {
				type: 'OBJECT',
				properties: {
					tipo: { type: 'STRING', enum: ['alimento', 'medicina', 'cobijas', 'limpieza', 'otro'] },
					descripcion: { type: 'STRING' },
					ya_registrada: texto,
				},
				required: ['tipo', 'descripcion', 'ya_registrada'],
			},
		},
		vigencia: texto,
		texto_en_foto: texto,
	},
	required: ['categoria', 'motivo', 'varios_peludos', 'tamano', 'convive_perros', 'convive_gatos', 'convive_ninos'],
};

/** Necesidades ya registradas, una por línea, para que Gemini marque las que se repiten. */
const listaRegistradas = (registradas) =>
	registradas.length === 0
		? '(ninguna)'
		: registradas.map(({ id, tipo, descripcion }) => `- ${id} | ${tipo} | ${descripcion}`).join('\n');

const instrucciones = (fecha, registradas) => `Clasificas publicaciones de Facebook del refugio de animales "Ladridos de Esperanza" en Tenancingo, Estado de México. Hoy es ${fecha}.

Categorías:
- "adopcion": un perro o gato rescatado que busca hogar (adopción o casa temporal).
- "campana": una campaña de esterilización con fecha.
- "necesidad": el refugio pide cosas en especie (alimento, croquetas, sobres, latas, medicinas, cobijas, artículos de limpieza, arena…).
- "adoptado": celebra que un peludo con nombre ya fue adoptado.
- "otro": cualquier otra cosa (agradecimientos, donativos en dinero, rifas, eventos, carreras, extravíos, reflexiones).
Si una publicación es "adopcion" o "campana" y además pide cosas, es "adopcion" o "campana".

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
- "necesidades": solo con categoría "necesidad"; una por cada cosa distinta que se pide, con su "tipo" y una "descripcion" corta en español con las palabras del texto ("Sobres o latas para gatos", "Arena para gatos"). Nunca incluyas dinero (apoyo económico, donativos, transferencias) ni voluntarios ("manos"): no son cosas. Con otra categoría, null.
- "ya_registrada": el id de la necesidad ya registrada (lista de abajo) que pide lo mismo aunque esté escrita distinto ("arenita para los michis" es lo mismo que "Arena para gatos"); null si es nueva.
- "vigencia": la fecha AAAA-MM-DD hasta la que aplica la necesidad, solo si el texto la escribe; si no, null.
- "motivo": una frase corta que explique la categoría.

Necesidades ya registradas (id | tipo | descripción):
${listaRegistradas(registradas)}`;

/** Clasifica un post con su texto y, si tiene, su primera foto ya reducida. */
async function clasificar(textoPost, primeraFoto) {
	const partes = [{ text: instrucciones(hoy, registradas) }, { text: `Publicación:\n"""\n${textoPost}\n"""` }];
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
	// Foto ya descargada por --guardar.
	if (!/^https?:/.test(url)) return readFile(path.join(carpetaDesde, url));
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

/** "2026-10-24" de un instante en Ciudad de México (hoy si no hay instante). */
const fechaEnMexico = (instante) =>
	instante
		? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(instante))
		: hoy;

/** "AAAA-MM-DD" más `dias` días. */
const sumarDias = (fecha, dias) => {
	const resultado = new Date(`${fecha}T00:00:00Z`);
	resultado.setUTCDate(resultado.getUTCDate() + dias);
	return resultado.toISOString().slice(0, 10);
};

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
		if (!c.especie) return incompleto('sin_especie');
		// Sin nombre escrito en el post, o con varios peludos, entra como "Gatita sin nombre" o "Gatitos sin
		// nombre": el refugio le pone el nombre (o lo separa) desde el panel, con el enlace al post.
		const escrito = valor(c.nombre);
		const conNombre = escrito && nombreEnTexto(escrito, enPost) && !c.varios_peludos;
		const especie = valor(c.descripcion_especie) ?? (c.especie === 'gato' ? 'Gato' : 'Perro');
		const nombre = conNombre ? escrito : `${especie[0].toLocaleUpperCase('es-MX')}${especie.slice(1)} sin nombre`;
		const motivo = conNombre ? null : c.varios_peludos ? 'varios_peludos' : 'sin_nombre';
		// Sin foto (solo video o solo texto) también entra: el refugio la agrega antes de publicar (SPEC 16).
		const rasgos = (c.rasgos ?? [])
			.map(valor)
			.filter(Boolean)
			.map((rasgo) => rasgo[0].toLocaleUpperCase('es-MX') + rasgo.slice(1));
		return {
			resultado: 'peludo',
			...(motivo && { motivo }),
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

	if (c.categoria === 'necesidad') {
		const vigencia = valor(c.vigencia);
		const fechaVigencia =
			vigencia && /^\d{4}-\d{2}-\d{2}$/.test(vigencia) && vigencia > hoy && numeroEnTexto(Number(vigencia.slice(8)), enPost)
				? vigencia
				: sumarDias(fechaEnMexico(post.publicadoEn), DIAS_VIGENCIA);
		if (fechaVigencia < hoy) return incompleto('fecha_pasada');

		// Nada inventado: alguna palabra de 4 letras o más de la descripción está en el post. Y nada de dinero.
		const textoNormalizado = normalizar(enPost);
		const escritas = (c.necesidades ?? []).filter(
			({ descripcion }) =>
				valor(descripcion) &&
				!DINERO.test(normalizar(descripcion)) &&
				normalizar(descripcion)
					.split(/[^a-z0-9ñ]+/)
					.some((palabra) => palabra.length >= 4 && textoNormalizado.includes(palabra)),
		);
		if (escritas.length === 0) return incompleto('sin_necesidades');

		const urgencia = /\b(urgente|urge|urgencia|emergencia)\b/.test(textoNormalizado) ? 'urgente' : 'necesaria';
		const vistas = new Set(registradas.map(({ tipo, descripcion }) => `${tipo}|${normalizar(descripcion)}`));
		const nuevas = [];
		for (const { tipo, descripcion, ya_registrada } of escritas) {
			const clave = `${tipo}|${normalizar(descripcion)}`;
			if (registradas.some(({ id }) => id === ya_registrada) || vistas.has(clave)) continue;
			vistas.add(clave);
			const texto = valor(descripcion);
			nuevas.push({
				tipo,
				descripcion: texto[0].toLocaleUpperCase('es-MX') + texto.slice(1),
				urgencia,
				fecha_vigencia: fechaVigencia,
			});
		}
		if (nuevas.length === 0) return { resultado: 'ignorado', motivo: 'ya_registradas' };
		return { resultado: 'necesidad', necesidades: nuevas.slice(0, MAXIMO_NECESIDADES) };
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
		const haria = datos.peludo ?? datos.campana ?? datos.necesidades ?? datos.adoptado ?? { motivo: datos.motivo };
		console.log(`  Haría: ${JSON.stringify(haria)}`);
		if (medidas) console.log(`  Fotos: ${medidas}`);
		if (decision.resultado === 'peludo' && fotos.length === 0) console.log('  Sin foto: el refugio la agrega.');
		// Para que otro post de esta ejecución no las repita.
		for (const [indice, necesidad] of (datos.necesidades ?? []).entries()) {
			registradas.push({ id: `simulada-${post.id}-${indice}`, ...necesidad });
		}
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
	// Peludo ya registrado: las fotos que no entraron a su borrador (o a uno ya publicado) sobran.
	const sobrantes = new Set(resultado.fotos_sin_usar ?? []);
	await borrar(subidas.filter(({ ruta }) => sobrantes.has(ruta)));
	// Para que otro post de esta ejecución no las repita.
	for (const [indice, id] of (resultado.necesidad_ids ?? []).entries()) {
		registradas.push({ id, ...datos.necesidades[indice] });
	}
	const creado = resultado.peludo_id ?? resultado.campana_id ?? resultado.necesidad_ids?.join(', ');
	const motivo = resultado.motivo ?? datos.motivo;
	console.log(`  Registrado: ${resultado.resultado}${creado ? ` → ${creado}` : ''}${motivo ? ` (${motivo})` : ''}`);
	return resultado.resultado;
}

// ─── Principal ───────────────────────────────────────────────────────────────────────────────────

async function yaRegistrados(ids) {
	if (!supabase || ids.length === 0) return new Set();
	const { data, error } = await supabase.from('publicaciones_facebook').select('post_id').in('post_id', ids);
	if (error) throw new Error(`No se pudo leer publicaciones_facebook: ${error.message}`);
	return new Set(data.map(({ post_id }) => post_id));
}

/** Necesidades reales ya registradas (borradores y publicadas), para no repetirlas (SPEC 16). */
async function necesidadesRegistradas() {
	if (!supabase) return [];
	const { data, error } = await supabase.from('necesidades').select('id, tipo, descripcion').eq('es_ejemplo', false);
	if (error) throw new Error(`No se pudieron leer las necesidades: ${error.message}`);
	return data;
}

/** ¿El texto parece de adopción? Filtro barato antes de gastar cuota de Gemini (--solo-adopcion). */
const ADOPCION = /\b(adop\w*|hogar|casa temporal|familia responsable|en busca de casa)\b/;
const pareceAdopcion = (post) => ADOPCION.test(normalizar(post.texto));

/** Lee Apify, descarga las fotos de los posts sin registrar y guarda todo en la carpeta (--guardar). */
async function guardar(posts, carpeta) {
	const registrados = await yaRegistrados(posts.map(({ id }) => id));
	await mkdir(path.join(carpeta, 'fotos'), { recursive: true });
	let fallidas = 0;
	for (const post of posts) {
		if (registrados.has(post.id)) continue;
		const locales = [];
		for (const [indice, url] of post.fotos.entries()) {
			const destino = path.join(carpeta, 'fotos', `${post.id.replace(/[^A-Za-z0-9_-]/g, '-')}-${indice + 1}.jpg`);
			try {
				await writeFile(destino, await descargar(url));
				locales.push(path.relative(carpeta, destino));
			} catch {
				fallidas++;
			}
		}
		post.fotos = locales;
	}
	await writeFile(path.join(carpeta, 'posts.json'), JSON.stringify(posts, null, '\t'));
	const pendientes = posts.filter(({ id }) => !registrados.has(id));
	console.log(
		`${posts.length} posts guardados en ${carpeta} (${registrados.size} ya registrados, ` +
			`${pendientes.filter(pareceAdopcion).length} de los pendientes parecen de adopción)` +
			`${fallidas ? `; ${fallidas} fotos no se pudieron descargar` : ''}.`,
	);
}

const conteo = {
	peludo: 0,
	campana: 0,
	necesidad: 0,
	adoptado: 0,
	ignorado: 0,
	incompleto: 0,
	duplicado: 0,
	saltado: 0,
	error: 0,
};

console.log(`Sincronización desde Facebook${simulacion ? ' (simulación: no se sube ni se escribe nada)' : ''}.`);
let posts;
try {
	posts = carpetaDesde
		? JSON.parse(await readFile(path.join(carpetaDesde, 'posts.json'), 'utf8'))
		: await leerPosts();
} catch (error) {
	console.error(`No se pudieron leer los posts: ${error.message}`);
	process.exit(1);
}
console.log(`${posts.length} posts leídos de ${carpetaDesde ?? 'Apify'}.`);
if (carpetaGuardar) {
	await guardar(posts, carpetaGuardar);
	process.exit(0);
}

const registrados = await yaRegistrados(posts.map(({ id }) => id));
const registradas = await necesidadesRegistradas();
for (const post of posts) {
	console.log(`\nPost ${post.id} · ${post.url}`);
	if (registrados.has(post.id)) {
		console.log('  Ya registrado.');
		conteo.duplicado++;
		continue;
	}
	if (soloAdopcion && !pareceAdopcion(post)) {
		console.log('  Saltado: no parece de adopción (queda sin registrar).');
		conteo.saltado++;
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
	`\nResumen: ${conteo.peludo} peludos, ${conteo.campana} campañas, ${conteo.necesidad} posts con necesidades, ` +
		`${conteo.adoptado} avisos de adopción, ` +
		`${conteo.ignorado} ignorados, ${conteo.incompleto} incompletos, ${conteo.duplicado} duplicados, ` +
		(conteo.saltado ? `${conteo.saltado} saltados, ` : '') +
		`${conteo.error} errores.`,
);
if (conteo.error > 0) process.exit(1);
