# SPEC 01 — Fundación del sitio y datos de ejemplo

> **Estado:** Implementado
> **Depende de:** ninguna (parte de `referencias/spec-ladridos-de-esperanza.md`)
> **Fecha:** 2026-10-01
> **Objetivo:** Dejar el scaffold de Astro listo para construir el sitio, con estilos, fuentes, íconos, layout común y todas las colecciones de contenido cargadas con los datos de ejemplo del prototipo.

## Por qué existe esta spec

La spec padre describe 9 rutas, un panel y una base de datos en Supabase. Construir todo a la vez es inviable para una sola persona.
Esta spec arma la base que comparten todas las páginas: tokens de diseño, layout, encabezado, pie y datos.
Los datos se definen completos desde ahora para que un esquema mal pensado falle en `astro build` antes de construir páginas encima.
Las páginas reales llegan en las specs 02 a 05 (ver `specs/README.md`).

## Alcance

**Dentro:**

- Tailwind CSS v4 con los tokens de color de la spec padre como variables de tema, solo modo claro.
- Bricolage Grotesque (títulos) y DM Sans (texto) servidas con la API de fuentes de Astro desde el propio dominio.
- Íconos de Lucide con `@lucide/astro`, mismo grosor de trazo y `aria-hidden` en los decorativos (RF-32, parte de base).
- `Layout.astro` con `lang="es-MX"`, título y descripción por página, encabezado, pie y cinta "Datos de ejemplo".
- Encabezado con logo, nombre, navegación deslizable y botón "Dona" siempre visible.
- Pie con enlaces de texto a las cuatro redes y al WhatsApp del refugio, en otra pestaña (RF-27, parte del pie).
- Página `404.astro` con el diseño del sitio.
- Portada provisional en `/` que muestra el nombre y la frase del refugio leídos de los datos.
- Las 13 colecciones de contenido de la sección "Modelo de datos", con esquema Zod y datos de ejemplo tomados del prototipo.
- Las 5 imágenes JPEG incrustadas en el prototipo, extraídas a `src/assets/`.
- Filtro de registros `es_ejemplo` controlado por la variable `PUBLIC_MOSTRAR_EJEMPLOS`.
- Utilidad para armar enlaces de WhatsApp con mensaje prellenado.
- Base de accesibilidad: foco visible y bloque global para "reducir movimiento".
- `astro check` sin errores.
- Retiro del contenido de bienvenida del scaffold (`Welcome.astro`, `astro.svg`, `background.svg`).

**Fuera de alcance (specs futuras):**

- Secciones de la portada, carrusel y animaciones (SPEC 02).
- Páginas `/adopta`, `/esterilizacion`, `/donar` y `/transparencia` (SPEC 03). Sus enlaces existen, pero muestran el 404 hasta entonces.
- Catálogo `/colabora` y página de negocio (SPEC 04 y 05).
- Supabase, formulario Súmate, panel `/admin`, anuncios, analítica y SEO (SPEC 06 a 08).
- Solicitudes de negocio y usuarios del panel: no son contenido publicado y van directo a Supabase (SPEC 06 y 07).
- La calculadora "¿Cuánto podría aportar al refugio?" del prototipo: se descartó del sitio.
- Animación del corazón en "Dona" (RF-31, SPEC 02).
- Redes en el encabezado (ver Decisiones).

## Modelo de datos

Todas las colecciones viven en `src/content.config.ts` y sus archivos en `src/data/`.
Los campos van en español y `snake_case`, para que coincidan con las columnas de Postgres en la SPEC 06.
Todo registro lleva `es_ejemplo: boolean`.
Las fechas van como texto ISO (`"2026-10-24"`) y se validan con `z.coerce.date()`.
Las horas van como `"HH:MM"` en 24 horas.
Los montos van en pesos mexicanos como número, sin símbolo.

