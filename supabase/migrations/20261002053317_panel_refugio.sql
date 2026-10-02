-- Panel del refugio (SPEC 08): peludos, campañas, necesidades, textos y registro de cifras.
-- Las cuentas refugio y administrador leen estas tablas por la API y escriben solo con las funciones
-- RPC de abajo, que validan, arman los id y guardan cada registro con sus hijas en una transacción.

-- Recompilación: el deploy hook se llama una vez por transacción, no una por sentencia.
-- Así guardar un peludo con fotos (imagenes, peludos y fotos_peludo) inicia un solo despliegue.
create or replace function public.avisar_cambio() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	-- Primera sentencia de la transacción: marca y llama al hook. Las siguientes no hacen nada.
	if current_setting('recompilar.avisado', true) is distinct from 'si' then
		perform set_config('recompilar.avisado', 'si', true); -- true = solo esta transacción
		perform public.recompilar_sitio();
	end if;
	return null;
end;
$$;

revoke execute on function public.avisar_cambio() from public, anon, authenticated;

-- El sitio no muestra el registro de cifras (RF-29): guardarlo no inicia un despliegue.
drop trigger recompilar on registros_cifras;
drop trigger recompilar on gastos_registro;

-- Nadie escribe directo en las tablas de contenido por la API: el panel usa las funciones RPC
-- y el resto se edita en Studio. Sin esto, un update sin política no falla, solo no cambia nada.
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
		execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', tabla);
	end loop;
end;
$$;

-- Lectura para el panel: las cuentas con rol (y sesión aal2, que rol_panel() exige) leen las tablas
-- que editan. anon sigue sin políticas.
do $$
declare
	tabla text;
begin
	foreach tabla in array array[
		'peludos', 'fotos_peludo', 'campanas', 'necesidades', 'bloques_contenido', 'imagenes_bloque',
		'registros_cifras', 'gastos_registro', 'imagenes'
	] loop
		execute format(
			'create policy %I on public.%I for select to authenticated '
			'using ((select public.rol_panel()) is not null)',
			tabla || '_lee_panel',
			tabla
		);
	end loop;
end;
$$;

-- Fotos del panel en el bucket `imagenes`, solo en las carpetas del refugio.
-- select lo pide la API de Storage para borrar; el bucket ya es público para leer por URL.
create policy imagenes_panel_sube on storage.objects
	for insert to authenticated
	with check (
		bucket_id = 'imagenes'
		and (storage.foldername(name))[1] in ('peludos', 'campanas', 'bloques')
		and (select public.rol_panel()) is not null
	);

create policy imagenes_panel_lee on storage.objects
	for select to authenticated
	using (
		bucket_id = 'imagenes'
		and (storage.foldername(name))[1] in ('peludos', 'campanas', 'bloques')
		and (select public.rol_panel()) is not null
	);

create policy imagenes_panel_borra on storage.objects
	for delete to authenticated
	using (
		bucket_id = 'imagenes'
		and (storage.foldername(name))[1] in ('peludos', 'campanas', 'bloques')
		and (select public.rol_panel()) is not null
	);

-- Auxiliares de las funciones RPC. Solo las llaman otras funciones; nadie las ejecuta por la API.

-- Lanza 'sin_permiso' si la sesión no es aal2 o la cuenta no tiene rol.
create function public.exigir_panel() returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if (select public.rol_panel()) is null then
		raise exception 'sin_permiso';
	end if;
end;
$$;

-- Texto de un campo de `datos` sin espacios a los lados; vacío cuenta como null.
-- Con `requerido`, un campo vacío lanza 'datos_invalidos'.
create function public.campo_texto(datos jsonb, campo text, requerido boolean default true) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	valor text := nullif(btrim(datos ->> campo), '');
begin
	if requerido and valor is null then
		raise exception 'datos_invalidos' using detail = campo;
	end if;
	return valor;
end;
$$;

-- Número entero opcional y no negativo; vacío es null, nunca 0 (RF-29).
create function public.campo_cifra(datos jsonb, campo text) returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
	valor int := nullif(btrim(datos ->> campo), '')::int;
begin
	if valor < 0 then
		raise exception 'datos_invalidos' using detail = campo;
	end if;
	return valor;
end;
$$;

