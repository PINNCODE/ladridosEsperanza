# SPEC 10 — Editor de menús

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-10-02
> **Objetivo:** Que la cuenta `administrador` capture y edite desde `/admin` el menú completo de un negocio (grupos, secciones, platillos y precios) en una sola página, con un solo guardado y un solo despliegue.

## Por qué existe esta spec

La SPEC 09 dejó fuera el menú porque es tan grande como toda la SPEC 08: tres niveles, hasta 4 precios por platillo y más de 150 platillos en el café de ejemplo.
Hasta ahora los menús se cargan en Studio, que no sirve para el paso 3 de la spec padre ("el equipo captura el menú en el panel") ni para el paso 6 (cambiar un precio cuando el negocio avisa).

El índice ya fijó la forma: un árbol en una sola página con `<script>` nativo, sin framework, y una RPC solo para el administrador que reemplaza el menú completo en una transacción, como `guardar_negocio`.
Esta spec define cómo se ve y se usa ese árbol, y cómo se evita que un guardado viejo borre el trabajo de otra pestaña.

## Alcance

**Dentro:**

- Página `/admin/negocios/menu?id={negocio}`, solo para el administrador, con acción "Menú" en `/admin/negocios` y enlace "Editar menú" en `/admin/negocios/editar` (solo al editar).
- Árbol con grupos y secciones plegables (`<details>`) y una fila corta por platillo.
- Un `<dialog>` para editar grupo (nombre), sección (nombre y nota) y platillo (nombre, descripción, precios, extra, disponible y sección).
- Hasta 4 precios por platillo, cada uno con etiqueta opcional y monto o texto alterno.
- Subir y Bajar en grupos, secciones, platillos y precios; "Mover a sección" para el platillo.
- Duplicar un platillo.
- Casilla "Disponible" en la fila del platillo, sin abrir el diálogo.
- Buscador que filtra el árbol por platillo.
- Agregar y borrar grupos, secciones, platillos y precios; `confirm` al borrar un grupo o una sección con contenido.
- Un solo botón "Guardar" que manda el menú completo a `guardar_menu` y revisa que nadie lo haya cambiado desde que se abrió.
- Grupos y secciones vacíos se pueden guardar; la página pública ya los oculta.

**Fuera de alcance (specs futuras):**

- Importar un menú desde texto pegado o desde PDF.
- Fotos de platillos (campo con asterisco de la spec padre).
- Exigir menú para publicar un negocio; sigue como en la SPEC 09.
- Vista previa del menú público antes de guardar.
- Arrastrar y soltar.
- Historial de versiones o deshacer después de guardar.
- Edición del menú por la cuenta `refugio` o por cuentas de negocio.
- Cambios a la página pública `/colabora/[slug]` y a `MenuNegocio`.
- Anuncios, analítica, SEO y aviso de privacidad definitivo (SPEC 11).

## Modelo de datos

No hay tablas nuevas ni columnas nuevas.
Se reutilizan `grupos_menu`, `secciones_menu`, `platillos` y `precios` de la SPEC 01 y se agregan dos funciones.
Las tablas del menú no ganan políticas de lectura: el editor lee con `leer_menu`.
Las escrituras directas siguen revocadas (SPEC 08).

### Funciones RPC

Las dos son `security definer`, `set search_path = ''` y empiezan con `exigir_administrador()` (SPEC 09).
Se revoca `execute` a `public` y `anon` y se concede a `authenticated`.

```sql
-- Menú del negocio en el orden de la página pública, y su versión.
-- Devuelve null si el negocio no existe.
create function public.leer_menu(negocio_id text) returns jsonb ...;

-- Reemplaza el menú completo en una transacción.
-- Lanza 'menu_cambiado' si la versión actual no es `version`.
-- Devuelve { "version": text }.
create function public.guardar_menu(negocio_id text, version text, grupos jsonb) returns jsonb ...;
```

