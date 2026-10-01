# SPEC 06 — Datos en Supabase y publicación en Vercel

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 04, SPEC 05
> **Fecha:** 2026-10-01
> **Objetivo:** Mover los datos y las imágenes de `src/data/` y `src/assets/` a Supabase y publicar el sitio estático en Vercel, recompilándolo cuando cambia un dato y cada día, sin cambiar lo que muestran las páginas.

## Por qué existe esta spec

El índice asigna a esta spec la base para la 07 y la 08.
El panel de la SPEC 07 (RF-16) necesita editar datos e imágenes en un lugar que no sea el repositorio, y un cambio guardado debe verse en menos de 1 minuto.
La SPEC 01 dejó los campos en español y `snake_case` para que coincidieran con columnas de Postgres, y decidió que pasar a Supabase "solo cambia el loader".
Las SPEC 02 a 05 filtran necesidades, campañas y promociones con la fecha de compilación y dejaron pendiente la recompilación diaria.
El README dejaba pendiente para esta spec el hospedaje, cómo se recompila el sitio y `PUBLIC_MOSTRAR_EJEMPLOS` en el hospedaje.

## Alcance

**Dentro:**

- Proyecto de Supabase con la CLI (`supabase/`), desarrollo local con `npx supabase start` y un solo proyecto en la nube.
- Migraciones SQL con una tabla por cada una de las 12 colecciones actuales, el menú y los horarios normalizados, y las imágenes en una tabla propia.
- RLS activado en todas las tablas, sin políticas para `anon` ni `authenticated`.
- Bucket público `imagenes` en Supabase Storage con las 5 imágenes actuales.
- Semilla (`supabase/seed.sql` e imágenes en `supabase/semilla/imagenes/`) generada una vez desde los JSON actuales.
- Loaders propios de content collections que leen Supabase al compilar con una llave secreta y entregan la misma forma de datos que hoy.
- Esquemas Zod de `src/content.config.ts` sin cambios, salvo los campos de imagen, que pasan de `image()` a `{ url, ancho, alto }`.
- Los 7 componentes que usan `<Image>` pasan a recibir esa imagen remota.
- Borrar `src/data/` y `src/assets/`: Supabase es la única fuente de datos.
- Recompilación automática: un disparador en cada tabla de contenido llama al deploy hook de Vercel con `pg_net`, y `pg_cron` lo llama cada día a las 00:05 de Ciudad de México.
- Proyecto en Vercel conectado a `main`, sitio estático sin adaptador, con `PUBLIC_MOSTRAR_EJEMPLOS=true` y la cinta "Datos de ejemplo", en la URL `*.vercel.app`.

**Fuera de alcance (specs futuras):**

- Panel `/admin`, inicio de sesión, verificación en dos pasos y políticas RLS para editar (SPEC 07).
- Tablas `solicitudes_negocio` y usuarios del panel (SPEC 07).
- Subir imágenes desde el sitio o desde el panel (SPEC 07).
- QR por negocio (SPEC 07).
- Dominio propio y quitar los datos de ejemplo de producción; se hacen cuando el refugio entregue sus datos reales.
- Renderizado en el servidor (SSR o ISR).
- Texto alternativo por imagen; hoy ningún esquema lo tiene.
- Anuncios en las páginas, analítica y SEO (SPEC 08).
- Un segundo proyecto de Supabase para pruebas.

## Modelo de datos

### Tablas

Todas las tablas viven en el esquema `public`, con nombres en español y `snake_case`.
Las tablas de colección conservan el `id` de texto de los JSON actuales (`"luna"`, `"tacos-don-chuy"`, `"2026-09-26"`), así las URL y las referencias no cambian.
Las tablas hijas usan `id bigint generated always as identity` y un `orden int` que conserva el orden del arreglo del JSON.
`es_ejemplo boolean not null` va solo en las tablas de colección; las hijas lo heredan de su registro.
Las fechas son `date` y los montos `numeric`.
Los `enum` de Zod se vuelven `check (... in (...))` con los mismos valores.

