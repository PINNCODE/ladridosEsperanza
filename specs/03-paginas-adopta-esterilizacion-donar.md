# SPEC 03 — Páginas del refugio: adopta, esterilización y donar

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-01
> **Objetivo:** Crear las páginas `/adopta`, `/esterilizacion` y `/donar` con sus datos, y retirar del sitio Transparencia y todo monto de dinero recibido por el refugio.

## Por qué existe esta spec

El índice asigna a esta spec RF-11, RF-12, RF-24, RF-25, RF-26 y RF-19, con 4 páginas.
Durante la definición se decidió que el sitio no muestra cuánto dinero recibe el refugio, ni de personas ni de negocios.
Por eso `/transparencia` no se crea, la sección Transparencia sale de la portada y la colección `informes_transparencia` se elimina.
RF-19 queda fuera del MVP; si vuelve, entra con su propia spec.
Esta spec también cierra la decisión pendiente del README: `/adopta` usa una cuadrícula, no el carrusel.

## Alcance

**Dentro:**

- Página `/adopta` con todos los peludos disponibles en cuadrícula, favoritos, contacto por WhatsApp y "Cómo es el proceso de adopción" (RF-11).
- Página `/esterilizacion` con por qué esterilizar, ficha de la próxima campaña, fecha de la última, cartel ampliable, preparación y cuidados, preguntas frecuentes y "Reservar mi lugar" (RF-12, RF-24).
- Página `/donar` con 6 formas de ayudar, "Necesidades del mes" y "En qué se usa un donativo" (RF-25, RF-26).
- Botones de WhatsApp "Pedir datos para donar", "Quiero apadrinar" y "Quiero ser voluntario", y aviso del canal oficial para donar.
- Textos por confirmar con el refugio o su veterinario como registros de `bloques_contenido`, con ejemplos marcados `es_ejemplo`.
- Enlace "Ver a todos" de la sección de adopciones de la portada a `/adopta`.
- Retiro de la sección Transparencia de la portada, que queda con 8 secciones.
- Eliminación de la colección `informes_transparencia`, su archivo JSON, el tipo `Informe` y `ultimoInforme`.
- Componentes compartidos `EncabezadoPagina`, `VisorCartel` y `ListaNecesidades`.

**Fuera de alcance (specs futuras):**

- Página `/transparencia` y RF-19. Salen del MVP por decisión del refugio.
- Mostrar montos recibidos, gastados, disponibles o entregados por negocios en cualquier página.
- Filtro por especie en `/adopta`.
- Página propia por peludo o carrusel de varias fotos.
- "Apadrinar a {nombre}" en cada tarjeta de peludo.
- Fotos y resultados de campañas pasadas.
- Publicar datos bancarios (requiere aprobación escrita del refugio, RF-25).
- Catálogo `/colabora` (SPEC 04). Los enlaces "Ver negocios" muestran el 404 hasta entonces.
- Editar bloques, necesidades y campañas desde el panel (SPEC 07).
- Medir clics de WhatsApp (SPEC 08).
- Editar `referencias/spec-ladridos-de-esperanza.md`. El cambio de alcance se registra en el README de specs.

## Modelo de datos

Esta spec no agrega colecciones ni cambia los esquemas que quedan. Elimina una colección y agrega registros de ejemplo.

### Colección eliminada

`informes_transparencia` sale de `src/content.config.ts` y de `collections`. Se borra `src/data/informes-transparencia.json`. Quedan 12 colecciones.

`registros_cifras` no cambia: es el registro interno del refugio (RF-29) y ninguna página muestra sus gastos.

### Bloques nuevos en `src/data/bloques-contenido.json`

Todos con `publicado: true`, `imagenes: []` y `es_ejemplo: true`. El `texto` separa párrafos con una línea en blanco, como "Quiénes somos".

