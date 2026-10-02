# SPEC 13 — Adopciones: galería con "me gusta" y ficha de cada peludo

> **Estado:** Aprobado
> **Depende de:** SPEC 03, SPEC 06, SPEC 08, SPEC 11, SPEC 12
> **Fecha:** 2026-10-02
> **Objetivo:** Cambiar las tarjetas de `/adopta` por una galería de fotos con filtro perros/gatos y un "me gusta" animado con contador público, y dar a cada peludo una ficha propia `/adopta/{id}` con sus fotos, su historia, su convivencia, una línea de tiempo con el padrino de su esterilización y un botón directo de WhatsApp para adoptarlo.

## Por qué existe esta spec

Hoy `/adopta` es una cuadrícula de tarjetas iguales: una sola foto, dos rasgos y un botón de WhatsApp.
El panel ya permite hasta 4 fotos y una descripción por peludo, pero el sitio solo muestra la primera foto y nunca la descripción.
El corazón de favorito solo vive en el dispositivo y no tiene ningún efecto visible.

La idea sale de las apps de fotos y de los sitios de adopción (Instagram, Petfinder): fotos grandes que invitan a recorrerlas, un corazón con su animación y su número, y una página por animal con su historia que se pueda mandar por WhatsApp.

Esta spec toma el número 13; los anuncios (RF-18) pasan a la 14.

## Alcance

**Dentro:**

- `TarjetaPeludo` nueva: foto grande 4:5 con nombre y edad encima, número de fotos, corazón de "me gusta" con contador, y toda la tarjeta lleva a la ficha. La usan `/adopta` y el carrusel de la portada.
- Galería en `/adopta` (`GaleriaPeludos`, reemplaza a `CuadriculaPeludos`) con chips Todos · Perros · Gatos · Mis favoritos, y el filtro en la URL (`?ver=`).
- Ficha `/adopta/{id}` por peludo disponible: carrusel de fotos, doble toque sobre la foto para dar "me gusta", datos (especie, edad, talla, rasgos), convivencia con perros, gatos y niños, "Su historia", línea de tiempo "Su camino en el refugio", enlace al proceso de adopción y barra fija con "Quiero adoptar a {nombre}" (WhatsApp) y "Compartir".
- "Me gusta" público: un "me gusta" por dispositivo y peludo, guardado en Supabase y contado en vivo desde el navegador, sin recompilar el sitio.
- Animación del "me gusta": latido con chispas de corazones en el botón y un corazón grande sobre la foto con el doble toque; nada con "reducir movimiento".
- Datos nuevos: convivencia (`convive_perros`, `convive_gatos`, `convive_ninos`) en `peludos`, tabla `hitos_peludo` (línea de tiempo con el padrino de la esterilización) y tabla `me_gusta`.
- Panel: convivencia, editor de hitos y hasta 8 fotos en `/admin/peludos/editar`, y el número de "me gusta" en la lista `/admin/peludos`.
- Eventos de Umami nuevos y el aviso de privacidad al día.

**Fuera de alcance (specs futuras):**

- Modo deslizar tipo "match".
- Formulario de solicitud de adopción guardado en Supabase.
- Fichas de peludos en proceso o adoptados, y una sección de "Finales felices".
- Padrinos como entidad propia (tabla, página o muro de agradecimiento) y enlaces a sus redes.
- Ordenar la galería por "más queridos" o mostrar un ranking.
- Visor de fotos a pantalla completa en la ficha.
- Mandar al servidor los favoritos guardados antes de esta spec.
- Cambios a `/esterilizacion`, `/donar` o al botón "Quiero apadrinar".
- Anuncios (SPEC 14, RF-18).

## Modelo de datos

### Migración `adopciones_galeria_y_ficha`

```sql
-- Convivencia: el refugio muchas veces no lo ha probado, por eso hay tres valores.
alter table peludos
	add column convive_perros text not null default 'no_sabemos' check (convive_perros in ('si', 'no', 'no_sabemos')),
	add column convive_gatos text not null default 'no_sabemos' check (convive_gatos in ('si', 'no', 'no_sabemos')),
	add column convive_ninos text not null default 'no_sabemos' check (convive_ninos in ('si', 'no', 'no_sabemos'));

-- Línea de tiempo "Su camino en el refugio".
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

-- Un "me gusta" por dispositivo y peludo. `dispositivo` es un uuid al azar del navegador.
create table me_gusta (
	peludo_id text not null references peludos on delete cascade,
	dispositivo uuid not null,
	creado_en timestamptz not null default now(),
	primary key (peludo_id, dispositivo)
);
create index me_gusta_dispositivo_creado on me_gusta (dispositivo, creado_en);
create index me_gusta_creado on me_gusta (creado_en);
```

