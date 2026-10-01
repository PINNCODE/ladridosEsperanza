# SPEC 04 — Catálogo `/colabora` con búsqueda, filtros y barra fija

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 03
> **Fecha:** 2026-10-01
> **Objetivo:** Crear la página `/colabora` "Come por los Peludos" con las tarjetas de los negocios publicados, búsqueda por negocio o platillo, filtros combinables y la barra fija inferior con enlaces al refugio.

## Por qué existe esta spec

El índice asigna a esta spec RF-01, RF-02, RF-03 y RF-13.
El sitio es estático, pero "Abierto ahora" cambia cada minuto, así que el estado de cada negocio se calcula en el navegador con la hora de Tenancingo (`America/Mexico_City`), no con la del visitante.
La lógica de horarios queda en `src/lib/horarios.ts` para que la SPEC 05 la reutilice en la página de cada negocio (RF-07).
El prototipo incluye en esta página "Un menú digital para el negocio" y la calculadora de aportes.
La primera habla de cobros y de publicar lo recaudado, y la segunda ya está descartada en el README; ninguna entra.

## Alcance

**Dentro:**

- Página `/colabora` con título "Come por los Peludos", buscador, filtros, contador y tarjetas de negocios (RF-01).
- Tarjeta por negocio publicado, en orden alfabético, que enlaza a `/colabora/{id}`: logo o inicial, nombre, categoría, descripción corta, línea de estado, promoción vigente y "Aporta {n}% al refugio".
- Línea de estado calculada en el navegador con la hora de `America/Mexico_City`, con cruce de medianoche, turnos múltiples y días "por confirmar".
- Búsqueda al escribir, sin distinguir mayúsculas ni acentos, por nombre y descripción del negocio, categoría, grupos y secciones del menú, y nombre y descripción de los platillos disponibles (RF-02).
- Filtros combinables: una categoría, "Abierto ahora" y "Con promoción" (RF-03).
- Búsqueda y filtros guardados en la URL con `history.replaceState`.
- Mensaje y botón "Quitar filtros" cuando no hay resultados.
- Promoción vigente filtrada al compilar, como las necesidades y las campañas (RF-09 en la tarjeta).
- Sección "¿Tienes un negocio? Súmate" con botón de WhatsApp al refugio.
- Barra fija inferior "Adopta / Esteriliza / Dona" de 48 px en un layout `LayoutColabora` que también usará la SPEC 05 (RF-13).
- Ajustes a 3 negocios de ejemplo para probar promoción vencida, dos turnos y día por confirmar.

**Fuera de alcance (specs futuras):**

- Página de cada negocio `/colabora/{slug}`, su menú, horarios completos, "Cómo llegar", nota lateral del refugio y "Más negocios" (SPEC 05). Las tarjetas llevan al 404 hasta entonces.
- Formulario Súmate `/colabora/sumate` (SPEC 07). Mientras tanto, el botón abre WhatsApp.
- Espacios de anuncio y anuncios automáticos (SPEC 08).
- Medir búsquedas y clics a negocios (SPEC 08).
- Negocios destacados que aparecen primero.
- Sección "Un menú digital para el negocio" con precios de digitalización o destacados.
- Calculadora de aportes (descartada en el README).
- Retirar la promoción vencida en el navegador; se retira al recompilar (SPEC 06).
- Ordenar por "abiertos primero" o por cercanía.

## Modelo de datos

Esta spec no agrega colecciones ni cambia esquemas. Reutiliza `negocios` y `categorias` de la SPEC 01 y ajusta datos de ejemplo.

### Cambios en `src/data/negocios/`

| Archivo | Cambio | Para probar |
| --- | --- | --- |
| `la-cocina-de-dona-mary.json` | `promocion`: `{ "texto": "Comida corrida con agua del día por $85", "fecha_inicio": "2026-09-01", "fecha_fin": "2026-09-30" }` | Promoción vencida que no se muestra |
| `panaderia-san-juan.json` | Se quita `dom` de `horarios` | Día "por confirmar" |
| `cafe-del-jardin.json` | `dom`: `[{ "abre": "09:00", "cierra": "13:00" }, { "abre": "17:00", "cierra": "20:00" }]` | Dos turnos en un día |

Tacos Don Chuy ya cubre el cruce de medianoche: el sábado cierra a las 00:30 y el domingo está cerrado.