Forma de `grupos` (la misma que devuelve `leer_menu` en `grupos`):

```json
[
  {
    "nombre": "Café",
    "secciones": [
      {
        "nombre": "Latte",
        "nota": "Precio caliente / frío o frappé. Con crema batida +$13",
        "platillos": [
          {
            "nombre": "Sabor",
            "descripcion": null,
            "es_extra": false,
            "disponible": true,
            "precios": [
              { "etiqueta": "Caliente", "monto": 54, "texto_alterno": null },
              { "etiqueta": "Frío o frappé", "monto": 64, "texto_alterno": null }
            ]
          }
        ]
      }
    ]
  }
]
```

`leer_menu` devuelve `{ "version": "…", "grupos": [ … ] }`.

Reglas:

- El orden es la posición en cada arreglo; la RPC guarda `orden` = 1, 2, 3… en los cuatro niveles.
- La versión es el `md5` del texto de `grupos` armado con las filas actuales. La calculan `leer_menu` y `guardar_menu` con la misma función interna `menu_json(negocio_id)`, que no se concede a nadie.
- `guardar_menu` bloquea la fila del negocio (`for update`), compara la versión, borra los grupos del negocio (secciones, platillos y precios caen en cascada) e inserta todo de nuevo. Los `id` del menú cambian en cada guardado; nada fuera del menú los usa.
- Un cambio hecho en Studio también cambia la versión.
- Un negocio que no existe lanza `no_encontrado`.
- `nombre` vacío o solo espacios en grupo, sección o platillo lanza `datos_invalidos`.
- Un platillo con 0 o más de 4 precios lanza `datos_invalidos`.
- Un precio sin `monto` ni `texto_alterno`, o con `monto` negativo, lanza `datos_invalidos`.
- `nota`, `descripcion`, `etiqueta` y `texto_alterno` vacíos se guardan como `null`.
- `monto` acepta hasta 2 decimales.
- `datos_invalidos` lleva en `details` el campo (`nombre`, `precios`, `monto`) como en la SPEC 09.
- El trigger de recompilación de la SPEC 06 ya llama al deploy hook una vez por transacción: un guardado es un despliegue.

### Migración

| Archivo en `supabase/migrations/` | Contenido |
| --- | --- |
| `{marca}_editor_menus.sql` | `menu_json()`, `leer_menu()` y `guardar_menu()`, con sus permisos |

### Archivos

| Archivo | Contenido |
| --- | --- |
| `src/pages/admin/negocios/menu.astro` | Página del editor con `LayoutPanel`, `FormularioPanel` y `prepararPanel('administrador')` |
| `src/components/admin/DialogoMenu.astro` | El `<dialog>` de grupo, sección y platillo, con hasta 4 filas de precio |
| `src/lib/menuPanel.ts` | Estado del árbol en memoria, dibujo de filas, acciones (agregar, mover, duplicar, borrar), buscador y armado de `grupos` |
| `src/lib/formularioPanel.ts` | Mensajes de `menu_cambiado` y de los `datos_invalidos` nuevos |
| `src/pages/admin/negocios.astro` | Acción "Menú" por fila |
| `src/pages/admin/negocios/editar.astro` | Enlace "Editar menú" al editar un negocio existente |

El buscador usa `normalizar()` y `coincide()` de `src/lib/busqueda.ts`, y la fila muestra los precios con `formatearPrecio()` de `src/lib/formato.ts`.

### Página del editor

```
Menú de Café del Jardín                      [Buscar platillo…]
▾ Desayunos                                   ↑ ↓ Editar
   ▾ Desayunos · Disponibles de 8:00 am…      ↑ ↓ Editar
      Restaurador   $90          ☑ Disponible ↑ ↓ Editar
      Enchiladas    $90          ☑ Disponible ↑ ↓ Editar
      [Agregar platillo]
   [Agregar sección]
[Agregar grupo]
                                        [Cancelar] [Guardar]
```

