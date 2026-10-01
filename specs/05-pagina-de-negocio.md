# SPEC 05 — Página de negocio `/colabora/[slug]`

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 04
> **Fecha:** 2026-10-01
> **Objetivo:** Crear una página por cada negocio publicado en `/colabora/{id}` con su menú por pestañas y buscador, horarios, "Cómo llegar", promoción, aporte, nota del refugio y "Más negocios".

## Por qué existe esta spec

El índice asigna a esta spec RF-04 a RF-10.
Las tarjetas de `/colabora` ya enlazan a `/colabora/{id}` y hoy llevan al 404.
El menú del café de ejemplo tiene 7 grupos y 145 platillos, así que la página necesita pestañas y un buscador propio (RF-05 y RF-06).
El estado "Abierto ahora" reutiliza `src/lib/horarios.ts` de la SPEC 04, que ya resuelve el cruce de medianoche (RF-07).
El README dejaba pendiente para esta spec dónde se genera el QR (RF-17): se decidió que va en el panel de la SPEC 07.

## Alcance

**Dentro:**

- Una página estática por negocio con `estado: "publicado"` en `/colabora/{id}`, con el título de la pestaña propio (RF-04).
- Cabecera: enlace "← Volver a negocios", logo o inicial, nombre en `<h1>`, "{categoría}. {descripcion_corta}", línea de estado calculada en el navegador y promoción vigente (RF-07, RF-09).
- Acciones rápidas bajo la cabecera: "Cómo llegar" y "Ver horarios".
- Menú por grupos y secciones, con notas de sección, descripción y uno o varios precios por platillo (RF-05).
- Pestañas fijas al desplazarse, una por grupo, solo cuando hay más de un grupo. La pestaña activa se guarda en el hash de la URL (`#menu-cafe`).
- Buscador dentro del menú que filtra platillos por nombre, descripción y sección, sin distinguir mayúsculas ni acentos (RF-06).
- Platillos con `disponible: false` ocultos; una sección o grupo sin platillos disponibles no se muestra.
- Precio de los platillos con `es_extra: true` con "+" ("+$12").
- Tabla de horarios de lunes a domingo, con turnos múltiples, cruce de medianoche, "Cerrado" y "Por confirmar", y el día de hoy resaltado en el navegador (RF-07).
- "Ubicación y contacto": dirección, botón "Cómo llegar" a Google Maps con coordenadas o con nombre y dirección, y botón de WhatsApp solo si el negocio tiene número (RF-08).
- "Aporte al refugio" con el porcentaje acordado.
- Nota del refugio con enlace a `/adopta` y, si hay próxima campaña, enlace a `/esterilizacion` con su fecha (RF-13).
- "Más negocios" con chips a los demás negocios publicados (RF-10).
- La página usa `LayoutColabora`, así que lleva la barra fija inferior (RF-13).
- Sin JavaScript: todos los grupos del menú seguidos, sin pestañas, buscador, línea de estado ni resaltado de hoy.
- Ajustes a 2 negocios de ejemplo para probar coordenadas, WhatsApp y platillo no disponible.

**Fuera de alcance (specs futuras):**

- Código QR por negocio en PNG y SVG (RF-17, SPEC 07).
- Fecha de última revisión del menú; requiere un campo nuevo en el esquema.
- Guardar la búsqueda del menú en la URL.
- Mapa incrustado en la página.
- Fotos de platillos.
- Espacios de anuncio y analítica de visitas a negocios (SPEC 08).
- Metadatos para compartir (Open Graph) por negocio (SPEC 08).
- Retirar la promoción vencida sin recompilar (SPEC 06).
- Páginas para negocios en `borrador` o `pausado`.

## Modelo de datos

Esta spec no agrega colecciones ni cambia esquemas. Reutiliza `negocios` y `categorias` de la SPEC 01, y `campanas` para la nota del refugio.

### Cambios en `src/data/negocios/`

| Archivo | Cambio | Para probar |
| --- | --- | --- |
| `tacos-don-chuy.json` | `"latitud": 18.9608`, `"longitud": -99.5906`, `"whatsapp": "5215500000001"` | "Cómo llegar" con coordenadas y botón de WhatsApp |
| `la-cocina-de-dona-mary.json` | "Postre del día" con `"disponible": false` | Platillo no disponible oculto |