| id | `seccion` | `orden` | `titulo` | `texto` (párrafos) |
| --- | --- | --- | --- | --- |
| `proceso-adopcion` | `proceso_adopcion` | 1 | "Cómo es el proceso de adopción" | "Escríbenos por WhatsApp con el nombre del peludo que te interesa." / "Te contamos su historia y agendamos una visita al refugio." / "Si es buena pareja para tu familia, firmamos juntos una carta de adopción responsable." |
| `por-que-esterilizar` | `esterilizacion_por_que` | 1 | "Por qué esterilizar" | "Menos animales nacen sin un hogar que los espere." / "Se cuida la salud de tu mascota." / "Ayudas a toda la comunidad." |
| `antes-de-la-cirugia` | `esterilizacion_cuidados` | 1 | "Antes de la cirugía" | "Texto de ejemplo. El veterinario del refugio indicará cuántas horas de ayuno necesita tu mascota y qué llevar el día de la campaña." |
| `despues-de-la-cirugia` | `esterilizacion_cuidados` | 2 | "Después de la cirugía" | "Texto de ejemplo. El veterinario del refugio indicará los cuidados de la herida y cuándo puede volver a comer y jugar." |
| `pregunta-edad` | `esterilizacion_preguntas` | 1 | "¿Desde qué edad se puede esterilizar?" | "Respuesta de ejemplo. La confirma el veterinario del refugio." |
| `pregunta-recuperacion` | `esterilizacion_preguntas` | 2 | "¿Cuánto tarda en recuperarse?" | "Respuesta de ejemplo. La confirma el veterinario del refugio." |
| `pregunta-reservar` | `esterilizacion_preguntas` | 3 | "¿Necesito reservar mi lugar?" | "Sí. Los lugares son limitados y se apartan con el pago. Escríbenos por WhatsApp para reservar." |
| `voluntariado` | `voluntariado` | 1 | "Voluntariado y hogar temporal" | "Mayores de 18 años, un sábado al mes." |

En `esterilizacion_preguntas`, `titulo` es la pregunta y `texto` la respuesta.
Una sección sin bloques publicados no se muestra en su página.

### Funciones en `src/lib/datos.ts`

Se eliminan el tipo `Informe` y `ultimoInforme`. Se agregan (todas pasan por `obtener`):

```ts
export type Destino = CollectionEntry<'destinos_donativo'>;

export function bloquesDeSeccion(seccion: string): Promise<Bloque[]>; // publicados, por `orden`
export function campanaAnterior(): Promise<Campana | null>;         // estado "pasada", la `fecha` más reciente
export function destinosDonativo(): Promise<Destino[]>;             // por `orden`
```

`bloqueQuienesSomos` pasa a devolver el primero de `bloquesDeSeccion('quienes_somos')`.

### Función en `src/lib/formato.ts`

```ts
parrafos("Uno.\n\nDos.") // ["Uno.", "Dos."]; separa por línea en blanco y descarta vacíos
```

`QuienesSomos.astro` pasa a usarla en lugar de su `split` propio.

### Textos fijos

| Uso | Texto |
| --- | --- |
| Título de pestaña | "{título de la página} · {refugio.nombre}" |
| `/adopta`, título y frase | "Adopta a un peludo" · "Conócelos y escríbenos para saber su historia y cómo es el proceso de adopción." |
| `/esterilizacion`, título y frase | "Campañas de esterilización" · el párrafo "La esterilización es una de las formas más efectivas…" de la portada |
| `/donar`, título y frase | "Dona al refugio" · el párrafo "Cuidar animales cuesta todos los días…" de la portada |
| Contacto de `/adopta` | "¿Tienes dudas? Escríbenos." con botón "Escríbenos por WhatsApp" y el mensaje general del pie |
| Última campaña | "Última campaña: {fecha}" |
| Leyenda del cartel anterior | "Cartel de la campaña anterior" |
| Texto alterno del cartel | "Cartel de la campaña de esterilización del {fecha de esa campaña}" |
| Mensaje al reservar | El de la SPEC 02: "Hola, quiero reservar un lugar para la campaña de esterilización del {fecha}." |
| Mensaje "Pedir datos para donar" | "Hola, quiero los datos para donar a {refugio.nombre}." |
| Mensaje "Quiero apadrinar" | "Hola, quiero apadrinar a un peludo de {refugio.nombre}." |
| Mensaje "Quiero ser voluntario" | "Hola, quiero ser voluntario o dar hogar temporal en {refugio.nombre}." |
| Aviso de canal oficial | "El único canal oficial para donar es el WhatsApp del refugio. No publicamos cuentas bancarias en esta página." |

