# SPEC 08 — Panel del refugio

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 03, SPEC 06, SPEC 07
> **Fecha:** 2026-10-01
> **Objetivo:** Que las cuentas `refugio` y `administrador` editen desde `/admin` peludos, campañas, necesidades, textos y el registro mensual de cifras, con sus fotos, y que cada guardado inicie un solo despliegue.

## Por qué existe esta spec

La SPEC 07 dejó la sesión con TOTP, los roles y las funciones `rol_panel()` y `es_administrador()`, pero ninguna tabla de contenido tiene políticas: hoy todo se edita en Supabase Studio.
Esta es la primera spec que escribe en tablas de contenido y en el bucket `imagenes` desde el navegador.

Guardar un peludo con fotos toca tres tablas (`imagenes`, `peludos`, `fotos_peludo`).
Con varias llamadas a PostgREST serían varias transacciones, y el disparador `recompilar` de la SPEC 06 llamaría al deploy hook de Vercel una vez por sentencia.
Por eso cada guardado es una sola función de Postgres (RPC), y el disparador pasa a llamar al hook una vez por transacción.

La SPEC 09 (negocios y menús) reutiliza las piezas de esta: la subida de imágenes, las RPC y el aviso de cambios sin guardar.

## Alcance

**Dentro:**

- Edición desde el panel de `peludos` (con `fotos_peludo`), `campanas` (con su cartel), `necesidades`, `bloques_contenido` (con `imagenes_bloque`) y `registros_cifras` (con `gastos_registro`).
- Mismos permisos para los roles `refugio` y `administrador` en esas tablas.
- Crear, editar y borrar (con confirmación) en las cinco; subir y bajar el orden de peludos y bloques.
- Subida de fotos al bucket `imagenes`, reducidas en el navegador; hasta 4 fotos por peludo y por bloque; un cartel por campaña.
- Borrado del archivo y de la fila de `imagenes` cuando una foto se quita y nadie más la usa.
- Funciones RPC de guardado, borrado y orden, con políticas de lectura para el panel y políticas de Storage.
- El disparador `recompilar` llama al deploy hook una vez por transacción.
- `registros_cifras` y `gastos_registro` dejan de iniciar despliegues; el registro de cifras solo se ve en el panel.
- Aviso del navegador al salir de un formulario con cambios sin guardar.
- `/admin` y `EncabezadoPanel` muestran las cinco secciones a los dos roles; se retira el aviso "Pronto podrás editar…".

**Fuera de alcance (specs futuras):**

- Problemáticas, destinos de donativo, datos del refugio (frase, ubicación, WhatsApp, logo, foto principal) y redes: siguen en Studio.
- Calcular las cifras de la portada a partir del registro de cifras; `problematicas` sigue con cifras manuales.
- Resumen anual o gráficas del registro de cifras.
- Negocios, menús, horarios y promociones (SPEC 09).
- Anuncios (SPEC 10).
- Bloqueo o aviso cuando dos personas editan el mismo registro.
- Vista previa del sitio antes de guardar.
- Arrastrar para ordenar.
- Biblioteca de imágenes para reutilizar una foto en varios registros.

## Modelo de datos

No hay tablas nuevas ni columnas nuevas.
Se agregan políticas, funciones y un cambio en la recompilación.

### Recompilación una vez por transacción

`avisar_cambio()` revisa una variable local de la transacción antes de llamar a `recompilar_sitio()`:

```sql
-- Primera sentencia de la transacción: marca y llama al hook. Las siguientes no hacen nada.
if current_setting('recompilar.avisado', true) is distinct from 'si' then
	perform set_config('recompilar.avisado', 'si', true); -- true = solo esta transacción
	perform public.recompilar_sitio();
end if;
```

Se borran los disparadores `recompilar` de `registros_cifras` y `gastos_registro`: el sitio no muestra esas tablas.
El trabajo diario `recompilar-diario` no cambia.

### Lectura para el panel

`authenticated` recibe `select` con la condición `public.rol_panel() is not null` en:

`peludos`, `fotos_peludo`, `campanas`, `necesidades`, `bloques_contenido`, `imagenes_bloque`, `registros_cifras`, `gastos_registro` e `imagenes`.

