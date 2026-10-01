// Cliente de Supabase para el build (SPEC 06). Solo lo importan los loaders de src/lib/cargadores.ts:
// usa la llave secreta, que se salta RLS, y nunca debe llegar al navegador.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function variable(nombre: string, valor: string | undefined): string {
	if (!valor) {
		throw new Error(
			`Falta la variable de entorno ${nombre}. ` +
				'En desarrollo, copia .env.example a .env y corre `npx supabase start`.',
		);
	}
	return valor;
}

export function urlSupabase(): string {
	return variable('SUPABASE_URL', import.meta.env.SUPABASE_URL).replace(/\/$/, '');
}

let cliente: SupabaseClient | undefined;

export function clienteSupabase(): SupabaseClient {
	cliente ??= createClient(urlSupabase(), variable('SUPABASE_SECRET_KEY', import.meta.env.SUPABASE_SECRET_KEY), {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	return cliente;
}