Los demás negocios siguen sin coordenadas ni WhatsApp y prueban el caso contrario.

### Funciones en `src/lib/datos.ts`

```ts
export type GrupoMenu = Negocio['data']['menu'][number];

export function menuDisponible(n: Negocio): GrupoMenu[]; // sin platillos `disponible: false` ni secciones o grupos vacíos, por `orden`
```

`getStaticPaths` usa `negociosPublicados()` de la SPEC 04; "Más negocios" usa la misma lista sin el negocio actual.
La próxima campaña sale de `proximaCampana(hoy)` de la SPEC 02.

### `src/lib/busqueda.ts` (se agrega)

```ts
export function idGrupo(nombre: string): string;        // "Sin café" → "menu-sin-cafe"
export function textoPlatillo(p: Platillo, seccion: string): string; // nombre, descripción y sección, ya normalizado
```

`idGrupo` usa `normalizar`, cambia cada tramo que no sea letra o número por "-" y antepone `menu-`.
La búsqueda del menú usa `coincide` de la SPEC 04: cada palabra de la consulta debe aparecer.

### `src/lib/horarios.ts` (se agrega)

```ts
export function textoDia(valor: Horarios[Dia]): string;
```

| Valor del día | Texto |
| --- | --- |
| `[{ abre: "13:00", cierra: "00:30" }]` | "13:00 a 0:30" |
| Dos turnos | "9:00 a 13:00 y 17:00 a 20:00" |
| `"cerrado"` | "Cerrado" |
| Ausente | "Por confirmar" |

### `src/lib/formato.ts` (se agrega)

```ts
export function formatearPrecio(precio: Precio, esExtra: boolean): string;
```

| Precio | `es_extra` | Texto |
| --- | --- | --- |
| `{ etiqueta: null, monto: 18 }` | `false` | "$18" |
| `{ etiqueta: null, monto: 12 }` | `true` | "+$12" |
| `{ etiqueta: "Caliente", monto: 49 }` | `false` | "Caliente $49" |
| `{ monto: null, texto_alterno: "Incluido" }` | `false` | "Incluido" |

Varios precios de un platillo se unen con " · ": "Caliente $49 · Frío o frappé $59".

### `src/lib/mapas.ts` (nuevo)

```ts
export function enlaceMapa(n: Negocio, ubicacion: string): string;
```

- Con `latitud` y `longitud`: `https://www.google.com/maps/search/?api=1&query={latitud},{longitud}` (con `encodeURIComponent`).
- Sin ellas: la misma URL con `query` = "{nombre}, {direccion}, {refugio.ubicacion}".

### `src/lib/whatsapp.ts` (cambia)

`mensaje` pasa a ser opcional. Sin mensaje, el enlace es `https://wa.me/{numero}` sin `?text=`. Los usos actuales no cambian.

### Atributos del menú

```html
<section id="menu-cafe" data-grupo>
  <h3>Café</h3>
  <h4>Latte</h4>
  <p>Precio caliente / frío o frappé. Con crema batida +$13</p>
  <ul>
    <li data-platillo data-busqueda="clasico latte">…</li>
  </ul>
</section>
```

### Textos fijos

| Uso | Texto |
| --- | --- |
| Título de pestaña | "{nombre} · Come por los Peludos" |
| Descripción de la página | "{categoría}. {descripcion_corta}. {direccion}." |
| Volver | "← Volver a negocios", a `/colabora` |
| Promoción | "Promoción: {texto}" |
| Acciones rápidas | "Cómo llegar" (otra pestaña) · "Ver horarios" (ancla a `#horarios`) |
| Menú | `<h2>` "Menú"; pestañas con `aria-label="Grupos del menú"` |
| Buscador del menú | Etiqueta "Buscar en el menú"; marcador "Buscar en el menú, por ejemplo: latte" |
| Contador de la búsqueda | "10 platillos" / "1 platillo", con `aria-live="polite"` |
| Sin resultados | "No encontramos ese platillo en el menú. Prueba con otra palabra." |
| Horarios | `<h2>` "Horarios"; filas "Lunes" a "Domingo"; la de hoy agrega "Hoy" |
| Ubicación | `<h2>` "Ubicación y contacto"; botones "Cómo llegar" y "Escribir por WhatsApp" |
| Aporte | `<h2>` "Aporte al refugio"; "Este negocio aporta el {n}% al refugio {refugio.nombre}."; con `0`, "Aporte al refugio por acordar." |
| Nota del refugio | "Con tu visita ayudas a {refugio.nombre}." · "Conoce a los peludos en adopción" · "Próxima campaña de esterilización: {formatearFecha(fecha)}" |
| Más negocios | `<h2>` "Más negocios" |