`rol_panel()` ya exige sesión `aal2` (SPEC 07).
`authenticated` no recibe `insert`, `update` ni `delete` en ninguna tabla de contenido: todas las escrituras pasan por las RPC.
`anon` sigue sin políticas.

### Funciones RPC

Todas son `security definer`, `set search_path = ''`, y empiezan con `if public.rol_panel() is null then raise exception 'sin_permiso'`.
Se revoca `execute` a `public` y `anon` y se concede a `authenticated`.

```sql
-- Crea (sin "id") o actualiza (con "id") y devuelve { "id": text, "rutas_borradas": text[] }.
create function public.guardar_peludo(datos jsonb) returns jsonb ...;
create function public.guardar_campana(datos jsonb) returns jsonb ...;
create function public.guardar_necesidad(datos jsonb) returns jsonb ...;
create function public.guardar_bloque(datos jsonb) returns jsonb ...;
create function public.guardar_registro_cifras(datos jsonb) returns jsonb ...;

-- tabla in ('peludos', 'campanas', 'necesidades', 'bloques_contenido', 'registros_cifras').
-- Borra el registro (las hijas caen en cascada) y devuelve las rutas de imágenes que quedaron sin uso.
create function public.borrar_contenido(tabla text, id text) returns text[] ...;

-- tabla in ('peludos', 'bloques_contenido'); direccion in (-1, 1).
-- Intercambia `orden` con el vecino; en bloques, el vecino de la misma sección.
create function public.mover_contenido(tabla text, id text, direccion int) returns void ...;
```

Forma de `datos` en las RPC con imágenes (ejemplo de peludo):

```json
{
  "id": "luna",
  "nombre": "Luna",
  "especie": "perro",
  "descripcion_especie": "Perrita",
  "edad": "2 años",
  "tamano": "mediano",
  "descripcion": null,
  "rasgos": ["Juguetona", "Cariñosa"],
  "estado": "disponible",
  "fotos": [
    { "imagen_id": "6f1c…" },
    { "ruta": "peludos/0b7e….jpg", "ancho": 1600, "alto": 1200 }
  ]
}
```

- Una foto con `imagen_id` ya existe; una con `ruta` es nueva y la RPC inserta su fila en `imagenes`.
- El orden del arreglo es el `orden` de `fotos_peludo` (o `imagenes_bloque`); la primera es la principal.
- La RPC reemplaza todas las filas hijas del registro, luego borra las filas de `imagenes` que dejó de usar y que no usa ninguna otra tabla (`fotos_peludo`, `imagenes_bloque`, `campanas`, `refugio`, `negocios`), y devuelve sus rutas.
- `guardar_campana` recibe `cartel` como `null`, `{ "imagen_id": … }` o `{ "ruta", "ancho", "alto" }`.
- `guardar_registro_cifras` recibe `gastos` como arreglo de `{ "concepto", "monto" }` y reemplaza las filas de `gastos_registro`.
- Más de 4 fotos lanza `demasiadas_fotos`.

Reglas de `id` (solo al crear; nunca cambia al editar):

| Tabla | `id` |
| --- | --- |
| `peludos` | Slug del nombre (`luna`); si existe, `luna-2`, `luna-3`… |
| `bloques_contenido` | Slug del título, con el mismo sufijo |
| `campanas` | La fecha (`2026-11-14`); si existe, error `campana_repetida` |
| `registros_cifras` | El mes (`2026-10`); si existe, error `mes_repetido` |
| `necesidades` | `{tipo}-{fecha_vigencia}` (`alimento-2026-10-31`), con el mismo sufijo |

El slug quita acentos, pasa a minúsculas y cambia todo lo que no sea letra o número por `-`.
Un registro nuevo va con `es_ejemplo = false` y `orden` = máximo + 1 (en bloques, dentro de su sección); al editar se conservan los dos.

### Storage

Políticas en `storage.objects` para `authenticated` con `bucket_id = 'imagenes'`, `public.rol_panel() is not null` y la primera carpeta en `('peludos', 'campanas', 'bloques')`:

| Permiso | Para qué |
| --- | --- |
| `insert` | Subir una foto nueva |
| `select` | Lo pide la API de Storage para borrar |
| `delete` | Borrar las rutas que devuelven las RPC |

Ruta de cada archivo: `{carpeta}/{crypto.randomUUID()}.jpg`.

### Reducción de imágenes

| Uso | Lado mayor máximo | Formato |
| --- | --- | --- |
| Fotos de peludos y de bloques | 1600 px | JPEG, calidad 0.85 |
| Cartel de campaña | 2400 px | JPEG, calidad 0.85 |

Una imagen más chica no se agranda.
El navegador mide `ancho` y `alto` después de reducir y los manda en `datos`.
El `<input type="file">` acepta `image/jpeg, image/png, image/webp`; si el navegador no puede leer el archivo, se muestra "No pudimos leer esta imagen. Prueba con una foto JPG o PNG."

### Orden de un guardado con fotos

1. Reducir y subir las fotos nuevas al bucket.
2. Llamar a la RPC.
3. Si la RPC falla, borrar del bucket las fotos recién subidas y mostrar el error.
4. Si la RPC responde, borrar del bucket las `rutas_borradas`.

### Migración

| Archivo en `supabase/migrations/` | Contenido |
| --- | --- |
| `{marca}_panel_refugio.sql` | Nueva `avisar_cambio()`, borrado de los disparadores de `registros_cifras` y `gastos_registro`, políticas de lectura, políticas de Storage y las 7 funciones RPC |

### Archivos

| Archivo | Contenido |
| --- | --- |
| `src/lib/imagenesPanel.ts` | `reducir(archivo, ladoMaximo)` con `<canvas>` (devuelve `Blob`, `ancho`, `alto`), `subir(carpeta, blob)` y `borrarRutas(rutas)` |
| `src/lib/formularioPanel.ts` | Aviso `beforeunload` con cambios sin guardar, estado del botón "Guardando…", mensajes de error por código y `confirmarBorrado(nombre)` |
| `src/components/admin/CampoFotos.astro` | Lista de hasta 4 fotos con vista previa, "Subir", "Bajar", "Quitar" y "Agregar foto"; con `maximo={1}` sirve para el cartel |
| `src/components/admin/EncabezadoPanel.astro` | Enlaces a Peludos, Campañas, Necesidades, Textos y Cifras para los dos roles |
| `src/pages/admin/index.astro` | Tarjetas de las cinco secciones para los dos roles, más Solicitudes y QR para el administrador |
| `src/pages/admin/peludos.astro` y `peludos/editar.astro` | Lista y formulario |
| `src/pages/admin/campanas.astro` y `campanas/editar.astro` | Lista y formulario |
| `src/pages/admin/necesidades.astro` y `necesidades/editar.astro` | Lista y formulario |
| `src/pages/admin/textos.astro` y `textos/editar.astro` | Lista y formulario de `bloques_contenido` |
| `src/pages/admin/cifras.astro` y `cifras/editar.astro` | Lista y formulario de `registros_cifras` |

Cada `editar` lee `?id=`; sin `id` es un registro nuevo.
Un `id` que no existe muestra "No encontramos este registro." y un enlace a la lista.
Todas las páginas usan `LayoutPanel` y `prepararPanel()` sin rol (los dos roles entran).

### Listas

| Página | Columnas | Orden | Acciones por fila |
| --- | --- | --- | --- |
| `/admin/peludos` | Foto principal (o ícono), nombre, especie, estado | `orden` | Editar, Subir, Bajar, Borrar |
| `/admin/campanas` | Fecha, lugar, estado | Fecha, la más nueva primero | Editar, Borrar |
| `/admin/necesidades` | Descripción, tipo, urgencia, vigencia y "Vencida" si ya pasó | Vigencia, la más próxima primero | Editar, Borrar |
| `/admin/textos` | Agrupados por sección: título y "Publicado" o "Oculto" | `orden` dentro de la sección | Editar, Subir, Bajar, Borrar |
| `/admin/cifras` | Mes, animales recibidos, rescates, adopciones, esterilizaciones y total de gastos | Mes, el más nuevo primero | Editar, Borrar |