| Colección | Archivo | Loader | Registros de ejemplo |
| --- | --- | --- | --- |
| `refugio` | `src/data/refugio.json` | `file()` | 1 (id `refugio`) |
| `redes` | `src/data/redes.json` | `file()` | 4 |
| `bloques_contenido` | `src/data/bloques-contenido.json` | `file()` | 1 ("Quiénes somos") |
| `problematicas` | `src/data/problematicas.json` | `file()` | 8 |
| `peludos` | `src/data/peludos.json` | `file()` | 6 |
| `campanas` | `src/data/campanas.json` | `file()` | 2 (pasada y próxima) |
| `necesidades` | `src/data/necesidades.json` | `file()` | 3 |
| `destinos_donativo` | `src/data/destinos-donativo.json` | `file()` | 5 |
| `informes_transparencia` | `src/data/informes-transparencia.json` | `file()` | 1 (septiembre 2026) |
| `registros_cifras` | `src/data/registros-cifras.json` | `file()` | 0 (arreglo vacío) |
| `anuncios` | `src/data/anuncios.json` | `file()` | 0 (arreglo vacío) |
| `categorias` | `src/data/categorias.json` | `file()` | 5 |
| `negocios` | `src/data/negocios/*.json` | `glob()` | 5, uno por archivo |

Forma de cada registro (los `id` son slugs en kebab-case):

```ts
// refugio (registro único)
{ id: "refugio", nombre: string, frase: string, ubicacion: string,
  whatsapp: string /* solo dígitos con lada: "5215500000000" */,
  logo: image(), foto_principal: image(), es_ejemplo: boolean }

// redes
{ id, red: "facebook" | "instagram" | "facebook_sos" | "tiktok",
  etiqueta: string, url: string /* URL válida */, orden: number, es_ejemplo }

// bloques_contenido
{ id, seccion: "quienes_somos" | string, titulo: string, texto: string,
  imagenes: image()[], orden: number, publicado: boolean, es_ejemplo }

// problematicas
{ id, titulo: string, texto: string, icono: string /* nombre de Lucide */,
  etiqueta_cifra: string /* "Animales que recibe al mes" */,
  cifra: string | null, fecha_cifra: Date | null, fuente: string | null,
  enlace: { texto: string, url: string, sensible: boolean } | null,
  orden: number, publicada: boolean, es_ejemplo }

// peludos
{ id, nombre: string, especie: "perro" | "gato", descripcion_especie: string /* "Perrita", "Cachorro" */,
  edad: string, tamano: "pequeño" | "mediano" | "grande",
  descripcion: string | null, rasgos: [string, string], fotos: image()[],
  orden: number, estado: "disponible" | "en_proceso" | "adoptado", es_ejemplo }

// campanas
{ id, fecha: Date, costo: number, lugar: string, horario: string,
  forma_pago: string, cupo: number | null, cartel: image() | null,
  estado: "proxima" | "pasada", es_ejemplo }

// necesidades
{ id, tipo: "alimento" | "medicina" | "cobijas" | "limpieza" | "otro",
  descripcion: string, urgencia: "urgente" | "necesaria",
  fecha_vigencia: Date, es_ejemplo }

// destinos_donativo
{ id, destino: string, cubre: string, monto: number, equivalencia: string,
  orden: number, es_ejemplo }

// informes_transparencia
{ id /* "2026-09" */, mes: string /* "2026-09" */,
  ingresos: { fuente: string, monto: number }[],
  gastos: { concepto: string, monto: number }[],
  monto_entregado_refugio: number, comprobantes: string[] /* URLs */,
  publicado: boolean, es_ejemplo }

// registros_cifras
{ id, mes: string, animales_recibidos: number | null, rescates: number | null,
  adopciones: number | null, esterilizaciones: number | null,
  gastos: { concepto: string, monto: number }[], notas: string | null, es_ejemplo }

// anuncios
{ id, tipo: "patrocinio_local" | "automatico", anunciante: string, texto: string,
  enlace: string, posicion: string, vigencia_inicio: Date, vigencia_fin: Date,
  activo: boolean, es_ejemplo }

// categorias
{ id, nombre: string, orden: number, es_ejemplo }

// negocios (un archivo por negocio, menú y horarios anidados)
{ id /* = slug */, nombre: string, categoria: reference("categorias"),
  descripcion_corta: string, logo: image() | null, direccion: string,
  latitud: number | null, longitud: number | null, whatsapp: string | null,
  estado: "borrador" | "publicado" | "pausado", porcentaje_aporte: number,
  fecha_alta: Date,
  horarios: Record<"lun"|"mar"|"mie"|"jue"|"vie"|"sab"|"dom",
    { abre: string, cierra: string }[] | "cerrado">, // día ausente = "por confirmar"
  promocion: { texto: string, fecha_inicio: Date, fecha_fin: Date | null } | null,
  menu: { nombre: string, orden: number,
    secciones: { nombre: string, nota: string | null, orden: number,
      platillos: { nombre: string, descripcion: string | null,
        precios: { etiqueta: string | null, monto: number | null, texto_alterno: string | null }[],
        es_extra: boolean, disponible: boolean }[] }[] }[],
  es_ejemplo }
```

