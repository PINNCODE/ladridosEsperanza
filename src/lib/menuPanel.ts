// Editor de menús del panel (SPEC 10, RF-05 y RF-16). Conecta el árbol de /admin/negocios/menu y su
// DialogoMenu (src/components/admin/DialogoMenu.astro): grupos, secciones y platillos en memoria,
// con agregar, editar, subir, bajar, mover, duplicar, borrar, "Disponible" y el buscador.
// leer() arma lo que recibe la RPC guardar_menu; el orden es la posición en cada arreglo.
// Sin imports de Astro: lo usa el <script> de la página.

import { coincide, normalizar } from './busqueda';
import { formatearPrecio } from './formato';

export type Precio = { etiqueta: string | null; monto: number | null; texto_alterno: string | null };
export type Platillo = {
	nombre: string;
	descripcion: string | null;
	es_extra: boolean;
	disponible: boolean;
	precios: Precio[];
};
export type Seccion = { nombre: string; nota: string | null; platillos: Platillo[] };
export type Grupo = { nombre: string; secciones: Seccion[] };

/** Lo mismo que acepta guardar_menu. */
export const maximoPrecios = 4;

type Elemento =
	| { tipo: 'grupo'; objeto: Grupo; lista: Grupo[] }
	| { tipo: 'seccion'; objeto: Seccion; lista: Seccion[]; grupo: Grupo }
	| { tipo: 'platillo'; objeto: Platillo; lista: Platillo[]; seccion: Seccion };

/** Botón al que regresa el foco: el `data-accion` dentro de la fila de `objeto` (o del árbol). */
type Foco = { objeto: object | null; accion: string };

/** Control del editor de la página. */
export type EditorMenu = {
	/** Pone el menú que devolvió leer_menu. */
	cargar: (grupos: Grupo[]) => void;
	/** El menú para guardar_menu. */
	leer: () => Grupo[];
};

const titulos = {
	grupo: { nuevo: 'Nuevo grupo', editar: 'Editar grupo' },
	seccion: { nuevo: 'Nueva sección', editar: 'Editar sección' },
	platillo: { nuevo: 'Nuevo platillo', editar: 'Editar platillo' },
};

const sinMonto = 'Escribe un monto o un texto alterno, por ejemplo "Incluido".';

/** 1 → "su sección"; 4 → "sus 4 secciones". */
function sus(cantidad: number, singular: string, plural: string): string {
	return cantidad === 1 ? `su ${singular}` : `sus ${cantidad} ${plural}`;
}

/** Cambia de lugar el elemento `indice` con su vecino de arriba (-1) o de abajo (1). */
function intercambiar<T>(lista: T[], indice: number, direccion: -1 | 1): void {
	const destino = indice + direccion;
	if (destino < 0 || destino >= lista.length) return;
	[lista[indice], lista[destino]] = [lista[destino], lista[indice]];
}

/** Campo de texto sin espacios a los lados; vacío es null. */
function opcional(valor: string): string | null {
	const limpio = valor.trim();
	return limpio === '' ? null : limpio;
}

/**
 * Conecta el árbol (`raiz`, con sus plantillas) y el diálogo. `alCambiar` se llama con cada cambio
 * al menú, para el aviso de cambios sin guardar.
 */
