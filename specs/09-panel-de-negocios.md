# SPEC 09 — Panel de negocios

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 05, SPEC 07, SPEC 08
> **Fecha:** 2026-10-02
> **Objetivo:** Que la cuenta `administrador` cree, edite y borre desde `/admin` los negocios de "Come por los Peludos" (ficha, logo, horarios, promoción y estado) y sus categorías, con un solo despliegue por guardado.

## Por qué existe esta spec

El índice asignaba a la 09 los negocios y los menús juntos.
El editor de menús (tres niveles, varios precios por platillo y más de 150 platillos en el café de ejemplo) es tan grande como toda la SPEC 08, así que se divide:

- **09 (esta):** ficha del negocio, logo, horarios con turnos, promoción, estado y categorías.
- **10:** editor de menús (grupos, secciones, platillos y precios).

La antigua 10 (anuncios, analítica, SEO y aviso de privacidad) pasa a ser la 11.

Esta spec reutiliza las piezas de la 08: RPC `security definer` que guardan todo en una transacción, `src/lib/formularioPanel.ts`, `src/lib/imagenesPanel.ts` y `CampoFotos`.
La diferencia es el rol: aquí solo entra el administrador, que es quien digitaliza y gestiona negocios según la spec padre.

## Alcance

**Dentro:**

- Edición desde el panel de `negocios` con su logo, `promociones`, `horarios` y `turnos`, en un solo formulario y un solo guardado.
- Edición de `categorias`: crear, renombrar, subir y bajar el orden, y borrar si ningún negocio la usa.
- Borrar un negocio con confirmación; caen en cascada su promoción, horarios y menú, y el logo si nadie más lo usa.
- Solo el rol `administrador`; la cuenta `refugio` no ve ni puede llamar nada de esta spec.
- Logo en PNG reducido a 512 px que conserva la transparencia, en la carpeta `negocios/` del bucket.
- Horarios por día: "Por confirmar", "Cerrado" o "Abierto" con hasta 2 turnos, y un botón para copiar el lunes a los demás días.
- Ubicación con un solo campo que acepta las coordenadas copiadas de Google Maps.
- WhatsApp capturado en 10 dígitos y guardado con `52` delante.
- `MenuNegocio` muestra "Estamos preparando el menú de este negocio." cuando el negocio no tiene platillos disponibles.
- Enlaces a Negocios y Categorías en `EncabezadoPanel` y `/admin`, solo para el administrador.

**Fuera de alcance (specs futuras):**

- Editor de menús: grupos, secciones, platillos y precios (SPEC 10). Hasta entonces los menús se cargan en Studio.
- Importar un menú desde texto pegado o desde PDF.
- Crear un negocio desde una solicitud de `/admin/solicitudes`; la solicitud se marca `publicada` a mano, como hoy.
- Exigir menú o autorización con fecha para publicar un negocio.
- Columna o registro de la autorización de publicación del negocio.
- Varias promociones por negocio; la tabla admite una.
- Mapa para elegir el punto de la ubicación.
- Edición de negocios por la cuenta `refugio` o por cuentas de negocio.
- Anuncios, analítica, SEO y aviso de privacidad definitivo (SPEC 11).

## Modelo de datos

No hay tablas nuevas ni columnas nuevas.
Se agregan políticas, funciones y la carpeta `negocios/` del bucket.

### Lectura para el panel

`authenticated` recibe `select` con la condición `public.es_administrador()` en:

`categorias`, `promociones`, `horarios` y `turnos`.

`negocios` ya tiene `negocios_lee_administrador` (SPEC 07) e `imagenes` ya se lee con `rol_panel()` (SPEC 08).
Las tablas del menú no ganan políticas en esta spec.
Las escrituras directas siguen revocadas (SPEC 08): todo pasa por las RPC.

### Funciones RPC

Todas son `security definer`, `set search_path = ''`, y empiezan con la nueva `exigir_administrador()`, que lanza `sin_permiso` si `es_administrador()` es falso.
Se revoca `execute` a `public` y `anon` y se concede a `authenticated` (salvo `exigir_administrador()`, que no se concede a nadie).