Convenciones del modelo:

- Un horario con `cierra` menor que `abre` cruza la medianoche (`"13:00"` a `"00:30"`).
- Un precio con `monto: null` exige `texto_alterno` (por ejemplo `"Incluido"`); el esquema lo valida con `refine`.
- `"$49 / $59"` con la nota "Precio caliente / frío o frappé" se captura como dos precios con etiqueta `"Caliente"` y `"Frío o frappé"`.
- `"+$60"` se captura como `monto: 60` con `es_extra: true`.
- Los horarios del prototipo vienen como `wk`, `sat` y `sun`; `wk` se copia a `lun` a `vie`, y `null` se captura como `"cerrado"`.

Datos de ejemplo, todos con `es_ejemplo: true`:

- **refugio:** nombre "Ladridos de Esperanza", frase de la presentación del prototipo, ubicación "Tenancingo, Estado de México", WhatsApp ficticio `5215500000000`.
- **redes:** las cuatro URL reales de la spec padre (estas sí con `es_ejemplo: false`).
- **problematicas:** los 8 textos del prototipo con sus cifras de ejemplo, `fecha_cifra` y `fuente` en `null`. "Abandono y maltrato" lleva el enlace a la nota de Posta con `sensible: true`.
- **peludos:** Luna, Canelo, Miel, Rocky, Nube y Toby con los datos del prototipo; Luna y Canelo con sus fotos reales; todos `disponible`. `tamano` va en masculino porque así lo define el enum; la forma femenina del prototipo ("mediana", "pequeña") se conserva en `descripcion_especie` ("Perrita", "Gatita").
- **campanas:** pasada `2026-09-26`, $380, en el refugio, desde las 9:30 am, con el cartel y `cupo: null` (el cartel solo dice "lugares limitados"); próxima `2026-10-24`, cupo 20, sin cartel.
- **necesidades:** croquetas (urgente), medicinas y cobijas (necesaria), vigencia `2026-11-30`.
- **destinos_donativo:** las 5 equivalencias del prototipo ($200, $350, $380, $150, $100).
- **informes_transparencia:** septiembre 2026, recibido $15,000, gastado $14,200. El prototipo solo da totales, así que lleva una línea de ingresos ("Donativos", $15,000) y una de gastos ("Gastos del refugio", $14,200), sin desglose inventado. `monto_entregado_refugio` va en `0` porque en septiembre todavía no existía la colaboración con los negocios.
- **categorias:** Cafeterías, Taquerías, Comida corrida, Panaderías, Pizzas.
- **negocios:** `cafe-del-jardin` con el menú real completo del prototipo, `tacos-don-chuy`, `la-cocina-de-dona-mary`, `panaderia-san-juan` y `pizzeria-nonna-lupe`, con dirección, promoción, aporte y horarios del prototipo. Las promociones toman `fecha_inicio: 2026-10-01` y `fecha_fin: null`, y `fecha_alta` también es `2026-10-01`. El menú del café tiene 145 platillos, igual que `CAFE`; la spec padre dice "más de 150", pero era un número aproximado. El café se llama "Café del Jardín", sin el "(ejemplo)" que el prototipo pone en el nombre: así queda igual que los otros 4 negocios, que lo llevan solo en la dirección.
- **WhatsApp del pie:** mensaje prellenado "Hola, les escribo desde la página de Ladridos de Esperanza." (la spec no lo fijaba).

Imágenes extraídas del prototipo (las 5 son JPEG):

| Archivo | Uso en el prototipo |
| --- | --- |
| `src/assets/refugio/logo.jpg` | Logo del encabezado |
| `src/assets/refugio/patio.jpg` | Foto de la presentación |
| `src/assets/campanas/cartel-2026-09-26.jpg` | Cartel de la campaña |
| `src/assets/peludos/luna.jpg` | Foto de Luna |
| `src/assets/peludos/canelo.jpg` | Foto de Canelo |

Acceso a los datos en `src/lib/datos.ts`:

```ts
export const mostrarEjemplos: boolean; // import.meta.env.PUBLIC_MOSTRAR_EJEMPLOS === "true"
export function obtener<C>(coleccion: C): Promise<Entrada<C>[]>; // filtra es_ejemplo si mostrarEjemplos es false
export function obtenerRefugio(): Promise<Refugio>; // lanza error si no hay registro visible
```