- `hitos_peludo` sigue el patrón de las tablas de contenido: RLS sin políticas para `anon`, política de lectura del panel (`rol_panel()` no nulo) y el trigger `recompilar`.
- `me_gusta` tiene RLS y ningún permiso para `anon` ni `authenticated`: solo se toca con las dos RPC de abajo. **No** tiene trigger `recompilar`: un "me gusta" no publica el sitio.
- Un peludo admite hasta 20 hitos.

### RPC

| Función | Quién | Qué hace |
| --- | --- | --- |
| `marcar_me_gusta(peludo_id text, dispositivo uuid, activo boolean) returns int` | `anon`, `authenticated` | `activo` inserta (`on conflict do nothing`) o borra la fila, y devuelve el total del peludo. Solo para peludos `disponible`: si no, `no_encontrado`. Más de 30 filas de ese dispositivo en la última hora: `limite_me_gusta`. Más de 600 filas nuevas en total en la última hora: `limite_me_gusta`. |
| `conteos_me_gusta() returns table (peludo_id text, total int)` | `anon`, `authenticated` | Total por peludo `disponible`, solo los que tienen 1 o más. |
| `guardar_peludo(datos jsonb)` (cambia) | panel | Acepta `convive_perros`, `convive_gatos`, `convive_ninos` y `hitos`. Sin la clave `hitos`, no toca los hitos; sin una clave `convive_*`, deja su valor. Así el panel de `main` sigue funcionando si la migración llega antes del merge. |
| `reemplazar_fotos` (cambia) | interna | Límite de 8 fotos para `fotos_peludo`; sigue en 4 para `imagenes_bloque`. |

Las dos RPC de "me gusta" son `security definer` con `set search_path = ''`, como las del panel.

Cada hito de `datos.hitos` llega así:

```json
{ "fecha": "2026-08-14", "tipo": "esterilizacion", "texto": null, "padrino": "Familia López" }
```

`guardar_peludo` revisa los hitos: tipo válido, fecha no posterior a hoy en México, `padrino` solo en `esterilizacion`, `texto` obligatorio en `otro` y 20 como máximo. Si algo falla, lanza `datos_invalidos` con detalle `hitos`. Borra los hitos del peludo y los vuelve a insertar ordenados por fecha (`orden` 1, 2, 3…).

### Esquema (`src/content.config.ts`)

```ts
const convivencia = z.enum(['si', 'no', 'no_sabemos']);

const peludos = defineCollection({
	loader: cargadorPeludos(),
	schema: z.object({
		// … campos actuales …
		convive_perros: convivencia,
		convive_gatos: convivencia,
		convive_ninos: convivencia,
		hitos: z.array(
			z.object({
				fecha: z.coerce.date(),
				tipo: z.enum(['llegada', 'esterilizacion', 'vacunas', 'desparasitacion', 'otro']),
				texto: z.string().nullable(),
				padrino: z.string().nullable(),
			}),
		),
		es_ejemplo,
	}),
});
```

`cargadorPeludos` agrega `hitos_peludo(orden, fecha, tipo, texto, padrino)` a su `select` y los entrega en `orden`. `me_gusta` nunca pasa por los cargadores.

### En el navegador (`src/lib/meGusta.ts`, sin imports de Astro)

| Clave de `localStorage` | Contenido |
| --- | --- |
| `favoritos:v1` | Ids de peludos con "me gusta" en este dispositivo (ya existe; la usa el chip "Mis favoritos"). |
| `dispositivo:v1` | Uuid de `crypto.randomUUID()`, creado la primera vez que se da un "me gusta". |

Funciones: `leerFavoritos()`, `alternar(id)`, `cargarConteos()` y `enviar(id, activo)`.
Las RPC se llaman con `fetch` a `${PUBLIC_SUPABASE_URL}/rest/v1/rpc/…` y la llave publicable. Las páginas públicas no cargan `@supabase/supabase-js`.
`cargarConteos()` hace una sola petición por página, aunque haya varias tarjetas.