```sql
-- Crea (sin "id") o actualiza (con "id") el negocio, su logo, horarios y promoción.
-- Devuelve { "id": text, "rutas_borradas": text[] }.
create function public.guardar_negocio(datos jsonb) returns jsonb ...;

-- Borra el negocio (promoción, horarios, turnos y menú caen en cascada)
-- y devuelve las rutas de imágenes que quedaron sin uso.
create function public.borrar_negocio(id text) returns text[] ...;

-- Crea o renombra una categoría. Devuelve { "id": text }.
create function public.guardar_categoria(datos jsonb) returns jsonb ...;

-- Lanza 'categoria_en_uso' si algún negocio la usa.
create function public.borrar_categoria(id text) returns void ...;

-- direccion in (-1, 1); renumera e intercambia `orden` como mover_contenido de la SPEC 08.
create function public.mover_categoria(id text, direccion int) returns void ...;
```

`borrar_contenido` y `mover_contenido` de la SPEC 08 no cambian: siguen rechazando `negocios` y `categorias`.

Forma de `datos` en `guardar_negocio`:

```json
{
  "id": "tacos-don-chuy",
  "nombre": "Tacos Don Chuy",
  "categoria_id": "taquerias",
  "descripcion_corta": "Tacos al pastor con trompo de leña",
  "direccion": "Av. Juárez 45",
  "latitud": 18.9608,
  "longitud": -99.5906,
  "whatsapp": "5500000001",
  "estado": "publicado",
  "porcentaje_aporte": 5,
  "logo": { "ruta": "negocios/0b7e….png", "ancho": 512, "alto": 384 },
  "horarios": {
    "lun": [{ "abre": "13:00", "cierra": "00:30" }],
    "mar": "cerrado",
    "sab": [{ "abre": "09:00", "cierra": "14:00" }, { "abre": "18:00", "cierra": "23:00" }]
  },
  "promocion": { "texto": "Orden de 5 tacos con refresco por $95", "fecha_inicio": "2026-10-01", "fecha_fin": null }
}
```

- `logo` es `null`, `{ "imagen_id": … }` o `{ "ruta", "ancho", "alto" }`, como el cartel de `guardar_campana`.
- Una ruta nueva de logo debe empezar con `negocios/`; las RPC de la SPEC 08 siguen sin aceptar rutas en `negocios/`.
- Un día ausente de `horarios` es "por confirmar" (sin fila). `"cerrado"` es una fila con `cerrado = true` y sin turnos. Un arreglo es una fila con `cerrado = false` y 1 o 2 turnos.
- Un turno con `abre` igual a `cierra` lanza `datos_invalidos`; `cierra` menor que `abre` cruza la medianoche.
- La RPC reemplaza todas las filas de `horarios` y `turnos` del negocio en cada guardado.
- `promocion` `null` borra la fila de `promociones`; con objeto, la crea o la reemplaza. `fecha_fin` menor que `fecha_inicio` lanza `datos_invalidos`.
- `whatsapp` llega con 10 dígitos o `null`; la RPC guarda `'52' || whatsapp`.
- `latitud` y `longitud` llegan las dos o ninguna; fuera de rango (±90, ±180) lanzan `datos_invalidos`.
- `porcentaje_aporte` entre 0 y 100, con decimales.
- Al quitar o reemplazar el logo, la RPC lo pasa por `limpiar_imagenes()` y devuelve su ruta en `rutas_borradas`.

Reglas de `id` (solo al crear; nunca cambia al editar):

| Tabla | `id` |
| --- | --- |
| `negocios` | Slug del nombre (`tacos-don-chuy`); si existe, `tacos-don-chuy-2`… Es la URL `/colabora/{id}` y la del QR |
| `categorias` | Slug del nombre, con el mismo sufijo |

Se usan `slug()` e `id_libre()` de la SPEC 08.
Un negocio nuevo va con `es_ejemplo = false` y `fecha_alta` = hoy en `America/Mexico_City`; al editar se conservan los dos.
Una categoría nueva va con `es_ejemplo = false` y `orden` = máximo + 1.

### Storage

Políticas en `storage.objects` para `authenticated` con `bucket_id = 'imagenes'`, `public.es_administrador()` y la primera carpeta igual a `'negocios'`: `insert`, `select` y `delete`, como las de la SPEC 08.
Ruta de cada logo: `negocios/{crypto.randomUUID()}.png`.

### Imágenes en el navegador

| Uso | Lado mayor máximo | Formato |
| --- | --- | --- |
| Logo de negocio | 512 px | PNG, conserva la transparencia |
| Fotos y carteles (SPEC 08) | 1600 y 2400 px | JPEG 0.85, sin cambio |

