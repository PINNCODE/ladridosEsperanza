# SPEC 02 — Portada del refugio

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-01
> **Objetivo:** Reemplazar la portada provisional por la portada completa del refugio, con sus 9 secciones leídas de los datos, el carrusel de peludos en adopción y las animaciones hechas solo con CSS.

## Por qué existe esta spec

La spec padre ordena la portada en 9 secciones y el índice asigna a esta spec RF-21, RF-22, RF-23, RF-28, RF-30 y RF-31.
Esterilización, Donativos y Transparencia también son secciones de la portada, pero sus RF completos (RF-24, RF-25, RF-26 y RF-19) son de la SPEC 03.
Esta spec las incluye como resúmenes breves con su dato clave y un enlace a su página, para que la portada quede completa de una vez.
La SPEC 03 construye las páginas y no vuelve a tocar la portada.
También cierra las dos decisiones que el README dejó pendientes para la 02: los íconos de las problemáticas y la precarga de la cursiva.

## Alcance

**Dentro:**

- Las 9 secciones de la portada en el orden de la spec padre: Presentación, Adopciones, Quiénes somos, Lo que enfrenta un refugio, Esterilización, Donativos, Transparencia, Colaboración con negocios y Redes y contacto.
- Presentación con foto principal, nombre, frase y botones "Quiero adoptar" (a `#adopta`) y "Dona" (a `/donar`) (RF-21).
- Carrusel de peludos con estado `disponible`: deslizamiento táctil, flechas, puntos, teclado, avance automático y favorito guardado en el dispositivo (RF-30).
- Botón "Quiero conocer a [nombre]" que abre WhatsApp con mensaje prellenado.
- Sección "Quiénes somos" leída de `bloques_contenido` (RF-22, solo lectura; la edición llega con el panel).
- Tarjetas de problemáticas que muestran la cifra solo si tiene cifra, fecha y fuente (RF-23).
- Resúmenes de Esterilización (próxima campaña y "Reservar mi lugar"), Donativos (necesidades vigentes) y Transparencia (totales del último informe), con enlace a su página.
- Tarjeta "Come local, ayuda al refugio" que lleva a `/colabora` (RF-28).
- Sección "Síguenos y escríbenos" con las 4 redes y el WhatsApp del refugio.
- Animaciones solo con CSS: caminito de huellas entre secciones, figuras que flotan en la presentación, figuras que se asoman, aparición al desplazar, corazón que late en "Dona" (RF-31).
- Lista final de íconos de las problemáticas y retiro de la cursiva de DM Sans.
- Funciones de formato de pesos y fechas, y funciones de consulta para la portada en `src/lib/datos.ts`.

**Fuera de alcance (specs futuras):**

- Páginas `/adopta`, `/esterilizacion`, `/donar` y `/transparencia` (SPEC 03). Los enlaces de los resúmenes muestran el 404 hasta entonces.
- Si `/adopta` reutiliza `CarruselPeludos` o usa una cuadrícula (se decide en la SPEC 03).
- Cartel ampliable, preguntas frecuentes y cuidados de esterilización (SPEC 03).
- Formas de ayudar, tabla "En qué se usa un donativo" y botón "Pedir datos para donar" (SPEC 03).
- Catálogo `/colabora` (SPEC 04). El enlace de la tarjeta de colaboración muestra el 404 hasta entonces.
- Editar textos, fotos y cifras desde el panel, y el registro mensual de cifras (SPEC 07).
- Medir clics de WhatsApp y de adopción (SPEC 08).
- Recompilar el sitio cuando vence una necesidad o pasa una campaña (SPEC 06).
- Sincronizar favoritos entre dispositivos o enviarlos al refugio.
- Redes en el encabezado (descartado en la SPEC 01).

## Modelo de datos

Esta spec no agrega colecciones ni cambia esquemas. Reutiliza el modelo de la SPEC 01 y solo ajusta datos de ejemplo.

Cambios en `src/data/problematicas.json`:

| id | Cambio |
| --- | --- |
| `abandono-y-maltrato` | `icono: "shield-alert"`; `enlace.texto: "Nota de prensa"` (el aviso "Contenido sensible" lo pone el componente cuando `sensible` es `true`) |
| `enfermedades-y-emergencias` | `icono: "siren"` |
| `adopciones-lentas` | `icono: "hourglass"` |
| Las 7 primeras (todas menos `pocos-recursos`) | `fecha_cifra: "2026-09-30"`, `fuente: "Registro del refugio"` |
| `pocos-recursos` | Sin cambios: conserva `cifra: "12"` con fecha y fuente en `null`, para ver el caso de una tarjeta sin dato completo |

Lista final de íconos de problemáticas: `shield-alert`, `users`, `stethoscope`, `soup`, `house`, `siren`, `hourglass` y `hand-coins`.

Cambio en `astro.config.mjs`: DM Sans pasa a `styles: ['normal']`. Quedan 2 archivos de fuente precargados.

Favoritos en el navegador:

```ts
// localStorage, clave "favoritos:v1"
["luna", "miel"] // ids de peludos marcados como favoritos
```

Funciones nuevas en `src/lib/datos.ts` (todas pasan por `obtener`):

```ts
export function peludosDisponibles(): Promise<Peludo[]>;        // estado "disponible", por `orden`
export function bloqueQuienesSomos(): Promise<Bloque | null>;   // seccion "quienes_somos", publicado
export function problematicasPublicadas(): Promise<Problematica[]>; // publicada, por `orden`
export function cifraVisible(p: Problematica): boolean;          // cifra, fecha_cifra y fuente no nulos
export function proximaCampana(hoy: Date): Promise<Campana | null>; // estado "proxima", fecha >= hoy, la más cercana
export function necesidadesVigentes(hoy: Date): Promise<Necesidad[]>; // fecha_vigencia >= hoy; urgentes, luego vigencia y descripción
export function ultimoInforme(): Promise<Informe | null>;       // publicado, el `mes` más reciente
```

`hoy` es la fecha de compilación. Las comparaciones usan solo la fecha, sin hora.

Funciones nuevas en `src/lib/formato.ts`:

```ts
formatearPesos(15000)                   // "$15,000"
formatearFecha(new Date("2026-10-24"))  // "sábado 24 de octubre"
formatearMes("2026-09")                 // "septiembre de 2026"
```

Las fechas se formatean con `timeZone: "UTC"`, porque `z.coerce.date()` crea `"2026-10-24"` a medianoche UTC.

Textos fijos de la portada (títulos, frases de sección y mensajes de WhatsApp) viven en los componentes, tomados del prototipo:

| Uso | Texto |
| --- | --- |
| Botón de tarjeta | "Quiero conocer a {nombre}" |
| Mensaje al adoptar | "Hola, quiero conocer a {nombre}. La vi en la página de {refugio.nombre}." |
| Mensaje al reservar | "Hola, quiero reservar un lugar para la campaña de esterilización del {fecha}." |
| Mensaje de "Síguenos y escríbenos" y del aviso sin peludos | "Hola, les escribo desde la página de {refugio.nombre}." (el mismo del pie) |
| Aviso sin peludos | "Por ahora no hay peludos en adopción. Escríbenos para saber cuándo llegan nuevos." |
| Sin próxima campaña | "Pronto anunciaremos la próxima campaña." |

## Plan de implementación