| Tabla | Columnas | Notas |
| --- | --- | --- |
| `imagenes` | `id uuid` · `ruta text unique` · `ancho int` · `alto int` | `ruta` dentro del bucket: `peludos/luna.jpg` |
| `refugio` | `id text` (`check id = 'refugio'`) · `nombre` · `frase` · `ubicacion` · `whatsapp` · `logo_id` · `foto_principal_id` · `es_ejemplo` | `whatsapp` con `check (whatsapp ~ '^\d{10,15}$')` |
| `redes` | `id` · `red` · `etiqueta` · `url` · `orden` · `es_ejemplo` | |
| `categorias` | `id` · `nombre` · `orden` · `es_ejemplo` | |
| `bloques_contenido` | `id` · `seccion` · `titulo` · `texto` · `orden` · `publicado` · `es_ejemplo` | |
| `imagenes_bloque` | `bloque_id` · `imagen_id` · `orden` | `imagenes` del bloque |
| `problematicas` | `id` · `titulo` · `texto` · `icono` · `etiqueta_cifra` · `cifra` · `fecha_cifra` · `fuente` · `enlace_texto` · `enlace_url` · `enlace_sensible` · `orden` · `publicada` · `es_ejemplo` | Las 3 columnas `enlace_*` van todas o ninguna (`check`) |
| `peludos` | `id` · `nombre` · `especie` · `descripcion_especie` · `edad` · `tamano` · `descripcion` · `rasgos text[]` · `orden` · `estado` · `es_ejemplo` | `check (cardinality(rasgos) = 2)` |
| `fotos_peludo` | `peludo_id` · `imagen_id` · `orden` | `fotos` del peludo |
| `campanas` | `id` · `fecha` · `costo` · `lugar` · `horario` · `forma_pago` · `cupo` · `cartel_id` · `estado` · `es_ejemplo` | |
| `necesidades` | `id` · `tipo` · `descripcion` · `urgencia` · `fecha_vigencia` · `es_ejemplo` | |
| `destinos_donativo` | `id` · `destino` · `cubre` · `monto` · `equivalencia` · `orden` · `es_ejemplo` | |
| `registros_cifras` | `id` · `mes` · `animales_recibidos` · `rescates` · `adopciones` · `esterilizaciones` · `notas` · `es_ejemplo` | `mes unique`, `check (mes ~ '^\d{4}-\d{2}$')` |
| `gastos_registro` | `registro_id` · `concepto` · `monto` · `orden` | `gastos` del mes |
| `anuncios` | `id` · `tipo` · `anunciante` · `texto` · `enlace` · `posicion` · `vigencia_inicio` · `vigencia_fin` · `activo` · `es_ejemplo` | |
| `negocios` | `id` (slug) · `nombre` · `categoria_id` · `descripcion_corta` · `logo_id` · `direccion` · `latitud` · `longitud` · `whatsapp` · `estado` · `porcentaje_aporte` · `fecha_alta` · `es_ejemplo` | `check (porcentaje_aporte between 0 and 100)` |
| `promociones` | `negocio_id` (llave primaria) · `texto` · `fecha_inicio` · `fecha_fin` | Una por negocio, como hoy |
| `horarios` | `negocio_id` · `dia` · `cerrado boolean` | Llave `(negocio_id, dia)`; `dia in ('lun', …, 'dom')`. Día sin fila = "por confirmar" |
| `turnos` | `negocio_id` · `dia` · `abre time` · `cierra time` · `orden` | Llave foránea a `horarios (negocio_id, dia)` |
| `grupos_menu` | `negocio_id` · `nombre` · `orden` | |
| `secciones_menu` | `grupo_id` · `nombre` · `nota` · `orden` | |
| `platillos` | `seccion_id` · `nombre` · `descripcion` · `es_extra` · `disponible` · `orden` | `orden` es nuevo: hoy es el orden del arreglo |
| `precios` | `platillo_id` · `etiqueta` · `monto` · `texto_alterno` · `orden` | `check (monto is not null or texto_alterno is not null)` |

