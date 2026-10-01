// Convierte los JSON de src/data/ y las imágenes de src/assets/ en la semilla de Supabase (SPEC 06).
// Se usa una sola vez: escribe supabase/seed.sql y copia las imágenes a supabase/semilla/imagenes/.
// Uso: node scripts/generar-semilla.mjs
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const datos = 'src/data';
const destinoImagenes = 'supabase/semilla/imagenes';

const leer = (archivo) => JSON.parse(readFileSync(join(datos, archivo), 'utf8'));

/** Literal SQL: null, número, booleano, texto o arreglo de texto. */
function v(valor) {
	if (valor === null || valor === undefined) return 'null';
	if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
	if (Array.isArray(valor)) return `array[${valor.map(v).join(', ')}]::text[]`;
	return `'${String(valor).replaceAll("'", "''")}'`;
}

const lineas = [
	'-- Semilla de Supabase (SPEC 06): los datos de ejemplo del sitio.',
	'-- Generada una vez desde los JSON de src/data/; desde entonces los datos de ejemplo se editan aquí.',
	'-- Se carga con `npx supabase db reset` en local y con `npx supabase db push --include-seed` en la nube.',
	'',
];

function insertar(tabla, filas) {
	if (filas.length === 0) return;
	const columnas = Object.keys(filas[0]);
	const identidad = 'id' in filas[0] && typeof filas[0].id === 'number' ? ' overriding system value' : '';
	lineas.push(`insert into ${tabla} (${columnas.join(', ')})${identidad} values`);
	lineas.push(filas.map((fila) => `\t(${columnas.map((c) => fila[c]?.sql ?? v(fila[c])).join(', ')})`).join(',\n') + ';');
	lineas.push('');
}