1. Cambiar DM Sans a `styles: ['normal']` en `astro.config.mjs`. Comprobar que `astro build` pasa y que `index.html` precarga 2 archivos de fuente.
2. Aplicar los cambios de `src/data/problematicas.json` de la tabla del modelo de datos. Comprobar que `astro build` valida los íconos y las fechas.
3. Crear `src/lib/formato.ts` con `formatearPesos`, `formatearFecha` y `formatearMes`, usando `Intl` con `es-MX` y `timeZone: "UTC"`. `formatearFecha` devuelve el día de la semana sin coma.
4. Agregar a `src/lib/datos.ts` las funciones `peludosDisponibles`, `bloqueQuienesSomos`, `problematicasPublicadas`, `cifraVisible`, `proximaCampana`, `necesidadesVigentes` y `ultimoInforme`.
5. Crear `src/styles/animaciones.css` e importarlo desde `global.css`. Define las clases `latido` (corazón, ~3 s), `flotar` (figuras de la presentación, 7 s), `asomarse` (figuras sobre las bandas, 3.6 s), `huella` (paso del caminito, 5.6 s, retraso por `--k`) y `aparecer` (entrada al desplazar). Todo con `transform` y `opacity`. `aparecer` va dentro de `@supports (animation-timeline: view())` y usa `animation-timeline: view()`. El estado sin animación de cada clase es visible (las huellas quedan a opacidad 0.5).
6. Agregar la clase `latido` al ícono de corazón del botón "Dona" en `src/components/Encabezado.astro`.
7. Crear `src/components/CaminoHuellas.astro` (9 íconos `paw-print` con `--k` de 0 a 8, prop `invertido` que cambia la dirección y `aria-hidden="true"` en el contenedor) y `src/components/FigurasFlotantes.astro` (2 `paw-print`, `bone`, `cat` y `dog` a opacidad 0.12, detrás del contenido).
8. Crear `src/components/portada/Presentacion.astro` con figuras flotantes, nombre, frase, botones "Quiero adoptar" (`house-heart`, a `#adopta`) y "Dona" (`heart` con `latido`, a `/donar`) y la foto principal con `loading="eager"` y `fetchpriority="high"`. Reemplazar el contenido provisional de `src/pages/index.astro` por esta sección.
9. Crear `src/components/TarjetaPeludo.astro`: foto (`fotos[0]` con `<Image>` en proporción 4:3) o ícono `dog`/`cat` sobre fondo suave si no hay foto, nombre, línea "{descripcion_especie}, {edad}, tamaño {tamano}", los 2 rasgos como etiquetas, botón de favorito (`heart`, `aria-pressed="false"`, `aria-label="Guardar a {nombre} como favorito"`, 44 px) y botón "Quiero conocer a {nombre}" que abre WhatsApp en otra pestaña.
10. Crear `src/components/CarruselPeludos.astro` con el marcado estático: región con `aria-roledescription="carrusel"` y `aria-label="Peludos en adopción"`, lista deslizable con `scroll-snap` y `tabindex="0"`, tarjetas de ancho fijo que dejan ver el borde de la siguiente a 360 px, botones "Anterior" y "Siguiente" (`chevron-left` y `chevron-right`) y un punto por peludo con `aria-label="Ver a {nombre}"`.
11. Crear `src/components/portada/Adopciones.astro` con `id="adopta"`, título "Ellos buscan una familia", frase, el carrusel y una figura `cat` con `asomarse`. Sin peludos disponibles muestra el aviso y un botón de WhatsApp en lugar del carrusel. Agregarla a `index.astro`.
12. Agregar el `<script>` del carrusel: flechas y puntos desplazan una tarjeta, las flechas del teclado funcionan con el foco en la lista, el punto activo sigue al desplazamiento con `aria-current="true"` y el desplazamiento es instantáneo con "reducir movimiento".
13. Agregar el avance automático al mismo script: cada 5 s, vuelve al primero después del último, no avanza con la pestaña oculta ni con el carrusel fuera de pantalla (`IntersectionObserver`) y no arranca con "reducir movimiento". Se apaga para siempre en la visita al primer `pointerdown`, `wheel`, `keydown` o `focusin` dentro del carrusel.
14. Agregar el `<script>` de favoritos: lee `favoritos:v1` al cargar y marca los corazones, alterna `aria-pressed` y guarda al tocar, y envuelve todo acceso a `localStorage` en `try/catch` para que el botón siga funcionando sin guardar.
15. Crear `src/components/portada/QuienesSomos.astro`: título y texto del bloque (un párrafo por cada línea en blanco), ubicación del refugio, imágenes del bloque si las hay y las 4 redes como botones secundarios en otra pestaña. Sin bloque publicado, la sección no se muestra.
16. Crear `src/components/portada/Problematicas.astro` con `id="problematica"`, título "Lo que enfrenta un refugio todos los días", frase y una tarjeta por problemática con su ícono, título y texto. Si `cifraVisible` es `true`, muestra "{etiqueta_cifra}: {cifra}" y debajo "Dato de {mes y año de fecha_cifra}. Fuente: {fuente}.". Si hay `enlace`, lo muestra en otra pestaña, precedido de la etiqueta "Contenido sensible" cuando `sensible` es `true`.
17. Crear `src/components/portada/Esterilizacion.astro`: título "Esterilizar salva vidas", el párrafo del prototipo y, si hay próxima campaña, fecha, costo, lugar, horario, cupo (solo si no es `null`), botón "Reservar mi lugar" por WhatsApp y enlace "Más sobre esterilización" a `/esterilizacion`. Sin próxima campaña muestra el texto fijo y el enlace. Lleva una figura `dog` con `asomarse`.
18. Crear `src/components/portada/Donativos.astro`: título "Tu donativo cambia vidas", frase, "Necesidades del mes" con cada necesidad vigente y su etiqueta "Urgente" o "Necesaria", y botón "Ver cómo ayudar" a `/donar`. Sin necesidades vigentes, la lista no se muestra.
19. Crear `src/components/portada/Transparencia.astro`: título "Transparencia", frase, "Informe de {mes}" con Recibido (suma de `ingresos`), Gastado (suma de `gastos`) y "Disponible para el mes siguiente" (la diferencia), y enlace "Ver informe" a `/transparencia`. Sin informe publicado, la sección no se muestra.
20. Crear `src/components/portada/Colaboracion.astro` (ícono `store`, "Come local, ayuda al refugio", texto del prototipo, botón "Ver negocios" a `/colabora` y figura `cat` con `asomarse`) y `src/components/portada/RedesContacto.astro` ("Síguenos y escríbenos", las 4 redes y "Escríbenos por WhatsApp").
21. Ordenar las 9 secciones en `src/pages/index.astro` con un `CaminoHuellas` entre cada par, alternando `invertido`, y la clase `aparecer` en cada sección y en cada tarjeta de problemática.
22. Actualizar `specs/README.md` (estado de la 02 y decisiones pendientes cerradas) y la sección "Project Structure" de `CLAUDE.md` con `src/components/portada/`, `src/styles/animaciones.css` y `src/lib/formato.ts`.

