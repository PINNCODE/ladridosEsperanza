// Fotos reales del refugio (SPEC 14). Viven en src/assets/refugio/ y Astro las optimiza al compilar;
// no son datos de ejemplo, así que se ven con y sin PUBLIC_MOSTRAR_EJEMPLOS.
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import cachorrosEnLaCasita from '../assets/refugio/cachorros-en-la-casita.jpg';
import gataBlancoYNegro from '../assets/refugio/gata-blanco-y-negro.jpg';
import gataConSuCamada from '../assets/refugio/gata-con-su-camada.jpg';
import gataEnSuCasita from '../assets/refugio/gata-en-su-casita.jpg';
import gatitoNegro from '../assets/refugio/gatito-negro.jpg';
import gatitoRecienNacido from '../assets/refugio/gatito-recien-nacido.jpg';
import gatitosEnLaCaja from '../assets/refugio/gatitos-en-la-caja.jpg';
import gatitosEnLaCama from '../assets/refugio/gatitos-en-la-cama.jpg';
import gatoAtigradoSentado from '../assets/refugio/gato-atigrado-sentado.jpg';
import gatosComiendo from '../assets/refugio/gatos-comiendo.jpg';
import perraCanelaSentada from '../assets/refugio/perra-canela-sentada.jpg';
import perroNegroEchado from '../assets/refugio/perro-negro-echado.jpg';
import perroNegroEnLaMano from '../assets/refugio/perro-negro-en-la-mano.jpg';
import perroNegroJuntoALasCasitas from '../assets/refugio/perro-negro-junto-a-las-casitas.jpg';
import perroPeludoSonriendo from '../assets/refugio/perro-peludo-sonriendo.jpg';
import perroTricolorEnElPasillo from '../assets/refugio/perro-tricolor-en-el-pasillo.jpg';
import perrosEnElPatio from '../assets/refugio/perros-en-el-patio.jpg';
import perrosEnLaBarda from '../assets/refugio/perros-en-la-barda.jpg';
import perrosRodeandoLaCamara from '../assets/refugio/perros-rodeando-la-camara.jpg';

export interface FotoRefugio {
	src: ImageMetadata;
	alt: string;
	/** `object-position` cuando la foto se recorta: "50% 40%". */
	enfoque: string;
}

