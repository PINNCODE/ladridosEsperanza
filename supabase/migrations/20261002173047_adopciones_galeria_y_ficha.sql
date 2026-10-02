-- Adopciones (SPEC 13): convivencia de cada peludo, su línea de tiempo "Su camino en el refugio"
-- (hitos, con el padrino de la esterilización) y el "me gusta" público, uno por dispositivo.

-- Convivencia: el refugio muchas veces no lo ha probado, por eso hay tres valores.
alter table peludos
	add column convive_perros text not null default 'no_sabemos' check (convive_perros in ('si', 'no', 'no_sabemos')),
	add column convive_gatos text not null default 'no_sabemos' check (convive_gatos in ('si', 'no', 'no_sabemos')),
	add column convive_ninos text not null default 'no_sabemos' check (convive_ninos in ('si', 'no', 'no_sabemos'));

-- Línea de tiempo de la ficha. `orden` sigue la fecha: guardar_peludo los renumera al guardar.
create table hitos_peludo (
	peludo_id text not null references peludos on delete cascade,
	orden int not null,
	fecha date not null,
	tipo text not null check (tipo in ('llegada', 'esterilizacion', 'vacunas', 'desparasitacion', 'otro')),
	texto text check (texto is null or (btrim(texto) <> '' and char_length(texto) <= 140)),
	padrino text check (padrino is null or (btrim(padrino) <> '' and char_length(padrino) <= 60)),
	primary key (peludo_id, orden),
	constraint hitos_padrino_solo_esterilizacion check (padrino is null or tipo = 'esterilizacion'),
	constraint hitos_otro_con_texto check (tipo <> 'otro' or texto is not null)
);

-- Igual que las demás tablas de contenido: anon sin políticas (la API devuelve []), lectura del panel,
-- escritura solo por guardar_peludo o en Studio, y cada cambio publica el sitio.
alter table hitos_peludo enable row level security;
revoke insert, update, delete, truncate on hitos_peludo from anon, authenticated;

create policy hitos_peludo_lee_panel on hitos_peludo
	for select to authenticated
	using ((select public.rol_panel()) is not null);

create trigger recompilar after insert or update or delete on hitos_peludo
	for each statement execute function public.avisar_cambio();

-- Hasta 8 fotos por peludo; los bloques de contenido siguen con 4.
create or replace function public.reemplazar_fotos(tabla text, id text, fotos jsonb) returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
	anteriores uuid[];
	foto jsonb;
	orden int := 0;
begin
	if jsonb_array_length(fotos) > (case when tabla = 'fotos_peludo' then 8 else 4 end) then
		raise exception 'demasiadas_fotos';
	end if;

	if tabla = 'fotos_peludo' then
		anteriores := array(select f.imagen_id from public.fotos_peludo f where f.peludo_id = reemplazar_fotos.id);
		delete from public.fotos_peludo f where f.peludo_id = reemplazar_fotos.id;
	else
		anteriores := array(select b.imagen_id from public.imagenes_bloque b where b.bloque_id = reemplazar_fotos.id);
		delete from public.imagenes_bloque b where b.bloque_id = reemplazar_fotos.id;
	end if;

	for foto in select * from jsonb_array_elements(fotos) loop
		orden := orden + 1;
		if tabla = 'fotos_peludo' then
			insert into public.fotos_peludo (peludo_id, imagen_id, orden)
			values (reemplazar_fotos.id, public.guardar_imagen(foto), orden);
		else
			insert into public.imagenes_bloque (bloque_id, imagen_id, orden)
			values (reemplazar_fotos.id, public.guardar_imagen(foto), orden);
		end if;
	end loop;

	return public.limpiar_imagenes(anteriores);
end;
$$;