Cada lista tiene el botón "Agregar".
Los registros con `es_ejemplo` llevan la etiqueta "Ejemplo".
"Subir" en el primero y "Bajar" en el último están desactivados.

### Formularios

| Formulario | Campos | Reglas |
| --- | --- | --- |
| Peludo | Nombre, especie (perro o gato), cómo se nombra (`descripcion_especie`), edad, tamaño, descripción, rasgo 1, rasgo 2, estado, fotos | Todo obligatorio salvo descripción y fotos; exactamente 2 rasgos; hasta 4 fotos |
| Campaña | Fecha, costo, lugar, horario, forma de pago, cupo, cartel, estado (próxima o pasada) | Cupo y cartel opcionales; costo y cupo ≥ 0 |
| Necesidad | Tipo, descripción, urgencia, vigente hasta | Todo obligatorio |
| Texto | Sección (`<select>` con las 6 de `bloques_contenido`), título, texto, publicado, imágenes | Hasta 4 imágenes; la sección no cambia al editar |
| Cifras del mes | Mes (`<input type="month">`), animales recibidos, rescates, adopciones, esterilizaciones, notas, gastos (concepto y monto, agregar y quitar renglones) | Cada cifra es opcional y ≥ 0; un campo vacío se guarda como `null`, nunca como 0; el mes no cambia al editar |

Las 6 secciones del `<select>` de textos son `quienes_somos`, `proceso_adopcion`, `esterilizacion_por_que`, `esterilizacion_cuidados`, `esterilizacion_preguntas` y `voluntariado`, con un nombre legible cada una.

| Estado | Qué se ve |
| --- | --- |
| Guardando | Botón desactivado con "Guardando…" |
| Guardado (tablas del sitio) | Regresa a la lista con "Guardado. El sitio público se actualiza en cuanto termine de compilar." |
| Guardado (cifras) | Regresa a la lista con "Guardado." |
| `campana_repetida` | "Ya hay una campaña ese día." |
| `mes_repetido` | "Ese mes ya tiene registro. Edítalo desde la lista." |
| Cualquier otro error | "No pudimos guardar. Revisa tu conexión e intenta otra vez."; el formulario conserva lo escrito |
| Borrar | `confirm` nativo: "¿Borrar {nombre}? No se puede deshacer." |

## Plan de implementación

1. Crear la migración `panel_refugio` solo con la nueva `avisar_cambio()` y el borrado de los disparadores de `registros_cifras` y `gastos_registro`. Comprobar en local, con un secreto `deploy_hook_vercel` que apunte a un receptor HTTP local (como en la SPEC 06), que una transacción con `update` a `peludos` y a `fotos_peludo` hace una sola llamada y que un `update` a `registros_cifras` no hace ninguna.
2. Agregar a la migración las políticas de lectura y de Storage. Comprobar por PostgREST que `anon`, una sesión `aal1` y una cuenta sin rol leen 0 filas de `peludos`, y que las cuentas `refugio` y `administrador` con `aal2` leen todas.
3. Agregar `guardar_necesidad` y `borrar_contenido`. Comprobar con `curl` y la sesión `aal2` de la cuenta `refugio` que crea, edita y borra una necesidad, y que con la llave publicable sola falla.
4. Crear `src/lib/formularioPanel.ts`, `/admin/necesidades` y `/admin/necesidades/editar`.
5. Cambiar `EncabezadoPanel` y `/admin` para mostrar las secciones a los dos roles (por ahora solo Necesidades activa) y quitar el aviso "Pronto podrás editar…".
6. Agregar `guardar_registro_cifras` y crear `/admin/cifras` y `/admin/cifras/editar`.
7. Crear `src/lib/imagenesPanel.ts` y `CampoFotos`. Comprobar en una página de prueba local que una foto de 4000 px se sube a 1600 px.
8. Agregar `guardar_campana` y crear `/admin/campanas` y `/admin/campanas/editar` con el cartel.
9. Agregar `guardar_peludo` y `mover_contenido`, y crear `/admin/peludos` y `/admin/peludos/editar`.
10. Agregar `guardar_bloque` y crear `/admin/textos` y `/admin/textos/editar`.
11. Agregar los enlaces de Peludos, Campañas, Textos y Cifras a `EncabezadoPanel` y `/admin`.
12. Paso manual en la nube: `npx supabase db push`; comprobar que la cuenta del refugio entra y edita un peludo, y medir el tiempo desde "Guardado" hasta verlo en el sitio (RF-16).
13. Actualizar `specs/README.md` (la 08 con este título y lo que cubre; quitar las pendientes de la 08) y `CLAUDE.md` (páginas nuevas de `/admin`, `src/lib/imagenesPanel.ts`, `src/lib/formularioPanel.ts`, `CampoFotos`, las RPC y que `registros_cifras` ya no recompila).