## Criterios de aceptación

- [x] `PUBLIC_MOSTRAR_EJEMPLOS=true astro build` termina sin errores.
- [x] `astro check` termina con 0 errores.
- [x] `/` muestra las 9 secciones en el orden de la spec padre y ningún negocio con nombre propio.
- [x] "Quiero adoptar" lleva a `#adopta` y "Dona" de la presentación lleva a `/donar`.
- [x] El enlace "Lo que enfrenta un refugio" del encabezado lleva a la sección de problemáticas de `/`.
- [x] El carrusel muestra los 6 peludos de ejemplo; al cambiar uno a `estado: "adoptado"` y recompilar, muestra 5 y 5 puntos.
- [x] Con todos los peludos en otro estado, la sección muestra el aviso "Por ahora no hay peludos en adopción…" con su botón de WhatsApp y no hay carrusel.
- [x] Luna y Canelo muestran su foto; Miel y Nube muestran el ícono `cat`; Rocky y Toby el ícono `dog`.
- [x] "Quiero conocer a Luna" abre `https://wa.me/5215500000000?text=` con el mensaje "Hola, quiero conocer a Luna. La vi en la página de Ladridos de Esperanza." en otra pestaña.
- [x] A 360 px, deslizar con el dedo mueve una tarjeta y el punto activo cambia.
- [x] "Siguiente" y "Anterior" mueven una tarjeta; tocar el tercer punto muestra a Miel.
- [x] Con el foco en la lista, las flechas izquierda y derecha del teclado mueven una tarjeta.
- [x] Sin tocar nada, el carrusel avanza solo cada 5 s y vuelve al primero después de Toby.
- [x] Después de tocar, deslizar o enfocar algo dentro del carrusel, ya no avanza solo durante esa visita.
- [x] Con "reducir movimiento" activo (emulado en Playwright), el carrusel no avanza solo y ninguna animación corre.
- [x] Marcar a Luna como favorito pone `aria-pressed="true"`, guarda `["luna"]` en `favoritos:v1` y al recargar sigue marcada.
- [x] Con `localStorage` bloqueado, el botón de favorito alterna sin errores en la consola.
- [x] Las 7 primeras problemáticas muestran su cifra con "Dato de septiembre de 2026. Fuente: Registro del refugio."; "Pocos recursos y pocas manos" muestra solo título y texto.
- [x] "Abandono y maltrato" muestra la etiqueta "Contenido sensible" antes del enlace a la nota, y el enlace abre en otra pestaña.
- [x] Los íconos de las 8 problemáticas son `shield-alert`, `users`, `stethoscope`, `soup`, `house`, `siren`, `hourglass` y `hand-coins`.
- [x] El resumen de esterilización muestra "sábado 24 de octubre", "$380", el lugar, el horario y "20 lugares".
- [x] "Reservar mi lugar" abre WhatsApp con "Hola, quiero reservar un lugar para la campaña de esterilización del sábado 24 de octubre.".
- [x] Cambiar la campaña próxima a `estado: "pasada"` y recompilar muestra "Pronto anunciaremos la próxima campaña." y el enlace.
- [x] El resumen de donativos lista Croquetas (Urgente), Cobijas y Medicinas (Necesaria), en ese orden.
- [x] Cambiar `fecha_vigencia` de Croquetas a una fecha pasada y recompilar la quita de la lista.
- [x] El resumen de transparencia muestra "Informe de septiembre de 2026", Recibido $15,000, Gastado $14,200 y Disponible $800.
- [x] La tarjeta "Come local, ayuda al refugio" lleva a `/colabora`.
- [x] "Síguenos y escríbenos" tiene las 4 redes y el WhatsApp, todos en otra pestaña.
- [x] Hay un caminito de huellas entre cada par de secciones, con dirección alterna.
- [x] El corazón de "Dona" late en el encabezado y en la presentación.
- [x] En Chrome, las secciones aparecen con un desplazamiento suave al entrar en pantalla; en Firefox se ven sin animación y nunca quedan invisibles.
- [x] `animaciones.css` solo anima `transform` y `opacity`, y la página no carga ninguna librería de animación.
- [x] El desplazamiento acumulado del diseño (CLS) medido con `PerformanceObserver` al cargar `/` a 360 px es menor que 0.1.
- [x] A 360 px no hay desplazamiento horizontal de la página.
- [x] Botones del carrusel, puntos, favoritos y botones de las secciones miden al menos 44 px de alto.
- [x] Todas las figuras, huellas e íconos decorativos tienen `aria-hidden="true"`; las flechas, puntos y favoritos tienen etiqueta de texto.
- [x] Recorrer la portada con Tab muestra foco visible en cada control del carrusel y de las secciones.
- [x] `index.html` precarga 2 archivos de fuente y ninguno es cursiva.
- [x] Ninguna página ni componente llama a `getCollection` fuera de `src/lib/datos.ts`.

