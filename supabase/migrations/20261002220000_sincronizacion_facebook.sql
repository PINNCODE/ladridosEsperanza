-- Sincronización desde Facebook (SPEC 15): un script diario (GitHub Actions) lee las páginas del refugio,
-- clasifica cada post con Gemini y lo registra con importar_post_facebook. Lo que trae un peludo o una
-- campaña entra como borrador (`por_revisar`): no sale en el sitio hasta que el refugio lo guarda en el panel.

-- Borradores: los cargadores del sitio solo leen filas con `por_revisar = false`.
alter table peludos add column por_revisar boolean not null default false;
alter table campanas add column por_revisar boolean not null default false;

-- Un registro por post leído, para no procesarlo dos veces y para que el panel enlace cada borrador
-- y cada aviso de adopción con su post. Sin trigger recompilar: el sitio no la muestra.
create table publicaciones_facebook (
	id uuid primary key default gen_random_uuid(),
	-- Id del post que da Apify; evita procesarlo dos veces.
	post_id text not null unique,
	url_post text not null check (url_post ~ '^https://(www\.|m\.)?facebook\.com/'),
	pagina text not null,
	resultado text not null check (resultado in ('peludo', 'campana', 'adoptado', 'ignorado', 'incompleto')),
	-- Peludo o campaña creada, o el peludo del aviso de adopción. Borrarlo en el panel deja null y el
	-- post no se vuelve a importar.
	peludo_id text references peludos on delete set null,
	campana_id text references campanas on delete set null,
	-- Por qué es `ignorado` o `incompleto`: 'sin_nombre', 'sin_foto', 'varios_peludos', 'fecha_pasada', 'sin_coincidencia', …
	motivo text,
	texto text not null,
	publicado_en timestamptz,
	procesado_en timestamptz not null default now(),
	es_ejemplo boolean not null default false
);
create index publicaciones_facebook_peludo on publicaciones_facebook (peludo_id);
create index publicaciones_facebook_campana on publicaciones_facebook (campana_id);

-- Igual que las tablas del refugio: sin escrituras por la API y lectura para el panel.
-- El script escribe solo con importar_post_facebook.
alter table publicaciones_facebook enable row level security;
revoke insert, update, delete, truncate on publicaciones_facebook from anon, authenticated;

create policy publicaciones_facebook_lee_panel on publicaciones_facebook
	for select to authenticated
	using ((select public.rol_panel()) is not null);

