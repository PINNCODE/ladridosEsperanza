// Favicons del sitio y del panel (SPEC 11), generados desde el logo del refugio.
// Uso: node scripts/generar-favicons.mjs (otra vez cuando llegue el logo en resolución original).
// sharp ya viene con Astro; el .ico guarda un PNG de 32×32, que todos los navegadores actuales leen.
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const origen = 'supabase/semilla/imagenes/refugio/logo.jpg';

const png = (lado) => sharp(origen).resize(lado, lado, { fit: 'cover' }).png().toBuffer();

/** Contenedor ICO con una sola imagen PNG: cabecera de 6 bytes, entrada de 16 y los datos. */
function ico(datos, lado) {
	const cabecera = Buffer.alloc(6);
	cabecera.writeUInt16LE(0, 0); // reservado
	cabecera.writeUInt16LE(1, 2); // tipo: ícono
	cabecera.writeUInt16LE(1, 4); // una imagen

	const entrada = Buffer.alloc(16);
	entrada.writeUInt8(lado % 256, 0); // ancho (0 significa 256)
	entrada.writeUInt8(lado % 256, 1); // alto
	entrada.writeUInt8(0, 2); // sin paleta
	entrada.writeUInt8(0, 3); // reservado
	entrada.writeUInt16LE(1, 4); // planos de color
	entrada.writeUInt16LE(32, 6); // bits por pixel
	entrada.writeUInt32LE(datos.length, 8);
	entrada.writeUInt32LE(cabecera.length + entrada.length, 12);

	return Buffer.concat([cabecera, entrada, datos]);
}

await writeFile('public/favicon.ico', ico(await png(32), 32));
await writeFile('public/icono.png', await png(192));
await writeFile('public/apple-touch-icon.png', await png(180));

console.log('Listo: public/favicon.ico, public/icono.png y public/apple-touch-icon.png');