### Funciones en `src/lib/datos.ts`

Todas pasan por `obtener`:

```ts
export type Negocio = CollectionEntry<'negocios'>;
export type Categoria = CollectionEntry<'categorias'>;
export type Promocion = NonNullable<Negocio['data']['promocion']>;

export function negociosPublicados(): Promise<Negocio[]>;          // estado "publicado", por nombre (es-MX)
export function promocionVigente(n: Negocio, hoy: Date): Promocion | null; // fecha_inicio <= hoy y (fecha_fin null o >= hoy)
export function categoriasConNegocios(negocios: Negocio[]): Promise<Categoria[]>; // solo las que tienen al menos uno, por `orden`
```

`promocionVigente` usa el mismo `soloFecha` que `necesidadesVigentes`.

### `src/lib/horarios.ts` (nuevo)

Funciones puras, sin `astro:content`, para que las importe el `<script>` del navegador:

```ts
export type Horarios = Negocio['data']['horarios']; // solo el tipo
export type Dia = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

export function momentoEnMexico(fecha: Date): { dia: Dia; minutos: number }; // Intl con timeZone "America/Mexico_City"
export function estadoHorario(h: Horarios, m: { dia: Dia; minutos: number }): { abierto: boolean; texto: string };
export function formatearHora(hora: string): string; // "08:00" → "8:00", "00:30" → "0:30"
```

Reglas de `estadoHorario`:

- Abierto si un turno de hoy cumple `abre <= minutos < cierra`, o `minutos >= abre` cuando `cierra < abre`.
- También abierto si un turno de ayer tiene `cierra < abre` y `minutos < cierra`.
- Un día ausente es "por confirmar" y nunca cuenta como abierto.

| Caso | `texto` |
| --- | --- |
| Abierto por un turno de hoy | "Abierto ahora · Hoy 13:00 a 23:30" |
| Abierto por un turno de ayer que cruza la medianoche | "Abierto ahora · Hasta las 0:30" |
| Cerrado y hoy tiene turnos | "Cerrado ahora · Hoy 14:00 a 21:00" |
| Hoy tiene dos turnos | "… · Hoy 9:00 a 13:00 y 17:00 a 20:00" |
| Hoy es `"cerrado"` | "Cerrado ahora · Hoy cerrado" |
| Hoy no tiene horario y nada de ayer sigue abierto | "Horario por confirmar" |

### `src/lib/busqueda.ts` (nuevo)

```ts
export function normalizar(texto: string): string;          // minúsculas, sin acentos (NFD), espacios simples
export function textoBusqueda(n: Negocio, categoria: string): string; // ya normalizado
export function coincide(texto: string, consulta: string): boolean;   // cada palabra de la consulta aparece en `texto`
```

`textoBusqueda` une nombre, descripción corta, nombre de la categoría, nombres de grupos y secciones del menú, y nombre y descripción de cada platillo con `disponible: true`.
`coincide` con consulta vacía devuelve `true`.

### Atributos de cada tarjeta

```html
<li
  data-negocio
  data-categoria="taquerias"
  data-promocion="true"
  data-busqueda="tacos don chuy tacos al pastor con trompo de lena taquerias menu tacos pastor con pina …"
  data-horarios='{"lun":[{"abre":"13:00","cierra":"23:30"}],…,"dom":"cerrado"}'
>
```

### Parámetros de la URL

| Parámetro | Valor | Ejemplo |
| --- | --- | --- |
| `q` | Texto de la búsqueda, tal como se escribió | `?q=chilaquiles` |
| `categoria` | `id` de la categoría | `&categoria=cafeterias` |
| `abierto` | `1` si "Abierto ahora" está activo | `&abierto=1` |
| `promocion` | `1` si "Con promoción" está activo | `&promocion=1` |

Un parámetro vacío o desconocido se ignora. Sin filtros activos, la URL queda `/colabora` sin `?`.

### Textos fijos