export function editorMenu(raiz: HTMLElement, dialogo: HTMLDialogElement, alCambiar: () => void): EditorMenu {
	const plantilla = (nombre: string) =>
		raiz.querySelector<HTMLTemplateElement>(`[data-plantilla-${nombre}]`)!.content.firstElementChild!;
	const clonar = (nombre: string) => plantilla(nombre).cloneNode(true) as HTMLElement;

	const listaGrupos = raiz.querySelector<HTMLElement>('[data-grupos]')!;
	const vacio = raiz.querySelector<HTMLElement>('[data-menu-vacio]')!;
	const buscador = raiz.querySelector<HTMLInputElement>('[data-buscador]')!;
	const sinResultados = raiz.querySelector<HTMLElement>('[data-sin-resultados]')!;

	let grupos: Grupo[] = [];
	/** Grupos y secciones que la persona plegó; los demás se ven abiertos. */
	const cerrados = new WeakSet<object>();
	/** Fila dibujada de cada grupo, sección y platillo, y lo que representa. */
	const filas = new Map<object, HTMLElement>();
	const elementos = new WeakMap<HTMLElement, Elemento>();

	const buscando = () => normalizar(buscador.value) !== '';

	// ---------- Árbol ----------

	/** Nombre para lectores de pantalla y estado de Subir, Bajar y Editar de una fila. */
	function prepararAcciones(fila: HTMLElement, nombre: string, indice: number, total: number) {
		const acciones = fila.querySelector<HTMLElement>(':scope > [data-acciones]')!;
		const subir = acciones.querySelector<HTMLButtonElement>('[data-accion="subir"]')!;
		const bajar = acciones.querySelector<HTMLButtonElement>('[data-accion="bajar"]')!;
		subir.setAttribute('aria-label', `Subir ${nombre}`);
		bajar.setAttribute('aria-label', `Bajar ${nombre}`);
		acciones.querySelector('[data-accion="editar"]')!.setAttribute('aria-label', `Editar ${nombre}`);
		// Con el buscador activo no se mueve nada: los vecinos pueden estar ocultos.
		subir.disabled = buscando() || indice === 0;
		bajar.disabled = buscando() || indice === total - 1;
	}

	/** `<details>` que recuerda si la persona lo plegó (mientras no se busca). */
	function prepararPlegable(fila: HTMLElement, objeto: object) {
		const detalles = fila.querySelector<HTMLDetailsElement>(':scope > details')!;
		detalles.open = buscando() || !cerrados.has(objeto);
		detalles.addEventListener('toggle', () => {
			if (buscando()) return;
			if (detalles.open) cerrados.delete(objeto);
			else cerrados.add(objeto);
		});
	}

	function registrar(fila: HTMLElement, elemento: Elemento) {
		filas.set(elemento.objeto, fila);
		elementos.set(fila, elemento);
	}

	function filaPlatillo(seccion: Seccion, platillo: Platillo, indice: number): HTMLElement {
		const fila = clonar('platillo');
		registrar(fila, { tipo: 'platillo', objeto: platillo, lista: seccion.platillos, seccion });
		fila.querySelector('[data-nombre]')!.textContent = platillo.nombre;
		fila.querySelector('[data-precios]')!.textContent = platillo.precios
			.map((precio) => formatearPrecio(precio, platillo.es_extra))
			.join(' · ');
		fila.querySelector<HTMLElement>('[data-extra]')!.hidden = !platillo.es_extra;
		const disponible = fila.querySelector<HTMLInputElement>('[data-accion="disponible"]')!;
		disponible.checked = platillo.disponible;
		disponible.setAttribute('aria-label', `${platillo.nombre} disponible`);
		pintarDisponible(fila, platillo);
		prepararAcciones(fila, platillo.nombre, indice, seccion.platillos.length);
		return fila;
	}

	function pintarDisponible(fila: HTMLElement, platillo: Platillo) {
		fila.querySelector<HTMLElement>('[data-contenido]')!.classList.toggle('opacity-50', !platillo.disponible);
	}

	function filaSeccion(grupo: Grupo, seccion: Seccion, indice: number): HTMLElement {
		const fila = clonar('seccion');
		registrar(fila, { tipo: 'seccion', objeto: seccion, lista: grupo.secciones, grupo });
		fila.querySelector('[data-nombre]')!.textContent = seccion.nombre;
		fila.querySelector('[data-nota]')!.textContent = seccion.nota ?? '';
		fila.querySelector('[data-accion="agregar-platillo"]')!.setAttribute(
			'aria-label',
			`Agregar platillo a ${seccion.nombre}`,
		);
		fila
			.querySelector('[data-platillos]')!
			.replaceChildren(...seccion.platillos.map((platillo, i) => filaPlatillo(seccion, platillo, i)));
		prepararAcciones(fila, seccion.nombre, indice, grupo.secciones.length);
		prepararPlegable(fila, seccion);
		return fila;
	}

	function filaGrupo(grupo: Grupo, indice: number): HTMLElement {
		const fila = clonar('grupo');
		registrar(fila, { tipo: 'grupo', objeto: grupo, lista: grupos });
		fila.querySelector('[data-nombre]')!.textContent = grupo.nombre;
		fila.querySelector('[data-accion="agregar-seccion"]')!.setAttribute(
			'aria-label',
			`Agregar sección a ${grupo.nombre}`,
		);
		fila
			.querySelector('[data-secciones]')!
			.replaceChildren(...grupo.secciones.map((seccion, i) => filaSeccion(grupo, seccion, i)));
		prepararAcciones(fila, grupo.nombre, indice, grupos.length);
		prepararPlegable(fila, grupo);
		return fila;
	}

	/** Vuelve a dibujar todo el árbol y, si se pide, regresa el foco a un botón. */
	function dibujar(foco?: Foco) {
		filas.clear();
		listaGrupos.replaceChildren(...grupos.map(filaGrupo));
		vacio.hidden = grupos.length > 0;
		filtrar();
		if (foco) enfocar(foco);
	}

	function enfocar({ objeto, accion }: Foco) {
		const contenedor = objeto ? filas.get(objeto) : raiz;
		if (!contenedor) return;
		const destino =
			contenedor.querySelector<HTMLButtonElement>(`[data-accion="${accion}"]:not(:disabled)`) ??
			contenedor.querySelector<HTMLButtonElement>('[data-accion="editar"]');
		destino?.focus();
	}

	// ---------- Buscador ----------

	/** Deja visibles solo los platillos que coinciden, con sus grupos y secciones abiertos. */
	function filtrar() {
		const consulta = buscador.value;
		const activo = buscando();
		let visibles = 0;
		for (const grupo of grupos) {
			let enGrupo = 0;
			for (const seccion of grupo.secciones) {
				let enSeccion = 0;
				for (const platillo of seccion.platillos) {
					const coincidente =
						!activo || coincide(normalizar(`${platillo.nombre} ${platillo.descripcion ?? ''}`), consulta);
					filas.get(platillo)!.hidden = !coincidente;
					if (coincidente) enSeccion++;
				}
				filas.get(seccion)!.hidden = activo && enSeccion === 0;
				enGrupo += enSeccion;
			}
			filas.get(grupo)!.hidden = activo && enGrupo === 0;
			visibles += enGrupo;
		}
		// Lo que se agrega mientras se busca podría no coincidir y quedar oculto.
		for (const agregar of raiz.querySelectorAll<HTMLElement>('[data-accion^="agregar-"]')) agregar.hidden = activo;
		sinResultados.textContent =
			activo && visibles === 0 ? `Ningún platillo coincide con «${consulta.trim()}».` : '';
	}

	// El buscador no es parte del menú: no marca cambios ni envía el formulario.
	for (const tipo of ['input', 'change']) buscador.addEventListener(tipo, (evento) => evento.stopPropagation());
	buscador.addEventListener('keydown', (evento) => {
		if (evento.key === 'Enter') evento.preventDefault();
	});
	buscador.addEventListener('input', () => dibujar());

	// ---------- Acciones del árbol ----------

	raiz.addEventListener('click', (evento) => {
		const boton = (evento.target as Element).closest<HTMLButtonElement>('button[data-accion]');
		if (!boton || !raiz.contains(boton)) return;
		const accion = boton.dataset.accion!;

		if (accion === 'agregar-grupo') {
			const grupo: Grupo = { nombre: '', secciones: [] };
			grupos.push(grupo);
			dibujar();
			abrir({ tipo: 'grupo', objeto: grupo, lista: grupos }, true, { objeto: null, accion });
			return;
		}

		const elemento = elementos.get(boton.closest<HTMLElement>('[data-elemento]')!)!;
		if (accion === 'subir' || accion === 'bajar') {
			intercambiar(elemento.lista as object[], (elemento.lista as object[]).indexOf(elemento.objeto), accion === 'subir' ? -1 : 1);
			alCambiar();
			dibujar({ objeto: elemento.objeto, accion });
		} else if (accion === 'editar') {
			abrir(elemento, false, { objeto: elemento.objeto, accion: 'editar' });
		} else if (accion === 'agregar-seccion' && elemento.tipo === 'grupo') {
			const seccion: Seccion = { nombre: '', nota: null, platillos: [] };
			elemento.objeto.secciones.push(seccion);
			dibujar();
			abrir({ tipo: 'seccion', objeto: seccion, lista: elemento.objeto.secciones, grupo: elemento.objeto }, true, {
				objeto: elemento.objeto,
				accion,
			});
		} else if (accion === 'agregar-platillo' && elemento.tipo === 'seccion') {
			const platillo: Platillo = {
				nombre: '',
				descripcion: null,
				es_extra: false,
				disponible: true,
				precios: [{ etiqueta: null, monto: null, texto_alterno: null }],
			};
			elemento.objeto.platillos.push(platillo);
			dibujar();
			abrir({ tipo: 'platillo', objeto: platillo, lista: elemento.objeto.platillos, seccion: elemento.objeto }, true, {
				objeto: elemento.objeto,
				accion,
			});
		}
	});

	raiz.addEventListener('change', (evento) => {
		const casilla = evento.target as HTMLInputElement;
		if (casilla.dataset.accion !== 'disponible') return;
		const fila = casilla.closest<HTMLElement>('[data-elemento]')!;
		const elemento = elementos.get(fila)!;
		if (elemento.tipo !== 'platillo') return;
		elemento.objeto.disponible = casilla.checked;
		pintarDisponible(fila, elemento.objeto);
		alCambiar();
	});

	// ---------- Diálogo ----------

	const formulario = dialogo.querySelector<HTMLFormElement>('[data-dialogo-formulario]')!;
	const campo = (nombre: string) => formulario.elements.namedItem(nombre) as HTMLInputElement;
	const listaPrecios = dialogo.querySelector<HTMLOListElement>('[data-precios]')!;
	const agregarPrecio = dialogo.querySelector<HTMLButtonElement>('[data-agregar-precio]')!;
	const plantillaPrecio = dialogo.querySelector<HTMLTemplateElement>('[data-plantilla-precio]')!;
	const selectorSeccion = campo('seccion') as unknown as HTMLSelectElement;

	/** Lo que edita el diálogo abierto; null si está cerrado o ya se resolvió. */
	let abierto: { elemento: Elemento; nuevo: boolean; foco: Foco } | null = null;
	/** Secciones del `<select>` "Sección", en el orden de sus opciones. */
	let destinos: { grupo: Grupo; seccion: Seccion }[] = [];

	/** Muestra solo los campos del tipo; los ocultos se desactivan y no se validan. */
	function mostrarCampos(tipo: Elemento['tipo']) {
		for (const parte of dialogo.querySelectorAll<HTMLElement>('[data-solo]')) {
			const visible = parte.dataset.solo === tipo;
			parte.hidden = !visible;
			for (const control of parte.querySelectorAll<HTMLInputElement>('input, textarea, select')) {
				control.disabled = !visible;
			}
		}
	}

	function filasPrecio(): HTMLElement[] {
		return [...listaPrecios.children] as HTMLElement[];
	}

	function leerPrecios(): Precio[] {
		return filasPrecio().map((fila) => {
			const monto = fila.querySelector<HTMLInputElement>('[data-monto]')!.value;
			return {
				etiqueta: opcional(fila.querySelector<HTMLInputElement>('[data-etiqueta]')!.value),
				monto: monto === '' ? null : Number(monto),
				texto_alterno: opcional(fila.querySelector<HTMLInputElement>('[data-texto-alterno]')!.value),
			};
		});
	}

	/** Sin monto ni texto alterno, el monto queda marcado y "Listo" no cierra. */
	function revisarPrecio(fila: HTMLElement) {
		const monto = fila.querySelector<HTMLInputElement>('[data-monto]')!;
		const alterno = fila.querySelector<HTMLInputElement>('[data-texto-alterno]')!;
		monto.setCustomValidity(monto.value === '' && alterno.value.trim() === '' && !monto.validity.badInput ? sinMonto : '');
	}

	function dibujarPrecios(precios: Precio[], foco?: { indice: number; boton: string }) {
		listaPrecios.replaceChildren(
			...precios.map((precio, indice) => {
				const fila = plantillaPrecio.content.firstElementChild!.cloneNode(true) as HTMLElement;
				const numero = indice + 1;
				fila.querySelector('[data-leyenda]')!.textContent = `Precio ${numero}`;
				fila.querySelector<HTMLInputElement>('[data-etiqueta]')!.value = precio.etiqueta ?? '';
				fila.querySelector<HTMLInputElement>('[data-monto]')!.value = precio.monto === null ? '' : String(precio.monto);
				fila.querySelector<HTMLInputElement>('[data-texto-alterno]')!.value = precio.texto_alterno ?? '';
				const subir = fila.querySelector<HTMLButtonElement>('[data-precio="subir"]')!;
				const bajar = fila.querySelector<HTMLButtonElement>('[data-precio="bajar"]')!;
				const quitar = fila.querySelector<HTMLButtonElement>('[data-precio="quitar"]')!;
				subir.setAttribute('aria-label', `Subir precio ${numero}`);
				bajar.setAttribute('aria-label', `Bajar precio ${numero}`);
				quitar.setAttribute('aria-label', `Quitar precio ${numero}`);
				subir.disabled = indice === 0;
				bajar.disabled = indice === precios.length - 1;
				quitar.disabled = precios.length === 1;
				revisarPrecio(fila);
				return fila;
			}),
		);
		agregarPrecio.disabled = precios.length >= maximoPrecios;
		if (foco) {
			const fila = filasPrecio()[foco.indice];
			(
				fila?.querySelector<HTMLButtonElement>(`[data-precio="${foco.boton}"]:not(:disabled)`) ??
				fila?.querySelector<HTMLInputElement>('[data-monto]')
			)?.focus();
		}
	}

	listaPrecios.addEventListener('input', (evento) => {
		revisarPrecio((evento.target as Element).closest<HTMLElement>('li')!);
	});

	listaPrecios.addEventListener('click', (evento) => {
		const boton = (evento.target as Element).closest<HTMLButtonElement>('button[data-precio]');
		if (!boton) return;
		const indice = filasPrecio().indexOf(boton.closest('li')!);
		const precios = leerPrecios();
		const accion = boton.dataset.precio;
		if (accion === 'quitar') {
			precios.splice(indice, 1);
			dibujarPrecios(precios, { indice: Math.min(indice, precios.length - 1), boton: 'quitar' });
		} else {
			const direccion = accion === 'subir' ? -1 : 1;
			intercambiar(precios, indice, direccion);
			dibujarPrecios(precios, { indice: indice + direccion, boton: accion! });
		}
	});

	agregarPrecio.addEventListener('click', () => {
		const precios = [...leerPrecios(), { etiqueta: null, monto: null, texto_alterno: null }];
		dibujarPrecios(precios, { indice: precios.length - 1, boton: '' });
	});

	function abrir(elemento: Elemento, nuevo: boolean, foco: Foco) {
		abierto = { elemento, nuevo, foco };
		dialogo.querySelector('[data-dialogo-titulo]')!.textContent = titulos[elemento.tipo][nuevo ? 'nuevo' : 'editar'];
		mostrarCampos(elemento.tipo);
		campo('nombre').value = elemento.objeto.nombre;

		if (elemento.tipo === 'seccion') campo('nota').value = elemento.objeto.nota ?? '';
		if (elemento.tipo === 'platillo') {
			const platillo = elemento.objeto;
			(campo('descripcion') as unknown as HTMLTextAreaElement).value = platillo.descripcion ?? '';
			campo('es_extra').checked = platillo.es_extra;
			campo('disponible').checked = platillo.disponible;
			dibujarPrecios(platillo.precios);

			destinos = grupos.flatMap((grupo) => grupo.secciones.map((seccion) => ({ grupo, seccion })));
			selectorSeccion.replaceChildren(
				...destinos.map(({ grupo, seccion }, indice) => {
					const opcion = new Option(`${grupo.nombre} › ${seccion.nombre}`, String(indice));
					opcion.selected = seccion === elemento.seccion;
					return opcion;
				}),
			);
		}
		dialogo.showModal();
	}

	/** Pasa lo escrito en el diálogo al árbol en memoria. */
	function aplicar(elemento: Elemento) {
		elemento.objeto.nombre = campo('nombre').value.trim();
		if (elemento.tipo === 'seccion') elemento.objeto.nota = opcional(campo('nota').value);
		if (elemento.tipo === 'platillo') {
			const platillo = elemento.objeto;
			platillo.descripcion = opcional((campo('descripcion') as unknown as HTMLTextAreaElement).value);
			platillo.es_extra = campo('es_extra').checked;
			platillo.disponible = campo('disponible').checked;
			platillo.precios = leerPrecios();

			const destino = destinos[Number(selectorSeccion.value)]?.seccion;
			if (destino && destino !== elemento.seccion) {
				elemento.lista.splice(elemento.lista.indexOf(platillo), 1);
				destino.platillos.push(platillo);
				elemento.lista = destino.platillos;
				elemento.seccion = destino;
			}
		}
	}

	/** Cierra el diálogo ya resuelto (sin pasar por la cancelación de "close"). */
	function cerrar() {
		abierto = null;
		dialogo.close();
	}

	function quitar(elemento: Elemento) {
		(elemento.lista as object[]).splice((elemento.lista as object[]).indexOf(elemento.objeto), 1);
	}

	/** Botón "Agregar…" del contenedor del elemento, para dejar el foco tras borrarlo. */
	function focoDelPadre(elemento: Elemento): Foco {
		if (elemento.tipo === 'grupo') return { objeto: null, accion: 'agregar-grupo' };
		if (elemento.tipo === 'seccion') return { objeto: elemento.grupo, accion: 'agregar-seccion' };
		return { objeto: elemento.seccion, accion: 'agregar-platillo' };
	}

	// "Listo": la validación del navegador ya pasó (nombre y precios); se aplica sin enviar nada.
	formulario.addEventListener('submit', (evento) => {
		evento.preventDefault();
		if (!abierto) return;
		const { elemento } = abierto;
		aplicar(elemento);
		cerrar();
		alCambiar();
		dibujar({ objeto: elemento.objeto, accion: 'editar' });
	});

	dialogo.querySelector('[data-cancelar]')!.addEventListener('click', () => dialogo.close());

	// Cancelar, Esc o cerrar sin "Listo": se descartan los cambios y un elemento recién agregado se quita.
	dialogo.addEventListener('close', () => {
		if (!abierto) return;
		const { elemento, nuevo, foco } = abierto;
		abierto = null;
		if (nuevo) {
			quitar(elemento);
			dibujar(foco);
		} else {
			enfocar(foco);
		}
	});

	dialogo.querySelector('[data-borrar-elemento]')!.addEventListener('click', () => {
		if (!abierto) return;
		const { elemento, nuevo } = abierto;
		if (elemento.tipo === 'grupo' && elemento.objeto.secciones.length > 0) {
			const secciones = elemento.objeto.secciones.length;
			const platillos = elemento.objeto.secciones.reduce((suma, { platillos }) => suma + platillos.length, 0);
			const detalle =
				sus(secciones, 'sección', 'secciones') +
				(platillos ? ` y ${platillos === 1 ? 'un platillo' : `${platillos} platillos`}` : '');
			if (!confirm(`¿Borrar ${elemento.objeto.nombre} con ${detalle}?`)) return;
		}
		if (elemento.tipo === 'seccion' && elemento.objeto.platillos.length > 0) {
			if (!confirm(`¿Borrar ${elemento.objeto.nombre} con ${sus(elemento.objeto.platillos.length, 'platillo', 'platillos')}?`)) {
				return;
			}
		}
		quitar(elemento);
		cerrar();
		if (!nuevo) alCambiar();
		dibujar(focoDelPadre(elemento));
	});

	dialogo.querySelector('[data-duplicar]')!.addEventListener('click', () => {
		if (!abierto || abierto.elemento.tipo !== 'platillo' || !formulario.reportValidity()) return;
		const { elemento } = abierto;
		aplicar(elemento);
		const copia = structuredClone(elemento.objeto);
		elemento.lista.splice(elemento.lista.indexOf(elemento.objeto) + 1, 0, copia);
		cerrar();
		alCambiar();
		dibujar();
		// "close" llega después (en otra tarea): el diálogo de la copia se abre cuando ya pasó.
		dialogo.addEventListener('close', () => abrir({ ...elemento, objeto: copia }, true, { objeto: elemento.objeto, accion: 'editar' }), {
			once: true,
		});
	});

	return {
		cargar: (menu) => {
			grupos = menu;
			dibujar();
		},
		leer: () => grupos,
	};
}