Formas de ayudar de `/donar`, en este orden:

| Tarjeta | Ícono | Texto | Contenido extra |
| --- | --- | --- | --- |
| Transferencia o depósito | `landmark` | "Pide los datos oficiales por WhatsApp para donar con seguridad." | Botón "Pedir datos para donar" y aviso de canal oficial |
| Donar en especie | `package` | "Croquetas, medicinas, cobijas y artículos de limpieza. Mira lo que hace falta este mes." | `ListaNecesidades` |
| Apadrina a un peludo | `hand-heart` | "Con un aporte cada mes ayudas a cubrir la comida y la atención de un peludo mientras encuentra familia. Escríbenos y te contamos cómo funciona." | Botón "Quiero apadrinar" |
| Voluntariado y hogar temporal | `users` | "Tu tiempo y tu casa también salvan vidas." | Párrafos del bloque `voluntariado` (si hay) y botón "Quiero ser voluntario" |
| Comparte | `share-2` | "Compartir las publicaciones del refugio ayuda a que más personas adopten y donen." | Las 4 redes en otra pestaña |
| Come en negocios que ayudan | `store` | "Negocios locales aportan al refugio cuando publican su menú con nosotros." | Botón "Ver negocios" a `/colabora` |

## Plan de implementación

1. Retirar Transparencia: borrar `src/components/portada/Transparencia.astro` y quitarla de `src/pages/index.astro`, que queda con 8 secciones y 7 `CaminoHuellas` alternando `invertido`. Quitar `Informe` y `ultimoInforme` de `src/lib/datos.ts`, la colección de `src/content.config.ts` y borrar `src/data/informes-transparencia.json`. Comprobar que `astro build` y `astro check` pasan.
2. Agregar los 8 bloques de la tabla del modelo de datos a `src/data/bloques-contenido.json`. Comprobar que `astro build` los valida.
3. Agregar `parrafos` a `src/lib/formato.ts` y usarla en `QuienesSomos.astro`. Agregar `bloquesDeSeccion`, `campanaAnterior`, `destinosDonativo` y el tipo `Destino` a `src/lib/datos.ts`, y hacer que `bloqueQuienesSomos` use `bloquesDeSeccion`. Comprobar que "Quiénes somos" se ve igual en `/`.
4. Crear `src/components/EncabezadoPagina.astro` con props `titulo`, `frase` e `icono`: ícono en fondo suave, `<h1>` y frase.
5. Crear `src/components/adopta/CuadriculaPeludos.astro`: lista de `TarjetaPeludo` en 1 columna a 360 px, 2 desde `sm` y 3 desde `lg`. Sin peludos disponibles muestra el aviso y el botón de WhatsApp de la SPEC 02. El script de favoritos ya viene con `TarjetaPeludo`.
6. Crear `src/components/adopta/ProcesoAdopcion.astro`: título del bloque `proceso_adopcion` y un paso numerado (`<ol>`) por párrafo. Sin bloque, no se muestra.
7. Crear `src/pages/adopta.astro`: `EncabezadoPagina` (`house-heart`), cuadrícula, proceso y contacto. Corregir el comentario de `TarjetaPeludo.astro` que dice que el carrusel activa los favoritos.
8. Agregar a `src/components/portada/Adopciones.astro` el enlace "Ver a todos" a `/adopta` debajo del carrusel, solo cuando hay peludos disponibles.
9. Crear `src/components/VisorCartel.astro` con props `cartel`, `alt` y `leyenda` (opcional): miniatura con `<Image>` de 480 px, leyenda si la hay, botón "Ver cartel" y `<dialog>` con la imagen a 1200 px, `loading="lazy"`, y botón "Cerrar" (ícono `x`, `aria-label="Cerrar"`, 44 px).
10. Agregar el `<script>` de `VisorCartel`: "Ver cartel" llama a `showModal()`, "Cerrar" y un clic fuera de la imagen (`event.target === dialog`) llaman a `close()`. Esc y el regreso del foco a "Ver cartel" los da el `<dialog>` nativo.
11. Crear `src/components/esterilizacion/PorQueEsterilizar.astro` (bloque `esterilizacion_por_que`, un `<li>` por párrafo) y `src/components/esterilizacion/FichaCampana.astro`. La ficha muestra fecha, costo, lugar, horario y cupo (si no es `null`) de `proximaCampana(new Date())`, la `forma_pago` como párrafo, "Reservar mi lugar" por WhatsApp y "Última campaña: {fecha}" si hay `campanaAnterior()`. Sin próxima campaña muestra "Pronto anunciaremos la próxima campaña." y la línea de la última.
12. Agregar a `FichaCampana` el `VisorCartel`: usa el cartel de la próxima campaña; si no tiene, el de la anterior con la leyenda "Cartel de la campaña anterior"; si ninguna tiene, no se muestra.
13. Crear `src/components/esterilizacion/CuidadosCirugia.astro` (título "Antes y después de la cirugía" y una tarjeta por bloque de `esterilizacion_cuidados`) y `src/components/esterilizacion/PreguntasFrecuentes.astro` (título "Preguntas frecuentes" y un `<details>` cerrado por bloque de `esterilizacion_preguntas`, con la pregunta en `<summary>` de 44 px de alto). Cada uno se oculta sin bloques.
14. Crear `src/pages/esterilizacion.astro`: `EncabezadoPagina` (`syringe`), por qué esterilizar, ficha, cuidados y preguntas frecuentes.
15. Crear `src/components/ListaNecesidades.astro` con la lista y las etiquetas "Urgente" y "Necesaria" de `Donativos.astro`, y usarla en la portada. Comprobar que el resumen de donativos de `/` se ve igual.
16. Crear `src/components/donar/FormasDeAyudar.astro` con las 6 tarjetas de la tabla del modelo de datos, en 1 columna a 360 px y 2 desde `md`. Los botones de WhatsApp abren en otra pestaña. Sin necesidades vigentes, "Donar en especie" queda con su texto.
17. Crear `src/components/donar/EnQueSeUsa.astro`: título "En qué se usa un donativo" y una fila por destino con `destino`, `cubre` y "{formatearPesos(monto)} = {equivalencia}". Sin destinos, no se muestra.
18. Crear `src/pages/donar.astro`: `EncabezadoPagina` (`heart`), formas de ayudar y en qué se usa.
19. Actualizar `specs/README.md`: fila 03 con el nuevo título, estado y RF (sin RF-19); nueva decisión general "No se publica ningún monto de dinero recibido por el refugio, de personas ni de negocios; `/transparencia` y RF-19 salen del MVP"; cerrar la pendiente de la 03; y en "Antes de publicar", confirmar con el refugio el apadrinamiento y el voluntariado. Actualizar "Project Structure" de `CLAUDE.md`: portada de 8 secciones sin `Transparencia`, páginas nuevas, carpetas `adopta/`, `esterilizacion/` y `donar/`, componentes compartidos y la línea de `[WARN]` sin cambios.