### Comportamiento del corazón

1. Al tocarlo cambia `aria-pressed`, se guarda en `favoritos:v1`, el número sube o baja 1 al momento y corre la animación (solo al dar, no al quitar).
2. Se llama a `marcar_me_gusta` y el número toma el total que devuelve.
3. Si la llamada falla (sin red, `limite_me_gusta`), el favorito local se queda y el número vuelve a como estaba. No se muestra ningún mensaje.
4. Sin `localStorage`, el corazón alterna y anima, pero no se manda nada al servidor (sin un id estable, cada visita contaría de nuevo).
5. Sin conteos (error o sin JS), no se muestra ningún número. Con total 0 tampoco.

El doble toque o doble clic sobre una foto de la ficha solo **da** el "me gusta", nunca lo quita, y muestra el corazón grande aunque ya estuviera dado.

### Textos de la ficha

| Campo | `si` | `no` | `no_sabemos` |
| --- | --- | --- | --- |
| `convive_perros` (ícono `dog`) | Convive con perros | Mejor sin perros | Con perros: por conocer |
| `convive_gatos` (ícono `cat`) | Convive con gatos | Mejor sin gatos | Con gatos: por conocer |
| `convive_ninos` (ícono `baby`) | Convive con niños | Mejor sin niños | Con niños: por conocer |

| Tipo de hito | Título | Ícono |
| --- | --- | --- |
| `llegada` | Llegó al refugio | `house` |
| `esterilizacion` | Esterilización | `heart-handshake` |
| `vacunas` | Vacunas | `syringe` |
| `desparasitacion` | Desparasitación | `pill` |
| `otro` | El `texto` del hito | `sparkles` |

Cada hito muestra su fecha (`formatearFecha`) y su `texto` cuando lo tiene.
En `esterilizacion`, con padrino: "Gracias a {padrino}, que apadrinó su esterilización."; sin padrino: "La cubrió el refugio."

Talla: `pequeño`, `mediano` y `grande` se leen "Talla pequeña", "Talla mediana" y "Talla grande" (`textoTalla` en `src/lib/formato.ts`).

### Eventos de Umami

| Evento | Atributos | Dónde |
| --- | --- | --- |
| `me_gusta` | `peludo`, `origen`: `galeria`, `portada` o `ficha` | Al dar (no al quitar) un "me gusta", con `registrar()` |
| `abrir_peludo` | `peludo`, `origen`: `galeria` o `portada` | Enlace de `TarjetaPeludo` |
| `compartir` | `peludo` | Botón "Compartir" de la ficha |
| `whatsapp` | `motivo`: `adopcion`, `peludo` (ya existe) | "Quiero adoptar a {nombre}" de la ficha; ya no está en la tarjeta |

## Cambios por archivo

| Archivo | Cambio |
| --- | --- |
| `supabase/migrations/<fecha>_adopciones_galeria_y_ficha.sql` | Columnas de convivencia, `hitos_peludo`, `me_gusta`, sus RLS y triggers, las dos RPC nuevas, `guardar_peludo` y `reemplazar_fotos` |
| `supabase/seed.sql` | Convivencia variada, historia de Luna y Canelo, hitos de ejemplo (uno con padrino "Familia Ejemplo", otro sin padrino), una segunda foto de Luna (`refugio/patio.jpg`) y 3 "me gusta" de Luna |
| `src/content.config.ts` | Convivencia e `hitos` en `peludos` |
| `src/lib/cargadores.ts` | `hitos_peludo` en `cargadorPeludos` |
| `src/lib/formato.ts` | `textoTalla` |
| `src/lib/meGusta.ts` | Nuevo: favoritos, dispositivo, conteos y envío |
| `src/styles/animaciones.css` | `estallido` (botón), `chispa` (corazones pequeños) y `corazon-grande` (foto); solo `transform` y `opacity` |
| `src/components/TarjetaPeludo.astro` | Reescrita; prop `origen` |
| `src/components/CarruselPeludos.astro` | Pasa `origen="portada"`; el script de favoritos sale de la tarjeta |
| `src/components/adopta/GaleriaPeludos.astro` | Nuevo; reemplaza a `CuadriculaPeludos.astro`, que se borra |
| `src/components/adopta/ProcesoAdopcion.astro` | `id="proceso"` en su `<section>` |
| `src/components/adopta/` (ficha) | Nuevos: `FotosPeludo` (carrusel y doble toque), `ConvivenciaPeludo`, `CaminoPeludo` (línea de tiempo) y `BarraPeludo` (WhatsApp y Compartir) |
| `src/pages/adopta.astro` | Usa `GaleriaPeludos` |
| `src/pages/adopta/[id].astro` | Nueva ficha, una por peludo `disponible` |
| `src/components/admin/CampoHitos.astro` y `src/lib/hitosPanel.ts` | Nuevos: editor de hitos |
| `src/pages/admin/peludos/editar.astro` | Convivencia, `CampoHitos` y `CampoFotos maximo={8}` |
| `src/pages/admin/peludos.astro` | Número de "me gusta" por peludo con `conteos_me_gusta` |
| `src/pages/aviso-de-privacidad.astro` | Sección "Me gusta" y eventos nuevos en estadísticas |
| `specs/README.md`, `CLAUDE.md`, `AGENTS.md` | Índice (13 esta, anuncios a la 14), ficha, tablas, `meGusta.ts` y eventos |

