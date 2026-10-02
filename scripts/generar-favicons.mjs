// Favicons del sitio y del panel (SPEC 11), generados desde el logo del refugio.
// Uso: node scripts/generar-favicons.mjs (otra vez si cambia el logo; después sube el ?v= de los enlaces en Layout y LayoutPanel).
// sharp ya viene con Astro; el .ico guarda PNG de 16, 32 y 48, que todos los navegadores actuales leen.
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const origen = 'referencias/logo-refugio.jpg';

const png = (lado) =>
	sharp(origen).resize(lado, lado, { fit: 'cover', kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();

/** Contenedor ICO con varias imágenes PNG: cabecera de 6 bytes, una entrada de 16 por imagen y los datos. */
function ico(imagenes) {
	const cabecera = Buffer.alloc(6);
	cabecera.writeUInt16LE(0, 0); // reservado
	cabecera.writeUInt16LE(1, 2); // tipo: ícono
	cabecera.writeUInt16LE(imagenes.length, 4);

	let desplazamiento = cabecera.length + 16 * imagenes.length;
	const entradas = imagenes.map(({ lado, datos }) => {
		const entrada = Buffer.alloc(16);
		entrada.writeUInt8(lado % 256, 0); // ancho (0 significa 256)
		entrada.writeUInt8(lado % 256, 1); // alto
		entrada.writeUInt8(0, 2); // sin paleta
		entrada.writeUInt8(0, 3); // reservado
		entrada.writeUInt16LE(1, 4); // planos de color
		entrada.writeUInt16LE(32, 6); // bits por pixel
		entrada.writeUInt32LE(datos.length, 8);
		entrada.writeUInt32LE(desplazamiento, 12);
		desplazamiento += datos.length;
		return entrada;
	});

	return Buffer.concat([cabecera, ...entradas, ...imagenes.map(({ datos }) => datos)]);
}

const ladosIco = [16, 32, 48];
await writeFile('public/favicon.ico', ico(await Promise.all(ladosIco.map(async (lado) => ({ lado, datos: await png(lado) })))));
await writeFile('public/icono.png', await png(192));
await writeFile('public/apple-touch-icon.png', await png(180));

console.log('Listo: public/favicon.ico, public/icono.png y public/apple-touch-icon.png');
