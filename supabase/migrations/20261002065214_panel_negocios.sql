-- Panel de negocios (SPEC 09): negocios con logo, horarios y promoción, y categorías.
-- Solo la cuenta administradora los lee por la API y los escribe con las funciones RPC de abajo,
-- que guardan cada negocio con sus hijas en una transacción (un solo despliegue).
-- Las tablas del menú no cambian aquí: el editor de menús es la SPEC 10.

-- Lectura para el panel: negocios ya tiene negocios_lee_administrador (SPEC 07) e imagenes se lee
-- con rol_panel() (SPEC 08).
do $$
declare
	tabla text;
begin
	foreach tabla in array array['categorias', 'promociones', 'horarios', 'turnos'] loop
		execute format(
			'create policy %I on public.%I for select to authenticated '
			'using ((select public.es_administrador()))',
			tabla || '_lee_administrador',
			tabla
		);
	end loop;
end;
$$;

-- Logos de negocios en la carpeta negocios/ del bucket `imagenes`, solo para el administrador.
create policy imagenes_negocios_sube on storage.objects
	for insert to authenticated
	with check (
		bucket_id = 'imagenes'
		and (storage.foldername(name))[1] = 'negocios'
		and (select public.es_administrador())
	);

create policy imagenes_negocios_lee on storage.objects
	for select to authenticated
	using (
		bucket_id = 'imagenes'
		and (storage.foldername(name))[1] = 'negocios'
		and (select public.es_administrador())
	);

create policy imagenes_negocios_borra on storage.objects
	for delete to authenticated
	using (
		bucket_id = 'imagenes'
		and (storage.foldername(name))[1] = 'negocios'
		and (select public.es_administrador())
	);

-- Lanza 'sin_permiso' si la sesión no es aal2 o la cuenta no es administradora.
create function public.exigir_administrador() returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not (select public.es_administrador()) then
		raise exception 'sin_permiso';
	end if;
end;
$$;

revoke execute on function public.exigir_administrador() from public, anon, authenticated;

-- guardar_imagen() de la SPEC 08 ahora recibe las carpetas que acepta cada RPC: las del refugio
-- por defecto, y negocios/ solo desde guardar_negocio. Así la cuenta refugio no registra logos.
-- Las RPC de la SPEC 08 son plpgsql y la llaman por nombre: siguen funcionando sin cambios.
drop function public.guardar_imagen(jsonb);