### Galería (`/adopta`)

- Rejilla de 2 columnas en teléfono, 3 desde `md` y 4 desde `lg`.
- Chips arriba: "Todos", "Perros {n}", "Gatos {n}" y "Mis favoritos {n}". Perros y Gatos solo aparecen si hay peludos de las dos especies.
- Un chip activo a la vez, con `aria-pressed`; el filtro queda en la URL: `?ver=perros`, `?ver=gatos` o `?ver=favoritos`. Un valor desconocido se trata como "Todos".
- Sin JS: se ven todos los peludos y los chips quedan ocultos.
- Filtro sin resultados: "No hay gatos en adopción por ahora." (o perros) y "Todavía no tienes favoritos. Toca el corazón de un peludo para guardarlo aquí."
- Sin ningún peludo disponible, el mismo aviso con WhatsApp de hoy.

### Ficha (`/adopta/{id}`)

- `getStaticPaths` con `peludosDisponibles()`; un peludo en proceso o adoptado no tiene ficha y su enlace da 404.
- Enlace "← Todos los peludos" a `/adopta`.
- Desde `md`, fotos a la izquierda y datos a la derecha; en teléfono, apilados.
- Carrusel con `scroll-snap`, contador "2 / 5", puntos y flechas desde `sm`. Con una foto no hay controles. Sin fotos, el ícono de su especie.
- `<h1>` con el nombre, el corazón con su contador, "{descripcion_especie} · {edad} · {textoTalla}", los rasgos, la convivencia, "Su historia" (párrafos de `descripcion`, oculto sin ella) y "Su camino en el refugio" (oculto sin hitos).
- Enlace "¿Cómo es adoptar?" a `/adopta#proceso`, solo si hay bloque `proceso_adopcion` publicado.
- Barra fija (slot `barra` de `Layout`): "Quiero adoptar a {nombre}" con el mensaje `Hola, quiero adoptar a {nombre}. La vi en la página de {refugio}.`, y "Compartir".
- "Compartir" usa `navigator.share` con título, texto y URL; sin él, copia la URL y dice "Enlace copiado" por 2 s; sin ninguno de los dos, no se muestra.
- SEO: título `{nombre} busca familia · {refugio}`, descripción `{descripcion_especie}, {edad}.` más el inicio de la historia (hasta 150 caracteres), `imagen` = primera foto.

### Panel

- Tres `<select>` de convivencia ("Sí", "No", "No sabemos").
- `CampoHitos`: filas con fecha, tipo, texto (140) y padrino (60, solo visible con tipo "Esterilización"), botón "Quitar" y "Agregar hito" hasta 20. Se ordenan por fecha al guardar.
- Nota junto al padrino: "Pide permiso antes de publicar su nombre. Puedes usar nombre de pila, una familia o «Anónimo»."
- `CampoFotos` con `maximo={8}`.
- Lista `/admin/peludos`: "♥ {n}" junto a cada peludo disponible con 1 o más.

## Plan de implementación