| Uso | Texto |
| --- | --- |
| Título de pestaña | "Come por los Peludos · {refugio.nombre}" |
| Título y frase | "Come por los Peludos" · "Negocios locales que publican su menú con nosotros y aportan al refugio {refugio.nombre}." |
| Buscador | Etiqueta "Buscar negocio o platillo"; marcador "Busca un platillo o negocio, por ejemplo: café" |
| Grupo de filtros | `aria-label="Filtros"`; chips "Todas", una por categoría, "Abierto ahora" y "Con promoción" |
| Contador | "5 negocios" / "1 negocio" |
| Sin resultados | "No encontramos negocios con esos filtros. Prueba quitar un filtro o buscar otra palabra." y botón "Quitar filtros" |
| Sin negocios publicados | "Pronto verás aquí a los negocios que ayudan al refugio." |
| Insignia de promoción | "Promoción" |
| Aporte | "Aporta {porcentaje_aporte}% al refugio"; con `0`, "Aporte al refugio por acordar" |
| Súmate, título y texto | "¿Tienes un negocio? Súmate" · "Publicamos tu menú, horarios y promociones, y tu negocio aporta al refugio. Escríbenos y te contamos cómo." |
| Botón Súmate | "Quiero sumar mi negocio", con el mensaje "Hola, tengo un negocio y quiero sumarme a Come por los Peludos." |
| Barra fija | `aria-label="Enlaces del refugio"`; a menos de 640 px "Adopta", "Esteriliza", "Dona"; desde 640 px "Adopta a un peludo", "Campañas de esterilización", "Dona al refugio" |

Íconos de la barra: `house-heart`, `syringe` y `heart`, los mismos de los encabezados de `/adopta`, `/esterilizacion` y `/donar`.

## Plan de implementación

1. Aplicar los cambios de la tabla a los 3 archivos de `src/data/negocios/`. Comprobar que `astro build` los valida.
2. Agregar a `src/lib/datos.ts` los tipos `Negocio`, `Categoria` y `Promocion`, y las funciones `negociosPublicados`, `promocionVigente` y `categoriasConNegocios`.
3. Crear `src/lib/horarios.ts` con `momentoEnMexico`, `estadoHorario` y `formatearHora` según las reglas del modelo de datos. Importar `Negocio` solo como tipo.
4. Crear `src/lib/busqueda.ts` con `normalizar`, `textoBusqueda` y `coincide`.
5. Agregar a `src/layouts/Layout.astro` un slot con nombre `barra`, que se pinta después de `Pie`. Cuando el slot tiene contenido (`Astro.slots.has('barra')`), el `<meta name="viewport">` agrega `viewport-fit=cover` y el `<body>` agrega un relleno inferior de `calc(3rem + env(safe-area-inset-bottom))`. Las páginas sin barra no cambian.
6. Crear `src/components/colabora/BarraRefugio.astro`: `<nav>` fijo abajo, fondo superficie y una sombra superior de 1 px en el color de las líneas, 48 px de alto más `env(safe-area-inset-bottom)`, tres enlaces del mismo ancho a `/adopta`, `/esterilizacion` y `/donar` con ícono y los textos corto o largo según el ancho.
7. Crear `src/layouts/LayoutColabora.astro`, que recibe `titulo` y `descripcion`, usa `Layout` y pone `BarraRefugio` en el slot `barra`.
8. Crear `src/pages/colabora/index.astro` con `LayoutColabora` y `EncabezadoPagina` (`store`). Comprobar a 360 px que la barra no tapa el pie.
9. Crear `src/components/colabora/TarjetaNegocio.astro`: enlace de bloque a `/colabora/{id}` con portada (logo con `<Image>` o la inicial del nombre en fondo suave), insignia "Promoción" si hay promoción vigente, nombre en `<h3>`, "{categoría}. {descripcion_corta}", línea de estado vacía con `hidden`, texto de la promoción vigente y el aporte. Lleva los atributos `data-*` del modelo de datos.
10. Crear `src/components/colabora/CatalogoNegocios.astro`: `<h2>` "Negocios" solo para lectores de pantalla, contador y lista de `TarjetaNegocio` en 1 columna a 360 px, 2 desde `sm` y 3 desde `lg`. Sin negocios publicados muestra el aviso del modelo de datos y nada más. Agregarlo a la página.
11. Agregar el `<script>` de estado a `CatalogoNegocios`: al cargar y cada 60 s calcula `estadoHorario` de cada tarjeta con `momentoEnMexico(new Date())`, escribe el texto, quita `hidden` y marca la tarjeta como abierta o cerrada.
12. Agregar a `CatalogoNegocios` el buscador (`<form role="search">`, `<input type="search">` de 16 px con etiqueta) y el grupo de chips con `aria-pressed`, en una fila que se desliza horizontalmente. Los dos se pintan con `hidden` y el script los muestra. Enviar el formulario no recarga la página y quita el foco del campo.
13. Agregar al script el filtrado: al escribir y al tocar un chip, oculta las tarjetas que no cumplen búsqueda, categoría, "Abierto ahora" y "Con promoción" a la vez. Actualiza el contador (`aria-live="polite"`). Sin resultados muestra el mensaje y "Quitar filtros", que limpia todo y devuelve el foco al buscador. El filtro "Abierto ahora" se vuelve a aplicar cada 60 s.
14. Agregar al script la sincronización con la URL: al cargar lee `q`, `categoria`, `abierto` y `promocion` y aplica el estado; en cada cambio lo escribe con `history.replaceState`.
15. Crear `src/components/colabora/SumaTuNegocio.astro` con el título, el texto y el botón de WhatsApp a `refugio.whatsapp` en otra pestaña. Agregarlo al final de la página.
16. Actualizar `specs/README.md` (estado y título de la 04) y la sección "Project Structure" de `CLAUDE.md` con `src/pages/colabora/`, `src/layouts/LayoutColabora.astro`, `src/components/colabora/`, `src/lib/horarios.ts` y `src/lib/busqueda.ts`.