`reducir()` recibe el formato de salida, `subir()` usa la extensión y el `contentType` del formato, y el tipo `Carpeta` suma `'negocios'`.
`CampoFotos` con `maximo={1}` sirve para el logo.

### Migración

| Archivo en `supabase/migrations/` | Contenido |
| --- | --- |
| `{marca}_panel_negocios.sql` | `exigir_administrador()`, políticas de lectura, políticas de Storage para `negocios/`, el cambio de `guardar_imagen()` para limitar la carpeta por RPC y las 5 funciones RPC |

### Archivos

| Archivo | Contenido |
| --- | --- |
| `src/pages/admin/negocios.astro` y `negocios/editar.astro` | Lista y formulario de negocio |
| `src/pages/admin/categorias.astro` y `categorias/editar.astro` | Lista y formulario de categoría |
| `src/components/admin/CampoHorarios.astro` | Los 7 días con "Por confirmar", "Cerrado" o "Abierto", hasta 2 turnos y "Copiar el lunes a todos los días" |
| `src/lib/imagenesPanel.ts` | Formato de salida en `reducir()` y `subir()`, carpeta `negocios` |
| `src/lib/formularioPanel.ts` | Mensajes de `categoria_en_uso` y de los `datos_invalidos` nuevos |
| `src/components/admin/EncabezadoPanel.astro` y `src/pages/admin/index.astro` | Enlaces y tarjetas de Negocios y Categorías con `data-solo-administrador` |
| `src/components/colabora/MenuNegocio.astro` | Mensaje de menú en preparación sin grupos disponibles |

Las páginas usan `LayoutPanel` y `prepararPanel('administrador')`: la cuenta `refugio` regresa a `/admin`.
Cada `editar` lee `?id=`; sin `id` es un registro nuevo, y un `id` que no existe muestra "No encontramos este registro."

### Listas

| Página | Columnas | Orden | Acciones por fila |
| --- | --- | --- | --- |
| `/admin/negocios` | Logo (o inicial), nombre, categoría, estado, aporte y promoción ("Vigente", "Programada", "Vencida" o nada) | Nombre, alfabético | Editar, Ver página (solo `publicado`), Borrar |
| `/admin/categorias` | Nombre y número de negocios | `orden` | Editar, Subir, Bajar, Borrar |

Cada lista tiene el botón "Agregar" y la etiqueta "Ejemplo" en los registros `es_ejemplo`.

### Formularios

| Formulario | Campos | Reglas |
| --- | --- | --- |
| Negocio | Nombre, categoría (`<select>` por `orden`), descripción corta, dirección, ubicación, WhatsApp, estado (borrador, publicado o pausado), aporte (%), logo, horarios, promoción | Obligatorios: nombre, categoría, descripción, dirección, estado y aporte. Un negocio nuevo empieza en `borrador` |
| Ubicación | Un campo de texto: "19.0123, -99.5906" | Opcional; el script separa por la coma; si no se entiende, marca el campo. Enlace "Probar en el mapa" con `enlaceMapa()` |
| WhatsApp | `tel` con `inputmode="numeric"` | Opcional, 10 dígitos; quita espacios y guiones. Al editar muestra los últimos 10 dígitos del valor guardado |
| Horarios | `CampoHorarios` | Cada día empieza en "Por confirmar"; "Abierto" pide al menos un turno con apertura y cierre distintos |
| Promoción | Casilla "Tiene promoción", texto, desde (por defecto hoy en México) y hasta | Con la casilla marcada, texto y "desde" son obligatorios; "hasta" opcional y no anterior a "desde" |
| Categoría | Nombre | Obligatorio |

| Estado | Qué se ve |
| --- | --- |
| Guardando | Botón desactivado con "Guardando…" |
| Guardado | Regresa a la lista con "Guardado. El sitio público se actualiza en cuanto termine de compilar." |
| `categoria_en_uso` | "Esta categoría tiene negocios. Cámbialos de categoría antes de borrarla." |
| Cualquier otro error | "No pudimos guardar. Revisa tu conexión e intenta otra vez."; el formulario conserva lo escrito |
| Borrar negocio | `confirm` nativo: "¿Borrar {nombre}? Se borran también su menú y horarios. No se puede deshacer." |
| Borrar categoría | `confirm` nativo: "¿Borrar {nombre}? No se puede deshacer." |
| Cambios sin guardar | Aviso `beforeunload` del navegador, como en la SPEC 08 |