Ninguna página llama a `getCollection` directamente: siempre pasa por `src/lib/datos.ts`.

## Plan de implementación

1. Retirar `src/components/Welcome.astro`, `src/assets/astro.svg` y `src/assets/background.svg`. Dejar `src/pages/index.astro` con un texto simple dentro de `Layout`. Comprobar que `astro build` pasa.
2. Ejecutar `astro add tailwind`. Crear `src/styles/global.css` con `@import "tailwindcss"`, los 9 tokens de color en `@theme` (`--color-fondo`, `--color-superficie`, `--color-texto`, `--color-texto-secundario`, `--color-lineas`, `--color-acento`, `--color-sobre-acento`, `--color-suave`, `--color-sobre-suave`), `body` con fondo y texto, foco visible y el bloque `@media (prefers-reduced-motion: reduce)` que anula animaciones y transiciones. Importarlo en `Layout.astro`.
3. Configurar la API de fuentes en `astro.config.mjs` con el proveedor de Google para Bricolage Grotesque (`--font-titulos`) y DM Sans (`--font-texto`), con alternativas del sistema. Agregar `<Font />` en `Layout.astro` y mapear las variables en `@theme`.
4. Instalar `@lucide/astro`. Crear `src/components/Icono.astro`, que fija `stroke-width` en 2, el color de acento y `aria-hidden="true"` salvo que reciba `etiqueta`. La prop `tono="heredado"` usa el color del texto que lo rodea, solo para íconos dentro de botones de acento. Verificar que existen `dog`, `cat`, `paw-print`, `bone` y `heart`.
5. Extraer las 5 imágenes base64 del prototipo a las rutas de la tabla de imágenes con un script de un solo uso que no se guarda en el repo.
6. Crear `src/content.config.ts` con las colecciones `refugio`, `redes`, `categorias` y `bloques_contenido`, y sus archivos JSON. Comprobar que `astro build` valida los datos.
7. Agregar `problematicas`, `peludos`, `campanas`, `necesidades` y `destinos_donativo` con sus datos de ejemplo e imágenes.
8. Agregar `informes_transparencia`, `registros_cifras` y `anuncios`. Las dos últimas quedan como arreglos vacíos.
9. Agregar `negocios` con los 4 negocios cortos del prototipo.
10. Capturar el menú completo del café en `src/data/negocios/cafe-del-jardin.json`, convirtiendo precios y horarios según las convenciones del modelo.
11. Crear `src/lib/datos.ts` con `mostrarEjemplos`, `obtener` y `obtenerRefugio`. Crear `.env.example` con `PUBLIC_MOSTRAR_EJEMPLOS=true` y agregar `.env` a `.gitignore` si no está.
12. Crear `src/lib/whatsapp.ts` con `enlaceWhatsApp(numero: string, mensaje: string): string`, que devuelve `https://wa.me/<numero>?text=<mensaje codificado>`.
13. Crear `src/components/CintaEjemplo.astro` (cinta delgada en fondo suave con el texto "Datos de ejemplo") y mostrarla en `Layout.astro` solo si `mostrarEjemplos` es `true`.
14. Crear `src/components/Encabezado.astro`: logo, nombre del refugio, navegación (Adopta → `/adopta`, Lo que enfrenta un refugio → `/#problematica`, Esterilización → `/esterilizacion`, Donar → `/donar`, Negocios que ayudan → `/colabora`) en una fila que se desliza horizontalmente, y botón "Dona" con ícono de corazón que lleva a `/donar`.
15. Crear `src/components/Pie.astro` con los enlaces de texto a las 4 redes (`target="_blank"` y `rel="noopener"`) y el enlace al WhatsApp del refugio.
16. Completar `src/layouts/Layout.astro` con las props `titulo` y `descripcion`, `lang="es-MX"`, `<meta name="description">`, cinta, encabezado, `<main>` y pie.
17. Hacer que `src/pages/index.astro` muestre el nombre, la frase y la foto principal del refugio leídos con `obtenerRefugio()`.
18. Crear `src/pages/404.astro` con el layout, el texto "No encontramos esta página" y un enlace a `/`.
19. Instalar `@astrojs/check` y `typescript` como dependencias de desarrollo y corregir lo que reporte `astro check`.
20. Actualizar la sección "Project Structure" de `CLAUDE.md` con `src/data/`, `src/lib/`, `src/content.config.ts` y la variable `PUBLIC_MOSTRAR_EJEMPLOS`.