| Parte | Qué hace |
| --- | --- |
| Título | "Menú de {nombre}" en el `<h1>` con `data-titulo`; enlace "Ver página" si el negocio está `publicado` |
| Grupo | `<details>` abierto al cargar; encabezado con nombre, Subir, Bajar y Editar; al final, "Agregar sección" |
| Sección | `<details>` abierto al cargar; encabezado con nombre, nota, Subir, Bajar y Editar; al final, "Agregar platillo" |
| Fila de platillo | Nombre, precios formateados, "Extra" si `es_extra`, casilla "Disponible", Subir, Bajar y Editar; sin disponible, la fila se ve atenuada |
| Final del árbol | "Agregar grupo" |
| Menú vacío | "Este negocio todavía no tiene menú." y "Agregar grupo" |
| Subir / Bajar | Desactivados en el primero y el último de su lista; los botones llevan `aria-label` con el nombre ("Subir Restaurador") |
| Agregar | Crea el elemento al final de su lista y abre su diálogo; si se cancela un elemento recién creado, se quita |

### Diálogo

| Para | Campos | Acciones |
| --- | --- | --- |
| Grupo | Nombre | Borrar, Cancelar, Listo |
| Sección | Nombre, nota | Borrar, Cancelar, Listo |
| Platillo | Nombre, descripción, precios (1 a 4 filas con etiqueta, monto y texto alterno, cada una con Subir, Bajar y Quitar; "Agregar precio" desactivado con 4), "Es un extra", "Disponible", "Mover a sección" (`<select>` con "Grupo › Sección") | Duplicar, Borrar, Cancelar, Listo |

- "Listo" revisa el diálogo y pasa los cambios al árbol en memoria; nada se manda a Supabase hasta "Guardar".
- "Listo" no cierra si falta el nombre o si un precio no tiene monto ni texto alterno; marca el campo.
- Un platillo nuevo empieza con 1 fila de precio vacía, `disponible` marcado y `es_extra` sin marcar.
- "Mover a sección" deja el platillo al final de la sección elegida.
- "Duplicar" inserta una copia justo debajo con el mismo contenido y abre su diálogo.
- "Borrar" quita un platillo sin preguntar; un grupo o una sección con contenido pide `confirm`.
- "Cancelar" y la tecla Esc descartan los cambios del diálogo.

### Buscador

- Filtra mientras se escribe; cada palabra debe aparecer en el nombre o la descripción del platillo (`coincide()`).
- Muestra solo los platillos que coinciden, con sus grupos y secciones abiertos, y oculta lo demás.
- Sin resultados: "Ningún platillo coincide con «{texto}»."
- Con texto en el buscador, Subir y Bajar se desactivan en los cuatro niveles; Editar y Disponible siguen.
- Vaciar el buscador regresa el árbol completo.

### Estados

| Estado | Qué se ve |
| --- | --- |
| Cargando | El contenido oculto hasta que `prepararPanel()` confirma la sesión y llega `leer_menu` |
| Negocio que no existe | "No encontramos este registro." |
| Guardando | Botón desactivado con "Guardando…" |
| Guardado | Regresa a `/admin/negocios` con "Guardado. El sitio público se actualiza en cuanto termine de compilar." |
| `menu_cambiado` | "Alguien guardó este menú mientras lo editabas. Recarga la página para ver la versión nueva." El árbol conserva lo capturado |
| `datos_invalidos` | Mensaje con el campo, como en la SPEC 09 |
| Cualquier otro error | "No pudimos guardar. Revisa tu conexión e intenta otra vez."; el árbol conserva lo capturado |
| Borrar grupo o sección con contenido | `confirm` nativo: "¿Borrar {nombre} con sus {n} secciones y {m} platillos?" (o "con sus {m} platillos" en una sección) |
| Cambios sin guardar | Aviso `beforeunload` del navegador, como en la SPEC 08 |

## Plan de implementación