### Página pública sin menú

Si `menuDisponible(negocio)` no tiene grupos, `MenuNegocio` conserva el título "Menú" y muestra "Estamos preparando el menú de este negocio." en lugar del buscador y las pestañas.

## Plan de implementación

1. Crear la migración `panel_negocios` con `exigir_administrador()`, las políticas de lectura y las de Storage. Comprobar por PostgREST que la cuenta `administrador` con `aal2` lee `categorias`, `promociones`, `horarios` y `turnos`, y que la cuenta `refugio`, `aal1` y `anon` leen 0 filas.
2. Agregar `guardar_categoria`, `borrar_categoria` y `mover_categoria`. Comprobar con `curl` que el administrador crea, renombra, mueve y borra una categoría, que borrar `taquerias` lanza `categoria_en_uso` y que la cuenta `refugio` recibe `sin_permiso`.
3. Crear `/admin/categorias` y `/admin/categorias/editar`, y agregar Negocios y Categorías a `EncabezadoPanel` y `/admin` con `data-solo-administrador` (Negocios todavía sin página).
4. Cambiar `src/lib/imagenesPanel.ts` para el formato PNG y la carpeta `negocios`. Comprobar que una foto de peludo sigue saliendo en JPEG de 1600 px.
5. Cambiar `guardar_imagen()` para limitar la carpeta por RPC y agregar `guardar_negocio` (sin horarios todavía) y `borrar_negocio`. Comprobar con `curl` que crea un negocio con logo y promoción, y que `guardar_peludo` rechaza una ruta en `negocios/`.
6. Crear `/admin/negocios` y `/admin/negocios/editar` con ficha, ubicación, WhatsApp, logo y promoción.
7. Agregar los horarios a `guardar_negocio`, crear `CampoHorarios` y sumarlo al formulario.
8. Agregar el mensaje de menú en preparación a `MenuNegocio`.
9. Paso manual en la nube: `npx supabase db push`; con la cuenta administradora, cambiar el horario de un negocio y medir el tiempo hasta verlo en `/colabora/{id}` (RF-16).
10. Actualizar `specs/README.md` (la 09 con este título; nueva fila 10 "Editor de menús" y la antigua 10 como 11; mover sus pendientes) y `CLAUDE.md` (páginas nuevas, `CampoHorarios`, las RPC, la carpeta `negocios/` y el formato PNG de logos).

## Criterios de aceptación

### Seguridad

- [ ] Con la llave publicable, con `aal1` y con la sesión `aal2` de la cuenta `refugio`, `select` a `categorias`, `promociones`, `horarios` y `turnos` por PostgREST devuelve 0 filas.
- [ ] Con esas mismas sesiones, `guardar_negocio`, `borrar_negocio`, `guardar_categoria`, `borrar_categoria` y `mover_categoria` fallan y no cambian nada.
- [ ] La cuenta `refugio` no ve los enlaces Negocios ni Categorías, y abrir `/admin/negocios` la regresa a `/admin`.
- [ ] La cuenta `refugio` no puede subir `negocios/x.png` al bucket; la cuenta `administrador` sí.
- [ ] `guardar_peludo` con una foto en `negocios/x.png` falla con `datos_invalidos`.
- [ ] `borrar_contenido('negocios', 'tacos-don-chuy')` sigue fallando con `sin_permiso`, también para el administrador.

### Negocios

- [ ] "Agregar" con nombre "Tacos Don Chuy" crea el id `tacos-don-chuy-2`, en `borrador`, con `es_ejemplo = false` y `fecha_alta` de hoy.
- [ ] Cambiar el nombre de un negocio existente no cambia su id ni su URL.
- [ ] Un negocio en `borrador` o `pausado` no aparece en `/colabora` tras recompilar; al pasarlo a `publicado`, sí.
- [ ] Pegar "18.9608, -99.5906" en ubicación guarda `latitud = 18.9608` y `longitud = -99.5906`; dejarlo vacío guarda las dos en `null`; "hola" marca el campo y no guarda.
- [ ] "55 0000-0001" en WhatsApp se guarda como `525500000001`, y al editar se muestra `5500000001`.
- [ ] Editar Tacos Don Chuy (guardado como `5215500000001`) muestra `5500000001` en el campo.
- [ ] Un logo PNG de 2000 × 1500 px con fondo transparente queda en el bucket como PNG de 512 × 384 px, con transparencia.
- [ ] Reemplazar o quitar el logo y guardar borra el archivo anterior del bucket y su fila de `imagenes`.
- [ ] Borrar un negocio pide confirmación; al aceptar desaparecen sus filas de `negocios`, `promociones`, `horarios`, `turnos` y del menú, y su logo del bucket.
- [ ] Guardar un negocio con logo, horarios y promoción encola exactamente 1 llamada en `net.http_request_queue` (local, con el receptor de prueba de la SPEC 08).