export const fotosRefugio = {
	perrosEnLaBarda: {
		src: perrosEnLaBarda,
		alt: 'Tres perros del refugio asomados a la barda, con más perros en el patio detrás',
		enfoque: '50% 50%',
	},
	gataEnSuCasita: {
		src: gataEnSuCasita,
		alt: 'Gata atigrada de ojos verdes asomada en su casita de madera',
		enfoque: '50% 50%',
	},
	perrosEnElPatio: {
		src: perrosEnElPatio,
		alt: 'Grupo de perros del refugio mirando a la cámara en el patio',
		enfoque: '50% 50%',
	},
	gatitosEnLaCaja: {
		src: gatitosEnLaCaja,
		alt: 'Tres gatitos atigrados juntos sobre una caja rascadora',
		enfoque: '50% 50%',
	},
	perroNegroEnLaMano: {
		src: perroNegroEnLaMano,
		alt: 'Perro negro recargando el hocico en la mano de una persona',
		enfoque: '50% 55%',
	},
	gataConSuCamada: {
		src: gataConSuCamada,
		alt: 'Gata siamés sentada en una tina junto a su camada de diez gatitos recién nacidos',
		enfoque: '50% 15%',
	},
	perrosRodeandoLaCamara: {
		src: perrosRodeandoLaCamara,
		alt: 'Decenas de perros del refugio rodeando a quien toma la foto en el patio',
		enfoque: '50% 50%',
	},
	gatitoNegro: {
		src: gatitoNegro,
		alt: 'Gatito negro cargado con una mano',
		enfoque: '50% 50%',
	},
	gatosComiendo: {
		src: gatosComiendo,
		alt: 'Gatos del refugio comiendo de sus platos en el cuarto de los gatos',
		enfoque: '50% 65%',
	},
	// De los posts de Facebook del refugio (agosto a octubre de 2026): solo animales, sin carteles ni personas.
	perroPeludoSonriendo: {
		src: perroPeludoSonriendo,
		alt: 'Perro de pelo largo color miel echado junto a su casita de madera, sonriendo',
		enfoque: '50% 55%',
	},
	gatitosEnLaCama: {
		src: gatitosEnLaCama,
		alt: 'Cuatro gatitos claros de ojos azules acurrucados en una cama gris',
		enfoque: '50% 50%',
	},
	perroTricolorEnElPasillo: {
		src: perroTricolorEnElPasillo,
		alt: 'Perro tricolor parado en el pasillo del refugio, con otros perros detrás',
		enfoque: '50% 50%',
	},
	gatoAtigradoSentado: {
		src: gatoAtigradoSentado,
		alt: 'Gato atigrado sentado en el piso del cuarto de los gatos',
		enfoque: '50% 75%',
	},
	perroNegroJuntoALasCasitas: {
		src: perroNegroJuntoALasCasitas,
		alt: 'Perro negro de pelo rizado con la lengua de fuera frente a las casitas del patio',
		enfoque: '50% 55%',
	},
	gataBlancoYNegro: {
		src: gataBlancoYNegro,
		alt: 'Gata blanco y negro mirando a la cámara',
		enfoque: '50% 40%',
	},
	perraCanelaSentada: {
		src: perraCanelaSentada,
		alt: 'Perra color canela sentada sobre una cobija',
		enfoque: '50% 45%',
	},
	cachorrosEnLaCasita: {
		src: cachorrosEnLaCasita,
		alt: 'Una camada de cachorros amontonados dentro de una casita de plástico verde',
		enfoque: '50% 60%',
	},
	gatitoRecienNacido: {
		src: gatitoRecienNacido,
		alt: 'Gatito recién nacido dormido en la palma de una mano',
		enfoque: '50% 50%',
	},
	perroNegroEchado: {
		src: perroNegroEchado,
		alt: 'Perro negro con el pecho blanco echado en su casita de madera',
		enfoque: '50% 55%',
	},
} satisfies Record<string, FotoRefugio>;

/** Orden del carrusel de la portada: alterna perros y gatos, abre con la barda. */
export const fotosPortada: FotoRefugio[] = [
	fotosRefugio.perrosEnLaBarda,
	fotosRefugio.gataEnSuCasita,
	fotosRefugio.perrosEnElPatio,
	fotosRefugio.gatitosEnLaCaja,
	fotosRefugio.perroNegroEnLaMano,
	fotosRefugio.gataConSuCamada,
	fotosRefugio.perrosRodeandoLaCamara,
	fotosRefugio.gatitoNegro,
	fotosRefugio.perroPeludoSonriendo,
	fotosRefugio.gatitosEnLaCama,
	fotosRefugio.perroTricolorEnElPasillo,
	fotosRefugio.gatoAtigradoSentado,
	fotosRefugio.perroNegroJuntoALasCasitas,
	fotosRefugio.gataBlancoYNegro,
	fotosRefugio.perraCanelaSentada,
	fotosRefugio.gatosComiendo,
	fotosRefugio.cachorrosEnLaCasita,
	fotosRefugio.gatitoRecienNacido,
	fotosRefugio.perroNegroEchado,
];

/** Imagen para compartir y para el JSON-LD: la barda en 1200 × 630, JPEG, con URL absoluta. */
export async function imagenCompartir(sitio: URL) {
	const imagen = await getImage({
		src: fotosRefugio.perrosEnLaBarda.src,
		width: 1200,
		height: 630,
		fit: 'cover',
		position: 'center',
		format: 'jpg',
	});
	return { url: new URL(imagen.src, sitio).href, ancho: 1200, alto: 630 };
}