1. Crear la migración `editor_menus` con `menu_json()` y `leer_menu()`. Comprobar por PostgREST que el administrador con `aal2` recibe el menú del Café del Jardín en el orden de la página pública, que un negocio que no existe devuelve `null`, y que la cuenta `refugio`, `aal1` y `anon` fallan.
2. Agregar `guardar_menu()`. Comprobar con `curl` que guardar el menú leído sin cambios devuelve la misma versión y encola 1 llamada al hook; que una versión vieja lanza `menu_cambiado`; que 5 precios, un precio vacío y un nombre vacío lanzan `datos_invalidos`; y que la cuenta `refugio` recibe `sin_permiso`.
3. Crear `/admin/negocios/menu` con el árbol de solo lectura (grupos, secciones y filas) y agregar la acción "Menú" en la lista y el enlace en el formulario del negocio.
4. Crear `DialogoMenu` y la edición de grupos, secciones y platillos (agregar, editar, borrar), con Guardar conectado a `guardar_menu`.
5. Agregar Subir, Bajar, "Mover a sección" y Duplicar.
6. Agregar la casilla "Disponible" en la fila y el buscador.
7. Agregar los mensajes de `menu_cambiado` y `datos_invalidos` a `mensajeError()`.
8. Paso manual en la nube: `npx supabase db push`; con la cuenta administradora, cambiar un precio y medir el tiempo hasta verlo en `/colabora/{id}` (RF-16).
9. Actualizar `specs/README.md` (la 10 con este título y su enlace; mover sus pendientes) y `CLAUDE.md` (página del editor, `DialogoMenu`, `menuPanel.ts`, las 2 RPC y que el menú ya no se edita en Studio).

## Criterios de aceptación

### Seguridad

- [x] Con la llave publicable, con `aal1` y con la sesión `aal2` de la cuenta `refugio`, `leer_menu` y `guardar_menu` fallan y no cambian nada.
- [x] Con esas mismas sesiones, `select` a `grupos_menu`, `secciones_menu`, `platillos` y `precios` por PostgREST devuelve 0 filas.
- [x] La cuenta `refugio` abre `/admin/negocios/menu?id=cafe-del-jardin` y regresa a `/admin`.
- [x] `menu_json()` no se puede llamar por PostgREST con ninguna sesión.

### Lectura y guardado

- [x] El editor del Café del Jardín muestra 7 grupos, sus secciones y sus platillos en el mismo orden que `/colabora/cafe-del-jardin`.
- [x] Abrir el menú del Café del Jardín y guardar sin cambios deja las páginas públicas con el mismo HTML tras recompilar.
- [x] Un guardado encola exactamente 1 llamada en `net.http_request_queue` (local, con el receptor de prueba de la SPEC 08).
- [x] `/admin/negocios/menu?id=no-existe` muestra "No encontramos este registro."
- [x] Un negocio sin menú muestra "Este negocio todavía no tiene menú."; agregar un grupo, una sección y un platillo y guardar hace que su página deje de decir "Estamos preparando el menú…" tras recompilar.
- [x] Un grupo y una sección vacíos se guardan y no aparecen en la página pública.
- [x] Con dos pestañas abiertas en el mismo menú, guardar en la primera y luego en la segunda muestra "Alguien guardó este menú…" en la segunda y no cambia nada.
- [x] Cambiar un precio en Studio después de abrir el editor hace que "Guardar" muestre "Alguien guardó este menú…".
- [x] Con la red cortada, guardar muestra "No pudimos guardar…" y el árbol conserva lo capturado.
- [x] Cambiar algo e intentar cerrar la pestaña muestra el aviso del navegador; después de guardar, no.

### Platillos y precios

