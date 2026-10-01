-- Cuentas del panel /admin (SPEC 07).
-- Las cuentas se invitan desde Supabase Studio y su rol vive en usuarios_panel.
-- Todas las cuentas usan verificación en dos pasos (TOTP): las funciones de abajo solo reconocen
-- una sesión que completó el segundo paso (aal2), así las políticas no dependen de las páginas.

create table usuarios_panel (
	id uuid primary key references auth.users on delete cascade,
	nombre text not null,
	rol text not null check (rol in ('administrador', 'refugio'))
);

alter table usuarios_panel enable row level security;

-- Rol de la cuenta con sesión aal2, o null si no hay sesión, falta el segundo paso
-- o la cuenta no tiene fila en usuarios_panel.
create function public.rol_panel() returns text
language sql
stable
security definer
set search_path = ''
as $$
	select u.rol
	from public.usuarios_panel u
	where u.id = (select auth.uid())
		and (select auth.jwt() ->> 'aal') = 'aal2';
$$;

-- true si la sesión completó el segundo paso (aal2) y el rol es 'administrador'.
create function public.es_administrador() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(public.rol_panel() = 'administrador', false);
$$;

-- Las políticas de authenticated las llaman; anon no las necesita.
revoke execute on function public.rol_panel() from public, anon;
revoke execute on function public.es_administrador() from public, anon;
grant execute on function public.rol_panel() to authenticated;
grant execute on function public.es_administrador() to authenticated;

-- Cada cuenta lee solo su propia fila, y solo con el segundo paso completo.
-- No hay políticas de escritura: las filas se agregan desde Studio.
create policy usuarios_panel_lee_propia on usuarios_panel
	for select to authenticated
	using (id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');