create function public.guardar_imagen(
	foto jsonb,
	carpetas text[] default array['peludos', 'campanas', 'bloques']
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	nueva uuid;
begin
	if foto ? 'imagen_id' then
		select id into nueva from public.imagenes where id = (foto ->> 'imagen_id')::uuid;
		if nueva is null then
			raise exception 'datos_invalidos' using detail = 'imagen_id';
		end if;
		return nueva;
	end if;

	if coalesce(foto ->> 'ruta', '') !~ ('^(' || array_to_string(carpetas, '|') || ')/[A-Za-z0-9._-]+$') then
		raise exception 'datos_invalidos' using detail = 'ruta';
	end if;

	insert into public.imagenes (ruta, ancho, alto)
	values (foto ->> 'ruta', (foto ->> 'ancho')::int, (foto ->> 'alto')::int)
	returning id into nueva;
	return nueva;
end;
$$;

revoke execute on function public.guardar_imagen(jsonb, text[]) from public, anon, authenticated;

-- Categoría del catálogo. Sin "id" crea una con el slug del nombre, al final del orden;
-- con "id" la renombra (el id no cambia: es el valor de ?categoria= en /colabora).
create function public.guardar_categoria(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.categorias;
begin
	perform public.exigir_administrador();

	fila.id := datos ->> 'id';
	fila.nombre := public.campo_texto(datos, 'nombre');

	if fila.id is null then
		fila.id := public.id_libre(public.slug(fila.nombre), 'categorias');
		fila.orden := (select coalesce(max(c.orden), 0) + 1 from public.categorias c);
		fila.es_ejemplo := false;
		insert into public.categorias values (fila.*);
	else
		update public.categorias c set nombre = fila.nombre where c.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
	end if;

	return jsonb_build_object('id', fila.id);
end;
$$;

-- Borra una categoría que ningún negocio usa; si alguno la usa lanza 'categoria_en_uso'.
create function public.borrar_categoria(id text) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform public.exigir_administrador();

	if exists (select 1 from public.negocios n where n.categoria_id = borrar_categoria.id) then
		raise exception 'categoria_en_uso';
	end if;
	delete from public.categorias c where c.id = borrar_categoria.id;
	if not found then
		raise exception 'no_encontrado';
	end if;
end;
$$;

-- Sube (-1) o baja (1) una categoría un lugar; renumera 1, 2, 3… como mover_contenido (SPEC 08).
create function public.mover_categoria(id text, direccion int) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	ids text[];
	posicion int;
	destino int;
begin
	perform public.exigir_administrador();

	if direccion not in (-1, 1) then
		raise exception 'datos_invalidos' using detail = 'direccion';
	end if;

	ids := array(select c.id from public.categorias c order by c.orden, c.id);
	posicion := array_position(ids, mover_categoria.id);
	if posicion is null then
		raise exception 'no_encontrado';
	end if;
	destino := posicion + direccion;
	if destino < 1 or destino > cardinality(ids) then
		return;
	end if;
	ids[posicion] := ids[destino];
	ids[destino] := mover_categoria.id;

	update public.categorias c set orden = n.orden
	from unnest(ids) with ordinality as n(id, orden)
	where c.id = n.id and c.orden is distinct from n.orden;
end;
$$;

revoke execute on function public.guardar_categoria(jsonb) from public, anon;
revoke execute on function public.borrar_categoria(text) from public, anon;
revoke execute on function public.mover_categoria(text, int) from public, anon;
grant execute on function public.guardar_categoria(jsonb) to authenticated;
grant execute on function public.borrar_categoria(text) to authenticated;
grant execute on function public.mover_categoria(text, int) to authenticated;

-- Negocio de "Come por los Peludos" (RF-04, RF-07 a RF-09) con logo, horarios y promoción.
-- Sin "id" crea uno con el slug del nombre (su URL /colabora/{id}), en el estado que diga `datos`
-- y con fecha_alta de hoy en Ciudad de México; con "id" lo actualiza sin cambiar id ni fecha_alta.
-- "logo" es null, { imagen_id } o { ruta, ancho, alto } en negocios/. "horarios" lleva por día
-- "cerrado" o 1 o 2 turnos { abre, cierra }; un día ausente es "por confirmar". "promocion" null
-- la quita. "whatsapp" llega con 10 dígitos y se guarda con 52 delante.
create function public.guardar_negocio(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.negocios;
	logo_anterior uuid;
	whatsapp text;
	dia text;
	valor jsonb;
	turno jsonb;
	orden int;
	abre text;
	cierra text;
	promocion jsonb := datos -> 'promocion';
	fecha_inicio date;
	fecha_fin date;
begin
	perform public.exigir_administrador();

	fila.id := datos ->> 'id';
	fila.nombre := public.campo_texto(datos, 'nombre');
	fila.categoria_id := public.campo_texto(datos, 'categoria_id');
	fila.descripcion_corta := public.campo_texto(datos, 'descripcion_corta');
	fila.direccion := public.campo_texto(datos, 'direccion');
	fila.estado := public.campo_texto(datos, 'estado');
	fila.porcentaje_aporte := public.campo_texto(datos, 'porcentaje_aporte')::numeric;
	if fila.porcentaje_aporte not between 0 and 100 then
		raise exception 'datos_invalidos' using detail = 'porcentaje_aporte';
	end if;

	-- Coordenadas: las dos o ninguna, dentro de rango.
	fila.latitud := public.campo_texto(datos, 'latitud', false)::double precision;
	fila.longitud := public.campo_texto(datos, 'longitud', false)::double precision;
	if (fila.latitud is null) <> (fila.longitud is null)
		or fila.latitud not between -90 and 90
		or fila.longitud not between -180 and 180 then
		raise exception 'datos_invalidos' using detail = 'ubicacion';
	end if;

	whatsapp := public.campo_texto(datos, 'whatsapp', false);
	if whatsapp !~ '^\d{10}$' then
		raise exception 'datos_invalidos' using detail = 'whatsapp';
	end if;
	fila.whatsapp := '52' || whatsapp;

	if jsonb_typeof(datos -> 'logo') = 'object' then
		fila.logo_id := public.guardar_imagen(datos -> 'logo', array['negocios']);
	end if;

	if fila.id is null then
		fila.id := public.id_libre(public.slug(fila.nombre), 'negocios');
		fila.fecha_alta := (now() at time zone 'America/Mexico_City')::date;
		fila.es_ejemplo := false;
		insert into public.negocios values (fila.*);
	else
		select n.logo_id into logo_anterior from public.negocios n where n.id = fila.id for update;
		if not found then
			raise exception 'no_encontrado';
		end if;
		update public.negocios n
		set nombre = fila.nombre, categoria_id = fila.categoria_id, descripcion_corta = fila.descripcion_corta,
			logo_id = fila.logo_id, direccion = fila.direccion, latitud = fila.latitud, longitud = fila.longitud,
			whatsapp = fila.whatsapp, estado = fila.estado, porcentaje_aporte = fila.porcentaje_aporte
		where n.id = fila.id;
	end if;

	-- Horarios: se reemplazan completos; los turnos caen en cascada con su día.
	delete from public.horarios h where h.negocio_id = fila.id;
	for dia, valor in select * from jsonb_each(coalesce(datos -> 'horarios', '{}'::jsonb)) loop
		if dia not in ('lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom') then
			raise exception 'datos_invalidos' using detail = 'horarios';
		end if;
		if valor = '"cerrado"'::jsonb then
			insert into public.horarios (negocio_id, dia, cerrado) values (fila.id, dia, true);
			continue;
		end if;
		if jsonb_typeof(valor) <> 'array' or jsonb_array_length(valor) not between 1 and 2 then
			raise exception 'datos_invalidos' using detail = 'horarios';
		end if;
		insert into public.horarios (negocio_id, dia, cerrado) values (fila.id, dia, false);
		orden := 0;
		for turno in select * from jsonb_array_elements(valor) loop
			abre := public.campo_texto(turno, 'abre');
			cierra := public.campo_texto(turno, 'cierra');
			-- Mismo formato que el esquema del sitio ("09:00"); cierre menor que apertura cruza la medianoche.
			if abre !~ '^([01]\d|2[0-3]):[0-5]\d$' or cierra !~ '^([01]\d|2[0-3]):[0-5]\d$' or abre = cierra then
				raise exception 'datos_invalidos' using detail = 'turnos';
			end if;
			orden := orden + 1;
			insert into public.turnos (negocio_id, dia, abre, cierra, orden)
			values (fila.id, dia, abre::time, cierra::time, orden);
		end loop;
	end loop;

	-- Promoción: una por negocio; null la quita.
	delete from public.promociones p where p.negocio_id = fila.id;
	if jsonb_typeof(promocion) = 'object' then
		fecha_inicio := public.campo_texto(promocion, 'fecha_inicio')::date;
		fecha_fin := public.campo_texto(promocion, 'fecha_fin', false)::date;
		if fecha_fin < fecha_inicio then
			raise exception 'datos_invalidos' using detail = 'fecha_fin';
		end if;
		insert into public.promociones (negocio_id, texto, fecha_inicio, fecha_fin)
		values (fila.id, public.campo_texto(promocion, 'texto'), fecha_inicio, fecha_fin);
	end if;

	return jsonb_build_object(
		'id', fila.id,
		'rutas_borradas', to_jsonb(public.limpiar_imagenes(array[logo_anterior]))
	);
end;
$$;

-- Borra un negocio (promoción, horarios, turnos y menú caen en cascada) y devuelve la ruta
-- de su logo si ya nadie lo usa.
create function public.borrar_negocio(id text) returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
	logo uuid;
begin
	perform public.exigir_administrador();

	select n.logo_id into logo from public.negocios n where n.id = borrar_negocio.id;
	delete from public.negocios n where n.id = borrar_negocio.id;
	if not found then
		raise exception 'no_encontrado';
	end if;

	return public.limpiar_imagenes(array[logo]);
end;
$$;

revoke execute on function public.guardar_negocio(jsonb) from public, anon;
revoke execute on function public.borrar_negocio(text) from public, anon;
grant execute on function public.guardar_negocio(jsonb) to authenticated;
grant execute on function public.borrar_negocio(text) to authenticated;