### Horarios

- [ ] Un día en "Por confirmar" no deja fila en `horarios` y la página del negocio lo muestra como por confirmar.
- [ ] Un día "Cerrado" deja una fila con `cerrado = true` y sin turnos.
- [ ] Un turno de 13:00 a 00:30 se guarda y la página muestra "abierto ahora" a las 00:15 de ese día (RF-07).
- [ ] Un turno con la misma hora de apertura y cierre no deja guardar.
- [ ] Con 2 turnos en un día, "Agregar turno" está desactivado.
- [ ] "Copiar el lunes a todos los días" copia estado y turnos del lunes a los otros 6 días.

### Promoción

- [ ] Marcar "Tiene promoción" sin texto no deja guardar.
- [ ] Una promoción con "hasta" de ayer aparece como "Vencida" en `/admin/negocios` y no se muestra en la tarjeta ni en la página tras recompilar.
- [ ] Una promoción con "desde" de mañana aparece como "Programada".
- [ ] Desmarcar "Tiene promoción" y guardar borra la fila de `promociones`.

### Categorías

- [ ] Crear "Heladerías" crea el id `heladerias`, al final de la lista, y aparece en el `<select>` del formulario de negocio y en el de Súmate tras recompilar.
- [ ] Renombrar una categoría cambia su nombre en el filtro de `/colabora` tras recompilar y conserva su id.
- [ ] "Bajar" en la primera categoría la cambia de lugar con la segunda y se conserva al recargar.
- [ ] Borrar `taquerias` muestra "Esta categoría tiene negocios…" y no borra nada; borrar una sin negocios funciona.

### Página pública

- [ ] Un negocio publicado sin menú muestra "Estamos preparando el menú de este negocio." y no muestra el buscador del menú ni pestañas.
- [ ] Con la semilla sin cambios, las páginas públicas generan el mismo HTML que antes.

### Formularios y compilación

- [ ] Cambiar un campo e intentar cerrar la pestaña muestra el aviso del navegador; después de guardar, no.
- [ ] Con la red cortada, guardar muestra "No pudimos guardar…", conserva lo escrito y no deja logos nuevos en el bucket.
- [ ] `/admin/negocios/editar?id=no-existe` muestra "No encontramos este registro."
- [ ] Los registros de la semilla llevan la etiqueta "Ejemplo" y la conservan al editarlos.
- [ ] Las páginas nuevas no tienen desplazamiento horizontal a 360 px y sus botones miden al menos 44 px.
- [ ] Las páginas nuevas sin sesión redirigen a `/admin/entrar` sin mostrar datos.
- [ ] `npx supabase db reset` aplica las 7 migraciones y la semilla sin errores.
- [ ] `astro build` y `astro check` terminan sin errores.

### Nube (después del paso 9)

- [ ] La cuenta administradora cambia el horario de un negocio y el cambio se ve en `/colabora/{id}` de Vercel; se anota el tiempo medido contra RF-16.
- [ ] Ese guardado inicia un solo despliegue en Vercel.

## Decisiones