## Plan de implementación

1. Aplicar los cambios de la tabla a los 2 archivos de `src/data/negocios/`. Comprobar que `astro build` los valida.
2. Agregar `menuDisponible` y el tipo `GrupoMenu` a `src/lib/datos.ts`.
3. Agregar `idGrupo` y `textoPlatillo` a `src/lib/busqueda.ts`, `textoDia` a `src/lib/horarios.ts` y `formatearPrecio` a `src/lib/formato.ts`.
4. Crear `src/lib/mapas.ts` con `enlaceMapa` y hacer opcional `mensaje` en `src/lib/whatsapp.ts`.
5. Crear `src/pages/colabora/[slug].astro` con `getStaticPaths` sobre `negociosPublicados()`, `LayoutColabora`, el título y la descripción. Comprobar que `/colabora/tacos-don-chuy` abre y que las tarjetas de `/colabora` ya no llevan al 404.
6. Hacer que `Encabezado` marque "Negocios que ayudan" con `aria-current="true"` en `/colabora/*`; en `/colabora` sigue con `aria-current="page"`.
7. Crear `src/components/colabora/CabeceraNegocio.astro`: enlace de vuelta, logo con `<Image>` o la inicial en fondo suave, `<h1>`, categoría y descripción, línea de estado con `hidden`, caja de promoción vigente y las dos acciones rápidas.
8. Agregar a `CabeceraNegocio` un `<script>` que al cargar y cada 60 s escribe `estadoHorario` con `momentoEnMexico(new Date())` y quita `hidden`.
9. Crear `src/components/colabora/MenuNegocio.astro`: `<h2>` "Menú", un `<section>` por grupo de `menuDisponible` con `id={idGrupo}`, `<h3>` del grupo (sin `<h3>` si hay un solo grupo), `<h4>` por sección, su nota y la lista de platillos con nombre, descripción y precios. Sin JavaScript se ve todo seguido. Si dos grupos dan el mismo `idGrupo`, la compilación se detiene con un error que nombra el negocio y los grupos.
10. Agregar a `MenuNegocio` las pestañas (botones con `aria-pressed`, fila deslizable y `sticky top-0`) con `hidden`, y un `<script>` que las muestra si hay más de un grupo, oculta los grupos no activos y deja los `<h3>` solo para lectores de pantalla. Al cambiar de pestaña escribe el hash con `history.replaceState` y, si la fila de pestañas está fija, lleva el inicio del menú a la vista. Al cargar, un hash que coincide con un grupo activa esa pestaña; si no, la primera. Los `<section>` llevan `scroll-margin-top` igual al alto de la fila de pestañas.
11. Agregar a `MenuNegocio` el buscador (`<input type="search">` de 16 px con etiqueta, con `hidden` hasta que carga el script). Con texto: oculta las pestañas, muestra todos los grupos con su `<h3>`, oculta platillos que no cumplen `coincide` y secciones y grupos sin resultados, y actualiza el contador. Sin resultados muestra el mensaje. Al vaciarlo vuelve a la pestaña que estaba activa. Enviar el formulario no recarga la página.
12. Crear `src/components/colabora/HorariosNegocio.astro` con `id="horarios"`: tabla de 7 filas con `textoDia`, y un `<script>` que marca la fila de hoy en Ciudad de México con `aria-current="date"` y la etiqueta "Hoy", y la recalcula cada 60 s.
13. Crear `src/components/colabora/ContactoNegocio.astro` (dirección, "Cómo llegar" con `enlaceMapa` y WhatsApp solo con número, los dos en otra pestaña) y `src/components/colabora/AporteNegocio.astro`.
14. Crear `src/components/colabora/NotaRefugio.astro` con el texto, el enlace a `/adopta` y, si `proximaCampana(new Date())` existe, el enlace a `/esterilizacion`.
15. Crear `src/components/colabora/MasNegocios.astro`: chips en orden alfabético a los demás negocios publicados; sin otros negocios, la sección no se pinta.
16. Armar la página: cabecera; debajo, el menú y una columna con horarios, ubicación, aporte y nota. A 360 px va todo en una columna con la columna lateral después del menú; desde `lg`, dos columnas. "Más negocios" al final.
17. Actualizar `specs/README.md` (estado y título de la 05; pasar la decisión del QR a la 07) y la sección "Project Structure" de `CLAUDE.md` con `[slug].astro`, los componentes nuevos y `src/lib/mapas.ts`.

