-- Necesidades y adopciones sin foto desde Facebook (SPEC 16). La sincronización también reúne lo que pide
-- el refugio como borradores de necesidad, sin repetir lo ya registrado, y guarda todo post de adopción
-- aunque no traiga foto; el refugio la agrega en el panel, que no deja guardar un peludo sin fotos.

-- Borradores de necesidad: los cargadores del sitio solo leen filas con `por_revisar = false`.
alter table necesidades add column por_revisar boolean not null default false;
-- Post del que salió el borrador; varios borradores pueden venir del mismo post.
alter table necesidades add column publicacion_id uuid references publicaciones_facebook on delete set null;
create index necesidades_publicacion on necesidades (publicacion_id);

alter table publicaciones_facebook drop constraint publicaciones_facebook_resultado_check;
alter table publicaciones_facebook add constraint publicaciones_facebook_resultado_check
	check (resultado in ('peludo', 'campana', 'necesidad', 'adoptado', 'ignorado', 'incompleto'));

-- importar_post_facebook de la SPEC 15, más:
-- - `resultado = 'necesidad'`: crea un borrador por cada necesidad de `datos.necesidades` (1 a 6) que no
--   esté ya registrada (mismo tipo y misma descripción normalizada que una necesidad real, borrador o
--   publicada). Si todas lo estaban, el post queda `ignorado` con `ya_registradas`. El script ya descarta
--   las repetidas por significado; esta comparación exacta es la red de seguridad.
-- - `resultado = 'peludo'` acepta `fotos` vacío: el refugio agrega la foto antes de publicarlo.
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

		peludo.id := public.id_libre(public.slug(peludo.nombre), 'peludos');
		peludo.orden := (select coalesce(max(p.orden), 0) + 1 from public.peludos p);
		peludo.estado := 'disponible';
		peludo.es_ejemplo := false;
		peludo.por_revisar := true;
		insert into public.peludos values (peludo.*);
		perform public.reemplazar_fotos('fotos_peludo', peludo.id, fotos);
		post.peludo_id := peludo.id;

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
		'peludo_id', post.peludo_id,
		'campana_id', post.campana_id,
		'necesidad_ids', to_jsonb(necesidad_ids)
	);
end;
$$;

-- guardar_peludo de la SPEC 15 que además exige al menos una foto: ninguna tarjeta de /adopta sale vacía,
-- y un borrador sin foto (adopción con video o solo texto) no se publica hasta que el refugio le agrega una.
create or replace function public.guardar_peludo(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.peludos;
	fotos jsonb := coalesce(datos -> 'fotos', '[]'::jsonb);
	campo text;
	valor text;
begin
	perform public.exigir_panel();

	if jsonb_typeof(fotos) <> 'array' or jsonb_array_length(fotos) = 0 then
		raise exception 'datos_invalidos' using detail = 'fotos';
	end if;

	fila.id := datos ->> 'id';
	fila.nombre := public.campo_texto(datos, 'nombre');
	fila.especie := public.campo_texto(datos, 'especie');
	fila.descripcion_especie := public.campo_texto(datos, 'descripcion_especie');
	fila.edad := public.campo_texto(datos, 'edad');
	fila.tamano := public.campo_texto(datos, 'tamano');
	fila.descripcion := public.campo_texto(datos, 'descripcion', false);
	fila.estado := public.campo_texto(datos, 'estado');
	fila.por_revisar := false;
	fila.rasgos := array(
		select nullif(btrim(rasgo), '') from jsonb_array_elements_text(coalesce(datos -> 'rasgos', '[]'::jsonb)) rasgo
	);
	if cardinality(fila.rasgos) <> 2 or array_position(fila.rasgos, null) is not null then
		raise exception 'datos_invalidos' using detail = 'rasgos';
	end if;

	-- Convivencia: la guardada (o 'no_sabemos') salvo que `datos` traiga otra.
	select p.convive_perros, p.convive_gatos, p.convive_ninos
	into fila.convive_perros, fila.convive_gatos, fila.convive_ninos
	from public.peludos p where p.id = fila.id;

	foreach campo in array array['convive_perros', 'convive_gatos', 'convive_ninos'] loop
		valor := public.campo_texto(datos, campo, false);
		if valor is not null and valor not in ('si', 'no', 'no_sabemos') then
			raise exception 'datos_invalidos' using detail = campo;
		end if;
		case campo
			when 'convive_perros' then fila.convive_perros := coalesce(valor, fila.convive_perros, 'no_sabemos');
			when 'convive_gatos' then fila.convive_gatos := coalesce(valor, fila.convive_gatos, 'no_sabemos');
			else fila.convive_ninos := coalesce(valor, fila.convive_ninos, 'no_sabemos');
		end case;
	end loop;

	if fila.id is null then
		fila.id := public.id_libre(public.slug(fila.nombre), 'peludos');
		fila.orden := (select coalesce(max(p.orden), 0) + 1 from public.peludos p);
		fila.es_ejemplo := false;
		insert into public.peludos values (fila.*);
	else
		update public.peludos p
		set nombre = fila.nombre, especie = fila.especie, descripcion_especie = fila.descripcion_especie,
			edad = fila.edad, tamano = fila.tamano, descripcion = fila.descripcion, rasgos = fila.rasgos,
			estado = fila.estado, convive_perros = fila.convive_perros, convive_gatos = fila.convive_gatos,
			convive_ninos = fila.convive_ninos, por_revisar = false
		where p.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
	end if;

	if datos ? 'hitos' then
		perform public.reemplazar_hitos(fila.id, datos -> 'hitos');
	end if;

	return jsonb_build_object(
		'id', fila.id,
		'rutas_borradas', to_jsonb(public.reemplazar_fotos('fotos_peludo', fila.id, fotos))
	);
end;
$$;

-- guardar_necesidad de la SPEC 08 con `por_revisar = false`: guardar un borrador desde el panel lo publica.
create or replace function public.guardar_necesidad(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.necesidades;
begin
	perform public.exigir_panel();

	fila.id := datos ->> 'id';
	fila.tipo := public.campo_texto(datos, 'tipo');
	fila.descripcion := public.campo_texto(datos, 'descripcion');
	fila.urgencia := public.campo_texto(datos, 'urgencia');
	fila.fecha_vigencia := public.campo_texto(datos, 'fecha_vigencia')::date;
	fila.por_revisar := false;

	if fila.id is null then
		fila.id := public.id_libre(fila.tipo || '-' || fila.fecha_vigencia, 'necesidades');
		fila.es_ejemplo := false;
		insert into public.necesidades values (fila.*);
	else
		update public.necesidades n
		set tipo = fila.tipo, descripcion = fila.descripcion, urgencia = fila.urgencia,
			fecha_vigencia = fila.fecha_vigencia, por_revisar = false
		where n.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
	end if;

	return jsonb_build_object('id', fila.id, 'rutas_borradas', '[]'::jsonb);
end;
$$;