- **Sí:** dividir negocios y menús en 09 y 10. El editor de menús es tan grande como la SPEC 08 y puede reabrir la decisión del framework; juntos serían difíciles de validar.
- **Sí:** el editor de menús de la SPEC 10 será un árbol en una sola página con `<script>` nativo y una RPC que reemplaza el menú completo en una transacción. Se decidió al escribir esta spec y se anota en el índice.
- **No:** isla de Svelte para el editor de menús. Agrega un framework a un panel que hoy no tiene ninguno.
- **No:** importar menús desde texto pegado. Agiliza la primera captura, pero editar un precio suelto sigue necesitando el árbol.
- **Sí:** solo el administrador edita negocios y categorías. La spec padre le asigna digitalizar menús y gestionar negocios; el refugio no los necesita.
- **Sí:** funciones nuevas (`borrar_negocio`, `borrar_categoria`, `mover_categoria`) en lugar de ampliar `borrar_contenido` y `mover_contenido`. Cada función revisa un solo rol y las de la SPEC 08 quedan intactas.
- **Sí:** ficha, logo, horarios y promoción en un solo formulario y una sola RPC. Un guardado es una transacción y un despliegue.
- **No:** páginas separadas para horarios y promoción. Más pantallas y más despliegues por un mismo cambio.
- **Sí:** `id` automático y fijo. La URL y el QR impreso no cambian al renombrar el negocio.
- **Sí:** alta independiente de la bandeja de solicitudes. La solicitud trae poco (nombre, tipo, WhatsApp) y se marca `publicada` a mano.
- **Sí:** publicar solo exige los campos obligatorios. El menú llega en la SPEC 10 y la autorización con fecha no tiene columna.
- **Sí:** mensaje "Estamos preparando el menú…" en la página pública. Un negocio publicado sin menú no debe mostrar un buscador vacío.
- **Sí:** categorías editables en el panel. Un negocio nuevo puede necesitar una categoría que no existe.
- **Sí:** borrar una categoría solo si nadie la usa. La llave foránea `on delete restrict` ya lo exige; el panel lo explica.
- **Sí:** horarios por día con hasta 2 turnos y "Copiar el lunes a todos los días". Cubre comida y cena, y la mayoría de los negocios repite el mismo horario.
- **No:** 3 turnos por día. Ningún negocio de ejemplo lo necesita.
- **No:** validar que dos turnos del mismo día no se encimen. Son 2 turnos a lo más y el error se ve al revisar.
- **Sí:** un campo para pegar coordenadas de Google Maps. Es lo que el equipo copia del mapa y no agrega librerías.
- **No:** mapa para elegir el punto. Agrega una librería y más código.
- **Sí:** WhatsApp en 10 dígitos y `52` delante, como Súmate. Los negocios son de Tenancingo y nadie escribe la lada.
- **Sí:** logo en PNG de 512 px. Conserva la transparencia; la tarjeta y la cabecera lo muestran a menos de 240 px de ancho.
- **No:** logo en JPEG con fondo blanco. Se vería un recuadro sobre fondos de color.
- **Sí:** borrar negocios desde el panel con `confirm`. Para ocultarlo sin perder datos existe `pausado`.
- **Sí:** `guardar_imagen()` limita la carpeta según la RPC. La cuenta `refugio` no puede registrar una imagen en `negocios/` por la SPEC 08.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Borrar un negocio con QR impreso deja el QR en un 404 | El `confirm` nombra el negocio; para ocultarlo sin romper el QR se usa `pausado`. |
| Un negocio publicado sin menú se ve incompleto | Mensaje "Estamos preparando el menú…"; el estado `borrador` sirve mientras se captura el menú en Studio o con la SPEC 10. |
| Coordenadas mal pegadas mandan "Cómo llegar" a otro lugar | El enlace "Probar en el mapa" abre el punto antes de guardar. |
| Un número con lada distinta de `52` | Los negocios son locales; un caso raro se corrige en Studio. |
| Un PNG grande de logo pesa más que un JPEG | A 512 px un logo pesa decenas de KB. |
| Un error en una RPC `security definer` da permisos de más | Cada función empieza con `exigir_administrador()`; hay criterios con `anon`, `aal1` y la cuenta `refugio`. |
| Cambiar `guardar_imagen()` rompe las RPC de la SPEC 08 | El paso 5 comprueba `guardar_peludo`; las RPC de la 08 se prueban otra vez con el panel del refugio. |

## Lo que **no** entra en esta spec

- Editor de menús (SPEC 10).
- Importar menús desde texto o PDF.
- Crear un negocio desde una solicitud.
- Exigir menú o autorización para publicar.
- Varias promociones por negocio.
- Mapa para elegir la ubicación.
- Edición de negocios por la cuenta `refugio` o por los negocios.
- Anuncios, analítica, SEO y aviso de privacidad (SPEC 11).

Cada una de estas, si llega, va en su propia spec.