## Criterios de aceptación

- [x] `PUBLIC_MOSTRAR_EJEMPLOS=true astro build` termina sin errores y genera `colabora/{id}/index.html` para los 5 negocios de ejemplo.
- [x] `astro check` termina con 0 errores.
- [x] Abrir `/colabora/tacos-don-chuy` directamente muestra la página y la pestaña dice "Tacos Don Chuy · Come por los Peludos".
- [x] Cada tarjeta de `/colabora` abre la página de su negocio.
- [x] Al cambiar Pizzería Nonna Lupe a `estado: "pausado"` y recompilar, `/colabora/pizzeria-nonna-lupe` da el 404 y ya no aparece en "Más negocios" de los demás.
- [x] La página tiene un solo `<h1>` con el nombre del negocio.
- [x] La cabecera de Tacos Don Chuy muestra la inicial "T", "Taquerías. Tacos al pastor con trompo de leña" y "Promoción: Orden de 5 tacos con refresco por $95".
- [x] La Cocina de Doña Mary no muestra promoción, porque la suya venció el 30 de septiembre.
- [x] Con el reloj en el domingo 4 de octubre de 2026 a las 00:15 de Ciudad de México, Tacos Don Chuy dice "Abierto ahora · Hasta las 0:30" y la fila "Domingo" de su tabla dice "Hoy" con `aria-current="date"`.
- [x] A las 00:45 del mismo domingo dice "Cerrado ahora · Hoy cerrado".
- [x] Con la zona horaria del navegador en `Europe/Madrid` y el mismo instante, el estado y la fila de hoy son los mismos.
- [x] Con el reloj en el jueves 1 de octubre a las 13:59, Pizzería Nonna Lupe dice "Cerrado ahora"; al avanzar el reloj 60 s dice "Abierto ahora" sin recargar.
- [x] La tabla de Tacos Don Chuy dice "13:00 a 0:30" el sábado y "Cerrado" el domingo; la de Panadería San Juan "Por confirmar" el domingo; la de Café del Jardín "9:00 a 13:00 y 17:00 a 20:00" el domingo.
- [x] "Ver horarios" lleva a la tabla de horarios, también sin JavaScript.
- [x] Café del Jardín muestra 7 pestañas en este orden: Desayunos, De antojo, Sándwiches, Lo dulce, Café, Sin café y Té; "Desayunos" está activa con `aria-pressed="true"`.
- [x] Tocar "Café" muestra solo las secciones Espresso y café, Latte, Cappuccino y Mocha, y deja la URL en `/colabora/cafe-del-jardin#menu-cafe` sin agregar entradas al historial.
- [x] Abrir `/colabora/cafe-del-jardin#menu-sin-cafe` muestra la pestaña "Sin café" activa.
- [x] Abrir `/colabora/cafe-del-jardin#menu-inexistente` muestra "Desayunos" activa.
- [x] Al desplazarse por el menú del café a 360 px, la fila de pestañas queda fija arriba de la pantalla.
- [x] Tacos Don Chuy no muestra pestañas ni el nombre de grupo "Menú" como `<h3>`.
- [x] La sección Latte muestra su nota "Precio caliente / frío o frappé. Con crema batida +$13" y el Clásico dice "Caliente $49 · Frío o frappé $59".
- [x] En La Cocina de Doña Mary, "Sopa o arroz" dice "Incluido" y "Postre del día" no aparece.
- [x] En la sección Extras del café, "Huevo" dice "+$12".
- [x] Buscar "latte" en el café oculta las pestañas y muestra 10 platillos en las secciones Desayunos y Paquete desayuno (grupo Desayunos), Latte (grupo Café), y Chai latte y Té latte (grupo Té); el contador dice "10 platillos".
- [x] Buscar "CHILAQUÍLES" muestra "Restaurador" en Desayunos y "Chilaquiles" en Antojitos.
- [x] Buscar "zzz" muestra "No encontramos ese platillo en el menú. Prueba con otra palabra."
- [x] Con "Café" activa, buscar "latte" y vaciar el buscador vuelve a mostrar las pestañas con "Café" activa.
- [x] Buscar "postre" en La Cocina de Doña Mary no muestra resultados.
- [x] "Cómo llegar" de Tacos Don Chuy abre `https://www.google.com/maps/search/?api=1&query=18.9608%2C-99.5906` en otra pestaña.
- [x] "Cómo llegar" de Café del Jardín abre Google Maps con `query` igual a "Café del Jardín, {direccion}, Tenancingo, Estado de México" codificado.
- [x] Tacos Don Chuy muestra "Escribir por WhatsApp" a `https://wa.me/5215500000001` en otra pestaña; Café del Jardín no muestra ese botón.
- [x] El botón "Quiero sumar mi negocio" de `/colabora` sigue abriendo WhatsApp con su mensaje.
- [x] Tacos Don Chuy dice "Este negocio aporta el 5% al refugio Ladridos de Esperanza."; con `porcentaje_aporte: 0` y recompilando, "Aporte al refugio por acordar."
- [x] La nota dice "Con tu visita ayudas a Ladridos de Esperanza.", enlaza "Conoce a los peludos en adopción" a `/adopta` y "Próxima campaña de esterilización: sábado 24 de octubre" a `/esterilizacion`.
- [x] Sin campañas próximas y recompilando, la nota no muestra el enlace de la campaña.
- [x] "Más negocios" en Tacos Don Chuy muestra 4 chips en orden alfabético, sin Tacos Don Chuy, y cada una abre su página.
- [x] "← Volver a negocios" lleva a `/colabora`.
- [x] La barra fija inferior aparece en la página del negocio y el último enlace del pie queda por encima de ella a 360 px.
- [x] El encabezado marca "Negocios que ayudan" con `aria-current="true"` en `/colabora/tacos-don-chuy`.
- [x] Con JavaScript desactivado, el café muestra los 7 grupos seguidos con sus nombres, sin pestañas, buscador ni línea de estado, y la tabla de horarios sin "Hoy".
- [x] A 360 px la columna de horarios, ubicación, aporte y nota va después del menú; desde 1024 px va a la derecha.
- [x] A 360 px no hay desplazamiento horizontal; la fila de pestañas y la de "Más negocios" se deslizan solas.
- [x] Pestañas, botones, chips y el buscador miden al menos 44 px de alto, y el texto del buscador mide 16 px.
- [x] Recorrer la página con Tab muestra foco visible en el enlace de vuelta, las acciones rápidas, el buscador, cada pestaña, los botones y las chips.
- [x] Los íconos decorativos tienen `aria-hidden="true"`.
- [x] Ninguna página ni componente llama a `getCollection` fuera de `src/lib/datos.ts`.

