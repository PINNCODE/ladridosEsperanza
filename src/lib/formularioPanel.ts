// Piezas comunes de los formularios y listas del panel /admin (SPEC 08).
// Sin imports de Astro: lo usan los <script> de las páginas.

/** Códigos que lanzan las funciones RPC y que la persona puede resolver. */
const mensajes: Record<string, string> = {
	campana_repetida: 'Ya hay una campaña ese día.',
	mes_repetido: 'Ese mes ya tiene registro. Edítalo desde la lista.',
	imagen_ilegible: 'No pudimos leer esta imagen. Prueba con una foto JPG o PNG.',
	categoria_en_uso: 'Esta categoría tiene negocios. Cámbialos de categoría antes de borrarla.',
	menu_cambiado: 'Alguien guardó este menú mientras lo editabas. Recarga la página para ver la versión nueva.',
};

/** Campos de 'datos_invalidos' (en `details`) que los formularios de negocio y de menú no alcanzan a revisar. */
const camposInvalidos: Record<string, string> = {
	ubicacion: 'Revisa la ubicación: pega la latitud y la longitud separadas por una coma.',
	whatsapp: 'Revisa el WhatsApp: deben ser 10 dígitos.',
	turnos: 'Revisa los horarios: cada turno necesita una hora de apertura y otra de cierre distintas.',
	fecha_fin: 'La promoción no puede terminar antes de empezar.',
	nombre: 'Revisa los nombres: cada grupo, sección y platillo necesita uno.',
	precios: 'Revisa los precios: cada platillo lleva de 1 a 4, con monto o texto alterno.',
	monto: 'Revisa los precios: el monto no puede ser negativo y lleva a lo más 2 decimales.',
};

/** Texto para un error de Supabase o del navegador: el de su código, o "No pudimos guardar…". */
export function mensajeError(error: unknown, accion: 'guardar' | 'borrar' | 'mover' = 'guardar'): string {
	const { message: codigo, details: campo } = (error ?? {}) as { message?: unknown; details?: unknown };
	return (
		(typeof codigo === 'string' && mensajes[codigo]) ||
		(codigo === 'datos_invalidos' && typeof campo === 'string' && camposInvalidos[campo]) ||
		`No pudimos ${accion}. Revisa tu conexión e intenta otra vez.`
	);
}

/** El `?id=` de la página `editar`; null es un registro nuevo. */
export function idDeLaUrl(): string | null {
	return new URLSearchParams(location.search).get('id');
}

/**
 * Pide confirmación al navegador antes de salir si el formulario cambió y no se guardó.
 * `limpiar()` se llama después de guardar, antes de regresar a la lista.
 */
export function vigilarCambios(formulario: HTMLFormElement): { marcar: () => void; limpiar: () => void } {
	let cambiado = false;
	const marcar = () => {
		cambiado = true;
	};
	formulario.addEventListener('input', marcar);
	formulario.addEventListener('change', marcar);
	addEventListener('beforeunload', (evento) => {
		if (cambiado) evento.preventDefault();
	});
	return {
		marcar,
		limpiar: () => {
			cambiado = false;
		},
	};
}

/** Desactiva el botón con "Guardando…" mientras dura `tarea`; devuelve lo que devuelva. */
export async function guardando<T>(boton: HTMLButtonElement, tarea: () => Promise<T>): Promise<T> {
	const texto = boton.textContent;
	boton.disabled = true;
	boton.textContent = 'Guardando…';
	try {
		return await tarea();
	} finally {
		boton.disabled = false;
		boton.textContent = texto;
	}
}

export function confirmarBorrado(nombre: string): boolean {
	return confirm(`¿Borrar ${nombre}? No se puede deshacer.`);
}

export const avisoSitio = 'Guardado. El sitio público se actualiza en cuanto termine de compilar.';

const claveAviso = 'panel:aviso';

/** Guarda el aviso que la lista muestra al volver y regresa a ella. */
export function volverALista(lista: string, aviso: string): void {
	try {
		sessionStorage.setItem(claveAviso, aviso);
	} catch {
		// Sin sessionStorage la lista abre sin aviso; lo guardado ya está en la base.
	}
	location.assign(lista);
}

/** Muestra (una sola vez) el aviso que dejó volverALista(). */
export function mostrarAviso(elemento: HTMLElement): void {
	try {
		const aviso = sessionStorage.getItem(claveAviso);
		sessionStorage.removeItem(claveAviso);
		if (aviso) elemento.textContent = aviso;
	} catch {
		// Sin sessionStorage no hay aviso.
	}
}

/** "2026-10-24" de hoy en Ciudad de México, para comparar con fechas de la base. */
export function hoyEnMexico(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

/** Campo de texto del formulario sin espacios a los lados; vacío es null. */
export function texto(datos: FormData, campo: string): string | null {
	const valor = String(datos.get(campo) ?? '').trim();
	return valor === '' ? null : valor;
}

type Opciones<R> = {
	/** Lista a la que se regresa al guardar, por ejemplo "/admin/necesidades". */
	lista: string;
	/** Títulos de la página para un registro nuevo y para uno existente. */
	titulos: { nuevo: string; editar: string };
	/** Lee el registro por su id; null si no existe. */
	cargar: (id: string) => PromiseLike<{ data: R | null; error: unknown }>;
	/** Pone los valores del registro en el formulario. */
	llenar: (registro: R, formulario: HTMLFormElement) => void;
	/** Guarda (lanza el error si falla) y devuelve el aviso que verá la lista. */
	guardar: (formulario: HTMLFormElement, id: string | null) => Promise<string>;
};

/**
 * Arma una página `editar` de FormularioPanel: título según `?id=`, carga y llenado del registro,
 * aviso de cambios sin guardar, validación del navegador, "Guardando…", error y regreso a la lista.
 * Devuelve el formulario y el vigilante de cambios, o null si no hay registro que editar.
 */
export async function iniciarFormulario<R>(opciones: Opciones<R>): Promise<{
	formulario: HTMLFormElement;
	cambios: ReturnType<typeof vigilarCambios>;
	id: string | null;
} | null> {
	const formulario = document.querySelector<HTMLFormElement>('[data-formulario]')!;
	const id = idDeLaUrl();
	const titulo = id ? opciones.titulos.editar : opciones.titulos.nuevo;
	document.querySelector('[data-titulo]')!.textContent = titulo;
	document.title = `${titulo} · Panel · Ladridos de Esperanza`;

	if (id) {
		const { data, error } = await opciones.cargar(id);
		if (error) {
			document.querySelector<HTMLElement>('[data-error-carga]')!.hidden = false;
			return null;
		}
		if (!data) {
			document.querySelector<HTMLElement>('[data-no-encontrado]')!.hidden = false;
			return null;
		}
		opciones.llenar(data, formulario);
	}

	formulario.hidden = false;
	const cambios = vigilarCambios(formulario);
	const boton = formulario.querySelector<HTMLButtonElement>('[data-guardar]')!;
	const errorGuardar = formulario.querySelector<HTMLElement>('[data-error-guardar]')!;

	formulario.addEventListener('submit', async (evento) => {
		evento.preventDefault();
		errorGuardar.textContent = '';
		if (!formulario.reportValidity()) return;
		await guardando(boton, async () => {
			try {
				const aviso = await opciones.guardar(formulario, id);
				cambios.limpiar();
				volverALista(opciones.lista, aviso);
			} catch (error) {
				errorGuardar.textContent = mensajeError(error);
			}
		});
	});

	return { formulario, cambios, id };
}
