// Cuentas de prueba del panel /admin (SPEC 07), solo para Supabase local.
// Uso: node scripts/crear-cuentas-prueba.mjs (después de `npx supabase start` o `npx supabase db reset`).
// No van en supabase/seed.sql porque la semilla puede subirse a la nube con contraseñas conocidas.
// Cada cuenta da de alta su TOTP la primera vez que entra a /admin/entrar.
import { createClient } from '@supabase/supabase-js';

// Lee .env sin pisar las variables que ya traiga el entorno.
try {
	process.loadEnvFile('.env');
} catch {
	// Sin .env se usan solo las variables del entorno.
}

const url = process.env.SUPABASE_URL;
const llave = process.env.SUPABASE_SECRET_KEY;

if (!url || !llave) {
	console.error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY (copia los valores de `npx supabase status`).');
	process.exit(1);
}

const { hostname } = new URL(url);
if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
	console.error(`Este script solo corre contra Supabase local; SUPABASE_URL apunta a ${hostname}.`);
	process.exit(1);
}

const contrasena = 'panel-prueba-2026';
const cuentas = [
	{ correo: 'admin@ejemplo.test', nombre: 'Admin de prueba', rol: 'administrador' },
	{ correo: 'refugio@ejemplo.test', nombre: 'Refugio de prueba', rol: 'refugio' },
];

const supabase = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: lista, error: errorLista } = await supabase.auth.admin.listUsers();
if (errorLista) throw errorLista;

for (const cuenta of cuentas) {
	let usuario = lista.users.find((u) => u.email === cuenta.correo);

	if (usuario) {
		const { error } = await supabase.auth.admin.updateUserById(usuario.id, { password: contrasena });
		if (error) throw error;
	} else {
		const { data, error } = await supabase.auth.admin.createUser({
			email: cuenta.correo,
			password: contrasena,
			email_confirm: true,
		});
		if (error) throw error;
		usuario = data.user;
	}

	const { error } = await supabase
		.from('usuarios_panel')
		.upsert({ id: usuario.id, nombre: cuenta.nombre, rol: cuenta.rol });
	if (error) throw error;

	console.log(`${cuenta.correo} (${cuenta.rol})`);
}

console.log(`Contraseña de las dos cuentas: ${contrasena}`);
