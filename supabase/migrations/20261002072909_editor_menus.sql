-- Editor de menús (SPEC 10): la cuenta administradora lee y reemplaza el menú completo de un negocio
-- (grupos, secciones, platillos y precios) con dos funciones RPC. Las tablas del menú no ganan
-- políticas: el editor lee con leer_menu, que también da la versión que guardar_menu revisa.

-- Menú del negocio en el orden de la página pública, con la forma que reciben y devuelven las RPC.
-- Ordena por `orden` y luego por `id` para que el mismo menú dé siempre el mismo texto (y la misma versión).
create function public.menu_json(negocio_id text) returns jsonb
language sql
stable
set search_path = ''
as $$
	select coalesce(jsonb_agg(
		jsonb_build_object(
			'nombre', g.nombre,
			'secciones', (
				select coalesce(jsonb_agg(
					jsonb_build_object(
						'nombre', s.nombre,
						'nota', s.nota,
						'platillos', (
							select coalesce(jsonb_agg(
								jsonb_build_object(
									'nombre', p.nombre,
									'descripcion', p.descripcion,
									'es_extra', p.es_extra,
									'disponible', p.disponible,
									'precios', (
										select coalesce(jsonb_agg(
											jsonb_build_object(
												'etiqueta', pr.etiqueta,
												'monto', pr.monto,
												'texto_alterno', pr.texto_alterno
											) order by pr.orden, pr.id
										), '[]'::jsonb)
										from public.precios pr where pr.platillo_id = p.id
									)
								) order by p.orden, p.id
							), '[]'::jsonb)
							from public.platillos p where p.seccion_id = s.id
						)
					) order by s.orden, s.id
				), '[]'::jsonb)
				from public.secciones_menu s where s.grupo_id = g.id
			)
		) order by g.orden, g.id
	), '[]'::jsonb)
	from public.grupos_menu g
	where g.negocio_id = menu_json.negocio_id;
$$;

revoke execute on function public.menu_json(text) from public, anon, authenticated;

-- { "version", "grupos" } del negocio; null si el negocio no existe.
-- La versión es el md5 del menú: cambia con cualquier guardado, también desde Studio.
create function public.leer_menu(negocio_id text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	grupos jsonb;
begin
	perform public.exigir_administrador();

	if not exists (select 1 from public.negocios n where n.id = leer_menu.negocio_id) then
		return null;
	end if;
	grupos := public.menu_json(leer_menu.negocio_id);
	return jsonb_build_object('version', md5(grupos::text), 'grupos', grupos);
end;
$$;

-- Reemplaza el menú completo del negocio en una transacción (un solo despliegue).
-- Lanza 'menu_cambiado' si el menú ya no es el de `version` (otra pestaña o Studio guardó antes).
-- El orden es la posición en cada arreglo; los id del menú cambian en cada guardado.
-- Devuelve { "version" } del menú guardado.
create function public.guardar_menu(negocio_id text, version text, grupos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	grupo jsonb;
	seccion jsonb;
	platillo jsonb;
	precio jsonb;
	orden_grupo bigint;
	orden_seccion bigint;
	orden_platillo bigint;
	orden_precio bigint;
	id_grupo bigint;
	id_seccion bigint;
	id_platillo bigint;
	monto numeric;
	texto_alterno text;
begin
	perform public.exigir_administrador();

	-- Bloquea el negocio: dos guardados del mismo menú se esperan y el segundo ve la versión nueva.
	perform 1 from public.negocios n where n.id = guardar_menu.negocio_id for update;
	if not found then
		raise exception 'no_encontrado';
	end if;
	if md5(public.menu_json(guardar_menu.negocio_id)::text) is distinct from guardar_menu.version then
		raise exception 'menu_cambiado';
	end if;
	if jsonb_typeof(grupos) is distinct from 'array' then
		raise exception 'datos_invalidos' using detail = 'grupos';
	end if;

	-- Secciones, platillos y precios caen en cascada con su grupo.
	delete from public.grupos_menu g where g.negocio_id = guardar_menu.negocio_id;

	for grupo, orden_grupo in select * from jsonb_array_elements(grupos) with ordinality loop
		insert into public.grupos_menu (negocio_id, nombre, orden)
		values (guardar_menu.negocio_id, public.campo_texto(grupo, 'nombre'), orden_grupo)
		returning id into id_grupo;

		for seccion, orden_seccion in
			select * from jsonb_array_elements(coalesce(grupo -> 'secciones', '[]'::jsonb)) with ordinality
		loop
			insert into public.secciones_menu (grupo_id, nombre, nota, orden)
			values (
				id_grupo,
				public.campo_texto(seccion, 'nombre'),
				public.campo_texto(seccion, 'nota', false),
				orden_seccion
			)
			returning id into id_seccion;

			for platillo, orden_platillo in
				select * from jsonb_array_elements(coalesce(seccion -> 'platillos', '[]'::jsonb)) with ordinality
			loop
				if jsonb_typeof(platillo -> 'precios') is distinct from 'array'
					or jsonb_array_length(platillo -> 'precios') not between 1 and 4 then
					raise exception 'datos_invalidos' using detail = 'precios';
				end if;

				insert into public.platillos (seccion_id, nombre, descripcion, es_extra, disponible, orden)
				values (
					id_seccion,
					public.campo_texto(platillo, 'nombre'),
					public.campo_texto(platillo, 'descripcion', false),
					coalesce((platillo ->> 'es_extra')::boolean, false),
					coalesce((platillo ->> 'disponible')::boolean, true),
					orden_platillo
				)
				returning id into id_platillo;

				for precio, orden_precio in select * from jsonb_array_elements(platillo -> 'precios') with ordinality loop
					-- Pesos con hasta 2 decimales; sin monto, el precio necesita texto alterno ("Incluido").
					monto := public.campo_texto(precio, 'monto', false)::numeric;
					if monto < 0 or monto <> round(monto, 2) then
						raise exception 'datos_invalidos' using detail = 'monto';
					end if;
					texto_alterno := public.campo_texto(precio, 'texto_alterno', false);
					if monto is null and texto_alterno is null then
						raise exception 'datos_invalidos' using detail = 'precios';
					end if;

					insert into public.precios (platillo_id, etiqueta, monto, texto_alterno, orden)
					values (id_platillo, public.campo_texto(precio, 'etiqueta', false), monto, texto_alterno, orden_precio);
				end loop;
			end loop;
		end loop;
	end loop;

	return jsonb_build_object('version', md5(public.menu_json(guardar_menu.negocio_id)::text));
end;
$$;

revoke execute on function public.leer_menu(text) from public, anon;
revoke execute on function public.guardar_menu(text, text, jsonb) from public, anon;
grant execute on function public.leer_menu(text) to authenticated;
grant execute on function public.guardar_menu(text, text, jsonb) to authenticated;