## Criterios de aceptación

### Seguridad

- [x] Con la llave publicable, una sesión `aal1` o una cuenta sin rol, `select` a `peludos`, `registros_cifras` e `imagenes` por PostgREST devuelve 0 filas.
- [x] Con las mismas sesiones, llamar a `guardar_peludo` falla y no cambia nada.
- [x] Con sesión `aal2` de la cuenta `refugio`, un `update` directo a `peludos` por PostgREST falla por permisos.
- [x] Con sesión `aal2` de la cuenta `refugio`, subir un archivo a `negocios/x.jpg` en el bucket falla y a `peludos/x.jpg` funciona.
- [x] `borrar_contenido('negocios', 'tacos-don-chuy')` falla y no borra nada.
- [x] La cuenta `refugio` sigue sin ver Solicitudes ni QR.

### Recompilación

- [x] Guardar un peludo con 2 fotos nuevas encola exactamente 1 llamada en `net.http_request_queue` (local, con el receptor de prueba).
- [x] Guardar un mes de cifras encola 0 llamadas.
- [x] Un `update` a `necesidades` desde Studio sigue encolando 1 llamada.

### Peludos

- [x] "Agregar" con nombre "Luna" crea el id `luna-2` porque `luna` ya existe.
- [x] Un peludo nuevo aparece al final de `/admin/peludos` y, si está `disponible`, al final del carrusel tras recompilar.
- [x] El formulario no deja guardar con un rasgo vacío.
- [x] Una foto de 4000 × 3000 px queda en el bucket de 1600 × 1200 px, y `imagenes` guarda esas medidas.
- [x] Con 4 fotos, "Agregar foto" está desactivado.
- [x] "Bajar" en la primera foto y guardar cambia la foto de la tarjeta en `/adopta` tras recompilar.
- [x] Quitar una foto y guardar borra su objeto del bucket y su fila de `imagenes`.
- [x] "Bajar" en el primer peludo de la lista lo cambia de lugar con el segundo y se conserva al recargar.
- [x] Borrar un peludo pide confirmación; al aceptar desaparece de la lista y sus fotos del bucket.
- [x] Un peludo sin fotos muestra el ícono de su especie en la lista y en el carrusel.

### Campañas, necesidades y textos

- [x] Crear una campaña con fecha `2026-11-14` crea el id `2026-11-14`; crear otra ese día muestra "Ya hay una campaña ese día."
- [x] Un cartel de 3000 × 4000 px queda de 1800 × 2400 px y se amplía en `VisorCartel` tras recompilar.
- [x] Una necesidad con vigencia de ayer aparece en la lista con "Vencida" y no en `/donar` tras recompilar.
- [x] Un texto nuevo en `voluntariado` con "Publicado" aparece en su página tras recompilar; desmarcado, no aparece.
- [x] El `<select>` de sección de textos lista las 6 secciones y no se puede cambiar al editar.
- [x] `/admin/textos` agrupa por sección y "Subir" y "Bajar" solo mueven dentro de la sección.

### Cifras (RF-29)

- [x] Crear el mes `2026-10` con solo "rescates" lleno guarda las otras cifras como `null`.
- [x] Crear otra vez `2026-10` muestra "Ese mes ya tiene registro. Edítalo desde la lista."
- [x] Dos gastos de 500 y 250 muestran 750 de total en `/admin/cifras`.
- [x] Ninguna página pública muestra datos de `registros_cifras` ni montos de gastos.

