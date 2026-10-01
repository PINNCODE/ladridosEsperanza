// Cliente de Supabase para el navegador (SPEC 07): lo usan el formulario Súmate y el panel /admin.
// Usa la llave publicable; RLS decide qué se lee y qué se escribe. La llave secreta nunca llega aquí.
// La sesión del panel vive en localStorage, como hace supabase-js por defecto.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | undefined;

export function supabaseNavegador(): SupabaseClient {
	if (!cliente) {
		const url = import.meta.env.PUBLIC_SUPABASE_URL;
		const llave = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
		// astro.config.mjs ya detiene la compilación sin estas variables; esto cubre un uso fuera del build.
		if (!url) throw new Error('Falta la variable de entorno PUBLIC_SUPABASE_URL.');
		if (!llave) throw new Error('Falta la variable de entorno PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
		cliente = createClient(url, llave);
	}
	return cliente;
}