- [x] Un platillo con precios "Caliente $54" y "Frío o frappé $64" se ve igual en la fila y en la página pública.
- [x] Un precio sin monto con texto "Incluido" se guarda y se muestra "Incluido".
- [x] "Listo" con un precio sin monto ni texto alterno no cierra el diálogo y marca la fila.
- [x] Con 4 precios, "Agregar precio" está desactivado.
- [x] Marcar "Es un extra" muestra "+$12" en la página pública para un precio de 12.
- [x] Desmarcar "Disponible" en la fila atenúa la fila y, tras guardar y recompilar, el platillo no aparece en la página ni en la búsqueda de `/colabora`.
- [x] "Duplicar" en "Sabor" crea una copia justo debajo con los mismos precios y abre su diálogo.
- [x] "Mover a sección" lleva un platillo al final de otra sección de otro grupo y se conserva al guardar y recargar.
- [x] Cancelar el diálogo de un platillo recién agregado lo quita del árbol.

### Orden y borrado

- [x] "Bajar" en el primer grupo lo cambia de lugar con el segundo, y tras guardar las pestañas públicas siguen ese orden.
- [x] Subir está desactivado en el primer elemento de cada lista y Bajar en el último.
- [x] Subir y Bajar en las filas de precio cambian el orden en la página pública.
- [x] Borrar "Desayunos" pide "¿Borrar Desayunos con sus 4 secciones y {m} platillos?"; cancelar no cambia nada.
- [x] Borrar un platillo no pregunta y desaparece del árbol.

### Buscador

- [x] Escribir "latte" deja visibles solo los platillos que contienen "latte", con sus grupos y secciones abiertos.
- [x] "cafe" encuentra "Café" sin importar acentos ni mayúsculas.
- [x] Con texto en el buscador, Subir y Bajar están desactivados; Editar y Disponible funcionan.
- [x] Una búsqueda sin resultados muestra "Ningún platillo coincide con «…»."

### Validación en la RPC

- [x] `guardar_menu` con un platillo de 5 precios, un precio sin monto ni texto, un monto negativo o un nombre vacío responde `datos_invalidos` con el campo en `details` y no cambia nada.

### Panel y compilación

- [x] `/admin/negocios` tiene la acción "Menú" en cada fila y `/admin/negocios/editar?id=…` tiene "Editar menú"; un negocio nuevo sin guardar no muestra el enlace.
- [x] La página del editor no tiene desplazamiento horizontal a 360 px y sus botones miden al menos 44 px.
- [x] El diálogo se cierra con Esc y regresa el foco al botón que lo abrió.
- [x] La página sin sesión redirige a `/admin/entrar` sin mostrar datos.
- [x] `npx supabase db reset` aplica las 8 migraciones y la semilla sin errores.
- [x] `astro build` y `astro check` terminan sin errores.

### Nube (después del paso 8)

- [ ] La cuenta administradora cambia un precio y el cambio se ve en `/colabora/{id}` de Vercel; se anota el tiempo medido contra RF-16.
- [ ] Ese guardado inicia un solo despliegue en Vercel.

### Observaciones de la validación

Validado el 2026-10-02 en local, con Supabase en Docker (Colima), `astro dev` y `astro build`; Chromium sin interfaz (Playwright) a 360 y 1024 px.
Las sesiones `aal2` se abrieron con un script de Node que calcula los códigos TOTP a partir del secreto del alta, y las llamadas al deploy hook se contaron con el receptor local de la SPEC 08 (`deploy_hook_vercel` apuntando a `http://host.docker.internal:8787`).