### Formularios

- [x] Cambiar un campo e intentar cerrar la pestaña muestra el aviso del navegador; después de guardar, no.
- [x] Con la red cortada, guardar muestra "No pudimos guardar…", conserva lo escrito y no deja fotos nuevas en el bucket.
- [x] `/admin/peludos/editar?id=no-existe` muestra "No encontramos este registro."
- [x] Los registros de la semilla llevan la etiqueta "Ejemplo" en las listas y la conservan al editarlos; uno creado en el panel tiene `es_ejemplo = false`.
- [x] Todas las páginas nuevas de `/admin` no tienen desplazamiento horizontal a 360 px y sus botones miden al menos 44 px.
- [x] Todas las páginas nuevas sin sesión redirigen a `/admin/entrar` sin mostrar datos.

### Compilación

- [x] `npx supabase db reset` aplica las 6 migraciones y la semilla sin errores.
- [x] `astro build` y `astro check` terminan sin errores.
- [x] Las páginas públicas generan el mismo HTML que antes con la misma semilla.
- [x] Solo el formulario Súmate y el panel importan `src/lib/supabaseNavegador.ts`.

### Nube (después del paso 12)

- [ ] La cuenta del refugio cambia el nombre de un peludo desde el panel y el cambio se ve en `/adopta` de Vercel; se anota el tiempo medido contra RF-16.
- [ ] Ese guardado inicia un solo despliegue en Vercel.

### Observaciones de la validación

Validado el 2026-10-02 en local, con Supabase en Docker (Colima), `astro dev` y `astro build`; Playwright a 360 y 1024 px.
Las sesiones `aal2` se abrieron con un script de Node y en el navegador, con los códigos TOTP calculados a partir del secreto del alta.
Las llamadas al deploy hook se contaron con un secreto `deploy_hook_vercel` que apuntaba a un receptor HTTP local (`http://host.docker.internal:8787`).