## Criterios de aceptación

- [x] `PUBLIC_MOSTRAR_EJEMPLOS=true astro build` termina sin errores y genera `colabora/index.html`.
- [x] `astro check` termina con 0 errores.
- [x] `/colabora` muestra 5 tarjetas en este orden: Café del Jardín, La Cocina de Doña Mary, Panadería San Juan, Pizzería Nonna Lupe y Tacos Don Chuy.
- [x] Al cambiar Pizzería Nonna Lupe a `estado: "pausado"` y recompilar, muestra 4 tarjetas y ya no hay chip "Pizzas".
- [x] Cada tarjeta enlaza a `/colabora/{id}`; la de Tacos Don Chuy a `/colabora/tacos-don-chuy`.
- [x] La tarjeta de Tacos Don Chuy muestra "Taquerías. Tacos al pastor con trompo de leña", la inicial "T", la insignia "Promoción", "Orden de 5 tacos con refresco por $95" y "Aporta 5% al refugio".
- [x] La tarjeta de La Cocina de Doña Mary no muestra insignia ni texto de promoción, porque la suya venció el 30 de septiembre.
- [x] Con `porcentaje_aporte: 0` en un negocio y recompilando, su tarjeta dice "Aporte al refugio por acordar".
- [x] Con el reloj del navegador en el domingo 4 de octubre de 2026 a las 00:15 de Ciudad de México (Playwright `page.clock`), Tacos Don Chuy dice "Abierto ahora · Hasta las 0:30".
- [x] A las 00:45 del mismo domingo, Tacos Don Chuy dice "Cerrado ahora · Hoy cerrado".
- [x] El domingo 4 de octubre a las 10:00, Café del Jardín dice "Abierto ahora · Hoy 9:00 a 13:00 y 17:00 a 20:00", Panadería San Juan "Horario por confirmar" y Pizzería Nonna Lupe "Cerrado ahora · Hoy 14:00 a 21:00".
- [x] Con la zona horaria del navegador en `Europe/Madrid` y el mismo instante de las 10:00 en Ciudad de México, los textos de estado son los mismos.
- [x] Con el reloj en el jueves 1 de octubre a las 13:59, Pizzería Nonna Lupe dice "Cerrado ahora"; al avanzar el reloj 60 s, dice "Abierto ahora" sin recargar.
- [x] Buscar "chilaquiles" muestra solo Café del Jardín y el contador dice "1 negocio".
- [x] Buscar "CHILAQUÍLES" da el mismo resultado.
- [x] Buscar "pastor" muestra solo Tacos Don Chuy.
- [x] Buscar "taquerias" muestra Tacos Don Chuy por su categoría.
- [x] Tocar "Cafeterías" muestra solo Café del Jardín y la chip queda con `aria-pressed="true"`; tocar "Todas" muestra 5.
- [x] Con el reloj el jueves 1 de octubre a las 13:30, "Abierto ahora" muestra 4 negocios, "Con promoción" muestra 4 y los dos juntos muestran Café del Jardín, Panadería San Juan y Tacos Don Chuy.
- [x] "Taquerías" más la búsqueda "chilaquiles" muestra "No encontramos negocios con esos filtros. Prueba quitar un filtro o buscar otra palabra." y el botón "Quitar filtros".
- [x] "Quitar filtros" vacía el buscador, vuelve a "Todas", apaga los dos interruptores, muestra 5 tarjetas y deja la URL en `/colabora`.
- [x] Buscar "chilaquiles" y tocar "Con promoción" deja la URL en `/colabora?q=chilaquiles&promocion=1`.
- [x] Abrir `/colabora?q=pastor&categoria=taquerias` muestra el buscador con "pastor", la chip "Taquerías" activa y solo Tacos Don Chuy.
- [x] Abrir `/colabora?categoria=inexistente` muestra 5 tarjetas con "Todas" activa.
- [x] Desde un resultado filtrado, abrir una tarjeta y volver con "Atrás" conserva la búsqueda y los filtros.
- [x] Buscar y filtrar no agrega entradas al historial del navegador.
- [x] Con JavaScript desactivado, `/colabora` muestra las 5 tarjetas sin buscador, sin filtros y sin línea de estado.
- [x] Con todos los negocios en `estado: "pausado"` y recompilando, `/colabora` muestra "Pronto verás aquí a los negocios que ayudan al refugio." sin buscador ni filtros.
- [x] "Quiero sumar mi negocio" abre `https://wa.me/5215500000000?text=` con "Hola, tengo un negocio y quiero sumarme a Come por los Peludos." en otra pestaña.
- [x] La barra inferior aparece en `/colabora` y no aparece en `/`, `/adopta`, `/esterilizacion` ni `/donar`.
- [x] La barra mide 48 px de alto a 360 px, con 3 enlaces del mismo ancho que dicen "Adopta", "Esteriliza" y "Dona".
- [x] A 640 px la barra dice "Adopta a un peludo", "Campañas de esterilización" y "Dona al refugio".
- [x] Los enlaces de la barra llevan a `/adopta`, `/esterilizacion` y `/donar`.
- [x] Al desplazarse hasta el final a 360 px, el último enlace del pie queda completo por encima de la barra.
- [x] El `<meta name="viewport">` de `/colabora` incluye `viewport-fit=cover` y el de `/` no.
- [x] El encabezado marca "Negocios que ayudan" con `aria-current="page"` en `/colabora`.
- [x] El enlace "Ver negocios" de la portada y el de `/donar` llevan a `/colabora`.
- [x] La pestaña dice "Come por los Peludos · Ladridos de Esperanza" y la página tiene un solo `<h1>`.
- [x] A 360 px no hay desplazamiento horizontal de la página; la fila de chips se desliza sola.
- [x] Chips, botones, el buscador y los enlaces de la barra miden al menos 44 px de alto, y el texto del buscador mide 16 px.
- [x] Recorrer la página con Tab muestra foco visible en el buscador, cada chip, cada tarjeta y cada enlace de la barra.
- [x] Los íconos decorativos tienen `aria-hidden="true"`.
- [x] Ninguna página ni componente llama a `getCollection` fuera de `src/lib/datos.ts`.