- **Paso 8 (nube), a medias.** El permiso de la herramienta bloqueó el `db push` desde la sesión de implementación; se corrió a mano el 2026-10-02 y aplicó solo `20261002072909_editor_menus.sql`, sin semilla. En la nube, `menu_json`, `leer_menu` y `guardar_menu` existen con los mismos permisos que en local (`menu_json` sin `authenticated`). Falta cambiar un precio con la cuenta administradora de la nube y medir RF-16: los dos criterios de la nube siguen sin marcar.
- **Orden del plan.** La migración se escribió completa (pasos 1 y 2) y se probó por PostgREST antes de la página; la interfaz se escribió de una vez y se probó criterio por criterio.
- **Seguridad.** Con la llave publicable, `leer_menu` y `guardar_menu` responden `permission denied` (42501); con `aal1` (admin) y con la cuenta `refugio` en `aal2`, `sin_permiso`. `menu_json()` responde `permission denied` con cualquier sesión, también la administradora. `select` a las 4 tablas del menú devuelve `[]` con las cuatro sesiones.
- **Versión.** Guardar el menú leído sin cambios devuelve la misma versión (`e080930672878a690d75c292504b3699` para el café de la semilla). Como la versión es el contenido, un guardado idéntico en otra pestaña no produce `menu_cambiado`; uno con cambios sí. Un `update` a `precios` por SQL (lo mismo que hace Studio) también.
- **HTML público.** Tras `db reset`, compilar, guardar el café sin cambios desde el editor y volver a compilar, las 33 páginas son idénticas byte a byte.
- **Recompilación.** Un guardado del café (145 platillos) hizo 1 llamada al hook.
- **Validación en la RPC.** 5 precios y un precio sin monto ni texto responden `datos_invalidos` con `precios`; un monto negativo o con 3 decimales, con `monto`; un nombre vacío de grupo o platillo, con `nombre`. Un negocio que no existe responde `no_encontrado` en `guardar_menu` y `null` en `leer_menu`.
- **Editor.** En una sola sesión de prueba se bajó "Desayunos", se movió "Restaurador" a Té › Infusiones, se duplicó "Sabor" (sección Latte), se invirtieron sus 2 precios, se desmarcó "Enchiladas Suizas", se borró "Mimosa" y se agregaron un platillo extra con 4 precios (+$12, +$20, +$30 e "Incluido") y un grupo con una sección vacía. `leer_menu` y la página compilada reflejaron todo; el grupo vacío y el platillo no disponible no aparecen, y el "Enchiladas Suizas" de Antojitos sigue visible.
- **Confirmaciones.** Borrar "Desayunos" pidió "¿Borrar Desayunos con sus 4 secciones y 19 platillos?" y borrar "Antojitos", "¿Borrar Antojitos con sus 7 platillos?"; con 1 elemento se escribe "su sección" o "un platillo".
- **Buscador.** Como dice la spec, busca en el nombre y la descripción del platillo, no en la sección: "latte" encuentra "Especial Latte" y "Paquete desayuno" (su descripción dice latte), pero no los platillos de la sección Latte ("Clásico", "Sabor"). La página pública sí incluye la sección (`textoPlatillo()`); si conviene igualarlo, es un cambio a la spec.
- **Agregar mientras se busca.** Los botones "Agregar…" se ocultan con texto en el buscador, para no crear algo que el filtro deja oculto; no estaba en la spec.
- **Diálogo.** `close` de `<dialog>` llega en otra tarea, así que "Duplicar" abre el diálogo de la copia después de ese evento; Cancelar y Esc quitan un elemento recién agregado y regresan el foco al botón "Agregar…" o a "Editar".
- **360 px.** Sin desplazamiento horizontal y sin botones de menos de 44 px, en el árbol y en el diálogo. Ahí el nombre de grupos y secciones va debajo de Subir, Bajar y Editar; desde `sm` va a su izquierda.
- **Lucide.** El ícono de borrar es `trash` (en esta versión no existe `trash-2`).

## Decisiones