### Observaciones de la validación

Validado con Playwright el 2026-10-01 a 360 px, sobre la compilación de producción (`astro preview`). Los criterios que piden cambiar datos se probaron con compilaciones temporales, y después se restauraron los archivos con `git checkout`.

- **Aparición al desplazar rota en producción (resuelto).** En `astro dev` funcionaba, pero en la compilación no corría. El minificador juntaba `animation` y `animation-timeline` en `animation: linear both aparecer view()`, y Chrome descarta esa declaración porque el atajo no acepta una línea de tiempo. Se corrigió en `animaciones.css` usando propiedades sueltas (`animation-name`, `animation-timing-function`, `animation-fill-mode`, `animation-timeline`, `animation-range`). Verificado: "Donativos" pasa de opacidad 0.13 a 0.51 y a 1 al entrar, y las 9 secciones quedan visibles en pantalla.
- **Firefox simulado.** El servidor de Playwright solo maneja Chromium. El caso sin soporte se probó en Chrome quitando la regla `@supports (animation-timeline: view())` del CSS cargado: ninguna sección ni tarjeta quedó con opacidad menor que 1. Conviene confirmarlo una vez en un Firefox real.
- **Orden de las necesidades (cambiado durante la implementación).** `getCollection` no respeta el orden del archivo. El criterio se ajustó al desempate por vigencia y descripción (ver Decisiones).
- **Puntos del carrusel de 28 px de ancho.** Miden 44 px de alto, como pide el criterio, pero 28 de ancho: con 6 puntos de 44 × 44 y las flechas, la fila no cabe en una línea dentro de la banda a 360 px.
- **Gestos táctiles.** El deslizamiento y el toque se probaron con eventos táctiles de Chrome (`Input.synthesizeScrollGesture` y `Input.dispatchTouchEvent`), no en un teléfono.
- **Capturas de página completa.** Con la aparición al desplazar, una captura `fullPage` sale casi en blanco, porque no desplaza la página. Para revisar visualmente hay que desplazarse o emular "reducir movimiento".
- **Servidor de desarrollo con datos viejos.** Un `astro dev` que llevaba tiempo corriendo no recogió el cambio de `problematicas.json`, ni siquiera tocando el archivo. Reiniciarlo lo resolvió.