### Observaciones de la validación

Validado el 2026-10-01 con Playwright a 360 px (y a 1024 px para las dos columnas), sobre la compilación de producción (`astro preview`). El navegador del MCP estaba ocupado por otra sesión, así que se usó Playwright desde un script con `page.clock` para fijar el reloj.

- **Compilación temporal.** Pizzería Nonna Lupe en `pausado`, Tacos Don Chuy con `porcentaje_aporte: 0` y la campaña del 24 de octubre como `pasada`. No se generó `colabora/pizzeria-nonna-lupe/`, "Más negocios" de Tacos Don Chuy no la incluyó, el aporte dijo "Aporte al refugio por acordar." y la nota no mostró la campaña. Después se restauraron los 3 archivos desde un respaldo.
- **Hash.** `#menu-sin-cafe` y `#menu-inexistente` se probaron cada uno en una página nueva. Con `page.goto` en la misma página solo cambia el hash y el script no vuelve a correr. Al abrir con `#menu-sin-cafe`, la página queda en el grupo, con 804 px de desplazamiento.
- **Historial.** `history.length` siguió en 2 después de cambiar de pestaña.
- **Pestañas fijas.** Al desplazarse 900 px dentro de Desayunos, la fila de pestañas quedó en `top: 0`.
- **Barra.** Al final de la página, el último enlace del pie termina en 680 px y la barra empieza en 712 px.
- **Foco visible.** Se recorrieron 40 pasos de Tab en Tacos Don Chuy. El único elemento sin contorno fue el `<body>`, al que llega Tab después del último control.
- **Tamaño.** `colabora/cafe-del-jardin/index.html` mide 74 KB con los 145 platillos.