## Criterios de aceptación

- [x] `PUBLIC_MOSTRAR_EJEMPLOS=true astro build` termina sin errores y genera `adopta/index.html`, `esterilizacion/index.html` y `donar/index.html`.
- [x] `astro check` termina con 0 errores.
- [x] `/transparencia` muestra el 404.
- [x] `/` muestra 8 secciones, sin Transparencia, con un caminito de huellas entre cada par.
- [x] Ninguna página del sitio compilado contiene "Recibido", "Gastado", "Disponible para el mes siguiente" ni "Informe de".
- [x] `src/content.config.ts` tiene 12 colecciones y no existe `src/data/informes-transparencia.json`.
- [x] `/adopta` muestra los 6 peludos de ejemplo en 1 columna a 360 px y en 3 columnas a 1280 px.
- [x] Al cambiar un peludo a `estado: "en_proceso"` y recompilar, `/adopta` muestra 5.
- [x] Con todos los peludos en otro estado, `/adopta` muestra el aviso "Por ahora no hay peludos en adopción…" con su botón de WhatsApp.
- [x] "Quiero conocer a Rocky" en `/adopta` abre WhatsApp con "Hola, quiero conocer a Rocky. La vi en la página de Ladridos de Esperanza." en otra pestaña.
- [x] Marcar a Luna como favorita en `/adopta` la deja marcada en el carrusel de `/` y viceversa.
- [x] `/adopta` muestra "Cómo es el proceso de adopción" con 3 pasos numerados; con el bloque en `publicado: false` y recompilando, la sección no aparece.
- [x] La sección de adopciones de `/` tiene el enlace "Ver a todos" que lleva a `/adopta`.
- [x] `/esterilizacion` muestra la próxima campaña con "sábado 24 de octubre", "$380", el lugar, el horario, "20 lugares" y la forma de pago.
- [x] `/esterilizacion` muestra "Última campaña: sábado 26 de septiembre".
- [x] "Reservar mi lugar" en `/esterilizacion` abre WhatsApp con "Hola, quiero reservar un lugar para la campaña de esterilización del sábado 24 de octubre.".
- [x] Cambiar la fecha de la próxima campaña a `"2026-10-31"` y recompilar muestra "sábado 31 de octubre" en `/` y en `/esterilizacion`.
- [x] Con la próxima campaña en `estado: "pasada"` y recompilando, `/esterilizacion` muestra "Pronto anunciaremos la próxima campaña." y la línea de la última campaña.
- [x] El cartel muestra la leyenda "Cartel de la campaña anterior", porque la próxima campaña de ejemplo no tiene cartel.
- [x] "Ver cartel" abre el cartel grande; Esc, "Cerrar" y un clic fuera de la imagen lo cierran, y el foco vuelve a "Ver cartel".
- [x] El cartel tiene el texto alterno "Cartel de la campaña de esterilización del sábado 26 de septiembre".
- [x] La imagen grande del cartel no se descarga hasta abrir el visor.
- [x] `/esterilizacion` muestra "Por qué esterilizar" con 3 puntos, "Antes y después de la cirugía" con 2 tarjetas y "Preguntas frecuentes" con 3 preguntas cerradas.
- [x] Una pregunta frecuente se abre y se cierra con clic y con Enter.
- [x] `/donar` muestra las 6 formas de ayudar en el orden de la tabla del modelo de datos.
- [x] "Pedir datos para donar" abre WhatsApp con "Hola, quiero los datos para donar a Ladridos de Esperanza." en otra pestaña.
- [x] "Quiero apadrinar" abre WhatsApp con "Hola, quiero apadrinar a un peludo de Ladridos de Esperanza.".
- [x] "Quiero ser voluntario" abre WhatsApp con "Hola, quiero ser voluntario o dar hogar temporal en Ladridos de Esperanza.".
- [x] El aviso "El único canal oficial para donar es el WhatsApp del refugio…" aparece junto a "Pedir datos para donar".
- [x] `/donar` no contiene ningún número de cuenta, CLABE ni número de tarjeta.
- [x] "Donar en especie" lista Croquetas (Urgente), Cobijas y Medicinas (Necesaria), en ese orden; con Croquetas vencida y recompilando, desaparece de `/donar` y de `/`.
- [x] "Voluntariado y hogar temporal" muestra "Mayores de 18 años, un sábado al mes."; con el bloque en `publicado: false` y recompilando, muestra solo su texto y el botón.
- [x] "Comparte" tiene las 4 redes en otra pestaña y "Ver negocios" lleva a `/colabora`.
- [x] "En qué se usa un donativo" muestra 5 filas, la primera "Alimento", "Comida diaria de los animales" y "$200 = un día de comida para 10 perros".
- [x] El encabezado marca con `aria-current="page"` el enlace de la página abierta en `/adopta`, `/esterilizacion` y `/donar`.
- [x] Cada página tiene un solo `<h1>` y su pestaña dice "{título} · Ladridos de Esperanza".
- [x] A 360 px no hay desplazamiento horizontal en `/adopta`, `/esterilizacion` ni `/donar`.
- [x] Botones, enlaces de acción y preguntas frecuentes miden al menos 44 px de alto.
- [x] Los íconos decorativos tienen `aria-hidden="true"` y el botón "Cerrar" del visor tiene etiqueta de texto.
- [x] Recorrer cada página con Tab muestra foco visible en cada control.
- [x] Con "reducir movimiento" activo (emulado en Playwright), ninguna animación corre en las 3 páginas.
- [x] Ninguna página ni componente llama a `getCollection` fuera de `src/lib/datos.ts`.