// Imágenes: "../assets/peludos/luna.jpg" → ruta "peludos/luna.jpg" en el bucket.
const imagenes = new Map();
async function imagen(rutaJson) {
	if (rutaJson === null) return null;
	const ruta = rutaJson.replace(/^\.\.\/assets\//, '');
	if (!imagenes.has(ruta)) {
		const origen = join('src/assets', ruta);
		const { width, height } = await sharp(origen).metadata();
		mkdirSync(dirname(join(destinoImagenes, ruta)), { recursive: true });
		copyFileSync(origen, join(destinoImagenes, ruta));
		imagenes.set(ruta, { ruta, ancho: width, alto: height });
	}
	return { sql: `(select id from imagenes where ruta = ${v(ruta)})` };
}

const refugio = leer('refugio.json');
const peludos = leer('peludos.json');
const campanas = leer('campanas.json');
const bloques = leer('bloques-contenido.json');
const negocios = readdirSync(join(datos, 'negocios'))
	.filter((archivo) => archivo.endsWith('.json'))
	.sort()
	.map((archivo) => ({ id: archivo.replace(/\.json$/, ''), ...leer(join('negocios', archivo)) }));

// Primero se leen todas las imágenes para insertarlas antes que los registros que las usan.
const filasRefugio = [];
for (const r of refugio) {
	filasRefugio.push({
		id: r.id, nombre: r.nombre, frase: r.frase, ubicacion: r.ubicacion, whatsapp: r.whatsapp,
		logo_id: await imagen(r.logo), foto_principal_id: await imagen(r.foto_principal), es_ejemplo: r.es_ejemplo,
	});
}
const filasFotos = [];
for (const p of peludos) {
	for (const [orden, foto] of p.fotos.entries()) {
		filasFotos.push({ peludo_id: p.id, imagen_id: await imagen(foto), orden: orden + 1 });
	}
}
const filasCampanas = [];
for (const c of campanas) {
	const { cartel, ...resto } = c;
	filasCampanas.push({ ...resto, cartel_id: await imagen(cartel) });
}
const filasImagenesBloque = [];
for (const b of bloques) {
	for (const [orden, img] of b.imagenes.entries()) {
		filasImagenesBloque.push({ bloque_id: b.id, imagen_id: await imagen(img), orden: orden + 1 });
	}
}
const filasLogos = new Map();
for (const n of negocios) filasLogos.set(n.id, await imagen(n.logo));

insertar('imagenes', [...imagenes.values()]);
insertar('refugio', filasRefugio);
insertar('redes', leer('redes.json'));
insertar('categorias', leer('categorias.json'));
insertar('bloques_contenido', bloques.map(({ imagenes: _, ...resto }) => resto));
insertar('imagenes_bloque', filasImagenesBloque);
insertar(
	'problematicas',
	leer('problematicas.json').map(({ enlace, ...resto }) => ({
		...resto,
		enlace_texto: enlace?.texto ?? null,
		enlace_url: enlace?.url ?? null,
		enlace_sensible: enlace?.sensible ?? null,
	})),
);
insertar('peludos', peludos.map(({ fotos: _, ...resto }) => resto));
insertar('fotos_peludo', filasFotos);
insertar('campanas', filasCampanas);
insertar('necesidades', leer('necesidades.json'));
insertar('destinos_donativo', leer('destinos-donativo.json'));

const registros = leer('registros-cifras.json');
insertar('registros_cifras', registros.map(({ gastos: _, ...resto }) => resto));
insertar(
	'gastos_registro',
	registros.flatMap((r) => r.gastos.map((g, i) => ({ registro_id: r.id, ...g, orden: i + 1 }))),
);
insertar('anuncios', leer('anuncios.json'));

insertar(
	'negocios',
	negocios.map((n) => ({
		id: n.id, nombre: n.nombre, categoria_id: n.categoria, descripcion_corta: n.descripcion_corta,
		logo_id: filasLogos.get(n.id), direccion: n.direccion, latitud: n.latitud, longitud: n.longitud,
		whatsapp: n.whatsapp, estado: n.estado, porcentaje_aporte: n.porcentaje_aporte, fecha_alta: n.fecha_alta,
		es_ejemplo: n.es_ejemplo,
	})),
);
insertar(
	'promociones',
	negocios.filter((n) => n.promocion).map((n) => ({ negocio_id: n.id, ...n.promocion })),
);

const dias = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const horarios = [];
const turnos = [];
for (const n of negocios) {
	for (const dia of dias) {
		const valor = n.horarios[dia];
		if (valor === undefined) continue;
		horarios.push({ negocio_id: n.id, dia, cerrado: valor === 'cerrado' });
		if (valor !== 'cerrado') {
			valor.forEach((t, i) => turnos.push({ negocio_id: n.id, dia, abre: t.abre, cierra: t.cierra, orden: i + 1 }));
		}
	}
}
insertar('horarios', horarios);
insertar('turnos', turnos);

// El menú se aplana con ids explícitos para enlazar cada nivel con su padre.
const grupos = [];
const secciones = [];
const platillos = [];
const precios = [];
for (const n of negocios) {
	for (const g of n.menu) {
		const grupoId = grupos.length + 1;
		grupos.push({ id: grupoId, negocio_id: n.id, nombre: g.nombre, orden: g.orden });
		for (const s of g.secciones) {
			const seccionId = secciones.length + 1;
			secciones.push({ id: seccionId, grupo_id: grupoId, nombre: s.nombre, nota: s.nota, orden: s.orden });
			s.platillos.forEach((p, i) => {
				const platilloId = platillos.length + 1;
				platillos.push({
					id: platilloId, seccion_id: seccionId, nombre: p.nombre, descripcion: p.descripcion,
					es_extra: p.es_extra, disponible: p.disponible, orden: i + 1,
				});
				p.precios.forEach((pr, j) =>
					precios.push({ id: precios.length + 1, platillo_id: platilloId, ...pr, orden: j + 1 }),
				);
			});
		}
	}
}
insertar('grupos_menu', grupos);
insertar('secciones_menu', secciones);
insertar('platillos', platillos);
insertar('precios', precios);

for (const tabla of ['turnos', 'grupos_menu', 'secciones_menu', 'platillos', 'precios']) {
	lineas.push(`select setval(pg_get_serial_sequence('${tabla}', 'id'), coalesce((select max(id) from ${tabla}), 1));`);
}

writeFileSync('supabase/seed.sql', lineas.join('\n') + '\n');
console.log(
	`seed.sql: ${negocios.length} negocios, ${platillos.length} platillos, ${precios.length} precios, ${imagenes.size} imágenes.`,
);