## Decisiones

- **Sí:** una página estática por negocio publicado con `getStaticPaths`. El sitio es estático hasta la SPEC 06, y una URL propia se comparte y abre sin JavaScript (RF-04).
- **Sí:** el `id` del archivo es el slug, como define la SPEC 01. No se agrega un campo `slug`.
- **No:** páginas para negocios en `borrador` o `pausado`. Un negocio pausado no debe recibir visitas que esperan encontrarlo abierto.
- **Sí:** QR en la SPEC 07. RF-17 es una función del panel y nadie fuera del equipo lo necesita ahora.
- **No:** generar el QR al compilar. Agrega una dependencia y rutas para un archivo que solo descarga el equipo.
- **Sí:** sin JavaScript se ven todos los grupos seguidos. El menú completo es el contenido principal y no debe quedar inaccesible; es el mismo criterio que `/colabora`.
- **No:** mostrar solo el primer grupo sin JavaScript. Pierde la mayor parte del menú del café.
- **Sí:** pestañas solo con más de un grupo. Una sola pestaña "Menú" no aporta nada.
- **Sí:** pestañas como botones con `aria-pressed`, como las chips de la SPEC 04. El patrón completo de `tablist` exige navegación con flechas que no agrega valor en una fila deslizable de teléfono.
- **Sí:** pestaña activa en el hash (`#menu-cafe`) con `replaceState`. Permite compartir "mira las bebidas" sin llenar el historial.
- **Sí:** prefijo `menu-` en el hash. Evita choques con otros `id` de la página, como `horarios`.
- **Sí:** el `id` del grupo es el mismo que su hash. Sin JavaScript, el enlace compartido lleva al grupo dentro del menú seguido.
- **No:** guardar la búsqueda del menú en la URL. Es un uso de paso y agrega código para un caso poco compartido.
- **Sí:** la búsqueda recorre todos los grupos, no solo la pestaña activa. Quien busca "latte" no sabe en qué grupo está (RF-06).
- **Sí:** buscar en nombre, descripción y nombre de la sección, como el prototipo. Buscar "latte" encuentra los platillos de la sección Latte aunque se llamen "Clásico".
- **No:** buscar en las notas de sección. Hablan de precios y extras ("Con tapioca +$30") y darían resultados de más.
- **Sí:** reutilizar `normalizar` y `coincide` de la SPEC 04. El buscador del menú y el del catálogo se comportan igual.
- **Sí:** texto de búsqueda de cada platillo normalizado al compilar en `data-busqueda`. Es el mismo patrón que las tarjetas del catálogo.
- **Sí:** platillos con `disponible: false` ocultos, en la lista y en la búsqueda. La SPEC 04 ya los saca de la búsqueda del catálogo.
- **No:** mostrarlos atenuados. Ocupan espacio en un menú largo y no se pueden pedir.
- **Sí:** el filtrado de disponibles en `menuDisponible`, en `src/lib/datos.ts`. La página no repite la regla y se puede reutilizar en la SPEC 06.
- **Sí:** precio de extras con "+". Ya viven en su propia sección, y el "+" dice que se suman a otro platillo.
- **No:** insignia "Extra". Repite lo que dice el nombre de la sección.
- **Sí:** estado de la cabecera calculado en el navegador con `estadoHorario` de la SPEC 04. Mismo texto en la tarjeta y en la página.
- **Sí:** día de hoy resaltado en la tabla de horarios con la fecha de Ciudad de México. A las 00:15 del domingo, "Hoy" es domingo aunque el turno abierto sea del sábado.
- **Sí:** "Por confirmar" para un día ausente y "Cerrado" para `"cerrado"`. Respeta la diferencia que define el esquema de la SPEC 01.
- **Sí:** "Cómo llegar" con coordenadas cuando existen y con nombre, dirección y ubicación del refugio cuando no. Las coordenadas son exactas; sin ellas, la ciudad evita que Maps busque la calle en otro estado.
- **Sí:** URL de búsqueda de Google Maps (`maps/search/?api=1`). Abre la aplicación en el teléfono y no necesita clave.
- **No:** mapa incrustado. Pide una clave o un iframe pesado para algo que el botón ya resuelve.
- **Sí:** botón de WhatsApp solo con número y sin mensaje prefijado. El mensaje lo escribe quien pregunta; sin número no se muestra nada.
- **Sí:** `mensaje` opcional en `enlaceWhatsApp`. Evita un `?text=` vacío sin cambiar los usos actuales.
- **Sí:** "Este negocio aporta el {n}% al refugio". Es el acuerdo del negocio, no dinero recibido (SPEC 03).
- **No:** "de cada menú digital" del prototipo. La SPEC 04 lo descartó porque no queda claro de qué es el porcentaje.
- **Sí:** nota del refugio con enlace a `/adopta` y a la próxima campaña con su fecha. La fecha es la información útil y la página de esterilización ya muestra el cartel.
- **No:** abrir el cartel en un `VisorCartel` dentro de la página del negocio. Repite el diálogo en una página centrada en el menú.
- **Sí:** "Más negocios" como chips en orden alfabético. Es ligero, no compite con el menú y no necesita el script de estado.
- **No:** reutilizar `TarjetaNegocio` en "Más negocios". La página crece mucho al final de un menú largo.
- **Sí:** "← Volver a negocios" a `/colabora` sin filtros. Un enlace a una URL fija funciona igual al llegar desde un enlace compartido; "Atrás" del navegador sigue conservando los filtros.
- **Sí:** `aria-current="true"` en "Negocios que ayudan" dentro de `/colabora/*`. Indica la sección del sitio sin decir que es la misma página.
- **Sí:** título de pestaña "{nombre} · Come por los Peludos". El nombre del negocio va primero porque es lo que se busca entre pestañas.
- **Sí:** componentes en `src/components/colabora/`, uno por bloque de la página. Sigue el patrón de una carpeta por área.
- **No:** fecha de última revisión del menú. Requiere un campo nuevo en el esquema; se decide con el panel.
- **Sí:** ajustar 2 negocios de ejemplo. Sin coordenadas, WhatsApp y un platillo no disponible, esos casos no se pueden verificar.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Dos grupos de un negocio producen el mismo `idGrupo` | Con los menús actuales no pasa. Si pasa, la segunda pestaña nunca se activa por hash; `astro build` se detiene con un error que nombra el negocio y los grupos repetidos. |
| La pestaña fija tapa el título de la sección al saltar desde el hash | Los `<section>` del menú llevan `scroll-margin-top` igual al alto de la fila de pestañas. |
| El HTML del café crece con 145 platillos y sus `data-busqueda` | Son pocos kilobytes, igual que en la SPEC 04. Se revisa el tamaño de `colabora/cafe-del-jardin/index.html` al compilar. |
| Una promoción o campaña vencida sigue visible hasta la siguiente compilación | Se acepta hasta la recompilación diaria de la SPEC 06, igual que en la SPEC 04. |
| Google cambia el formato de la URL de búsqueda de Maps | La URL se arma solo en `src/lib/mapas.ts`. |
| Coordenadas mal capturadas llevan a otro lugar | En la SPEC 07 el panel muestra la ubicación antes de guardar. Mientras tanto, se revisan al capturar cada negocio real. |
| Un hash compartido apunta a un grupo que el negocio quitó | Se activa la primera pestaña; hay un criterio que lo verifica. |

## Lo que **no** entra en esta spec

- Código QR por negocio (SPEC 07).
- Fecha de última revisión del menú.
- Búsqueda del menú en la URL.
- Mapa incrustado y fotos de platillos.
- Anuncios, analítica y metadatos para compartir (SPEC 08).
- Retiro de promociones y campañas vencidas sin recompilar (SPEC 06).
- Páginas de negocios en borrador o pausados.

Cada una de estas, si llega, va en su propia spec.