### Observaciones de la validación

Validado con Playwright el 2026-10-01 a 360 px (y a 1280 px para la cuadrícula), sobre la compilación de producción (`astro preview`). Los criterios que piden cambiar datos se probaron con dos compilaciones temporales, y después se restauraron los archivos desde un respaldo.

- **Compilación temporal A:** Luna en `en_proceso`, próxima campaña al `2026-10-31`, Croquetas vencida y los bloques `proceso-adopcion` y `voluntariado` sin publicar. `/adopta` mostró 5 peludos y ninguna sección de proceso. `/` y `/esterilizacion` mostraron "sábado 31 de octubre". Croquetas desapareció de `/donar` y de `/`, y "Voluntariado y hogar temporal" quedó con su texto y el botón.
- **Compilación temporal B:** todos los peludos `adoptado` y la próxima campaña `pasada`. `/adopta` mostró el aviso con su botón de WhatsApp. `/esterilizacion` mostró "Pronto anunciaremos la próxima campaña." y "Última campaña: sábado 24 de octubre", sin "Reservar mi lugar".
- **Cartel con dos campañas pasadas.** En la compilación B, la campaña anterior pasó a ser la del 24 de octubre, que no tiene cartel. Por eso no se mostró ningún cartel, aunque la del 26 de septiembre sí tiene uno. Es lo que dice el paso 12 (próxima o anterior), no un error, pero el cartel viejo deja de verse en cuanto se marca como pasada una campaña sin cartel.
- **Reducir movimiento.** Con "reducir movimiento" emulado, `document.getAnimations()` no devolvió ninguna animación en curso en las 3 páginas. Sin la emulación sí había una (el corazón del encabezado), así que la prueba distingue los dos casos.
- **Foco visible.** Se enfocó cada enlace, botón y pregunta de las 3 páginas y se revisó su contorno calculado. Todos lo muestran.
- **Visor del cartel.** La imagen de 1200 px no se descarga hasta abrir el visor. Esc, "Cerrar" y un clic en el fondo lo cierran; un clic en la imagen, no. El foco vuelve a "Ver cartel".
- **Servidor de desarrollo con datos viejos.** Como en la SPEC 02, un `astro dev` que llevaba una hora corriendo no mostraba los bloques nuevos. Hubo que reiniciarlo. La validación se hizo sobre `astro preview`.