Las llaves foráneas de las tablas hijas llevan `on delete cascade`.
Las llaves a `imagenes` y a `categorias` llevan `on delete restrict`: no se borra una imagen o categoría en uso.

### Migraciones

| Archivo en `supabase/migrations/` | Contenido |
| --- | --- |
| `{marca}_tablas_contenido.sql` | Las tablas de arriba y `alter table … enable row level security` en todas, sin políticas |
| `{marca}_almacenamiento.sql` | Bucket `imagenes` con `public = true` |
| `{marca}_recompilar.sql` | Extensiones `pg_net` y `pg_cron`, función `recompilar_sitio()`, disparadores y trabajo diario |

`{marca}` es la marca de tiempo que genera `npx supabase migration new`.

### Recompilación

```sql
-- Lee el secreto 'deploy_hook_vercel' de Vault; si no existe (desarrollo local), no hace nada.
create function recompilar_sitio() returns void ...;

-- En cada tabla de contenido, una vez por sentencia:
create trigger recompilar after insert or update or delete on peludos
  for each statement execute function avisar_cambio();

-- Todos los días a las 06:05 UTC = 00:05 en Ciudad de México (sin horario de verano desde 2022).
select cron.schedule('recompilar-diario', '5 6 * * *', 'select recompilar_sitio()');
```

`avisar_cambio()` es la función de disparador que llama a `recompilar_sitio()`.
El URL del deploy hook es un secreto: se guarda en Vault desde el SQL Editor del proyecto en la nube, nunca en una migración ni en el repositorio.

### Variables de entorno

| Variable | Dónde | Valor |
| --- | --- | --- |
| `SUPABASE_URL` | `.env`, Vercel | Local: `http://127.0.0.1:54321`; nube: `https://{ref}.supabase.co` |
| `SUPABASE_SECRET_KEY` | `.env`, Vercel | Llave secreta (`sb_secret_…`); nunca con prefijo `PUBLIC_` |
| `PUBLIC_MOSTRAR_EJEMPLOS` | `.env`, Vercel | `true` (sin cambios) |

`.env.example` agrega las dos variables nuevas con los valores locales que imprime `npx supabase status`.
Sin `SUPABASE_URL` o `SUPABASE_SECRET_KEY`, la compilación se detiene con un error que nombra la variable que falta.

### Imagen en los esquemas

```ts
// src/content.config.ts: reemplaza a image() en refugio, bloques_contenido, peludos, campanas y negocios.
const imagen = z.object({ url: z.url(), ancho: z.number().int(), alto: z.number().int() });
```

```ts
// src/lib/imagenes.ts (nuevo)
export type Imagen = { url: string; ancho: number; alto: number };
export function medidas(imagen: Imagen, ancho: number): { width: number; height: number }; // alto proporcional, redondeado
```

El loader arma `url` como `{SUPABASE_URL}/storage/v1/object/public/imagenes/{ruta}`.
`astro.config.mjs` autoriza en `image.remotePatterns` el protocolo, host y puerto de `SUPABASE_URL`, así Astro descarga y optimiza las imágenes al compilar.

### Loaders

| Archivo | Contenido |
| --- | --- |
| `src/lib/supabase.ts` (nuevo) | Cliente de `@supabase/supabase-js` para el build, con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Solo lo importan los loaders. |
| `src/lib/cargadores.ts` (nuevo) | Un loader por colección. Cada uno consulta su tabla con sus hijas, arma la misma forma que tenía el JSON y pasa cada registro por `parseData`. |

```ts
// src/content.config.ts
const negocios = defineCollection({
	loader: cargadorNegocios(), // antes: glob({ pattern: '*.json', base: './src/data/negocios' })
	schema: z.object({ /* igual que hoy, con `logo: imagen.nullable()` */ }),
});
```