## Decisiones

- **Sí:** las 9 secciones en esta spec, con Esterilización, Donativos y Transparencia como resúmenes. La portada queda completa y la SPEC 03 solo construye páginas.
- **No:** copiar esas 3 secciones completas del prototipo. Duplicaría el contenido de `/esterilizacion` y `/donar`.
- **No:** dejar esas 3 secciones para la SPEC 03. Obligaría a volver a tocar la portada.
- **Sí:** mostrar una cifra solo con cifra, fecha y fuente; sin las tres, la tarjeta queda con título y texto, sin rótulo. Es lo que piden RF-23 y RF-29 y la regla de no publicar huecos.
- **Sí:** completar fecha y fuente en 7 ejemplos y dejar uno incompleto. Con ejemplos activos se ven los dos casos de la tarjeta.
- **No:** mostrar "por confirmar" cuando falta el dato. La spec padre prohíbe publicar textos de relleno. Esto deja sin uso la razón original de `etiqueta_cifra` en la SPEC 01 (rótulo visible sin cifra); el campo sigue siendo el rótulo cuando sí hay dato.
- **Sí:** el aviso "Contenido sensible" lo pone el componente según `enlace.sensible`, no el texto del enlace. Así el refugio no tiene que recordarlo al capturar.
- **Sí:** íconos `shield-alert`, `siren` y `hourglass` en lugar de `triangle-alert`, `heart-pulse` y `clock`. `siren` distingue emergencias de salud general, `hourglass` comunica espera y `shield-alert` es menos alarmista.
- **Sí:** retirar la cursiva de DM Sans. Nada la usa y ahorra una descarga en cada visita.
- **No:** cargar la cursiva sin precargar. Mantener una fuente sin uso no aporta nada; se agrega cuando una spec la necesite.
- **Sí:** el avance automático se apaga para siempre al primer toque, deslizamiento, tecla o foco. Nadie pierde la tarjeta que estaba viendo, y en teléfono no hay un "salir" claro para reanudar.
- **No:** pausar y reanudar como el prototipo.
- **Sí:** aparición al desplazar con `animation-timeline: view()` dentro de `@supports`. Es CSS puro, como pide RF-31, y si el navegador no lo soporta el contenido se ve sin animación.
- **No:** `IntersectionObserver` para la aparición. El contenido arranca oculto y depende de un script.
- **Sí:** `IntersectionObserver` para saber si el carrusel está en pantalla. Es comportamiento del carrusel, no animación decorativa.
- **Sí:** el favorito solo marca el corazón y se guarda en `favoritos:v1`. RF-30 pide "solo en el dispositivo" y el orden del carrusel lo decide el refugio.
- **No:** poner los favoritos primero en el carrusel.
- **Sí:** necesidades ordenadas por urgencia, luego por vigencia más próxima y luego por descripción, decidido durante la implementación. La colección no tiene `orden` y `getCollection` no respeta el orden del archivo, así que el orden de captura no sirve como desempate.
- **No:** agregar `orden` a `necesidades`. Cambiaría el esquema por un detalle de presentación.
- **Sí:** clave versionada `favoritos:v1`. Permite cambiar el formato después sin leer datos viejos mal.
- **Sí:** con 0 peludos disponibles la sección se queda con un aviso y WhatsApp. "Quiero adoptar" siempre tiene a dónde llevar.
- **Sí:** línea de la tarjeta "{descripcion_especie}, {edad}, tamaño {tamano}". "Tamaño mediano" se lee bien para perritas y perros, y respeta el enum en masculino de la SPEC 01.
- **Sí:** una sección por archivo en `src/components/portada/`, y piezas reutilizables (`CarruselPeludos`, `TarjetaPeludo`, `CaminoHuellas`, `FigurasFlotantes`) en `src/components/`. La SPEC 03 puede reutilizar el carrusel sin moverlo.
- **No:** todas las secciones dentro de `index.astro`. Quedaría un archivo de cientos de líneas.
- **Sí:** consultas de la portada (`peludosDisponibles`, `proximaCampana`, …) en `src/lib/datos.ts`. Mantiene la regla de que solo ese archivo lee colecciones, y la SPEC 03 las reutiliza.
- **Sí:** textos fijos de sección y mensajes de WhatsApp dentro de los componentes. Lo editable por el refugio ya vive en las colecciones; los demás textos se moverán a datos si el panel lo necesita.
- **Sí:** el corazón late en el encabezado y en la presentación. RF-31 pide el latido en "Dona", y el del encabezado está en todas las páginas.
- **Sí:** figuras como el prototipo: 5 flotando en la presentación, 3 que se asoman y caminito de 9 huellas entre secciones. Son pocas a la vez en pantalla y ninguna pasa sobre el texto.
- **Sí:** figuras con los íconos de Lucide en trazo, sin relleno. RF-32 pide un solo juego con el mismo grosor.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `"2026-10-24"` se lee como medianoche UTC y en México se formatea como el 23 de octubre | `src/lib/formato.ts` usa `timeZone: "UTC"`. El criterio de aceptación revisa "sábado 24 de octubre". |
| Una necesidad vencida o una campaña pasada siguen visibles hasta la siguiente compilación | Se filtran con la fecha de compilación. La SPEC 06 define cómo se recompila el sitio cuando cambia un dato; anotar ahí que también debe recompilar a diario. |
| Firefox no soporta `animation-timeline: view()` | La regla vive dentro de `@supports`; sin soporte, el contenido se ve sin animación. |
| El punto activo no coincide con la tarjeta visible en anchos donde caben dos tarjetas | El índice se calcula con el `offsetLeft` de las tarjetas, como en el prototipo, y la última tarjeta se marca al llegar al final. Probar a 360 px y a 1024 px. |
| `localStorage` bloqueado o lleno | Todo acceso va en `try/catch`; el favorito funciona sin guardar. |
| El avance automático distrae a lectores de pantalla | Se apaga con el primer foco dentro del carrusel y no arranca con "reducir movimiento". |
| Las fotos del prototipo se ven borrosas en el carrusel y en la presentación | Ya está anotado en "Antes de publicar" del README: pedir al refugio las fotos originales. |

## Lo que **no** entra en esta spec

- Páginas `/adopta`, `/esterilizacion`, `/donar` y `/transparencia`, con cartel ampliable, preguntas frecuentes, formas de ayudar y tabla de equivalencias (SPEC 03).
- Catálogo `/colabora` (SPEC 04).
- Recompilación automática por fechas (SPEC 06).
- Edición desde el panel y registro mensual de cifras (SPEC 07).
- Medición de clics de WhatsApp (SPEC 08).
- Favoritos sincronizados, ordenados o enviados al refugio.
- Redes en el encabezado.

Cada una de estas, si llega, va en su propia spec.