## Criterios de aceptación

- [x] `PUBLIC_MOSTRAR_EJEMPLOS=true astro build` termina sin errores.
- [x] `astro check` termina con 0 errores.
- [x] `astro build` sin la variable falla con un mensaje que dice que falta el registro real de `refugio`.
- [x] Con la variable en `true`, todas las páginas muestran la cinta "Datos de ejemplo".
- [x] Cambiar el `estado` de un peludo a `"otro"` hace fallar `astro build` con un error de esquema que nombra el campo.
- [x] Un precio con `monto: null` y sin `texto_alterno` hace fallar `astro build`.
- [x] El menú de `cafe-del-jardin` tiene el mismo número de platillos que la constante `CAFE` del prototipo.
- [x] Las 13 colecciones aparecen en `src/content.config.ts` y ninguna página llama a `getCollection` fuera de `src/lib/datos.ts`.
- [x] `/` muestra el nombre, la frase y la foto del refugio, con títulos en Bricolage Grotesque y texto en DM Sans.
- [x] En la pestaña de red del navegador no hay peticiones a `fonts.googleapis.com` ni a `fonts.gstatic.com`.
- [x] `/adopta` y cualquier ruta inexistente muestran el 404 propio con encabezado y pie.
- [x] A 360 px de ancho no hay desplazamiento horizontal de la página y el botón "Dona" se ve sin abrir ningún menú.
- [x] Los enlaces del encabezado, el botón "Dona" y los enlaces del pie miden al menos 44 px de alto.
- [x] Los 4 enlaces de redes del pie abren en otra pestaña y la página no carga ningún script de Facebook, Instagram ni TikTok.
- [x] Recorrer el encabezado con Tab muestra un foco visible en cada enlace.
- [x] Los íconos decorativos tienen `aria-hidden="true"`.
- [x] `enlaceWhatsApp("5215500000000", "Hola, quiero adoptar a Luna")` devuelve `https://wa.me/5215500000000?text=Hola%2C%20quiero%20adoptar%20a%20Luna`.
- [x] Ya no existen `Welcome.astro`, `astro.svg` ni `background.svg`.

### Observaciones de la validación

Validado con Playwright el 2026-10-01, en `astro dev` y en la build de producción.

- **Aviso esperado en el build.** `astro build` muestra `[WARN] [file-loader] No items found` por `registros-cifras.json` y `anuncios.json`, que son arreglos vacíos. No es un error ni detiene el build; desaparece cuando esas colecciones tengan registros.
- **Variable en el hospedaje.** `.env` solo existe en el equipo de desarrollo. Una vista previa publicada con ejemplos necesita `PUBLIC_MOSTRAR_EJEMPLOS=true` configurada en el hospedaje (se define en la SPEC 06).
- **Foco cortado en "Negocios que ayudan" (resuelto).** A 360 px, al llegar con Tab al último enlace de la navegación, el enlace quedaba cortado por la derecha junto con su contorno de foco: el navegador no desliza la fila si el enlace ya se ve en parte. Se corrigió en `Encabezado.astro` con un script nativo que, al enfocar un enlace, lo desliza a la vista (`scrollIntoView` con `inline: "nearest"`), y con `scroll-px-2` en la fila para que también quepa el contorno. Verificado con Tab y Shift+Tab.

## Decisiones