1. Migración: convivencia, `hitos_peludo` (RLS, política del panel, trigger `recompilar`), `me_gusta` (RLS, índices) y los cambios a `reemplazar_fotos` y `guardar_peludo`. Semilla nueva. Comprobar con `npx supabase db reset` y SQL a mano los límites y validaciones.
2. RPC `marcar_me_gusta` y `conteos_me_gusta` con sus permisos. Comprobar con `curl` y la llave publicable: dar, quitar, peludo adoptado y límite por hora.
3. Esquema, cargador y `textoTalla`. `astro build` compila igual que antes.
4. Panel: convivencia, `CampoHitos` con `hitosPanel.ts`, 8 fotos y el contador en la lista. Guardar un peludo con hitos y ver el despliegue local encolado.
5. `meGusta.ts` y las animaciones en `animaciones.css`.
6. `TarjetaPeludo` nueva y `CarruselPeludos` con `origen`. La portada sigue funcionando con la tarjeta nueva.
7. `GaleriaPeludos` con chips y `?ver=`; `adopta.astro` la usa; borrar `CuadriculaPeludos`; `id="proceso"` en `ProcesoAdopcion`.
8. Ficha `/adopta/[id].astro` con `FotosPeludo`, `ConvivenciaPeludo`, `CaminoPeludo` y `BarraPeludo`.
9. Aviso de privacidad: sección "Me gusta" (id al azar en el navegador, qué se guarda en Supabase, que no incluye nombre ni IP, cómo quitarlo) y los eventos nuevos en estadísticas.
10. `specs/README.md` (13 esta spec, anuncios a la 14), `CLAUDE.md` y `AGENTS.md`.
11. Paso manual en la nube **antes del merge**: `npx supabase db push`. Las columnas tienen valor por defecto y `guardar_peludo` acepta datos sin las claves nuevas, así que `main` sigue funcionando con la migración aplicada.

## Criterios de aceptación

### Datos y RPC

- [ ] Después de `npx supabase db reset`, Luna tiene 2 fotos, historia, 3 hitos (uno de esterilización con padrino "Familia Ejemplo") y 3 "me gusta".
- [ ] `guardar_peludo` con 9 fotos falla con `demasiadas_fotos`; con 8 guarda.
- [ ] Guardar un bloque de contenido con 5 imágenes sigue fallando con `demasiadas_fotos`.
- [ ] `guardar_peludo` con un hito `vacunas` con padrino, un `otro` sin texto, una fecha de mañana o 21 hitos falla con `datos_invalidos` y detalle `hitos`.
- [ ] `guardar_peludo` sin la clave `hitos` conserva los hitos del peludo.
- [ ] Un `insert` en `hitos_peludo` desde Studio encola una llamada al hook de despliegue; un `insert` en `me_gusta` no.
- [ ] Con la llave publicable, `select` directo a `me_gusta` no devuelve filas y un `insert` directo falla.
- [ ] `marcar_me_gusta('luna', <uuid>, true)` devuelve 4; repetirlo devuelve 4; con `false` devuelve 3.
- [ ] `marcar_me_gusta` con un peludo adoptado falla con `no_encontrado`.
- [ ] La 31.ª llamada con `activo = true` del mismo dispositivo en una hora falla con `limite_me_gusta`.
- [ ] `conteos_me_gusta()` no incluye peludos con 0 ni peludos que no están disponibles.

### Galería y tarjeta

- [ ] `/adopta` muestra una tarjeta por peludo disponible con foto 4:5, nombre, edad y corazón; ya no tiene botón de WhatsApp en la tarjeta.
- [ ] La tarjeta de un peludo con 2 o más fotos muestra cuántas tiene.
- [ ] Tocar la foto o el nombre lleva a `/adopta/{id}`; tocar el corazón no navega.
- [ ] El chip "Gatos" deja solo gatos y cambia la URL a `?ver=gatos`; abrir `/adopta?ver=gatos` llega filtrado.
- [ ] "Mis favoritos" muestra solo los peludos con corazón y su número coincide.
- [ ] Sin favoritos, "Mis favoritos" muestra el texto que invita a tocar el corazón.
- [ ] Con JS desactivado, `/adopta` muestra todos los peludos sin chips.
- [ ] La rejilla tiene 2 columnas a 360 px, 3 a 768 px y 4 a 1024 px, sin desplazamiento horizontal.
- [ ] La portada usa la misma tarjeta y su corazón comparte estado con `/adopta`.

### "Me gusta"

