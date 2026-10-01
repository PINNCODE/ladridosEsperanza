-- Solicitudes del formulario Súmate (SPEC 07).
-- El navegador inserta con la llave publicable; RLS y los permisos por columna solo dejan escribir
-- los campos del formulario. Solo el administrador (sesión aal2) lee y cambia el estado.
-- La tabla no está en los disparadores `recompilar`: una solicitud no inicia un despliegue.

create table solicitudes_negocio (
	id uuid primary key default gen_random_uuid(),
	nombre_negocio text not null check (char_length(nombre_negocio) between 2 and 120),
	-- Nombre de la categoría elegida o el texto de "Otro".
	tipo text not null check (char_length(tipo) between 2 and 60),
	-- Número mexicano de 10 dígitos, sin lada de país.
	whatsapp text not null check (whatsapp ~ '^\d{10}$'),
	nombre_contacto text check (char_length(nombre_contacto) <= 80),
	mensaje text check (char_length(mensaje) <= 500),
	acepto_aviso boolean not null check (acepto_aviso = true),
	estado text not null default 'nueva'
		check (estado in ('nueva', 'contactada', 'publicada', 'descartada')),
	creada_en timestamptz not null default now(),
	actualizada_en timestamptz,
	es_ejemplo boolean not null default false
);

create index on solicitudes_negocio (whatsapp, creada_en);
create index on solicitudes_negocio (creada_en);

alter table solicitudes_negocio enable row level security;

-- Permisos por columna: nadie crea una solicitud ya publicada o marcada como ejemplo.
-- authenticated también inserta porque el formulario usa la sesión del navegador si la hay.
revoke all on solicitudes_negocio from anon, authenticated;
grant insert (nombre_negocio, tipo, whatsapp, nombre_contacto, mensaje, acepto_aviso)
	on solicitudes_negocio to anon, authenticated;
grant select, update (estado) on solicitudes_negocio to authenticated;
-- anon tiene select sin política, como las tablas de contenido: la API devuelve [] y no un error.
grant select on solicitudes_negocio to anon;

-- Los check de la tabla y el disparador de abajo validan cada envío.
create policy solicitudes_negocio_inserta on solicitudes_negocio
	for insert to anon, authenticated
	with check (true);

create policy solicitudes_negocio_lee on solicitudes_negocio
	for select to authenticated
	using ((select public.es_administrador()));

create policy solicitudes_negocio_cambia on solicitudes_negocio
	for update to authenticated
	using ((select public.es_administrador()))
	with check ((select public.es_administrador()));

-- Contra spam: un WhatsApp una vez cada 24 horas y 20 solicitudes por hora en total.
-- security definer porque anon no puede leer la tabla.
create function public.limitar_solicitudes() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if exists (
		select 1 from public.solicitudes_negocio
		where whatsapp = new.whatsapp and creada_en > now() - interval '24 hours'
	) then
		raise exception 'whatsapp_repetido';
	end if;

	if (
		select count(*) from public.solicitudes_negocio
		where creada_en > now() - interval '1 hour'
	) >= 20 then
		raise exception 'limite_por_hora';
	end if;

	return new;
end;
$$;

create function public.marcar_actualizada() returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.actualizada_en := now();
	return new;
end;
$$;

revoke execute on function public.limitar_solicitudes() from public, anon, authenticated;
revoke execute on function public.marcar_actualizada() from public, anon, authenticated;

create trigger limitar before insert on solicitudes_negocio
	for each row execute function public.limitar_solicitudes();

create trigger actualizada before update on solicitudes_negocio
	for each row execute function public.marcar_actualizada();

-- La página de QR lista los negocios; solo el administrador los lee por la API.
create policy negocios_lee_administrador on negocios
	for select to authenticated
	using ((select public.es_administrador()));