-- "Pequeño Óscar" → "pequeno-oscar". Sin letras ni números queda "registro".
create function public.slug(texto text) returns text
language sql
immutable
set search_path = ''
as $$
	select coalesce(
		nullif(
			btrim(
				regexp_replace(
					translate(lower(texto), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
					'[^a-z0-9]+', '-', 'g'
				),
				'-'
			),
			''
		),
		'registro'
	);
$$;

-- `base` si no existe en `tabla`; si existe, base-2, base-3…
create function public.id_libre(base text, tabla text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	candidato text := base;
	n int := 1;
	ocupado boolean;
begin
	loop
		execute format('select exists (select 1 from public.%I where id = $1)', tabla) into ocupado using candidato;
		exit when not ocupado;
		n := n + 1;
		candidato := base || '-' || n;
	end loop;
	return candidato;
end;
$$;

-- Devuelve el id de una foto de `datos`: { "imagen_id" } ya existe; { "ruta", "ancho", "alto" } es nueva
-- y se inserta en imagenes. Las rutas nuevas solo pueden estar en las carpetas del panel.
create function public.guardar_imagen(foto jsonb) returns uuid
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

	if coalesce(foto ->> 'ruta', '') !~ '^(peludos|campanas|bloques)/[A-Za-z0-9._-]+$' then
		raise exception 'datos_invalidos' using detail = 'ruta';
	end if;

	insert into public.imagenes (ruta, ancho, alto)
	values (foto ->> 'ruta', (foto ->> 'ancho')::int, (foto ->> 'alto')::int)
	returning id into nueva;
	return nueva;
end;
$$;

-- Borra de imagenes las filas de `ids` que ya no usa ninguna tabla y devuelve sus rutas,
-- para que el navegador borre los archivos del bucket.
create function public.limpiar_imagenes(ids uuid[]) returns text[]
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
			and not exists (select 1 from public.refugio r where i.id in (r.logo_id, r.foto_principal_id))
			and not exists (select 1 from public.negocios n where n.logo_id = i.id)
		returning i.ruta
	)
	select coalesce(array_agg(ruta), '{}') from borradas;
$$;

revoke execute on function public.exigir_panel() from public, anon, authenticated;
revoke execute on function public.campo_texto(jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public.campo_cifra(jsonb, text) from public, anon, authenticated;
revoke execute on function public.slug(text) from public, anon, authenticated;
revoke execute on function public.id_libre(text, text) from public, anon, authenticated;
revoke execute on function public.guardar_imagen(jsonb) from public, anon, authenticated;
revoke execute on function public.limpiar_imagenes(uuid[]) from public, anon, authenticated;

-- Necesidad del mes (RF-26). Sin "id" crea una con id {tipo}-{fecha_vigencia}; con "id" la actualiza.
create function public.guardar_necesidad(datos jsonb) returns jsonb
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

	if fila.id is null then
		fila.id := public.id_libre(fila.tipo || '-' || fila.fecha_vigencia, 'necesidades');
		fila.es_ejemplo := false;
		insert into public.necesidades values (fila.*);
	else
		update public.necesidades n
		set tipo = fila.tipo, descripcion = fila.descripcion, urgencia = fila.urgencia,
			fecha_vigencia = fila.fecha_vigencia
		where n.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
	end if;

	return jsonb_build_object('id', fila.id, 'rutas_borradas', '[]'::jsonb);
end;
$$;

-- Borra un registro del panel (las hijas caen en cascada) y devuelve las rutas de imágenes sin uso.
create function public.borrar_contenido(tabla text, id text) returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
	imagenes uuid[];
	borradas int;
begin
	perform public.exigir_panel();

	if tabla not in ('peludos', 'campanas', 'necesidades', 'bloques_contenido', 'registros_cifras') then
		raise exception 'sin_permiso';
	end if;

	imagenes := case tabla
		when 'peludos' then
			array(select f.imagen_id from public.fotos_peludo f where f.peludo_id = borrar_contenido.id)
		when 'bloques_contenido' then
			array(select b.imagen_id from public.imagenes_bloque b where b.bloque_id = borrar_contenido.id)
		when 'campanas' then
			array(select c.cartel_id from public.campanas c where c.id = borrar_contenido.id and c.cartel_id is not null)
		else '{}'::uuid[]
	end;

	execute format('delete from public.%I where id = $1', tabla) using borrar_contenido.id;
	-- execute no cambia found; row_count sí.
	get diagnostics borradas = row_count;
	if borradas = 0 then
		raise exception 'no_encontrado';
	end if;

	return public.limpiar_imagenes(imagenes);
end;
$$;

revoke execute on function public.guardar_necesidad(jsonb) from public, anon;
revoke execute on function public.borrar_contenido(text, text) from public, anon;
grant execute on function public.guardar_necesidad(jsonb) to authenticated;
grant execute on function public.borrar_contenido(text, text) to authenticated;

-- Cifras del mes (RF-29), solo para el panel. Sin "id" crea el mes (su id es el mes, "2026-10");
-- con "id" lo actualiza. Una cifra vacía queda en null, nunca en 0. Reemplaza los gastos.
create function public.guardar_registro_cifras(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.registros_cifras;
	gasto jsonb;
	monto numeric;
	orden int := 0;
begin
	perform public.exigir_panel();

	fila.id := datos ->> 'id';
	fila.animales_recibidos := public.campo_cifra(datos, 'animales_recibidos');
	fila.rescates := public.campo_cifra(datos, 'rescates');
	fila.adopciones := public.campo_cifra(datos, 'adopciones');
	fila.esterilizaciones := public.campo_cifra(datos, 'esterilizaciones');
	fila.notas := public.campo_texto(datos, 'notas', false);

	if fila.id is null then
		fila.mes := public.campo_texto(datos, 'mes');
		if exists (select 1 from public.registros_cifras r where r.mes = fila.mes or r.id = fila.mes) then
			raise exception 'mes_repetido';
		end if;
		fila.id := fila.mes;
		fila.es_ejemplo := false;
		insert into public.registros_cifras values (fila.*);
	else
		update public.registros_cifras r
		set animales_recibidos = fila.animales_recibidos, rescates = fila.rescates,
			adopciones = fila.adopciones, esterilizaciones = fila.esterilizaciones, notas = fila.notas
		where r.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
	end if;

	delete from public.gastos_registro g where g.registro_id = fila.id;
	for gasto in select * from jsonb_array_elements(coalesce(datos -> 'gastos', '[]'::jsonb)) loop
		monto := public.campo_texto(gasto, 'monto')::numeric;
		if monto < 0 then
			raise exception 'datos_invalidos' using detail = 'monto';
		end if;
		orden := orden + 1;
		insert into public.gastos_registro (registro_id, concepto, monto, orden)
		values (fila.id, public.campo_texto(gasto, 'concepto'), monto, orden);
	end loop;

	return jsonb_build_object('id', fila.id, 'rutas_borradas', '[]'::jsonb);
end;
$$;

revoke execute on function public.guardar_registro_cifras(jsonb) from public, anon;
grant execute on function public.guardar_registro_cifras(jsonb) to authenticated;

-- Campaña de esterilización (RF-12, RF-24). Sin "id" crea una con id = su fecha ("2026-11-14");
-- con "id" la actualiza. "cartel" es null, { imagen_id } o { ruta, ancho, alto }.
create function public.guardar_campana(datos jsonb) returns jsonb
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
			forma_pago = fila.forma_pago, cupo = fila.cupo, cartel_id = fila.cartel_id, estado = fila.estado
		where c.id = fila.id;
	end if;

	return jsonb_build_object(
		'id', fila.id,
		'rutas_borradas', to_jsonb(public.limpiar_imagenes(array[cartel_anterior]))
	);
end;
$$;

revoke execute on function public.guardar_campana(jsonb) from public, anon;
grant execute on function public.guardar_campana(jsonb) to authenticated;

-- Reemplaza las fotos de un peludo (fotos_peludo) o de un bloque (imagenes_bloque) por las de `fotos`,
-- en ese orden, y devuelve las rutas de las imágenes que dejaron de usarse.
create function public.reemplazar_fotos(tabla text, id text, fotos jsonb) returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
	anteriores uuid[];
	foto jsonb;
	orden int := 0;
begin
	if jsonb_array_length(fotos) > 4 then
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

revoke execute on function public.reemplazar_fotos(text, text, jsonb) from public, anon, authenticated;

-- Peludo en adopción (RF-11, RF-30). Sin "id" crea uno con el slug del nombre (luna, luna-2…) al final
-- del orden; con "id" lo actualiza. "rasgos" lleva exactamente 2 y "fotos" hasta 4.
create function public.guardar_peludo(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.peludos;
	fotos jsonb := coalesce(datos -> 'fotos', '[]'::jsonb);
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

	if fila.id is null then
		fila.id := public.id_libre(public.slug(fila.nombre), 'peludos');
		fila.orden := (select coalesce(max(p.orden), 0) + 1 from public.peludos p);
		fila.es_ejemplo := false;
		insert into public.peludos values (fila.*);
	else
		update public.peludos p
		set nombre = fila.nombre, especie = fila.especie, descripcion_especie = fila.descripcion_especie,
			edad = fila.edad, tamano = fila.tamano, descripcion = fila.descripcion, rasgos = fila.rasgos,
			estado = fila.estado
		where p.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
	end if;

	return jsonb_build_object(
		'id', fila.id,
		'rutas_borradas', to_jsonb(public.reemplazar_fotos('fotos_peludo', fila.id, fotos))
	);
end;
$$;

-- Sube (-1) o baja (1) un peludo, o un bloque dentro de su sección, un lugar en el orden.
-- Renumera 1, 2, 3… para que dos filas con el mismo `orden` también se puedan intercambiar.
create function public.mover_contenido(tabla text, id text, direccion int) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	seccion_bloque text;
	ids text[];
	posicion int;
	destino int;
begin
	perform public.exigir_panel();

	if tabla not in ('peludos', 'bloques_contenido') or direccion not in (-1, 1) then
		raise exception 'sin_permiso';
	end if;

	if tabla = 'bloques_contenido' then
		select b.seccion into seccion_bloque from public.bloques_contenido b where b.id = mover_contenido.id;
		ids := array(
			select b.id from public.bloques_contenido b where b.seccion = seccion_bloque order by b.orden, b.id
		);
	else
		ids := array(select p.id from public.peludos p order by p.orden, p.id);
	end if;

	posicion := array_position(ids, mover_contenido.id);
	if posicion is null then
		raise exception 'no_encontrado';
	end if;
	destino := posicion + direccion;
	if destino < 1 or destino > cardinality(ids) then
		return;
	end if;
	ids[posicion] := ids[destino];
	ids[destino] := mover_contenido.id;

	execute format(
		'update public.%I t set orden = n.orden from unnest($1::text[]) with ordinality as n(id, orden) '
		'where t.id = n.id and t.orden is distinct from n.orden',
		tabla
	) using ids;
end;
$$;

revoke execute on function public.guardar_peludo(jsonb) from public, anon;
revoke execute on function public.mover_contenido(text, text, int) from public, anon;
grant execute on function public.guardar_peludo(jsonb) to authenticated;
grant execute on function public.mover_contenido(text, text, int) to authenticated;

-- Texto del refugio (bloques_contenido, RF-22). Sin "id" crea uno en una de las 6 secciones, con el slug
-- del título como id y al final de su sección; con "id" lo actualiza sin cambiar su sección.
-- "fotos" lleva hasta 4 imágenes.
create function public.guardar_bloque(datos jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	fila public.bloques_contenido;
	fotos jsonb := coalesce(datos -> 'fotos', '[]'::jsonb);
begin
	perform public.exigir_panel();

	fila.id := datos ->> 'id';
	fila.titulo := public.campo_texto(datos, 'titulo');
	fila.texto := public.campo_texto(datos, 'texto');
	fila.publicado := coalesce((datos ->> 'publicado')::boolean, false);

	if fila.id is null then
		fila.seccion := public.campo_texto(datos, 'seccion');
		if fila.seccion not in (
			'quienes_somos', 'proceso_adopcion', 'esterilizacion_por_que', 'esterilizacion_cuidados',
			'esterilizacion_preguntas', 'voluntariado'
		) then
			raise exception 'datos_invalidos' using detail = 'seccion';
		end if;
		fila.id := public.id_libre(public.slug(fila.titulo), 'bloques_contenido');
		fila.orden := (
			select coalesce(max(b.orden), 0) + 1 from public.bloques_contenido b where b.seccion = fila.seccion
		);
		fila.es_ejemplo := false;
		insert into public.bloques_contenido values (fila.*);
	else
		update public.bloques_contenido b
		set titulo = fila.titulo, texto = fila.texto, publicado = fila.publicado
		where b.id = fila.id;
		if not found then
			raise exception 'no_encontrado';
		end if;
	end if;

	return jsonb_build_object(
		'id', fila.id,
		'rutas_borradas', to_jsonb(public.reemplazar_fotos('imagenes_bloque', fila.id, fotos))
	);
end;
$$;

revoke execute on function public.guardar_bloque(jsonb) from public, anon;
grant execute on function public.guardar_bloque(jsonb) to authenticated;