- **Sí:** content collections de Astro antes que Supabase. Los esquemas Zod validan los datos al compilar, y pasar a Supabase en la SPEC 06 solo cambia el loader.
- **No:** Supabase desde el inicio. Obligaría a crear proyecto, tablas y llaves antes de tener una sola página.
- **Sí:** todos los esquemas y todos los datos de ejemplo en esta spec. Un esquema mal pensado falla ahora y no después de construir páginas encima.
- **No:** colecciones para solicitudes de negocio y usuarios del panel. Son datos que se escriben desde el sitio, no contenido publicado; viven en Supabase.
- **Sí:** campo `etiqueta_cifra` en `problematicas`, añadido durante la implementación. El rótulo del dato ("Animales que recibe al mes") debe seguir visible aunque la cifra esté vacía.
- **Sí:** colección `destinos_donativo`, que no está en el modelo de la spec padre. La tabla "En qué se usa un donativo" del prototipo necesita datos editables.
- **Sí:** JSON con el menú anidado dentro de cada negocio. Es más fácil de editar a mano; se aplana a tablas en la SPEC 06.
- **No:** JSON plano tipo tablas con referencias por id. Más fiel a Postgres, pero un menú de 145 platillos se vuelve difícil de mantener a mano.
- **Sí:** campos en español y `snake_case`. Coinciden con la spec padre (`es_ejemplo`) y con columnas de Postgres.
- **Sí:** precios como lista de `{ etiqueta, monto, texto_alterno }`. Cubre "$49 / $59", "+$60" e "Incluido" sin perder información.
- **Sí:** horarios por día de la semana (`lun` a `dom`), no por grupo como en el prototipo. Coincide con la entidad Horario de la spec padre.
- **Sí:** `PUBLIC_MOSTRAR_EJEMPLOS` controla los ejemplos. Permite publicar una vista previa con ejemplos y un sitio real sin ellos.
- **No:** mostrar ejemplos solo en `astro dev`. Una vista previa publicada saldría vacía.
- **Sí:** `astro build` falla si no hay un `refugio` real y los ejemplos están apagados. Es la forma de garantizar que nunca se publique el WhatsApp ficticio.
- **Sí:** enlaces del encabezado a las rutas definitivas y un 404 propio. Evita volver a tocar el encabezado en la SPEC 03.
- **No:** páginas "Próximamente" ni anclas `#` como en el prototipo. Serían trabajo que se tira después.
- **Sí:** API de fuentes de Astro. Las fuentes se sirven desde el dominio propio y el visitante no hace peticiones a Google.
- **Sí:** variables de la API de fuentes con nombre `--fuente-titulos` y `--fuente-texto`, distinto del paso 3, cambio hecho durante la implementación. `@theme` las expone como `--font-titulos` y `--font-texto`; con el mismo nombre en los dos lados, `--font-titulos: var(--font-titulos)` se apuntaría a sí misma y no funcionaría. Las clases (`font-titulos`, `font-texto`) quedan como pide la spec.
- **No:** `<link>` a Google Fonts. Agrega una petición a un tercero.
- **Sí:** scripts nativos de Astro para la interactividad de las specs siguientes. Es lo que menos JavaScript manda al teléfono.
- **No:** Svelte o React en el sitio público. React queda como opción solo para el panel `/admin`.
- **Sí:** Lucide con `@lucide/astro`, como recomienda la spec padre.
- **Sí:** prop `tono="heredado"` en `Icono.astro`, añadida durante la implementación. El corazón del botón "Dona" va en blanco sobre el acento; con el color de acento fijo sería invisible.
- **Sí:** redes como enlaces de texto. Lucide retiró los íconos de marcas, y la spec padre pide no dibujar íconos a mano.
- **Sí:** redes solo en el pie, desviándose de RF-27, que también las pide en el encabezado. A 360 px el encabezado ya lleva logo, navegación y "Dona"; la SPEC 02 suma la sección "Redes y contacto" en la portada.
- **No:** la calculadora "¿Cuánto podría aportar al refugio?". Es una herramienta interna para conversar con el refugio y los negocios, no algo para el visitante.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `image()` no resuelve rutas relativas igual con el loader `file()` que con `glob()` | Verificarlo en el paso 6 con `refugio.logo`. Si falla, las rutas se escriben relativas al archivo JSON o se usa `glob()` con un archivo por registro para esa colección. |
| Error al capturar a mano el menú de 145 platillos | El criterio de aceptación compara el conteo con `CAFE`. El negocio valida precios antes de publicar (paso 4 de la operación en la spec padre). |
| La API de fuentes o `@lucide/astro` cambian en Astro 7 | Consultar `docs.astro.build` y la documentación de Lucide al instalar; anotar en esta spec cualquier diferencia. |
| Un ícono necesario no existe en Lucide (por ejemplo, alguna problemática) | Elegir el más cercano de Lucide. La SPEC 02 cierra la lista final de íconos de problemáticas. |

## Lo que **no** entra en esta spec

- Secciones de la portada, carrusel de peludos y animaciones (SPEC 02).
- Páginas `/adopta`, `/esterilizacion`, `/donar` y `/transparencia` (SPEC 03).
- Catálogo y páginas de negocio (SPEC 04 y 05).
- Supabase, Súmate, panel, anuncios, analítica y SEO (SPEC 06 a 08).
- Redes en el encabezado y la calculadora de aportes.

Cada una de estas, si llega, va en su propia spec.