### Observaciones de la validación

Validado con Playwright el 2026-10-01 a 360 px (y a 640 px para los textos largos de la barra), sobre la compilación de producción (`astro preview`). Los criterios de horario se probaron con el reloj del navegador fijado con `page.clock`. Los que piden cambiar datos se probaron con dos compilaciones temporales, y después se restauraron los archivos desde un respaldo (`diff` sin diferencias).

- **Compilación temporal A:** Pizzería Nonna Lupe en `pausado` y Panadería San Juan con `porcentaje_aporte: 0`. `/colabora` mostró 4 tarjetas, "4 negocios", ninguna chip "Pizzas", y la panadería dijo "Aporte al refugio por acordar".
- **Compilación temporal B:** los 5 negocios en `pausado`. `/colabora` mostró "Pronto verás aquí a los negocios que ayudan al refugio." sin tarjetas, buscador ni filtros. "¿Tienes un negocio? Súmate" sigue visible.
- **Zona horaria.** Con `timezoneId: "Europe/Madrid"` el reloj local del navegador marcaba las 18:00 del domingo y los estados fueron los mismos que a las 10:00 de Ciudad de México.
- **Avance del reloj.** A las 13:59 del jueves, Pizzería Nonna Lupe decía "Cerrado ahora · Hoy 14:00 a 22:30"; con `clock.runFor(60000)` cambió a "Abierto ahora" sin recargar.
- **"Atrás".** La tarjeta de Café del Jardín lleva al 404 (la página del negocio llega en la SPEC 05). Al volver, la URL `?q=chilaquiles&promocion=1`, el buscador, la chip y el resultado siguen igual. `history.length` no cambió al buscar, filtrar ni borrar.
- **Barra (cambiado durante la implementación).** Con `border-t` medía 49 px. Se cambió por una sombra superior de 1 px con el mismo color, y mide 48 px. Al final de la página, el último enlace del pie termina en 660 px y la barra empieza en 692 px.
- **Foco visible.** Se recorrió la página con Tab: buscador, 7 chips (incluida "Todas"), 5 tarjetas, "Quiero sumar mi negocio" y los 3 enlaces de la barra tienen contorno. El único elemento sin contorno fue el `<body>`, al que llega Tab después del último control.
- **Tamaños.** Los 13 controles revisados (chips, botones, buscador, barra y botón de WhatsApp) miden al menos 44 px; el buscador usa texto de 16 px. La fila de chips mide 1026 px de ancho dentro de 360 px y se desliza sola; la página no tiene desplazamiento horizontal.