- **Sí:** página propia `/admin/negocios/menu`. El menú y la ficha se guardan y despliegan por separado, y el formulario del negocio no crece con 150 platillos.
- **No:** el menú dentro de `/admin/negocios/editar`. Un formulario enorme y un guardado que mezcla dos cosas.
- **Sí:** fila corta por platillo y un `<dialog>` para editar. La página queda ligera con 150 platillos y cabe en 360 px.
- **No:** todos los campos en línea. Unos 1000 campos y mucho desplazamiento en teléfono.
- **Sí:** el mismo `<dialog>` para grupos, secciones y platillos. Un solo patrón para los tres niveles.
- **Sí:** Subir y Bajar, más "Mover a sección" para el platillo. Es el patrón de categorías y funciona en teléfono sin librerías.
- **No:** arrastrar y soltar. Difícil en teléfono y con lectores de pantalla; quizá pide una librería.
- **Sí:** Duplicar platillo. El café tiene muchas variantes con los mismos precios (lattes, creams, tés).
- **Sí:** casilla "Disponible" en la fila. Es el cambio más frecuente del paso de mantenimiento.
- **Sí:** buscador en el editor. Encontrar un platillo entre 150 para cambiar un precio.
- **Sí:** Subir y Bajar desactivados mientras se busca. Mover contra filas ocultas confunde.
- **No:** vista previa del menú público. La página pública ya se ve tras compilar y la fila muestra los precios formateados.
- **Sí:** hasta 4 precios por platillo. La semilla usa 2; 4 cubre tamaños de pizza o de bebida.
- **Sí:** reemplazar el menú completo en cada guardado. Una transacción y un despliegue; no hay que seguir ids ni diferencias en el navegador.
- **Sí:** revisar la versión con un `md5` del menú. Un guardado viejo no borra en silencio lo que otra pestaña o Studio guardó, y no hace falta una columna nueva.
- **No:** gana el último guardado. Como la RPC reemplaza todo, el segundo guardado borraría el trabajo del primero.
- **No:** una columna `menu_version` en `negocios`. No detecta cambios hechos en Studio.
- **Sí:** `leer_menu` en lugar de políticas de lectura en las tablas del menú. El editor necesita la versión, que solo calcula la base de datos.
- **Sí:** grupos y secciones vacíos se guardan. Sirven mientras se captura y la página pública ya los oculta.
- **Sí:** publicar sigue sin exigir menú, como decidió la SPEC 09. El mensaje "Estamos preparando el menú…" cubre el caso.
- **Sí:** `confirm` solo al borrar un grupo o una sección con contenido. Nada se pierde hasta "Guardar" y salir sin guardar sirve de deshacer.
- **Sí:** después de guardar se regresa a la lista, como en todo el panel. El aviso de guardado y el despliegue son los mismos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un guardado viejo borra lo que otra pestaña guardó | `guardar_menu` compara la versión y lanza `menu_cambiado`; el árbol conserva lo capturado para copiarlo. |
| Recargar tras `menu_cambiado` pierde lo capturado | El mensaje lo dice antes de recargar; el aviso `beforeunload` sigue activo. |
| Borrar e insertar 150 platillos tarda o falla a la mitad | Es una sola transacción: o se guarda todo o nada. Unas 500 filas caben de sobra en el tiempo de una RPC. |
| Un error en `security definer` da permisos de más | Las dos funciones empiezan con `exigir_administrador()`; `menu_json()` no se concede a nadie; hay criterios con `anon`, `aal1` y la cuenta `refugio`. |
| La versión cambia sin cambios reales por un orden distinto de las filas | `menu_json()` ordena por `orden` y luego por `id` en los cuatro niveles; el paso 2 comprueba que guardar sin cambios devuelve la misma versión. |
| Se cierra la pestaña con horas de captura sin guardar | Aviso `beforeunload`; se recomienda guardar por grupo. |

## Lo que **no** entra en esta spec

- Importar menús desde texto o PDF.
- Fotos de platillos.
- Exigir menú para publicar un negocio.
- Vista previa del menú público.
- Arrastrar y soltar.
- Historial de versiones o deshacer después de guardar.
- Edición del menú por la cuenta `refugio` o por los negocios.
- Cambios a la página pública del negocio.
- Anuncios, analítica, SEO y aviso de privacidad (SPEC 11).

Cada una de estas, si llega, va en su propia spec.
