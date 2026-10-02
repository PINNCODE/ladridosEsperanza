-- Las fotos del refugio viven en el repo, en src/assets/refugio/ (SPEC 14), y la imagen para
-- compartir sale de ahí; refugio ya no guarda una foto principal.
-- La fila de imagenes que apuntaba la columna no se borra: en la semilla, refugio/patio.jpg sigue
-- siendo la segunda foto de Luna.

-- Igual que en panel_refugio, pero del refugio solo se revisa el logo. `create or replace`
-- conserva los permisos revocados entonces.
create or replace function public.limpiar_imagenes(ids uuid[]) returns text[]
language sql
security definer
set search_path = ''
as $$
	with borradas as (
		delete from public.imagenes i
		where i.id = any (coalesce(ids, '{}'))
			and not exists (select 1 from public.fotos_peludo f where f.imagen_id = i.id)
			and not exists (select 1 from public.imagenes_bloque b where b.imagen_id = i.id)
			and not exists (select 1 from public.campanas c where c.cartel_id = i.id)
			and not exists (select 1 from public.refugio r where r.logo_id = i.id)
			and not exists (select 1 from public.negocios n where n.logo_id = i.id)
		returning i.ruta
	)
	select coalesce(array_agg(ruta), '{}') from borradas;
$$;

alter table refugio drop column foto_principal_id;