El loader de negocios arma `horarios` como `{ lun: [{ abre, cierra }] | 'cerrado', … }` sin los días ausentes, `promocion` como objeto o `null`, y `menu` anidado por `orden`.
Las horas `time` de Postgres (`"13:00:00"`) se recortan a `"13:00"`.
`categoria` se entrega como el `id` de texto y `reference('categorias')` sigue funcionando.

### Semilla

| Ruta | Contenido |
| --- | --- |
| `scripts/generar-semilla.mjs` | Lee los JSON de `src/data/` y las medidas de cada imagen con `sharp`, y escribe los dos destinos siguientes. Se usa una vez y se borra en el mismo paso que `src/data/`. |
| `supabase/seed.sql` | `insert` de todos los registros actuales, con `es_ejemplo` tal cual. Es el nuevo lugar donde se editan los datos de ejemplo. |
| `supabase/semilla/imagenes/` | Las 5 imágenes de `src/assets/` con la misma estructura de carpetas (`peludos/luna.jpg`) |

`supabase/config.toml` declara el bucket `imagenes` con `objects_path = "./semilla/imagenes"`, así `npx supabase start` y `npx supabase db reset` lo llenan en local.

## Plan de implementación

1. Antes de cambiar nada, compilar con `PUBLIC_MOSTRAR_EJEMPLOS=true astro build` y guardar `dist/` como referencia en el directorio temporal de la sesión (no se versiona).
2. Agregar `supabase` como `devDependency` y correr `npx supabase init`. Configurar el bucket `imagenes` en `supabase/config.toml` y agregar a `.gitignore` las carpetas temporales de la CLI. Comprobar que `npx supabase start` levanta y el sitio sigue compilando desde los JSON.
3. Crear la migración `tablas_contenido` con las tablas, llaves, `check` y RLS. Comprobar con `npx supabase db reset` que se aplica sin errores.
4. Crear la migración `almacenamiento` con el bucket público `imagenes`.
5. Crear `scripts/generar-semilla.mjs`, generar `supabase/seed.sql` y copiar las imágenes a `supabase/semilla/imagenes/`. Comprobar con `npx supabase db reset` que hay 5 negocios, 145 platillos en el café y 5 objetos en el bucket.
6. Agregar `@supabase/supabase-js`, crear `src/lib/supabase.ts` con el error por variable faltante, y agregar las variables a `.env.example`.
7. Crear `src/lib/cargadores.ts` con los loaders de las colecciones sin imágenes ni anidación: `redes`, `categorias`, `necesidades`, `destinos_donativo`, `anuncios` y `problematicas`. Cambiarlas en `src/content.config.ts` y borrar sus JSON. Comprobar que la compilación da el mismo texto en `/`, `/donar` y `/colabora`.
8. Agregar el loader de `registros_cifras` con sus `gastos_registro`, cambiarlo y borrar su JSON.
9. Crear `src/lib/imagenes.ts`, autorizar el host de `SUPABASE_URL` en `astro.config.mjs` y agregar el esquema `imagen` a `src/content.config.ts`.
10. Pasar `refugio`, `bloques_contenido`, `peludos` y `campanas` a sus loaders, con el campo `imagen`. Ajustar `Encabezado`, `Presentacion`, `QuienesSomos`, `TarjetaPeludo` y `VisorCartel` para usar `url` y `medidas`. Borrar sus JSON.
11. Pasar `negocios` a su loader con promoción, horarios, turnos y menú anidado. Ajustar `TarjetaNegocio` y `CabeceraNegocio`. Borrar `src/data/negocios/`.
12. Borrar `src/assets/`, `src/data/` y `scripts/generar-semilla.mjs`. Comprobar que no queda ninguna referencia a esas rutas y que `astro build` y `astro check` pasan.
13. Crear la migración `recompilar` con `pg_net`, `pg_cron`, `recompilar_sitio()`, `avisar_cambio()`, un disparador por cada tabla de contenido (las 12 de colección y sus hijas) y el trabajo `recompilar-diario`. Comprobar en local que un cambio no falla aunque no exista el secreto.
14. Paso manual: crear el proyecto de Supabase en la nube, enlazarlo con `npx supabase link`, aplicar las migraciones y la semilla con `npx supabase db push --include-seed` y subir las imágenes con `npx supabase seed buckets --linked`.
15. Paso manual: crear el proyecto en Vercel desde `PINNCODE/ladridosEsperanza` con la rama `main`, cargar las 3 variables de entorno para Production y Preview, crear el deploy hook de `main` y guardarlo en Vault como `deploy_hook_vercel`.
16. Actualizar `specs/README.md` (estado de la 06, la decisión general "Los datos se leen de content collections … hasta la SPEC 06" pasa a "Los datos se leen de Supabase con loaders propios", y se quitan las pendientes de la 06) y `CLAUDE.md` (sección "Sample data", `src/data/` y `src/assets/` fuera, `supabase/`, `src/lib/supabase.ts`, `src/lib/cargadores.ts`, `src/lib/imagenes.ts`, y que `npx supabase start` va antes de `astro dev` y `astro build`).