- **Paso 12 (nube) pendiente.** No se aplicó la migración en el proyecto de la nube: se hace después de revisar el PR, con `npx supabase db push`. Los dos criterios de la nube quedan sin marcar.
- **Recompilación.** Una transacción con `update` a `peludos` y a `fotos_peludo` hizo 1 llamada; guardar un peludo nuevo con 2 fotos desde el panel, 1; siete guardados seguidos de peludos, campañas, necesidades y textos (incluido un "Subir"), 7; un mes de cifras desde el panel y por la API, 0; un `update` a `necesidades` por SQL, 1.
- **Escrituras directas.** Además de las RPC, la migración quita `insert`, `update`, `delete` y `truncate` a `anon` y `authenticated` en las 23 tablas de contenido, como dice la spec ("ninguna tabla de contenido"). Sin eso, un `update` sin política responde 200 y no cambia nada; con eso, el `update` directo de la cuenta `refugio` responde 403 `permission denied`.
- **Seguridad.** Con la llave publicable, con `aal1` (admin) y con una cuenta `aal2` sin rol, `peludos`, `registros_cifras` e `imagenes` devuelven `[]` (con un mes de cifras guardado), y `guardar_peludo` responde 401 (`anon`) o `sin_permiso` sin crear filas. La cuenta `refugio` sube a `peludos/x.jpg` (200) y no a `negocios/x.jpg` (400); con `aal1` tampoco sube; borrar `refugio/logo.jpg` no borra nada. `borrar_contenido('negocios', …)` y `mover_contenido('negocios', …)` responden `sin_permiso`. La cuenta `administrador` también guarda.
- **Funciones auxiliares.** Las RPC comparten `exigir_panel()`, `campo_texto()`, `campo_cifra()`, `slug()`, `id_libre()`, `guardar_imagen()`, `limpiar_imagenes()` y `reemplazar_fotos()`, sin `execute` para `anon` ni `authenticated`. `guardar_imagen()` solo acepta rutas nuevas en `peludos/`, `campanas/` o `bloques/`.
- **Orden.** `mover_contenido` renumera 1, 2, 3… la tabla (o la sección) antes de intercambiar, así también mueve filas con el mismo `orden`. "Bajar" a Luna la dejó después de Canelo y lo conservó al recargar; en preguntas frecuentes solo cambió esa sección.
- **Fotos.** 4000 × 3000 quedó en 1600 × 1200 y el cartel de 3000 × 4000 en 1800 × 2400 (medido en el archivo del bucket y en `imagenes`). Un archivo que no es imagen muestra el mensaje de imagen ilegible. Reemplazar el cartel, quitar una foto o borrar el registro borró el archivo del bucket y la fila de `imagenes`.
- **Guardado fallido.** Con fecha de campaña repetida y un cartel nuevo, la RPC falló, el cartel recién subido se borró del bucket y el formulario conservó lo escrito. Sin conexión, la subida falla antes de la RPC: aparece "No pudimos guardar…", el texto se conserva y no queda nada en el bucket.
- **Tras recompilar.** El peludo nuevo "Luna" (`luna-2`) apareció al final del carrusel; después de "Bajar" en su primera foto, la tarjeta de `/adopta` usó la otra. Con la campaña del 24 de octubre como pasada, la del 14 de noviembre apareció en portada y `/esterilizacion`, con el cartel en `VisorCartel` (1200 × 1600). Una necesidad con vigencia del 30 de septiembre salió en la lista con "Vencida" y no en `/donar`. Las notas y el gasto de un mes de cifras no aparecen en ningún archivo de `dist/`.
- **Secciones de un solo bloque.** Portada (Quiénes somos), `/adopta`, "Por qué esterilizar" y `/donar` (voluntariado) muestran solo el primer bloque publicado de su sección. Un texto nuevo de voluntariado apareció en `/donar` después de subirlo al primer lugar; al desmarcar "Publicado" volvió el de ejemplo. `/admin/textos` lo avisa en esas secciones, y el formulario avisa que solo Quiénes somos muestra imágenes.
- **HTML público.** Comparado con una compilación de `main` con la misma semilla, las 13 páginas públicas son iguales salvo el nombre con hash del CSS (Tailwind agrega las clases del panel).
- **`es_ejemplo`.** Editar a Canelo (de la semilla) conservó `es_ejemplo = true`; lo creado en el panel quedó en `false`.
- **Piezas compartidas.** Además de los archivos de la spec, se agregaron `FormularioPanel` (marco de las páginas `editar`), `CabeceraLista`, `estilos.ts` y `secciones.ts` en `src/components/admin/`, e `iniciarFormulario()` en `src/lib/formularioPanel.ts`. `LayoutPanel` agrega `data-titulo` a su `<h1>` para "Nuevo…" y "Editar…".
- **Servidor de desarrollo.** Después de `astro build`, `astro dev` respondía 504 "Outdated Optimize Dep" para `supabase-js`; reiniciarlo lo resuelve.

## Decisiones

