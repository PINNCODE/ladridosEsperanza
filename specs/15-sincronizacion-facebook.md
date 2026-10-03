# SPEC 15 — Sincronización desde Facebook: borradores de peludos y campañas para revisar

> **Estado:** Implementado
> **Depende de:** SPEC 06, SPEC 08, SPEC 13
> **Fecha:** 2026-10-02
> **Objetivo:** Leer cada día las publicaciones de las dos páginas de Facebook del refugio, clasificarlas con Gemini y convertir las de adopción y de campañas de esterilización en borradores ocultos que el refugio revisa y publica desde el panel, más avisos de "fue adoptado" sobre los peludos que ya están en el sitio.

## Por qué existe esta spec

El refugio publica primero en Facebook, en dos páginas: [SOS Ladridos de Esperanza Tenancingo](https://www.facebook.com/p/Sos-Ladridos-de-Esperanza-Tenancingo-100067644922613/) y [Ladridos Esperanza](https://www.facebook.com/ladridos.esperanza.5/).
Pasar cada peludo y cada campaña al panel a mano es trabajo doble, y el sitio se queda atrás.
Un primer intento (`scripts/sincronizar-facebook.mjs`, sin commit) publicaba directo lo que entendía la IA y rellenaba lo que faltaba con valores inventados: costo de $250, cupo de 50, fecha de hoy, nombre puesto por la IA y fotos de 800 × 800.
Un error así sale en vivo con datos falsos sobre un animal o una campaña real.
Esta spec conserva la idea (Apify + Gemini + GitHub Actions) pero nada se publica sin que una persona del refugio lo revise, y el script nunca inventa un dato obligatorio.

No es RF-19: en la spec padre RF-19 es Transparencia, que salió del MVP en la SPEC 03. Es un requisito nuevo.

## Alcance

**Dentro:**

- Workflow de GitHub Actions `.github/workflows/sincronizar-facebook.yml`: diario a las 06:00 UTC (medianoche en Ciudad de México) y manual con `workflow_dispatch`.
- Script `scripts/sincronizar-facebook.mjs`: lee las publicaciones recientes con el actor `apify/facebook-posts-scraper`, salta las ya registradas, clasifica cada una con Gemini Flash-Lite con salida estructurada, reduce las fotos con `sharp` y las sube al bucket `imagenes`, y registra el resultado con la RPC `importar_post_facebook`.
- Modo `--dry-run`: lee Apify y Gemini e imprime lo que haría, sin subir fotos ni escribir en Supabase.
- Migración `sincronizacion_facebook`: tabla `publicaciones_facebook`, columna `por_revisar` en `peludos` y `campanas`, RPC `importar_post_facebook` solo para `service_role`, y `guardar_peludo`, `guardar_campana` y `marcar_me_gusta` al día.
- Los borradores (`por_revisar = true`) no salen en el sitio: los cargadores de `peludos` y `campanas` los excluyen.
- Panel: las listas `/admin/peludos` y `/admin/campanas` muestran primero los borradores con la etiqueta "Por revisar" y un enlace "Ver en Facebook"; el formulario `editar` de un borrador avisa que al guardar se publica. Guardar publica y "Borrar" descarta.
- Aviso de adopción: si un post dice que un peludo fue adoptado y su nombre coincide con un solo peludo publicado no adoptado, la lista de peludos muestra "Facebook dice que fue adoptado" con el enlace al post. El estado no cambia solo.
- Posts con datos obligatorios faltantes, con varios peludos o con un nombre de adoptado sin coincidencia única: se registran como `incompleto` con su motivo y no crean nada.
- Semilla: un peludo y una campaña de ejemplo por revisar, un aviso de adopción y un post `incompleto`, para probar el panel en local.
- `docs/configuracion-facebook-sync.md` con los pasos para las llaves, los secretos y la prueba manual.
- `specs/README.md`, `CLAUDE.md` y `AGENTS.md` al día: esta spec es la 15 y anuncios pasa a la 16.

**Fuera de alcance (specs futuras):**

- Publicar sin revisión.
- Cambiar el estado de un peludo a "adoptado" sin revisión.
- Posts con varios peludos: se registran como `incompleto` y el refugio los captura a mano.
- Necesidades, textos (`bloques_contenido`), negocios o hitos sacados de Facebook.
- Instagram, TikTok u otras redes.
- Editar en el panel la lista de páginas de Facebook o la hora de la sincronización.
- Pantalla en el panel con el historial de `publicaciones_facebook` (se consulta en Studio).
- Volver a procesar un post ya registrado (se borra su fila en Studio y entra en la siguiente ejecución).
- Avisos por correo o WhatsApp cuando llega un borrador.
- Anuncios (SPEC 16, RF-18).

## Modelo de datos

### Migración `sincronizacion_facebook`

Reemplaza a `supabase/migrations/20261002220000_sincronizacion_facebook.sql`, que nunca se aplicó en la nube (se confirma en el paso 1 del plan).

```sql
create table publicaciones_facebook (
	id uuid primary key default gen_random_uuid(),
	-- Id del post que da Apify; evita procesarlo dos veces.
	post_id text not null unique,
	url_post text not null check (url_post ~ '^https://(www\.|m\.)?facebook\.com/'),
	pagina text not null,
	resultado text not null check (resultado in ('peludo', 'campana', 'adoptado', 'ignorado', 'incompleto')),
	-- Peludo o campaña creada, o el peludo del aviso de adopción.
	peludo_id text references peludos on delete set null,
	campana_id text references campanas on delete set null,
	-- Por qué es `ignorado` o `incompleto`: 'sin_nombre', 'sin_foto', 'varios_peludos', 'fecha_pasada', 'sin_coincidencia', …
	motivo text,
	texto text not null,
	publicado_en timestamptz,
	procesado_en timestamptz not null default now(),
	es_ejemplo boolean not null default false
);

alter table peludos add column por_revisar boolean not null default false;
alter table campanas add column por_revisar boolean not null default false;
```

- RLS activo en `publicaciones_facebook`, sin escrituras por la API para `anon` ni `authenticated`, y una política de lectura para el panel (`rol_panel() is not null`) igual que las tablas del refugio.
- Sin trigger `recompilar` en `publicaciones_facebook`: no se muestra en el sitio. Los `insert` en `peludos` y `campanas` sí lo disparan (un deploy de más por ejecución con borradores; ver Decisiones).
- Un peludo o una campaña borrados desde el panel dejan la fila de su post con `peludo_id` o `campana_id` en `null`, así que el post no se vuelve a importar.

### RPC `importar_post_facebook(datos jsonb) returns jsonb`

`security definer`, `execute` solo para `service_role`. Una transacción por post:

```jsonc
{
  "post_id": "…", "url_post": "https://www.facebook.com/…", "pagina": "https://www.facebook.com/ladridos.esperanza.5/",
  "texto": "…", "publicado_en": "2026-10-01T18:20:00Z",
  "resultado": "peludo" | "campana" | "adoptado" | "ignorado" | "incompleto",
  "motivo": null,
  // Solo con resultado 'peludo': los campos de guardar_peludo sin id, estado ni hitos.
  "peludo": { "nombre", "especie", "descripcion_especie", "edad", "tamano", "descripcion", "rasgos", "convive_perros", "convive_gatos", "convive_ninos", "fotos": [{ "ruta", "ancho", "alto" }] },
  // Solo con resultado 'campana'.
  "campana": { "fecha", "costo", "lugar", "horario", "forma_pago", "cupo", "cartel": { "ruta", "ancho", "alto" } },
  // Solo con resultado 'adoptado'.
  "adoptado": { "nombre": "Toby" }
}
```

- Si `post_id` ya existe, no hace nada y devuelve `{ "duplicado": true }`.
- `peludo`: id con `id_libre(slug(nombre), 'peludos')`, `orden` al final, `estado = 'disponible'`, `por_revisar = true`, `es_ejemplo = false`, y las fotos en `imagenes` y `fotos_peludo` (hasta 8).
- `campana`: id con `id_libre`, `estado = 'proxima'`, `por_revisar = true`, `es_ejemplo = false`, y el cartel en `imagenes`.
- `adoptado`: busca peludos con `es_ejemplo = false`, `por_revisar = false` y `estado <> 'adoptado'` cuyo nombre normalizado (minúsculas, sin acentos, sin espacios de sobra) sea igual al recibido. Con exactamente uno, guarda `resultado = 'adoptado'` con su `peludo_id`. Con cero o varios, guarda `resultado = 'incompleto'` y `motivo = 'sin_coincidencia'`.
- Valida igual que `guardar_peludo` y `guardar_campana` (`datos_invalidos` con el campo en `detail`). Si falla, no guarda nada, ni la fila del post, y el script borra las fotos que subió.
- Devuelve `{ "resultado", "peludo_id", "campana_id" }`.

### Cambios a RPC existentes

- `guardar_peludo` y `guardar_campana` ponen `por_revisar = false` al guardar. Guardar un borrador desde el panel es aprobarlo.
- `marcar_me_gusta` solo acepta peludos con `por_revisar = false`.
- `borrar_contenido` no cambia: borrar un borrador lo descarta y limpia sus imágenes como cualquier otro registro.

### Cargadores (`src/lib/cargadores.ts`)

`cargadorPeludos` y `cargadorCampanas` piden solo filas con `por_revisar = false`. Así ningún borrador llega a `/adopta`, `/adopta/{id}`, la portada, `/esterilizacion` ni al sitemap. El esquema de `src/content.config.ts` no cambia.

### Datos obligatorios por tipo

El script pide a Gemini que deje en `null` lo que el post no dice. Con un obligatorio en `null`, el post queda `incompleto` con el motivo del primero que falte.

| Tipo | Obligatorio (si falta: `incompleto`) | Si falta, queda en el borrador como |
| --- | --- | --- |
| Peludo | `nombre` escrito en el post, `especie`, al menos 1 foto, un solo peludo en el post | `edad`, `descripcion_especie`: "Por confirmar"; `tamano`: lo estima Gemini con la primera foto; `rasgos`: ["Por confirmar", "Por confirmar"]; convivencia: `no_sabemos`; `descripcion`: el texto del post |
| Campaña | `fecha` futura, `lugar`, `costo` | `horario`, `forma_pago`: "Por confirmar"; `cupo`: `null`; `cartel`: la primera foto, o ninguno |
| Adoptado | `nombre` del peludo | — |

"Por confirmar" solo existe en borradores: el refugio lo cambia antes de guardar.

"Escrito en el post" quiere decir en su texto o en el texto de su primera foto: la fecha y el costo de una campaña suelen venir solo en el cartel. Gemini devuelve ese texto en `texto_en_foto` (el `ocrText` de Apify solo dice "May be an image of dog and text") y el script busca ahí y en el texto del post el nombre, el día de la fecha, el costo y el cupo.

### Script (`scripts/sincronizar-facebook.mjs`)

- Variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` y `APIFY_TOKEN`. Sin alguna, termina con código 1, incluso en `--dry-run` (que no pide las de Supabase). No hay modo de demostración con posts falsos.
- Apify: `run-sync-get-dataset-items` del actor `apify/facebook-posts-scraper` con las dos páginas y 10 posts por página; el token va en `Authorization: Bearer`, no en la URL.
- Gemini: `gemini-flash-lite-latest` con `responseSchema` (categoría, motivo, `varios_peludos` y los campos de la tabla anterior) y la primera foto como parte de la petición; la llave va en `x-goog-api-key`.
- Fotos: descarga sin el parámetro `ctp` de la URL firmada (la vista previa de 590 px; sin él, Facebook entrega hasta 1600 px y, si falla, se usa la vista previa), `sharp` a JPEG 0.85 con lado máximo de 1600 px (2400 px para el cartel), y sube a `peludos/` o `campanas/` con nombre `fb-{post_id}-{n}.jpg`, con el ancho y el alto reales. Igual que `reducir` del panel.
- Por post: si `post_id` ya está en `publicaciones_facebook`, lo salta sin llamar a Gemini.
- Un error de Gemini, de descarga o de la RPC en un post: lo imprime, no registra el post (se reintenta mañana) y sigue con el siguiente.
- Si Apify falla, o si falló algún post, termina con código 1 para que GitHub marque la ejecución en rojo.
- Al final imprime cuántos posts dieron `peludo`, `campana`, `adoptado`, `ignorado`, `incompleto`, duplicados y errores.

### Panel

| Lugar | Cambio |
| --- | --- |
| `/admin/peludos` y `/admin/campanas` | Los borradores van primero, con la etiqueta "Por revisar" y el enlace "Ver en Facebook" (`url_post`, en otra pestaña) |
| `/admin/peludos` | En un peludo con aviso de adopción: "Facebook dice que fue adoptado" y "Ver en Facebook". Se va solo cuando su estado pasa a "Adoptado" |
| `editar` de un borrador | Aviso arriba del formulario: "Este registro vino de Facebook. Revisa los datos y las fotos: al guardar se publica en el sitio." y el enlace "Ver en Facebook" |

Las listas leen `publicaciones_facebook` con su política de lectura; la del aviso de adopción solo toma filas con `resultado = 'adoptado'`.

### Secretos de GitHub

`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` y `APIFY_TOKEN`, como secretos del repositorio `PINNCODE/ladridosEsperanza`.

## Cambios por archivo

| Archivo | Cambio |
| --- | --- |
| `supabase/migrations/20261002220000_sincronizacion_facebook.sql` | Reescrita: tabla, columnas, RPC nueva y RPC al día |
| `supabase/seed.sql` | `por_revisar` en peludos y campañas; un peludo y una campaña por revisar, un aviso de adopción y un post `incompleto`, todos `es_ejemplo` |
| `src/lib/cargadores.ts` | Filtro `por_revisar = false` en peludos y campañas |
| `scripts/sincronizar-facebook.mjs` | Reescrito según "Script" |
| `package.json`, `package-lock.json` | `sharp` como dependencia directa |
| `.github/workflows/sincronizar-facebook.yml` | Diario y manual, con los 4 secretos |
| `src/pages/admin/peludos.astro`, `src/pages/admin/campanas.astro` | Borradores primero, etiqueta, enlace y aviso de adopción |
| `src/pages/admin/peludos/editar.astro`, `src/pages/admin/campanas/editar.astro` | Aviso del borrador |
| `docs/configuracion-facebook-sync.md` | Al día con esta spec |
| `specs/README.md`, `CLAUDE.md`, `AGENTS.md` | Fila 15 en "Borrador" (luego "Implementado") sin RF-19, anuncios en la 16, "Pendiente de decidir" al día, la tabla, el script, el workflow y la revisión en el panel |

## Plan de implementación

1. Confirmar con `npx supabase migration list` (proyecto enlazado) que `20261002220000` no está en la nube. Si ya está, parar y decidir antes de seguir: la migración se cambia por una nueva en lugar de reescribirla.
2. Reescribir la migración y agregar `por_revisar` a la semilla con los registros de ejemplo. `npx supabase db reset` corre sin errores.
3. Filtro `por_revisar = false` en `cargadorPeludos` y `cargadorCampanas`. `astro build` con los ejemplos: el peludo y la campaña por revisar no salen en `/adopta`, la portada, `/esterilizacion` ni el sitemap.
4. Listas y formularios del panel: etiqueta, enlace, aviso del borrador y aviso de adopción. Probar en local con `refugio@ejemplo.test`: guardar el borrador lo publica y borrarlo lo descarta.
5. Agregar `sharp` y reescribir el script. Probar `--dry-run` con llaves reales de Apify y Gemini, sin escribir nada.
6. Ejecutar el script contra Supabase local (`SUPABASE_URL` local): crea borradores, una segunda ejecución no duplica nada y un post sin nombre queda `incompleto`.
7. Workflow de GitHub Actions y `docs/configuracion-facebook-sync.md`.
8. `specs/README.md`, `CLAUDE.md` y `AGENTS.md`.
9. Pasos manuales **después del merge**: `npx supabase db push`, los 4 secretos en GitHub y una ejecución manual del workflow. El código nuevo filtra por una columna que solo existe tras el `db push`, así que el `db push` va antes del primer deploy que toque la nube (o justo después del merge, con un redeploy si el primero falla).

## Criterios de aceptación

### Datos y RPC

- [x] `npx supabase db reset` aplica la migración y la semilla sin errores.
- [x] `anon` y `authenticated` no pueden escribir en `publicaciones_facebook` ni ejecutar `importar_post_facebook`.
- [x] Una sesión del panel (`aal2`, cualquier rol) puede leer `publicaciones_facebook`; `anon` no.
- [x] `importar_post_facebook` con un `post_id` repetido devuelve `{ "duplicado": true }` y no crea nada.
- [x] Un `peludo` importado queda con `por_revisar = true`, `estado = 'disponible'`, `es_ejemplo = false` y sus fotos en orden.
- [x] Un `adoptado` con nombre que coincide con dos peludos queda `incompleto` con `motivo = 'sin_coincidencia'` y no cambia ningún peludo.
- [x] Un `importar_post_facebook` con datos inválidos no deja fila en ninguna tabla.
- [x] `marcar_me_gusta` sobre un peludo por revisar lanza error.

### Sitio público

- [x] El peludo y la campaña de ejemplo por revisar no aparecen en `/adopta`, la portada, `/esterilizacion` ni `sitemap-0.xml`, y no existe `/adopta/{id}` del peludo por revisar.
- [x] Al guardarlos desde el panel aparecen en el sitio después del siguiente build.

### Panel

- [x] `/admin/peludos` y `/admin/campanas` muestran los borradores arriba, con "Por revisar" y "Ver en Facebook" abriendo el post en otra pestaña.
- [x] El formulario de un borrador muestra el aviso; el de un registro normal, no.
- [x] Guardar un borrador lo deja con `por_revisar = false`.
- [x] Borrar un borrador lo quita, borra sus fotos del bucket y deja la fila de su post con `peludo_id` o `campana_id` en `null`.
- [x] El peludo de ejemplo con aviso de adopción muestra "Facebook dice que fue adoptado"; al cambiar su estado a "Adoptado" el aviso desaparece.

### Script y workflow

- [x] Sin alguna variable obligatoria, el script termina con código 1 y un mensaje que la nombra.
- [x] `--dry-run` imprime la clasificación de cada post y no sube fotos ni escribe en Supabase.
- [x] Contra Supabase local, una segunda ejecución seguida imprime todos los posts como duplicados y no llama a Gemini.
- [x] Las fotos subidas son JPEG de 1600 px como máximo (2400 px el cartel) y su fila en `imagenes` tiene el ancho y el alto reales.
- [x] Un post de adopción sin nombre escrito queda `incompleto` con `motivo = 'sin_nombre'`.
- [x] Una campaña con fecha pasada queda `incompleto` con `motivo = 'fecha_pasada'`.
- [x] Ningún borrador tiene costo, cupo, fecha o nombre que no estén en el post.
- [ ] El workflow aparece en GitHub Actions con "Run workflow" y su cron es `0 6 * * *`.
- [x] Ninguna llave aparece en la salida del script ni en una URL.

### Calidad

- [x] `npx astro check` y `astro build` pasan.
- [x] `specs/README.md`, `CLAUDE.md` y `AGENTS.md` dicen lo mismo sobre la spec 15 y la 16.

## Decisiones

- **Sí:** borradores que el refugio revisa. La IA se equivoca en nombres, edades y fechas; un dato falso sobre un animal o una campaña real cuesta más que un clic de "Guardar".
- **No:** publicación directa. Era el primer intento; sacaba en vivo valores inventados.
- **Sí:** columna `por_revisar` en lugar de un valor nuevo de `estado`. La revisión no es parte del ciclo disponible → adoptado ni próxima → pasada, y los esquemas y filtros de `estado` no cambian.
- **Sí:** guardar en el panel aprueba. No hace falta botón ni RPC nueva, y el refugio corrige y publica en un solo paso.
- **Sí:** el aviso "fue adoptado" no cambia el estado. Un nombre repetido ("Luna") marcaría al peludo equivocado.
- **Sí:** coincidencia exacta del nombre normalizado y un solo candidato. `ilike '%nombre%'` confundía "Luna" con "Lunita" y fallaba con dos resultados.
- **Sí:** un dato obligatorio faltante deja el post `incompleto`. Nunca se inventa un costo, un cupo, una fecha o un nombre.
- **Sí:** "Por confirmar" en los campos no obligatorios del borrador. Las columnas son `not null` y el borrador nunca sale en el sitio con ese texto si el refugio lo revisa.
- **Sí:** RPC `importar_post_facebook` en una transacción. El peludo, sus fotos y la fila del post se guardan juntos o no se guarda nada; el id y el orden salen de las mismas funciones que usa el panel.
- **No:** `insert` directos con la llave secreta desde el script. Dejaban un peludo sin foto o un post sin registrar si algo fallaba a la mitad.
- **Sí:** errores sin registrar para reintentar mañana; `incompleto` e `ignorado` sí se registran. Un fallo de red no debe perder un post; un post sin datos no debe gastar Gemini cada día.
- **Sí:** `sharp` como dependencia directa. Hoy llega por Astro; el script no debe depender de eso.
- **Sí:** mismo tamaño y formato que el panel (1600 px, 2400 px el cartel, JPEG 0.85). El sitio recibe las mismas fotos venga de donde venga.
- **Sí:** la primera foto va a Gemini. El tamaño del peludo casi nunca está escrito y se ve en la foto.
- **Sí:** `gemini-flash-lite-latest`, el modelo de bajo costo. Al implementar, `gemini-2.5-flash` ya no estaba disponible para llaves nuevas y `gemini-3.8-flash` agotó su cuota gratis (20 al día) con las pruebas; Flash-Lite clasificó bien los 20 posts reales, lee los carteles y el alias `-latest` no se retira.
- **No:** `gemini-3.8-flash`. Más caro y con la misma cuota gratis; queda disponible con `GEMINI_MODELO`.
- **Sí:** variable opcional `GEMINI_MODELO`. Google retira modelos para llaves nuevas sin aviso (pasó con `gemini-2.5-flash`), y cambiarlo no debe pedir un commit.
- **Sí:** `responseSchema` de Gemini. Sin esquema, un JSON mal formado tumbaba el post.
- **Sí:** GitHub Actions. Node con `sharp` y `supabase-js` sin infraestructura nueva; `sharp` no corre en las Edge Functions de Deno.
- **No:** Edge Function con `pg_cron`. Todo quedaría en Supabase, pero habría que reducir las fotos de otra forma.
- **Sí:** 06:00 UTC. Es medianoche en Ciudad de México (sin horario de verano desde 2022), 5 minutos antes de la recompilación diaria de `pg_cron`.
- **Sí:** dejar que un borrador dispare el deploy hook. A lo más un deploy de más por ejecución, sin tocar el trigger que comparten todas las tablas.
- **Sí:** reescribir la migración `20261002220000` si no está en la nube. Nadie la aplicó; una segunda migración solo cambiaría una tabla sin usar.
- **Sí:** número 15 para esta spec y anuncios a la 16. Las specs se numeran en el orden en que se escriben.
- **No:** citar RF-19. En la spec padre RF-19 es Transparencia.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Facebook cambia su HTML y Apify deja de traer posts | El script termina con código 1 y GitHub marca la ejecución en rojo y avisa por correo al dueño del repo. |
| El crédito gratis de Apify se acaba | 2 páginas × 10 posts al día es poco; si sube el costo se baja a 5 posts o a días alternos en el workflow. |
| La cuota gratis de Gemini es de 20 peticiones al día por modelo (medido al implementar) | Solo los posts nuevos llaman a Gemini (los registrados se saltan), así que después de la primera ejecución bastan unos cuantos al día. Con la cuota diaria agotada el script se detiene sin reintentar y los posts se procesan al día siguiente. `GEMINI_MODELO` cambia de modelo sin tocar el código; activar facturación quita el límite. |
| Gemini clasifica mal un post | Todo queda en borrador o en `ignorado`; el refugio ve lo que publica. Un post mal ignorado se reprocesa borrando su fila en Studio. |
| La llave secreta de Supabase vive en GitHub | Secreto del repositorio, nunca impreso; la RPC solo permite crear borradores y avisos. Si se filtra, se rota en Supabase y en GitHub. |
| Un post trae datos personales (teléfono de un adoptante) en el texto | `descripcion` lleva el texto del post y el refugio lo revisa antes de publicar; el texto completo solo queda en `publicaciones_facebook`, que solo lee el panel. |
| Las URL de las fotos de Facebook caducan | Se descargan en la misma ejecución en que Apify las entrega. |
| Se acumulan borradores que nadie revisa | No salen en el sitio; van arriba de la lista en el panel. Avisos por correo quedan para otra spec. |
| La migración se aplica después del deploy y los cargadores piden una columna que no existe | El paso 9 del plan pone el `db push` justo después del merge; si el build falla, Vercel conserva el último despliegue bueno y basta con un redeploy. |

## Lo que **no** entra en esta spec

- Publicar o marcar como adoptado sin revisión.
- Posts con varios peludos.
- Necesidades, textos, negocios o hitos desde Facebook.
- Otras redes sociales.
- Configurar las páginas o la hora desde el panel.
- Historial de posts en el panel.
- Avisos por correo o WhatsApp de borradores nuevos.
- Anuncios (SPEC 16, RF-18).

Cada una, si llega, va en su propia spec.