## Criterios de aceptación

- [x] `npx supabase db reset` aplica las 3 migraciones y la semilla sin errores.
- [x] Después del reset, `negocios` tiene 5 filas, el café tiene 7 grupos y 145 platillos, y el bucket `imagenes` tiene 5 objetos.
- [x] `PUBLIC_MOSTRAR_EJEMPLOS=true astro build` termina sin errores con Supabase local.
- [x] La compilación genera la misma lista de archivos HTML que la referencia del paso 1.
- [x] El texto visible de cada página HTML es igual al de la referencia; solo cambian las rutas de las imágenes.
- [x] `astro check` termina con 0 errores.
- [x] `src/data/`, `src/assets/` y `scripts/generar-semilla.mjs` ya no existen y ningún archivo de `src/` los menciona.
- [x] Ninguna página ni componente llama a `getCollection` fuera de `src/lib/datos.ts`, y solo `src/lib/cargadores.ts` importa `src/lib/supabase.ts`.
- [x] Sin `SUPABASE_SECRET_KEY` en el entorno, `astro build` se detiene con un mensaje que dice "SUPABASE_SECRET_KEY".
- [x] Con Supabase local detenido, `astro build` se detiene con un error y no genera un sitio vacío.
- [x] Sin `PUBLIC_MOSTRAR_EJEMPLOS`, `astro build` se detiene con el error de refugio de ejemplo de la SPEC 01.
- [x] Las fotos de Luna y Canelo, el logo, el patio y el cartel se ven en el sitio compilado, servidas desde `/_astro/` y no desde el host de Supabase.
- [x] Cambiar en Supabase Studio local a Pizzería Nonna Lupe a `estado = 'pausado'` y recompilar quita su página y su tarjeta.
- [x] Cambiar el `orden` de dos platillos de una sección y recompilar los muestra en el nuevo orden.
- [x] Insertar en `horarios` un día con `cerrado = false` y sin turnos hace que `astro build` se detenga con un error que nombra el negocio.
- [x] Insertar en `precios` una fila sin `monto` ni `texto_alterno` falla en Postgres por el `check`.
- [x] Con la llave publicable (anónima), `select * from negocios` por la API de PostgREST devuelve 0 filas.
- [ ] `https://{ref}.supabase.co/storage/v1/object/public/imagenes/peludos/luna.jpg` abre la foto sin iniciar sesión.
- [ ] El sitio en `*.vercel.app` muestra la cinta "Datos de ejemplo" y las mismas páginas que la compilación local.
- [ ] Cambiar el nombre de un peludo en Supabase Studio de la nube inicia un despliegue en Vercel, y el nombre nuevo se ve en `/adopta` en menos de 1 minuto desde que se guardó (RF-16).
- [ ] Un `update` que cambia 3 filas de una tabla inicia un solo despliegue.
- [ ] `select * from cron.job` en la nube muestra `recompilar-diario` con `5 6 * * *`.
- [ ] Correr `select recompilar_sitio()` en la nube inicia un despliegue en Vercel.
- [x] El URL del deploy hook no aparece en ningún archivo del repositorio.
- [ ] Ninguna variable de Vercel ni de `.env.example` con la llave secreta lleva prefijo `PUBLIC_`, y la llave no aparece en ningún archivo de `dist/`.

