// Sesión del panel /admin en el navegador (SPEC 07).
// Las páginas son estáticas: esto solo decide qué se muestra y a dónde redirigir.
// Lo que de verdad protege los datos son las políticas RLS, que exigen aal2 y el rol.
import { supabaseNavegador } from './supabaseNavegador';

export type Rol = 'administrador' | 'refugio';
export type Cuenta = { nombre: string; rol: Rol };

const nombresRol: Record<Rol, string> = { administrador: 'Administración', refugio: 'Refugio' };

/**
 * Revisa sesión, segundo paso (aal2) y rol. Sin sesión o sin aal2 redirige a /admin/entrar;
 * con `rol` y otra cuenta, a /admin. Devuelve null si redirigió y 'sin-rol' si la cuenta no tiene fila.
 */
export async function exigirSesion(rol?: Rol): Promise<Cuenta | null | 'sin-rol'> {
	const supabase = supabaseNavegador();

	const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
	if (nivel?.currentLevel !== 'aal2') {
		location.replace('/admin/entrar');
		return null;
	}

	const { data: cuenta } = await supabase.from('usuarios_panel').select('nombre, rol').maybeSingle<Cuenta>();
	if (!cuenta) return 'sin-rol';

	if (rol && cuenta.rol !== rol) {
		location.replace('/admin');
		return null;
	}

	return cuenta;
}

export async function salir(): Promise<void> {
	await supabaseNavegador().auth.signOut();
	location.replace('/admin/entrar');
}

/**
 * exigirSesion() más el armado de LayoutPanel: llena el encabezado, conecta "Salir" y muestra
 * el contenido, o el aviso de cuenta sin rol. Devuelve la cuenta solo si la página debe seguir.
 */
export async function prepararPanel(rol?: Rol): Promise<Cuenta | null> {
	const resultado = await exigirSesion(rol);
	if (resultado === null) return null;

	const salirBoton = document.querySelector<HTMLButtonElement>('[data-salir]')!;
	salirBoton.hidden = false;
	salirBoton.addEventListener('click', salir);
	document.querySelector<HTMLElement>('[data-cargando]')!.hidden = true;

	if (resultado === 'sin-rol') {
		document.querySelector<HTMLElement>('[data-sin-rol]')!.hidden = false;
		return null;
	}

	document.querySelector<HTMLElement>('[data-cuenta]')!.textContent =
		`${resultado.nombre} · ${nombresRol[resultado.rol]}`;
	document.querySelector<HTMLElement>('[data-navegacion]')!.hidden = false;
	if (resultado.rol === 'administrador') {
		for (const enlace of document.querySelectorAll<HTMLElement>('[data-solo-administrador]')) {
			enlace.hidden = false;
		}
	}
	document.querySelector<HTMLElement>('[data-panel]')!.hidden = false;
	return resultado;
}
