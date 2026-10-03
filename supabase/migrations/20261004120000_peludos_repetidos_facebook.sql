-- Peludos repetidos y sin nombre desde Facebook. El refugio publica al mismo peludo varias veces, y la
-- sincronización creaba un borrador por post (Cuchita salió tres veces).
--
-- importar_post_facebook de la SPEC 16, más: un post de adopción con el mismo nombre y especie que un
-- peludo real sin adoptar (borrador o publicado) no crea otro; queda ligado a él con `motivo =
-- 'ya_registrado'`, y si es borrador le suma las fotos nuevas hasta 8. Devuelve también `motivo` y
-- `fotos_sin_usar`, las rutas subidas que no entraron, para que el script las borre. Los nombres "… sin nombre" (adopciones
-- cuyo post no dice el nombre; el script los arma con la especie) nunca coinciden.
create or replace function public.importar_post_facebook(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	post public.publicaciones_facebook;
	peludo public.peludos;
	campana public.campanas;
	necesidad public.necesidades;
	datos_peludo jsonb := datos -> 'peludo';
	datos_campana jsonb := datos -> 'campana';
	datos_necesidades jsonb := datos -> 'necesidades';
	nuevas public.necesidades[] := '{}';
	necesidad_ids text[] := '{}';
	elemento jsonb;
	fotos jsonb;
	campo text;
	valor text;
	candidatos text[];
	existente public.peludos;
	actuales jsonb;
	libres int;
	sin_usar text[] := '{}';
begin
	post.post_id := public.campo_texto(datos, 'post_id');
	if exists (select 1 from public.publicaciones_facebook p where p.post_id = post.post_id) then
		return jsonb_build_object('duplicado', true);
	end if;

	post.id := gen_random_uuid();
	post.url_post := public.campo_texto(datos, 'url_post');
	post.pagina := public.campo_texto(datos, 'pagina');
	post.resultado := public.campo_texto(datos, 'resultado');
	post.motivo := public.campo_texto(datos, 'motivo', false);
	post.texto := coalesce(datos ->> 'texto', '');
	post.publicado_en := public.campo_texto(datos, 'publicado_en', false)::timestamptz;

	if post.resultado = 'peludo' then
		if jsonb_typeof(datos_peludo) <> 'object' then
			raise exception 'datos_invalidos' using detail = 'peludo';
		end if;
		fotos := coalesce(datos_peludo -> 'fotos', '[]'::jsonb);
		if jsonb_typeof(fotos) <> 'array' then
			raise exception 'datos_invalidos' using detail = 'fotos';
		end if;

		peludo.nombre := public.campo_texto(datos_peludo, 'nombre');
		peludo.especie := public.campo_texto(datos_peludo, 'especie');
		peludo.descripcion_especie := public.campo_texto(datos_peludo, 'descripcion_especie');
		peludo.edad := public.campo_texto(datos_peludo, 'edad');
		peludo.tamano := public.campo_texto(datos_peludo, 'tamano');
		peludo.descripcion := public.campo_texto(datos_peludo, 'descripcion', false);
		peludo.rasgos := array(
			select nullif(btrim(rasgo), '')
			from jsonb_array_elements_text(coalesce(datos_peludo -> 'rasgos', '[]'::jsonb)) rasgo
		);
		if cardinality(peludo.rasgos) <> 2 or array_position(peludo.rasgos, null) is not null then
			raise exception 'datos_invalidos' using detail = 'rasgos';
		end if;

		foreach campo in array array['convive_perros', 'convive_gatos', 'convive_ninos'] loop
			valor := coalesce(public.campo_texto(datos_peludo, campo, false), 'no_sabemos');
			if valor not in ('si', 'no', 'no_sabemos') then
				raise exception 'datos_invalidos' using detail = campo;
			end if;
			case campo
				when 'convive_perros' then peludo.convive_perros := valor;
				when 'convive_gatos' then peludo.convive_gatos := valor;
				else peludo.convive_ninos := valor;
			end case;
		end loop;

		-- El refugio vuelve a publicar al mismo peludo: mismo nombre y especie que uno real sin adoptar
		-- (borrador o publicado). "… sin nombre" nunca coincide: son animales distintos.
		if public.nombre_normalizado(peludo.nombre) !~ ' sin nombre$' then
			select p.* into existente from public.peludos p
			where not p.es_ejemplo and p.estado <> 'adoptado' and p.especie = peludo.especie
				and public.nombre_normalizado(p.nombre) = public.nombre_normalizado(peludo.nombre)
			order by p.por_revisar, p.orden
			limit 1;
		end if;

		if existente.id is not null then
			post.peludo_id := existente.id;
			post.motivo := 'ya_registrado';
			-- Un borrador suma las fotos nuevas hasta 8; uno publicado no se toca (el refugio ya lo revisó).
			libres := 0;
			if existente.por_revisar then
				actuales := coalesce((
					select jsonb_agg(jsonb_build_object('imagen_id', f.imagen_id) order by f.orden)
					from public.fotos_peludo f where f.peludo_id = existente.id
				), '[]'::jsonb);
				libres := greatest(0, 8 - jsonb_array_length(actuales));
				if libres > 0 and jsonb_array_length(fotos) > 0 then
					perform public.reemplazar_fotos(
						'fotos_peludo',
						existente.id,
						actuales || coalesce((
							select jsonb_agg(foto order by n) from jsonb_array_elements(fotos) with ordinality as t(foto, n)
							where n <= libres
						), '[]'::jsonb)
					);
				end if;
			end if;
			-- Las fotos que no entraron ya se subieron: el script las borra.
			sin_usar := array(
				select foto ->> 'ruta' from jsonb_array_elements(fotos) with ordinality as t(foto, n) where n > libres
			);
		else
			peludo.id := public.id_libre(public.slug(peludo.nombre), 'peludos');
			peludo.orden := (select coalesce(max(p.orden), 0) + 1 from public.peludos p);
			peludo.estado := 'disponible';
			peludo.es_ejemplo := false;
			peludo.por_revisar := true;
			insert into public.peludos values (peludo.*);
			perform public.reemplazar_fotos('fotos_peludo', peludo.id, fotos);
			post.peludo_id := peludo.id;
		end if;

	elsif post.resultado = 'campana' then
		if jsonb_typeof(datos_campana) <> 'object' then
			raise exception 'datos_invalidos' using detail = 'campana';
		end if;

		campana.fecha := public.campo_texto(datos_campana, 'fecha')::date;
		campana.costo := public.campo_texto(datos_campana, 'costo')::numeric;
		campana.lugar := public.campo_texto(datos_campana, 'lugar');
		campana.horario := public.campo_texto(datos_campana, 'horario');
		campana.forma_pago := public.campo_texto(datos_campana, 'forma_pago');
		campana.cupo := public.campo_cifra(datos_campana, 'cupo');
		if campana.costo < 0 then
			raise exception 'datos_invalidos' using detail = 'costo';
		end if;
		if jsonb_typeof(datos_campana -> 'cartel') = 'object' then
			campana.cartel_id := public.guardar_imagen(datos_campana -> 'cartel', array['campanas']);
		end if;

		-- Mismo id que da el panel (la fecha); si ya hay una campaña ese día, fecha-2, fecha-3…
		campana.id := public.id_libre(campana.fecha::text, 'campanas');
		campana.estado := 'proxima';
		campana.es_ejemplo := false;
		campana.por_revisar := true;
		insert into public.campanas values (campana.*);
		post.campana_id := campana.id;

	elsif post.resultado = 'necesidad' then
		if jsonb_typeof(datos_necesidades) <> 'array'
			or jsonb_array_length(datos_necesidades) not between 1 and 6 then
			raise exception 'datos_invalidos' using detail = 'necesidades';
		end if;

		for elemento in select * from jsonb_array_elements(datos_necesidades) loop
			necesidad.tipo := public.campo_texto(elemento, 'tipo');
			necesidad.descripcion := public.campo_texto(elemento, 'descripcion');
			necesidad.urgencia := public.campo_texto(elemento, 'urgencia');
			necesidad.fecha_vigencia := public.campo_texto(elemento, 'fecha_vigencia')::date;
			if necesidad.tipo not in ('alimento', 'medicina', 'cobijas', 'limpieza', 'otro') then
				raise exception 'datos_invalidos' using detail = 'tipo';
			end if;
			if necesidad.urgencia not in ('urgente', 'necesaria') then
				raise exception 'datos_invalidos' using detail = 'urgencia';
			end if;

			-- Ya registrada (en la base o antes en este mismo post): no se crea.
			continue when exists (
				select 1 from public.necesidades n
				where not n.es_ejemplo and n.tipo = necesidad.tipo
					and public.nombre_normalizado(n.descripcion) = public.nombre_normalizado(necesidad.descripcion)
			) or exists (
				select 1 from unnest(nuevas) n
				where n.tipo = necesidad.tipo
					and public.nombre_normalizado(n.descripcion) = public.nombre_normalizado(necesidad.descripcion)
			);
			nuevas := nuevas || necesidad;
		end loop;

		if cardinality(nuevas) = 0 then
			post.resultado := 'ignorado';
			post.motivo := 'ya_registradas';
		end if;

	elsif post.resultado = 'adoptado' then
		valor := public.nombre_normalizado(public.campo_texto(datos -> 'adoptado', 'nombre'));
		candidatos := array(
			select p.id from public.peludos p
			where not p.es_ejemplo and not p.por_revisar and p.estado <> 'adoptado'
				and public.nombre_normalizado(p.nombre) = valor
		);
		if cardinality(candidatos) = 1 then
			post.peludo_id := candidatos[1];
		else
			post.resultado := 'incompleto';
			post.motivo := 'sin_coincidencia';
		end if;

	elsif post.resultado not in ('ignorado', 'incompleto') then
		raise exception 'datos_invalidos' using detail = 'resultado';
	end if;

	insert into public.publicaciones_facebook (
		id, post_id, url_post, pagina, resultado, peludo_id, campana_id, motivo, texto, publicado_en
	) values (
		post.id, post.post_id, post.url_post, post.pagina, post.resultado, post.peludo_id, post.campana_id,
		post.motivo, post.texto, post.publicado_en
	);

	-- Las necesidades van después del post porque apuntan a él. Mismo id que da el panel (tipo-fecha).
	foreach necesidad in array nuevas loop
		necesidad.id := public.id_libre(necesidad.tipo || '-' || necesidad.fecha_vigencia, 'necesidades');
		necesidad.es_ejemplo := false;
		necesidad.por_revisar := true;
		necesidad.publicacion_id := post.id;
		insert into public.necesidades values (necesidad.*);
		necesidad_ids := necesidad_ids || necesidad.id;
	end loop;

	return jsonb_build_object(
		'resultado', post.resultado,
		'motivo', post.motivo,
		'peludo_id', post.peludo_id,
		'campana_id', post.campana_id,
		'necesidad_ids', to_jsonb(necesidad_ids),
		'fotos_sin_usar', to_jsonb(sin_usar)
	);
end;
$$;