### Observaciones de la validación

Validado el 2026-10-01 en local, con Supabase en Docker (Colima) y la compilación de producción servida con `astro preview`; Playwright a 360 px.

- **Pendiente: pasos 14 y 15.** No hay sesión de Supabase ni de Vercel en el equipo, así que no se crearon el proyecto en la nube ni el de Vercel. Los criterios sin marcar dependen de la nube y se verifican al terminar esos pasos.
- **Referencia.** La compilación de antes del cambio y la final tienen los mismos 11 archivos HTML. Al normalizar los nombres de `/_astro/`, el HTML es idéntico, incluidas las etiquetas `<img>` con su `width` y `height`.
- **Imágenes.** En `/`, `/adopta`, `/esterilizacion`, `/colabora` y `/colabora/tacos-don-chuy` todas las `<img>` apuntan a `/_astro/*.webp` y el HTML no menciona el host de Supabase. El cartel ampliado de `/esterilizacion` carga dentro del `<dialog>`.
- **Café.** `/colabora/cafe-del-jardin` muestra 7 pestañas y 145 platillos, sin desplazamiento horizontal a 360 px.
- **Cambios en la base.** Se hicieron con SQL en la base local, que es lo mismo que guarda Supabase Studio: Pizzería Nonna Lupe en `pausado`, Pastor y Suadero con el `orden` invertido, y el domingo de Panadería San Juan con `cerrado = false` y sin turnos. El build se detuvo con `negocios → panaderia-san-juan data does not match collection schema`. Después, `npx supabase db reset` restauró la semilla.
- **Recompilación en local.** Con un secreto `deploy_hook_vercel` que apuntaba a un receptor HTTP local, `update necesidades set descripcion = descripcion` (3 filas) hizo una sola llamada y `select recompilar_sitio()` hizo otra; las dos respondieron 200. Sin el secreto, un `update` no encola ninguna llamada. Falta repetirlo contra Vercel en la nube.
- **API pública.** Con la llave publicable, `negocios`, `peludos`, `refugio`, `platillos` e `imagenes` devuelven `[]`. La foto de Luna en el bucket local responde 200 sin sesión.
- **Supabase detenido.** `astro build` sale con código 1, con el mensaje "No se pudo leer la tabla "refugio" de Supabase: TypeError: fetch failed (Supabase en http://127.0.0.1:54321; ¿corriste `npx supabase start`?)", y no genera ningún HTML.
- **Llave secreta en `.env.example`.** La spec pedía los valores locales de `npx supabase status`, pero la protección de GitHub rechazó el push por la llave `sb_secret_…`, aunque sea la de desarrollo local. `.env.example` deja `SUPABASE_SECRET_KEY` vacía e indica copiarla de `npx supabase status`.
- **`supabase migration new`.** Lee el contenido de la migración por stdin cuando la entrada no es una terminal; para escribir la migración desde un script hay que redirigir `</dev/null` o escribir el archivo después.

## Decisiones

