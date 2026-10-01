-- Tablas de contenido del sitio (SPEC 06).
-- Una tabla por colección de src/content.config.ts, con los mismos campos en español y snake_case.
-- Las tablas de colección conservan el id de texto de los JSON originales y llevan es_ejemplo;
-- las tablas hijas lo heredan de su registro y guardan el orden del arreglo en `orden`.
-- RLS queda activado sin políticas: el build lee con la llave secreta y nada se lee desde fuera.

create table imagenes (
	id uuid primary key default gen_random_uuid(),
	-- Ruta dentro del bucket `imagenes`: "peludos/luna.jpg".
	ruta text not null unique,
	ancho int not null check (ancho > 0),
	alto int not null check (alto > 0)
);

create table refugio (
	id text primary key check (id = 'refugio'),
	nombre text not null,
	frase text not null,
	ubicacion text not null,
	-- Solo dígitos con lada, listo para wa.me.
	whatsapp text not null check (whatsapp ~ '^\d{10,15}$'),
	logo_id uuid not null references imagenes on delete restrict,
	foto_principal_id uuid not null references imagenes on delete restrict,
	es_ejemplo boolean not null
);

create table redes (
	id text primary key,
	red text not null check (red in ('facebook', 'instagram', 'facebook_sos', 'tiktok')),
	etiqueta text not null,
	url text not null,
	orden int not null,
	es_ejemplo boolean not null
);

create table categorias (
	id text primary key,
	nombre text not null,
	orden int not null,
	es_ejemplo boolean not null
);

create table bloques_contenido (
	id text primary key,
	seccion text not null,
	titulo text not null,
	texto text not null,
	orden int not null,
	publicado boolean not null,
	es_ejemplo boolean not null
);

create table imagenes_bloque (
	bloque_id text not null references bloques_contenido on delete cascade,
	imagen_id uuid not null references imagenes on delete restrict,
	orden int not null,
	primary key (bloque_id, orden)
);

create table problematicas (
	id text primary key,
	titulo text not null,
	texto text not null,
	-- Nombre de Lucide en kebab-case.
	icono text not null,
	etiqueta_cifra text not null,
	cifra text,
	fecha_cifra date,
	fuente text,
	enlace_texto text,
	enlace_url text,
	enlace_sensible boolean,
	orden int not null,
	publicada boolean not null,
	es_ejemplo boolean not null,
	-- El enlace va completo o no va.
	check (
		(enlace_texto is null and enlace_url is null and enlace_sensible is null)
		or (enlace_texto is not null and enlace_url is not null and enlace_sensible is not null)
	)
);

create table peludos (
	id text primary key,
	nombre text not null,
	especie text not null check (especie in ('perro', 'gato')),
	-- Cómo se nombra en la tarjeta: "Perrita", "Cachorro", "Gata".
	descripcion_especie text not null,
	edad text not null,
	tamano text not null check (tamano in ('pequeño', 'mediano', 'grande')),
	descripcion text,
	rasgos text[] not null check (cardinality(rasgos) = 2),
	orden int not null,
	estado text not null check (estado in ('disponible', 'en_proceso', 'adoptado')),
	es_ejemplo boolean not null
);

create table fotos_peludo (
	peludo_id text not null references peludos on delete cascade,
	imagen_id uuid not null references imagenes on delete restrict,
	orden int not null,
	primary key (peludo_id, orden)
);

create table campanas (
	id text primary key,
	fecha date not null,
	costo numeric not null,
	lugar text not null,
	horario text not null,
	forma_pago text not null,
	cupo int,
	cartel_id uuid references imagenes on delete restrict,
	estado text not null check (estado in ('proxima', 'pasada')),
	es_ejemplo boolean not null
);

create table necesidades (
	id text primary key,
	tipo text not null check (tipo in ('alimento', 'medicina', 'cobijas', 'limpieza', 'otro')),
	descripcion text not null,
	urgencia text not null check (urgencia in ('urgente', 'necesaria')),
	fecha_vigencia date not null,
	es_ejemplo boolean not null
);

create table destinos_donativo (
	id text primary key,
	destino text not null,
	cubre text not null,
	monto numeric not null,
	equivalencia text not null,
	orden int not null,
	es_ejemplo boolean not null
);