- **Sí:** las tablas que nombra el índice (peludos, campañas, necesidades, textos, cifras e imágenes). Problemáticas, destinos, datos del refugio y redes cambian poco y siguen en Studio.
- **No:** incluir todo lo del refugio. La spec crecería y habría que dividirla otra vez.
- **Sí:** los roles `refugio` y `administrador` editan lo mismo en estas tablas. La spec padre dice que el refugio actualiza sus secciones; el administrador ayuda cuando haga falta.
- **Sí:** una RPC por guardado. Un guardado es una transacción y no deja un peludo a medias si falla la red.
- **Sí:** el deploy hook se llama una vez por transacción con una variable local (`set_config(…, true)`). Un guardado inicia un solo despliegue y Studio sigue funcionando igual.
- **No:** cola con `pg_cron` cada minuto. Suma hasta 1 minuto de espera y pone en riesgo RF-16.
- **No:** varias llamadas a PostgREST. Cada una inicia un despliegue.
- **Sí:** RPC `security definer` que revisan `rol_panel()`, y sin `insert`, `update` ni `delete` para `authenticated`. Toda escritura pasa por la validación de las funciones.
- **No:** RPC `security invoker` con políticas de escritura por tabla. Para saber si una imagen está en uso hay que leer `negocios` y `refugio`, que el rol `refugio` no puede ver.
- **Sí:** el registro de cifras es privado y no inicia despliegues. El sitio nunca muestra dinero y estas cifras no se publican.
- **No:** calcular las cifras de la portada desde el registro. Cada tarjeta de problemática necesita decidir qué cifra y qué fuente usa; sigue siendo manual.
- **Sí:** un campo de cifra vacío se guarda como `null`. RF-29 pide no rellenar un mes sin datos.
- **Sí:** reducir las fotos en el navegador (1600 px; cartel 2400 px). Sube rápido con datos móviles y cada compilación descarga menos.
- **No:** subir el original. Un teléfono genera archivos de 3 a 8 MB.
- **Sí:** el cartel a 2400 px. Se lee ampliado en `VisorCartel` y el texto pequeño necesita resolución.
- **Sí:** borrar el archivo y la fila de `imagenes` cuando ya nadie la usa. El bucket no acumula fotos huérfanas.
- **Sí:** subir antes de llamar a la RPC y limpiar si falla. La RPC necesita la ruta y el bucket no es transaccional.
- **Sí:** hasta 4 fotos por peludo y por bloque, la primera es la principal. Alcanza para una galería corta y la tarjeta ya usa la primera.
- **Sí:** lista y página `editar?id=` por tabla. El sitio sigue estático, sin rutas dinámicas.
- **No:** formulario en `<dialog>`. Junta lista y formulario en un solo script más difícil de mantener.
- **Sí:** borrar desde el panel con `confirm`. El refugio no depende del administrador para quitar un registro.
- **Sí:** `id` automático y fijo. Nadie tiene que inventar slugs, y las referencias no cambian.
- **No:** `id` escrito por la persona. Más errores para el mismo resultado.
- **Sí:** subir y bajar con botones. Accesible con teclado y sin librerías.
- **No:** arrastrar. Necesita alternativa de teclado y más código.
- **Sí:** crear textos en las 6 secciones fijas. El refugio puede agregar preguntas frecuentes o pasos de adopción sin ayuda.
- **No:** cambiar la sección de un texto existente. Mover un bloque entre secciones cambia su `orden` y casi nunca hace falta; se borra y se crea.
- **Sí:** gana el último guardado. Son 2 o 3 personas.
- **Sí:** aviso `beforeunload` con cambios sin guardar. Evita perder un texto largo.
- **Sí:** `<script>` nativos, como el resto del panel (SPEC 07).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una foto HEIC no se puede leer en un navegador de escritorio | El `input` solo acepta JPEG, PNG y WebP; Safari en iPhone convierte al elegir la foto. Si falla, se muestra el mensaje de imagen ilegible. |
| La red se corta entre subir la foto y guardar | El script borra las fotos recién subidas si la RPC falla; si el borrado también falla, queda un archivo huérfano sin fila en `imagenes`, que no se muestra. |
| Dos personas editan el mismo peludo y una pierde sus cambios | Son pocas personas; se acepta. Una spec futura puede agregar `actualizado_en`. |
| Un error en una RPC `security definer` da permisos de más | Cada función revisa `rol_panel()` primero y `borrar_contenido` y `mover_contenido` aceptan solo una lista fija de tablas; hay criterios con `anon`, `aal1` y sin rol. |
| El despliegue tarda más de 1 minuto (RF-16) | Se mide en el paso 12 y se anota; la decisión sobre caché o ISR queda para otra spec. |
| Varios guardados seguidos inician varios despliegues | Vercel cancela o encola los anteriores; el último despliegue tiene todos los cambios. |
| Borrar una imagen que usa un negocio o el refugio | La RPC solo borra filas de `imagenes` que ninguna tabla usa, y la llave foránea `on delete restrict` lo impide de todos modos. |

## Lo que **no** entra en esta spec

- Problemáticas, destinos de donativo, datos del refugio y redes.
- Cifras de la portada calculadas desde el registro y resúmenes anuales.
- Negocios y menús (SPEC 09).
- Anuncios (SPEC 10).
- Bloqueo por edición simultánea.
- Vista previa antes de guardar.
- Arrastrar para ordenar.
- Biblioteca de imágenes compartidas.

Cada una de estas, si llega, va en su propia spec.
