-- Recompilación del sitio estático (SPEC 06).
-- Cada cambio en una tabla de contenido llama al deploy hook de Vercel con pg_net, una vez por sentencia,
-- y pg_cron lo llama cada día a las 00:05 de Ciudad de México para retirar necesidades vencidas,
-- campañas pasadas y promociones vencidas, que se filtran con la fecha de compilación.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- El URL del deploy hook es un secreto: se guarda en Vault con el nombre 'deploy_hook_vercel'
-- desde el SQL Editor del proyecto en la nube. Sin el secreto (desarrollo local) no hace nada.
create function public.recompilar_sitio() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	hook text;
begin
	select decrypted_secret into hook
	from vault.decrypted_secrets
	where name = 'deploy_hook_vercel';

	if hook is null then
		return;
	end if;

	perform net.http_post(url := hook, body := '{}'::jsonb);
end;
$$;

create function public.avisar_cambio() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform public.recompilar_sitio();
	return null;
end;
$$;

-- Solo el build, el trabajo diario y los disparadores inician despliegues.
revoke execute on function public.recompilar_sitio() from public, anon, authenticated;
revoke execute on function public.avisar_cambio() from public, anon, authenticated;

do $$
declare
	tabla text;
begin
	foreach tabla in array array[
		'imagenes', 'refugio', 'redes', 'categorias', 'bloques_contenido', 'imagenes_bloque',
		'problematicas', 'peludos', 'fotos_peludo', 'campanas', 'necesidades', 'destinos_donativo',
		'registros_cifras', 'gastos_registro', 'anuncios', 'negocios', 'promociones', 'horarios',
		'turnos', 'grupos_menu', 'secciones_menu', 'platillos', 'precios'
	] loop
		execute format(
			'create trigger recompilar after insert or update or delete on public.%I '
			'for each statement execute function public.avisar_cambio()',
			tabla
		);
	end loop;
end;
$$;

-- 06:05 UTC = 00:05 en Ciudad de México, que no tiene horario de verano desde 2022.
select cron.schedule('recompilar-diario', '5 6 * * *', 'select public.recompilar_sitio()');