-- Nombre para comparar: minúsculas, sin acentos y con un solo espacio entre palabras.
create function public.nombre_normalizado(texto text) returns text
language sql
immutable
set search_path = ''
as $$
	select btrim(regexp_replace(
		translate(lower(texto), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
		'\s+', ' ', 'g'
	));
$$;

revoke execute on function public.nombre_normalizado(text) from public, anon, authenticated;

-- Registra un post en una sola transacción: el borrador del peludo o de la campaña con sus fotos, el aviso
-- de adopción o solo la fila del post (`ignorado`, `incompleto`). Si algo no valida no guarda nada, ni la
-- fila del post, y el script borra las fotos que subió. Solo la llama el script, con la llave secreta.
create function public.importar_post_facebook(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	post public.publicaciones_facebook;
	peludo public.peludos;
	campana public.campanas;
	datos_peludo jsonb := datos -> 'peludo';
	datos_campana jsonb := datos -> 'campana';
	fotos jsonb;
	campo text;
	valor text;
	candidatos text[];
begin
	post.post_id := public.campo_texto(datos, 'post_id');
	if exists (select 1 from public.publicaciones_facebook p where p.post_id = post.post_id) then
		return jsonb_build_object('duplicado', true);
	end if;

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
		if jsonb_typeof(fotos) <> 'array' or jsonb_array_length(fotos) = 0 then
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
		post_id, url_post, pagina, resultado, peludo_id, campana_id, motivo, texto, publicado_en
	) values (
		post.post_id, post.url_post, post.pagina, post.resultado, post.peludo_id, post.campana_id,
		post.motivo, post.texto, post.publicado_en
	);

	return jsonb_build_object(
		'resultado', post.resultado,
		'peludo_id', post.peludo_id,
		'campana_id', post.campana_id
	);
end;
$$;

revoke execute on function public.importar_post_facebook(jsonb) from public, anon, authenticated;
grant execute on function public.importar_post_facebook(jsonb) to service_role;

-- guardar_peludo de la SPEC 13 con `por_revisar = false`: guardar un borrador desde el panel lo publica.
-- `create or replace` conserva los permisos.
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

-- guardar_campana de la SPEC 08 con `por_revisar = false`, por la misma razón.
create or replace function public.guardar_campana(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.campanas;
	cartel_anterior uuid;
begin
	perform public.exigir_panel();

	fila.id := datos ->> 'id';
	fila.fecha := public.campo_texto(datos, 'fecha')::date;
	fila.costo := public.campo_texto(datos, 'costo')::numeric;
	fila.lugar := public.campo_texto(datos, 'lugar');
	fila.horario := public.campo_texto(datos, 'horario');
	fila.forma_pago := public.campo_texto(datos, 'forma_pago');
	fila.cupo := public.campo_cifra(datos, 'cupo');
	fila.estado := public.campo_texto(datos, 'estado');
	fila.por_revisar := false;
	if fila.costo < 0 then
		raise exception 'datos_invalidos' using detail = 'costo';
	end if;
	if jsonb_typeof(datos -> 'cartel') = 'object' then
		fila.cartel_id := public.guardar_imagen(datos -> 'cartel');
	end if;

	if fila.id is null then
		fila.id := fila.fecha::text;
		if exists (select 1 from public.campanas c where c.id = fila.id) then
			raise exception 'campana_repetida';
		end if;
		fila.es_ejemplo := false;
		insert into public.campanas values (fila.*);
	else
		select c.cartel_id into cartel_anterior from public.campanas c where c.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
		update public.campanas c
		set fecha = fila.fecha, costo = fila.costo, lugar = fila.lugar, horario = fila.horario,
			forma_pago = fila.forma_pago, cupo = fila.cupo, cartel_id = fila.cartel_id, estado = fila.estado,
			por_revisar = false
		where c.id = fila.id;
	end if;

	return jsonb_build_object(
		'id', fila.id,
		'rutas_borradas', to_jsonb(public.limpiar_imagenes(array[cartel_anterior]))
	);
end;
$$;

-- marcar_me_gusta de la SPEC 13: un borrador no recibe "me gusta" aunque su estado sea 'disponible'.
create or replace function public.marcar_me_gusta(peludo_id text, dispositivo uuid, activo boolean) returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not exists (
		select 1 from public.peludos p
		where p.id = marcar_me_gusta.peludo_id and p.estado = 'disponible' and not p.por_revisar
	) then
		raise exception 'no_encontrado';
	end if;

	if activo then
		if not exists (
			select 1 from public.me_gusta m
			where m.peludo_id = marcar_me_gusta.peludo_id and m.dispositivo = marcar_me_gusta.dispositivo
		) then
			if (
				select count(*) from public.me_gusta m
				where m.dispositivo = marcar_me_gusta.dispositivo and m.creado_en > now() - interval '1 hour'
			) >= 30 or (
				select count(*) from public.me_gusta m where m.creado_en > now() - interval '1 hour'
			) >= 600 then
				raise exception 'limite_me_gusta';
			end if;

			insert into public.me_gusta (peludo_id, dispositivo)
			values (marcar_me_gusta.peludo_id, marcar_me_gusta.dispositivo)
			on conflict do nothing;
		end if;
	else
		delete from public.me_gusta m
		where m.peludo_id = marcar_me_gusta.peludo_id and m.dispositivo = marcar_me_gusta.dispositivo;
	end if;

	return (select count(*)::int from public.me_gusta m where m.peludo_id = marcar_me_gusta.peludo_id);
end;
$$;