- [ ] Tocar el corazón de Luna lo llena, muestra 4, guarda `luna` en `favoritos:v1` y crea una fila en `me_gusta`.
- [ ] Volver a tocarlo lo vacía, muestra 3 y borra la fila.
- [ ] Al recargar la página, el corazón sigue lleno y el número viene de `conteos_me_gusta`.
- [ ] Con la red bloqueada hacia Supabase, el corazón alterna, no hay número y la consola no tiene errores sin capturar.
- [ ] Un peludo sin "me gusta" no muestra "0".
- [ ] Al dar un "me gusta" corre el latido con chispas; con "reducir movimiento" solo cambia el relleno.
- [ ] Una página con 6 tarjetas hace una sola petición a `conteos_me_gusta`.
- [ ] Las páginas públicas no descargan `@supabase/supabase-js`.

### Ficha

- [ ] `/adopta/luna` existe y `/adopta/{id}` de un peludo adoptado da 404.
- [ ] El carrusel muestra "1 / 2", se desliza con el dedo y con las flechas desde 640 px.
- [ ] Doble toque sobre una foto llena el corazón y muestra el corazón grande; un segundo doble toque no lo quita.
- [ ] La ficha muestra especie, edad, "Talla mediana", los rasgos y las tres insignias de convivencia con los textos de la tabla.
- [ ] "Su historia" no aparece si el peludo no tiene `descripcion`.
- [ ] "Su camino en el refugio" lista los hitos por fecha, y el de esterilización dice "Gracias a Familia Ejemplo, que apadrinó su esterilización."
- [ ] Un hito de esterilización sin padrino dice "La cubrió el refugio."
- [ ] "Quiero adoptar a Luna" abre WhatsApp con `Hola, quiero adoptar a Luna. La vi en la página de {refugio}.`
- [ ] "¿Cómo es adoptar?" lleva a `/adopta#proceso`, y no aparece si el bloque `proceso_adopcion` está despublicado.
- [ ] "Compartir" abre el menú de compartir en teléfono; en un navegador sin `navigator.share`, copia la URL y dice "Enlace copiado".
- [ ] El HTML de `/adopta/luna` tiene `og:image` con la primera foto de Luna y el título "Luna busca familia · {refugio}".
- [ ] `/adopta/luna` aparece en `sitemap-index.xml`.
- [ ] La ficha no tiene niveles de título saltados.

### Panel

- [ ] `/admin/peludos/editar` permite 8 fotos y no deja agregar una 9.ª.
- [ ] El campo "Padrino" solo aparece con tipo "Esterilización" y muestra la nota de permiso.
- [ ] Guardar un peludo con convivencia e hitos y volver a abrirlo muestra los mismos valores, con los hitos ordenados por fecha.
- [ ] La lista `/admin/peludos` muestra "♥ 3" junto a Luna.

### Analítica, aviso y calidad

- [ ] Dar un "me gusta" llama a `registrar('me_gusta', { peludo, origen })`; quitarlo no.
- [ ] El enlace de la tarjeta tiene `data-umami-event="abrir_peludo"` con `peludo` y `origen`.
- [ ] "Quiero adoptar a {nombre}" tiene `data-umami-event="whatsapp"`, `motivo` `adopcion` y `peludo`.
- [ ] El aviso de privacidad explica el id al azar del "me gusta", qué se guarda y cómo quitarlo, y menciona los "me gusta" y los peludos compartidos entre lo que mide la analítica.
- [ ] `npx astro check` no reporta errores.

## Decisiones

