// Carrusel con scroll-snap (SPEC 02 y SPEC 14): el deslizamiento con el dedo lo da el CSS;
// esto agrega flechas, puntos, teclado y avance automático. Lo usan CarruselPeludos y
// CarruselRefugio, cada uno sobre su propio `data-carrusel`. Sin imports de Astro.
//
// Dentro de `raiz`: `[data-pista]` (sus hijos son las diapositivas), `[data-anterior]`,
// `[data-siguiente]` y un `[data-punto]` por diapositiva.
export function iniciarCarrusel(raiz: HTMLElement) {
	const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const pista = raiz.querySelector<HTMLElement>('[data-pista]')!;
	const tarjetas = [...pista.children] as HTMLElement[];
	const puntos = [...raiz.querySelectorAll<HTMLButtonElement>('[data-punto]')];
	const ultimo = tarjetas.length - 1;

	const posicion = (indice: number) => tarjetas[indice].offsetLeft - tarjetas[0].offsetLeft;

	// Diapositiva actual. Al llegar al final se marca la última, aunque quepan dos a la vez.
	const actual = () => {
		if (pista.scrollLeft >= pista.scrollWidth - pista.clientWidth - 4) return ultimo;
		const paso = tarjetas.length > 1 ? posicion(1) : pista.clientWidth;
		return Math.min(ultimo, Math.round(pista.scrollLeft / paso));
	};

	const ir = (indice: number) => {
		const destino = Math.max(0, Math.min(ultimo, indice));
		pista.scrollTo({ left: posicion(destino), behavior: reducirMovimiento ? 'auto' : 'smooth' });
	};

	const marcar = () => {
		const indice = actual();
		puntos.forEach((punto, i) => {
			if (i === indice) punto.setAttribute('aria-current', 'true');
			else punto.removeAttribute('aria-current');
		});
	};

	let cuadro = 0;
	pista.addEventListener(
		'scroll',
		() => {
			cancelAnimationFrame(cuadro);
			cuadro = requestAnimationFrame(marcar);
		},
		{ passive: true },
	);

	raiz.querySelector('[data-anterior]')!.addEventListener('click', () => ir(actual() - 1));
	raiz.querySelector('[data-siguiente]')!.addEventListener('click', () => ir(actual() + 1));
	puntos.forEach((punto, i) => punto.addEventListener('click', () => ir(i)));

	pista.addEventListener('keydown', (evento) => {
		if (evento.key === 'ArrowRight') {
			evento.preventDefault();
			ir(actual() + 1);
		}
		if (evento.key === 'ArrowLeft') {
			evento.preventDefault();
			ir(actual() - 1);
		}
	});

	// Avance automático cada 5 s. No arranca con "reducir movimiento", no avanza con la
	// pestaña oculta ni con el carrusel fuera de pantalla, y se apaga para siempre en
	// esta visita al primer toque, rueda, tecla o foco dentro del carrusel.
	if (reducirMovimiento || tarjetas.length < 2) return;

	let enPantalla = false;
	new IntersectionObserver(([entrada]) => {
		enPantalla = entrada.isIntersecting;
	}).observe(raiz);

	const intervalo = setInterval(() => {
		if (document.hidden || !enPantalla) return;
		ir(actual() === ultimo ? 0 : actual() + 1);
	}, 5000);

	const apagar = () => {
		clearInterval(intervalo);
		for (const tipo of ['pointerdown', 'wheel', 'keydown', 'focusin']) {
			raiz.removeEventListener(tipo, apagar);
		}
	};
	for (const tipo of ['pointerdown', 'wheel', 'keydown', 'focusin']) {
		raiz.addEventListener(tipo, apagar, { passive: true });
	}
}