- **Sí:** Vercel con salida estática y sin adaptador. Las SPEC 01 a 05 se diseñaron para compilarse completas, y un sitio estático carga rápido y se indexa bien.
- **No:** SSR o ISR en Vercel. Agrega adaptador y funciones, y cambia el modelo "todo se compila" para ganar segundos que RF-16 no pide.
- **No:** Cloudflare Pages. Funciona igual con deploy hook, pero el trabajo diario necesitaría un Worker aparte.
- **Sí:** disparador en Postgres que llama al deploy hook con `pg_net`. Es el mismo mecanismo que los Database Webhooks de Supabase, pero queda en una migración versionada.
- **Sí:** disparador por sentencia (`for each statement`). Un cambio de varias filas inicia un solo despliegue.
- **No:** botón "Publicar cambios" en el panel. Alguien puede olvidarlo, y en esta spec aún no hay panel.
- **No:** solo un cron frecuente. Gasta minutos de compilación sin cambios y no cumple RF-16.
- **Sí:** recompilación diaria con `pg_cron` a las 00:05 de Ciudad de México. Retira necesidades vencidas, campañas pasadas y promociones vencidas (SPEC 02, 04 y 05), y todo queda en SQL.
- **No:** GitHub Action programada. GitHub desactiva los crons de repositorios sin actividad durante 60 días.
- **No:** Vercel Cron. Necesita una función serverless y el sitio dejaría de ser estático.
- **Sí:** a las 06:05 UTC el build de Vercel (en UTC) y Ciudad de México están en el mismo día, así `soloFecha` de `src/lib/datos.ts` da la fecha correcta.
- **Sí:** URL del deploy hook en Vault. Quien lo conoce puede iniciar despliegues; no debe estar en el repositorio.
- **Sí:** sin el secreto, `recompilar_sitio()` no hace nada. El desarrollo local no llama a Vercel.
- **Sí:** loaders propios de content collections. Se conservan los esquemas Zod, `reference()`, la validación al compilar y los tipos; `src/lib/datos.ts` y las páginas no cambian, como decidió la SPEC 01.
- **No:** consultas directas con supabase-js en `src/lib/datos.ts`. Se pierde la validación al compilar y cambian los tipos de todos los componentes.
- **Sí:** tablas normalizadas para menú, horarios, promociones, fotos y gastos. El panel de la SPEC 07 edita un platillo sin reescribir todo el menú, y Postgres valida cada fila.
- **No:** columnas `jsonb` con la forma del JSON. Migrar sería trivial, pero Postgres no valida la forma y cada edición reescribe el menú completo.
- **Sí:** `orden` en platillos y precios. En JSON el orden venía del arreglo; en una tabla hay que guardarlo.
- **Sí:** `horarios` con `cerrado` y `turnos` aparte, y un día sin fila es "por confirmar". Respeta los tres casos del esquema de la SPEC 01.
- **Sí:** el `id` de texto de los JSON como llave primaria. Las URL de negocios y las referencias a categorías no cambian.
- **Sí:** `es_ejemplo` solo en las tablas de colección. Las hijas siguen a su registro; es el mismo filtro que hoy.
- **Sí:** imágenes en Supabase Storage. El panel de la SPEC 07 necesita subir fotos, y dejarlas en `src/assets/` obligaría a cambiar las páginas otra vez.
- **Sí:** tabla `imagenes` con `ruta`, `ancho` y `alto`, y el loader arma la URL con `SUPABASE_URL`. La misma semilla sirve en local y en la nube; con medidas guardadas, Astro no tiene que adivinarlas.
- **Sí:** campo `{ url, ancho, alto }` y `medidas()` en los 7 componentes con `<Image>`. Es el único cambio fuera de los datos y Astro sigue optimizando las imágenes al compilar.
- **No:** que el loader descargue las imágenes para seguir usando `image()`. Depende de cómo Astro resuelve rutas en loaders propios, que puede cambiar entre versiones.
- **Sí:** bucket público. El sitio estático solo sirve copias optimizadas en `/_astro/`, pero el panel y la vista previa de imágenes necesitan leerlas sin sesión.
- **Sí:** el build lee con la llave secreta y RLS queda sin políticas. Borradores, negocios pausados y datos de ejemplo no se leen desde fuera por la API.
- **No:** llave publicable con lectura pública. Cualquiera vería borradores por la API.
- **Sí:** Supabase CLI con desarrollo local y un solo proyecto en la nube. Las migraciones se prueban en local antes de tocar la nube, y el plan gratuito pausa proyectos inactivos.
- **No:** dos proyectos en la nube. Hay que aplicar migraciones dos veces y mantener dos proyectos vivos.
- **Sí:** los JSON se vuelven `supabase/seed.sql` y salen de `src/`. Una sola fuente de datos; dos fuentes se desincronizan.
- **No:** conservar los JSON como respaldo sin conexión. Obliga a mantener dos loaders.
- **Sí:** generar la semilla con un script y borrarlo después. Es una conversión de una sola vez; desde entonces los datos de ejemplo se editan en `seed.sql`.
- **Sí:** solo las 12 colecciones actuales. `solicitudes_negocio` y los usuarios del panel entran con la SPEC 07, que es la que los usa.
- **Sí:** producción en `*.vercel.app` con `PUBLIC_MOSTRAR_EJEMPLOS=true` y la cinta. Permite mostrar el sitio al refugio sin que el dominio propio indexe datos de ejemplo.
- **No:** conectar el dominio propio en esta spec. Va cuando haya datos reales y se quite `PUBLIC_MOSTRAR_EJEMPLOS`.
- **Sí:** en `astro dev`, un cambio en Supabase se ve al reiniciar el servidor. Los loaders corren al arrancar; no se agrega recarga en vivo.
- **Sí:** si Supabase no responde, la compilación falla. Vercel deja publicado el último despliegue bueno, que es mejor que publicar un sitio vacío.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El despliegue en Vercel tarda más de 1 minuto y no cumple RF-16 | Se mide en el criterio de aceptación. Si no cumple, se anota en la validación y la SPEC 07 decide entre caché de imágenes o ISR. |
| Varios cambios seguidos inician varios despliegues | El disparador es por sentencia. Vercel encola los despliegues del mismo proyecto; el último publica el estado final. |
| `pg_net` falla y el sitio no se recompila | `net._http_response` guarda cada llamada. La recompilación diaria corrige cualquier cambio perdido en menos de 24 h. |
| Supabase pausa el proyecto gratuito por inactividad | El trabajo diario hace una consulta cada día. Si se pausa, el build falla y Vercel conserva el último sitio publicado. |
| La forma que arma el loader no coincide con la del JSON | Los esquemas Zod no cambian y validan cada registro; el criterio de texto igual a la referencia lo comprueba página por página. |
| Una consulta anidada se corta por el límite de filas de PostgREST | El menú del café tiene 145 platillos. Se cuenta en el criterio de la semilla y en el texto de `/colabora/cafe-del-jardin`. |
| Alguien expone la llave secreta con prefijo `PUBLIC_` | Hay un criterio que la busca en `dist/`. `src/lib/supabase.ts` solo se importa desde los loaders. |
| Las fechas del build se calculan en otra zona horaria | Vercel compila en UTC y la hora del trabajo diario cae en el mismo día que Ciudad de México. |
| Cambiar la semilla en local no llega a la nube | `seed.sql` solo se aplica en la nube con `db push --include-seed` la primera vez. Después, los datos de la nube se editan en Studio y desde la SPEC 07 en el panel. |

## Lo que **no** entra en esta spec

- Panel `/admin`, cuentas, políticas RLS de edición y subida de imágenes (SPEC 07).
- Solicitudes de negocio y usuarios del panel (SPEC 07).
- Dominio propio y retiro de los datos de ejemplo de producción.
- SSR o ISR.
- Texto alternativo por imagen.
- Anuncios, analítica y SEO (SPEC 08).
- Un segundo proyecto de Supabase.

Cada una de estas, si llega, va en su propia spec.