## Decisiones

- **Sí:** "Abierto ahora" calculado en el navegador. Al compilar quedaría viejo en minutos y RF-07 no se cumpliría.
- **Sí:** siempre con la hora de `America/Mexico_City`. Un visitante fuera de México vería el estado equivocado con la hora de su dispositivo.
- **No:** usar la hora del dispositivo. Es más simple, pero falla justo con quien comparte el enlace desde otro lugar.
- **Sí:** contar los turnos de ayer que cruzan la medianoche. El prototipo solo mira el día de hoy y marca cerrado a las 00:15 un negocio que cierra a las 00:30, que es el caso de RF-07.
- **Sí:** "Abierto ahora · Hasta las 0:30" cuando el turno es de ayer. "Hoy cerrado" junto a "Abierto ahora" se contradice.
- **Sí:** la lógica en `src/lib/horarios.ts`, sin dependencias de Astro. La SPEC 05 la reutiliza en la página del negocio.
- **Sí:** estado y horario de hoy en la tarjeta, en formato de 24 horas sin cero inicial ("8:00"), como el prototipo.
- **Sí:** un día ausente en `horarios` es "Horario por confirmar" y no cuenta como abierto. Lo define el esquema de la SPEC 01.
- **Sí:** sin JavaScript se ven todas las tarjetas y se ocultan buscador, filtros y estado. Con pocos negocios el catálogo se recorre igual, y un estado sin calcular sería falso.
- **Sí:** promoción vigente filtrada al compilar. Es el mismo criterio que necesidades y campañas, y la recompilación diaria de la SPEC 06 la retira a tiempo.
- **No:** volver a filtrarla en el navegador. Duplica la lógica y deja el filtro "Con promoción" dependiendo de dos fuentes.
- **Sí:** una promoción con `fecha_inicio` futura tampoco se muestra.
- **Sí:** búsqueda al escribir, sin botón "Buscar". En el teléfono el resultado aparece sin un paso extra; enviar el formulario solo cierra el teclado.
- **Sí:** búsqueda y filtros en la URL con `replaceState`. Se pueden compartir, y "Atrás" desde un negocio conserva el resultado sin llenar el historial.
- **No:** `pushState` por cada letra. Haría que "Atrás" recorra la búsqueda letra por letra.
- **Sí:** buscar también en descripciones de negocio y platillos, y en grupos y secciones del menú. "Chilaquiles" aparece en la descripción de otros platillos del café y la gente busca por lo que come, no por el nombre exacto.
- **Sí:** cada palabra de la búsqueda debe aparecer, en cualquier orden. "frio cafe" encuentra "Café frío".
- **No:** búsqueda difusa o con errores de dedo. Con unos 15 negocios no compensa la librería.
- **Sí:** texto de búsqueda normalizado al compilar en `data-busqueda`. El navegador no recorre el menú y el café, con 145 platillos, no pesa más de unos kilobytes.
- **No:** un JSON aparte con el índice de búsqueda. Para este tamaño es otra petición sin ganancia.
- **Sí:** platillos con `disponible: false` fuera de la búsqueda. Encontrar un negocio por algo que no tiene confunde.
- **Sí:** una sola categoría a la vez, con "Todas", como el prototipo. Los interruptores sí se combinan con ella (RF-03).
- **Sí:** solo categorías con al menos un negocio publicado. Una chip que siempre da cero resultados no sirve.
- **Sí:** orden alfabético. Es neutral entre negocios; los destacados de pago se definen cuando existan.
- **No:** abiertos primero. Las tarjetas cambiarían de lugar al cargar y cada minuto.
- **Sí:** "Aporta {n}% al refugio" en la tarjeta. Es el acuerdo del negocio, no dinero recibido, así que no choca con la decisión de no publicar montos (SPEC 03).
- **No:** "Aporta {n}% de cada menú digital al refugio" del prototipo. No queda claro de qué es el porcentaje.
- **Sí:** texto de la promoción además de la insignia. RF-01 pide la promoción en la tarjeta y la insignia sola no dice cuál es.
- **Sí:** "¿Tienes un negocio? Súmate" con WhatsApp al número del refugio. Es el único número en los datos; el formulario llega en la SPEC 07.
- **No:** campo nuevo `whatsapp_colabora` en `refugio`. Cambia un esquema por un botón temporal.
- **No:** sección "Un menú digital para el negocio". Habla de cobros y de publicar lo recaudado, que choca con la decisión de no mostrar dinero.
- **Sí:** mismo `Encabezado` y `Pie` del sitio en `/colabora`. El botón "Dona" queda visible y la navegación del refugio sigue a mano.
- **No:** encabezado propio con "← Volver al refugio", como el prototipo. Separa visualmente lo que el sitio quiere unir.
- **Sí:** `LayoutColabora` con la barra en un slot de `Layout`. La SPEC 05 lo usa sin repetir la barra, y las páginas del refugio no cambian.
- **Sí:** `viewport-fit=cover` solo con barra. Sin él, `env(safe-area-inset-bottom)` vale 0 en iPhone y la barra queda bajo la barra de inicio; en el resto del sitio no hace falta.
- **Sí:** carpeta `src/components/colabora/` y página en `src/pages/colabora/index.astro`. Sigue el patrón de una carpeta por página y deja lugar a `[slug].astro` de la SPEC 05.
- **Sí:** tarjetas que llevan al 404 hasta la SPEC 05, como los enlaces a páginas pendientes en las SPEC 02 y 03.
- **Sí:** sombra superior de 1 px en la barra en lugar de borde (cambiado durante la implementación). El borde sumaba 1 px y la barra medía 49 px.
- **Sí:** ajustar 3 negocios de ejemplo. Sin promoción vencida, dos turnos y día por confirmar, esos casos no se pueden verificar.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una promoción vencida sigue visible hasta la siguiente compilación | Se acepta hasta la recompilación diaria de la SPEC 06, que ya está en las pendientes del README. |
| México vuelve a cambiar de horario en verano | `Intl` con `America/Mexico_City` usa la base de zonas del navegador, que se actualiza sola. No hay desfases fijos en el código. |
| `viewport-fit=cover` deja contenido bajo la muesca en horizontal | Solo se activa en `/colabora`, donde el contenido ya tiene `px-4`. Se revisa a 360 px y en horizontal durante la validación. |
| Un negocio con un menú muy grande infla el HTML por `data-busqueda` | Con 145 platillos son pocos kilobytes. Si un negocio supera unos 500 platillos, se mueve el índice a un JSON aparte. |
| El estado y el filtro "Abierto ahora" difieren por un minuto | El script recalcula los dos cada 60 s con la misma función. |
| Búsquedas como "pan" coinciden con palabras más largas ("panela", "empanada") | Se acepta: con pocos negocios, un resultado de más es mejor que uno de menos. |
| La barra tapa el final de la página | El `<body>` agrega el alto de la barra y el área segura como relleno inferior; hay un criterio que lo verifica. |

## Lo que **no** entra en esta spec

- Página de cada negocio, su menú, horarios completos, "Cómo llegar", nota del refugio y "Más negocios" (SPEC 05).
- Formulario Súmate (SPEC 07).
- Anuncios y analítica (SPEC 08).
- Negocios destacados, orden por abiertos o por cercanía.
- Sección de cobros a negocios y calculadora de aportes.
- Retiro de promociones vencidas sin recompilar.

Cada una de estas, si llega, va en su propia spec.