-- Reemplaza los hitos de un peludo por los de `hitos`, ordenados por fecha. Cada hito es
-- { "fecha", "tipo", "texto", "padrino" }; cualquier hito inválido lanza 'datos_invalidos' con detalle 'hitos'.
create function public.reemplazar_hitos(id text, hitos jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	hoy date := (now() at time zone 'America/Mexico_City')::date;
	hito jsonb;
	fecha_hito date;
	tipo_hito text;
	texto_hito text;
	padrino_hito text;
begin
	if jsonb_typeof(hitos) is distinct from 'array' or jsonb_array_length(hitos) > 20 then
		raise exception 'datos_invalidos' using detail = 'hitos';
	end if;

	for hito in select * from jsonb_array_elements(hitos) loop
		tipo_hito := nullif(btrim(hito ->> 'tipo'), '');
		texto_hito := nullif(btrim(hito ->> 'texto'), '');
		padrino_hito := nullif(btrim(hito ->> 'padrino'), '');
		begin
			fecha_hito := (hito ->> 'fecha')::date;
		exception when others then
			fecha_hito := null;
		end;

		if fecha_hito is null or fecha_hito > hoy
			or tipo_hito is null
			or tipo_hito not in ('llegada', 'esterilizacion', 'vacunas', 'desparasitacion', 'otro')
			or (padrino_hito is not null and tipo_hito <> 'esterilizacion')
			or (tipo_hito = 'otro' and texto_hito is null)
			or coalesce(char_length(texto_hito), 0) > 140
			or coalesce(char_length(padrino_hito), 0) > 60
		then
			raise exception 'datos_invalidos' using detail = 'hitos';
		end if;
	end loop;

	delete from public.hitos_peludo h where h.peludo_id = reemplazar_hitos.id;

	insert into public.hitos_peludo (peludo_id, orden, fecha, tipo, texto, padrino)
	select
		reemplazar_hitos.id,
		row_number() over (order by (h.valor ->> 'fecha')::date, h.n),
		(h.valor ->> 'fecha')::date,
		btrim(h.valor ->> 'tipo'),
		nullif(btrim(h.valor ->> 'texto'), ''),
		nullif(btrim(h.valor ->> 'padrino'), '')
	from jsonb_array_elements(hitos) with ordinality as h(valor, n);
end;
$$;

revoke execute on function public.reemplazar_hitos(text, jsonb) from public, anon, authenticated;

-- Peludo en adopción (RF-11, RF-30, SPEC 13). Sin "id" crea uno con el slug del nombre (luna, luna-2…)
-- al final del orden; con "id" lo actualiza. "rasgos" lleva exactamente 2 y "fotos" hasta 8.
-- Sin una clave "convive_*" deja su valor (o 'no_sabemos' si es nuevo) y sin "hitos" no los toca,
-- para que el panel anterior a la SPEC 13 siga guardando con esta migración aplicada.
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
			convive_ninos = fila.convive_ninos
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

-- "Me gusta" público: uno por dispositivo y peludo. `dispositivo` es un uuid al azar que el navegador
-- guarda en localStorage; no hay nombre, IP ni cuenta. Nadie lee ni escribe la tabla por la API:
-- solo marcar_me_gusta y conteos_me_gusta. Sin trigger recompilar: un "me gusta" no publica el sitio.
create table me_gusta (
	peludo_id text not null references peludos on delete cascade,
	dispositivo uuid not null,
	creado_en timestamptz not null default now(),
	primary key (peludo_id, dispositivo)
);
create index me_gusta_dispositivo_creado on me_gusta (dispositivo, creado_en);
create index me_gusta_creado on me_gusta (creado_en);

alter table me_gusta enable row level security;
revoke insert, update, delete, truncate on me_gusta from anon, authenticated;

-- Da (`activo`) o quita el "me gusta" de un dispositivo a un peludo disponible y devuelve su total.
-- Un dispositivo da hasta 30 por hora y todo el sitio hasta 600; arriba de eso lanza 'limite_me_gusta'.
-- Dar uno que ya existe no cuenta para el límite.
create function public.marcar_me_gusta(peludo_id text, dispositivo uuid, activo boolean) returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not exists (
		select 1 from public.peludos p where p.id = marcar_me_gusta.peludo_id and p.estado = 'disponible'
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

-- Total de "me gusta" de cada peludo disponible que tiene al menos uno.
create function public.conteos_me_gusta() returns table (peludo_id text, total int)
language sql
stable
security definer
set search_path = ''
as $$
	select m.peludo_id, count(*)::int
	from public.me_gusta m
	join public.peludos p on p.id = m.peludo_id and p.estado = 'disponible'
	group by m.peludo_id;
$$;

revoke execute on function public.marcar_me_gusta(text, uuid, boolean) from public;
revoke execute on function public.conteos_me_gusta() from public;
grant execute on function public.marcar_me_gusta(text, uuid, boolean) to anon, authenticated;
grant execute on function public.conteos_me_gusta() to anon, authenticated;