- **Sí:** galería de fotos con chips. Se ven todos los peludos a la vez, funciona sin JS y sigue el patrón del catálogo `/colabora` (filtro en la URL).
- **No:** modo deslizar tipo "match". Oculta a los demás peludos y es difícil de usar con teclado o lector de pantalla; puede ir en otra spec.
- **Sí:** ficha como página propia `/adopta/{id}`. Se comparte por WhatsApp con la foto en la vista previa, Google la indexa y funciona sin JS.
- **No:** ventana (`dialog`) sobre la galería. No da un enlace para compartir a un peludo.
- **Sí:** contador público de "me gusta". La persona ve que otros también se fijaron en ese peludo.
- **Sí:** un "me gusta" por dispositivo con un uuid al azar. Frena al visitante normal sin pedir cuenta ni guardar datos personales; un bot decidido puede inflarlo, y los límites por hora acotan el daño.
- **No:** contador sin control. Cualquiera lo inflaría desde la consola.
- **No:** guardar la IP o una huella del navegador. Son datos personales y el aviso promete no guardar la IP.
- **Sí:** sin `localStorage`, no se envía nada. Sin un id estable, cada visita contaría otra vez.
- **Sí:** conteos leídos en vivo con `fetch`. Un "me gusta" no recompila el sitio, y no se carga `supabase-js` en páginas públicas.
- **No:** conteos al compilar. Quedarían viejos hasta el siguiente despliegue.
- **No:** trigger `recompilar` en `me_gusta`. Cada corazón publicaría el sitio.
- **Sí:** el "me gusta" y el favorito son lo mismo. Un solo corazón; "Mis favoritos" filtra por él.
- **No:** mandar al servidor los favoritos de antes de esta spec. El sitio es nuevo y son pocos; contarlos pediría lógica de sincronización.
- **Sí:** el doble toque solo da "me gusta", como en Instagram. Quitarlo por accidente con dos toques sería confuso.
- **No:** doble toque en la galería. Un toque ya abre la ficha, y esperar el segundo toque haría lenta la navegación.
- **Sí:** WhatsApp sale de la tarjeta y queda en la ficha, en una barra fija. La tarjeta invita a conocer al peludo y la ficha da el contexto antes de escribir.
- **No:** formulario de solicitud de adopción. Pide datos personales, aviso y revisión en el panel; es otra spec.
- **Sí:** convivencia con perros, gatos y niños con "No sabemos". Muchas veces el refugio no lo ha probado y un "No" falso aleja adoptantes.
- **Sí:** línea de tiempo de hitos con el padrino solo en la esterilización. Cuenta la historia del peludo y agradece a quien pagó su cirugía.
- **Sí:** padrino como texto libre con nota de permiso en el panel. El refugio decide cómo nombrarlo; no se guarda ningún contacto del padrino.
- **No:** padrinos como entidad propia o con enlace a redes. Más datos personales y otra pantalla; otra spec.
- **Sí:** textos de hitos sin género ("Esterilización", "La cubrió el refugio."). Sirven para perros y perras sin pedir un campo más.
- **Sí:** hasta 8 fotos por peludo. Más fotos sin pesar demasiado; los bloques siguen en 4.
- **Sí:** solo peludos disponibles tienen ficha. Igual que hoy; "Finales felices" es otra spec.
- **Sí:** la portada usa la tarjeta nueva. Un solo estilo de corazón en todo el sitio.
- **Sí:** `guardar_peludo` acepta datos sin las claves nuevas. La migración se aplica antes del merge sin romper el panel de `main`.
- **Sí:** número 13 para esta spec y anuncios a la 14. Las specs se numeran en el orden en que se escriben.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Alguien infla el contador con un script | Un "me gusta" por dispositivo, 30 por dispositivo y 600 en total por hora; el número es un gesto, no decide nada. |
| El límite global de 600 por hora corta "me gusta" reales en un día viral | El corazón local se queda; solo deja de subir el número. El límite se ajusta en una migración si hace falta. |
| Publicar el nombre de un padrino sin su permiso | Nota en el panel junto al campo; es texto libre y puede ser "Anónimo" o una familia. |
| Un enlace compartido a un peludo adoptado da 404 | La página 404 ya ofrece volver al sitio; "Finales felices" queda para otra spec. |
| 8 fotos hacen pesada la ficha en teléfono | `<Image>` con `medidas()` y `loading="lazy"` desde la segunda foto. |
| Los "me gusta" de ejemplo llegan a producción | `seed.sql` nunca se empuja a la nube. |
| La migración se aplica después del merge | El plan pide `db push` antes del merge; sin las columnas nuevas, el esquema falla y no se publica nada roto. |

## Lo que **no** entra en esta spec

- Modo deslizar tipo "match".
- Formulario de solicitud de adopción.
- Fichas de peludos en proceso o adoptados, y "Finales felices".
- Padrinos como entidad propia o con enlaces a sus redes.
- Orden por "más queridos" o ranking.
- Visor de fotos a pantalla completa.
- Sincronizar los favoritos de antes de esta spec.
- Cambios a `/esterilizacion`, `/donar` o "Quiero apadrinar".
- Anuncios (SPEC 14, RF-18).