create table registros_cifras (
	id text primary key,
	mes text not null unique check (mes ~ '^\d{4}-\d{2}$'),
	animales_recibidos int,
	rescates int,
	adopciones int,
	esterilizaciones int,
	notas text,
	es_ejemplo boolean not null
);

create table gastos_registro (
	registro_id text not null references registros_cifras on delete cascade,
	concepto text not null,
	monto numeric not null,
	orden int not null,
	primary key (registro_id, orden)
);

create table anuncios (
	id text primary key,
	tipo text not null check (tipo in ('patrocinio_local', 'automatico')),
	anunciante text not null,
	texto text not null,
	enlace text not null,
	posicion text not null,
	vigencia_inicio date not null,
	vigencia_fin date not null,
	activo boolean not null,
	es_ejemplo boolean not null
);

-- El id es el slug de /colabora/{id}.
create table negocios (
	id text primary key,
	nombre text not null,
	categoria_id text not null references categorias on delete restrict,
	descripcion_corta text not null,
	logo_id uuid references imagenes on delete restrict,
	direccion text not null,
	latitud double precision,
	longitud double precision,
	whatsapp text check (whatsapp ~ '^\d{10,15}$'),
	estado text not null check (estado in ('borrador', 'publicado', 'pausado')),
	porcentaje_aporte numeric not null check (porcentaje_aporte between 0 and 100),
	fecha_alta date not null,
	es_ejemplo boolean not null
);

-- Una promoción por negocio, como en el esquema original.
create table promociones (
	negocio_id text primary key references negocios on delete cascade,
	texto text not null,
	fecha_inicio date not null,
	fecha_fin date
);

-- Un día sin fila es "por confirmar"; `cerrado` marca el día cerrado y sus turnos van en `turnos`.
create table horarios (
	negocio_id text not null references negocios on delete cascade,
	dia text not null check (dia in ('lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom')),
	cerrado boolean not null,
	primary key (negocio_id, dia)
);

-- Un turno con `cierra` menor que `abre` cruza la medianoche ("13:00" a "00:30").
create table turnos (
	id bigint generated always as identity primary key,
	negocio_id text not null,
	dia text not null,
	abre time not null,
	cierra time not null,
	orden int not null,
	foreign key (negocio_id, dia) references horarios on delete cascade
);

create table grupos_menu (
	id bigint generated always as identity primary key,
	negocio_id text not null references negocios on delete cascade,
	nombre text not null,
	orden int not null
);

create table secciones_menu (
	id bigint generated always as identity primary key,
	grupo_id bigint not null references grupos_menu on delete cascade,
	nombre text not null,
	nota text,
	orden int not null
);

create table platillos (
	id bigint generated always as identity primary key,
	seccion_id bigint not null references secciones_menu on delete cascade,
	nombre text not null,
	descripcion text,
	es_extra boolean not null,
	disponible boolean not null,
	orden int not null
);

create table precios (
	id bigint generated always as identity primary key,
	platillo_id bigint not null references platillos on delete cascade,
	etiqueta text,
	monto numeric,
	-- Un precio sin monto necesita texto alterno, por ejemplo "Incluido".
	texto_alterno text,
	orden int not null,
	check (monto is not null or texto_alterno is not null)
);

create index on negocios (categoria_id);
create index on turnos (negocio_id, dia);
create index on grupos_menu (negocio_id);
create index on secciones_menu (grupo_id);
create index on platillos (seccion_id);
create index on precios (platillo_id);

alter table imagenes enable row level security;
alter table refugio enable row level security;
alter table redes enable row level security;
alter table categorias enable row level security;
alter table bloques_contenido enable row level security;
alter table imagenes_bloque enable row level security;
alter table problematicas enable row level security;
alter table peludos enable row level security;
alter table fotos_peludo enable row level security;
alter table campanas enable row level security;
alter table necesidades enable row level security;
alter table destinos_donativo enable row level security;
alter table registros_cifras enable row level security;
alter table gastos_registro enable row level security;
alter table anuncios enable row level security;
alter table negocios enable row level security;
alter table promociones enable row level security;
alter table horarios enable row level security;
alter table turnos enable row level security;
alter table grupos_menu enable row level security;
alter table secciones_menu enable row level security;
alter table platillos enable row level security;
alter table precios enable row level security;