## Decisiones

- **Sí:** no publicar ningún monto de dinero recibido por el refugio, de personas ni de negocios. Lo pidió el usuario durante la definición.
- **Sí:** quitar Transparencia del todo: sin `/transparencia`, sin sección en la portada y RF-19 fuera del MVP.
- **No:** una `/transparencia` solo con gastos o solo con texto. Sin lo recibido, un informe de gastos se lee incompleto.
- **Sí:** eliminar la colección `informes_transparencia` completa. Sin ninguna página que la lea, solo agrega una tabla más a la SPEC 06; si vuelve, entra con su spec.
- **No:** conservarla sin el campo `ingresos`.
- **Sí:** seguir mostrando "En qué se usa un donativo" con montos. Son equivalencias de lo que cubre un aporte, no dinero recibido.
- **Sí:** tocar la portada en esta spec, aunque la SPEC 02 dijo que la 03 no lo haría. Quitar Transparencia lo obliga, y se aprovecha para el enlace "Ver a todos".
- **Sí:** registrar el cambio de alcance en `specs/README.md` y no editar la spec padre en `referencias/`. La spec padre queda como referencia original.
- **Sí:** cuadrícula en `/adopta`. La página es para ver a todos de un vistazo y el carrusel ya vive en la portada.
- **No:** reutilizar `CarruselPeludos`. Repetiría la portada y escondería peludos tras las flechas.
- **No:** filtro por especie. Con pocos peludos no hace falta y agrega estados vacíos.
- **Sí:** favoritos compartidos entre `/adopta` y la portada con la misma clave `favoritos:v1`. El script ya vive en `TarjetaPeludo`.
- **Sí:** textos por confirmar (proceso, por qué esterilizar, cuidados, preguntas, voluntariado) en `bloques_contenido`. No cambia el esquema, se ocultan sin bloque publicado y el panel de la SPEC 07 ya los podrá editar.
- **No:** colección nueva `preguntas_frecuentes`. `titulo` y `texto` bastan para pregunta y respuesta.
- **No:** dejarlos fijos en los componentes. El refugio no podría corregirlos ni ocultarlos mientras no estén confirmados.
- **Sí:** respuestas de ejemplo que dicen "Texto de ejemplo" o "Respuesta de ejemplo". No se inventa información veterinaria, y `es_ejemplo` impide que salgan en el sitio real.
- **Sí:** "Por qué esterilizar" como bloque y no como texto fijo. La spec padre pide que lo revise el veterinario del refugio.
- **Sí:** cartel de la próxima campaña o, si no tiene, el de la anterior con leyenda. Con los datos de ejemplo se ve el visor, y nunca se presenta un cartel viejo como si fuera el nuevo.
- **Sí:** visor con `<dialog>` nativo y `showModal()`. Da Esc, foco atrapado y regreso del foco sin librerías.
- **No:** enlazar la imagen en otra pestaña. Saca a la persona del sitio.
- **Sí:** ficha de la próxima campaña y una línea con la fecha de la última, como el prototipo y RF-12.
- **No:** ficha completa de la campaña pasada. Distrae de la próxima.
- **Sí:** preguntas frecuentes con `<details>` y `<summary>`. Funcionan sin script y con teclado.
- **Sí:** las 6 formas de ayudar, con Apadrinar como tarjeta y botón de WhatsApp. El refugio explica las condiciones por mensaje, sin montos en la página.
- **No:** "Apadrinar a {nombre}" en cada tarjeta. Satura la tarjeta y toca `TarjetaPeludo`.
- **Sí:** botón propio para voluntariado y requisitos desde el bloque `voluntariado`. Los requisitos del prototipo son de ejemplo.
- **Sí:** mensajes de WhatsApp y textos de tarjetas fijos en los componentes. Igual que en la SPEC 02, lo editable por el refugio vive en las colecciones.
- **Sí:** una carpeta por página (`src/components/adopta/`, `esterilizacion/`, `donar/`) y piezas compartidas en `src/components/`. Sigue el patrón de `portada/`.
- **Sí:** `ListaNecesidades` compartida entre la portada y `/donar`. Las etiquetas y el orden no pueden quedar distintos.
- **Sí:** `parrafos` en `src/lib/formato.ts`. "Quiénes somos" y los 5 tipos de bloque nuevos parten el texto igual.
- **Sí:** `campanaAnterior` por `estado: "pasada"` y no por fecha. El refugio marca cuándo una campaña terminó.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Sin Transparencia, el sitio pierde una señal de confianza que la spec padre consideraba central | Decisión del usuario. El aviso de canal oficial queda en `/donar` y el cambio se registra en el README. |
| Apadrinar y voluntariado se publican sin que el refugio confirme cómo funcionan | El README los agrega a "Antes de publicar". Los requisitos de voluntariado son un bloque de ejemplo que no sale al sitio real. |
| Un cartel de baja resolución se ve borroso al ampliarlo | `<Image>` no agranda el original. Ya está anotado en "Antes de publicar" pedir los archivos originales. |
| Una campaña pasada sigue marcada como `proxima` y la página la muestra como próxima | `proximaCampana` ya filtra por fecha de compilación. La recompilación diaria se define en la SPEC 06. |
| El clic fuera del visor cierra el diálogo al tocar el borde de la imagen | Se cierra solo cuando `event.target` es el propio `<dialog>`, no la imagen ni el botón. |
| Quitar Transparencia rompe criterios ya marcados de la SPEC 02 (9 secciones, informe de septiembre) | Esta spec los reemplaza; el README indica que la portada queda con 8 secciones. |

## Lo que **no** entra en esta spec

- Página `/transparencia`, RF-19 y cualquier monto de dinero recibido.
- Filtro por especie, página por peludo y apadrinamiento por peludo.
- Fotos y resultados de campañas pasadas.
- Datos bancarios publicados.
- Catálogo `/colabora` (SPEC 04).
- Edición desde el panel (SPEC 07).
- Medición de clics de WhatsApp (SPEC 08).
- Cambios a la spec padre en `referencias/`.

Cada una de estas, si llega, va en su propia spec.
