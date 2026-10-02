# SPEC 12 — Portada con prioridades: qué es, dónde está y cómo ayudar

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 03, SPEC 06, SPEC 11
> **Fecha:** 2026-10-02
> **Objetivo:** Reordenar la portada y el menú para que primero se entienda qué es y dónde está el refugio, y luego las adopciones, los donativos en dinero o en especie y las campañas de esterilización, con un enlace "Cómo llegar" a Google Maps.

## Por qué existe esta spec

La portada de la SPEC 02 sigue el orden de la spec padre: después de la presentación vienen los peludos (RF-30) y "Quiénes somos" queda en tercer lugar.
Quien llega por primera vez ve animales antes de saber qué es el refugio y dónde está.
Además, la sección de donativos mezcla el dinero y la ayuda en especie en un solo bloque, y la ubicación es solo un texto sin forma de llegar.

Esta spec **reemplaza el orden de RF-30 y de la SPEC 02**: los peludos pasan del 2.º al 3.er lugar.
La spec padre y la SPEC 02 no se reescriben; el índice `specs/README.md` deja la nota.

Ocupa el número 12; los anuncios (RF-18) pasan a la 13.

## Alcance

**Dentro:**

- Nuevo orden de la portada: Presentación → Quiénes somos → Adopciones → Donativos → Esterilización → Problemáticas → Colaboración → Redes.
- Línea de ubicación con ícono de mapa en la presentación, que lleva a `#quienes`.
- "Quiénes somos" siempre visible: sin bloque publicado, una versión mínima titulada "Dónde estamos" con ubicación, dirección, "Cómo llegar" y redes.
- Tres columnas nuevas en `refugio`: `direccion`, `latitud` y `longitud`, todas opcionales y capturadas en Supabase Studio.
- Botón "Cómo llegar" a Google Maps con las coordenadas, en "Quiénes somos" y en el pie; sin coordenadas no se muestra.
- Dirección escrita en "Quiénes somos" y en el pie cuando existe.
- `address` como `PostalAddress` y `geo` en el JSON-LD `AnimalShelter` de la portada.
- Sección de donativos dividida en dos tarjetas: "Dona dinero" y "Dona en especie".
- Menú del encabezado en el orden nuevo: Quiénes somos, Adopta, Donar, Esterilización, Negocios que ayudan.
- Eventos de Umami nuevos: `como_llegar` con `origen`, y `whatsapp` con `motivo` `especie`.
- Aviso de privacidad: agregar los clics a "Cómo llegar" a lo que mide la analítica.

**Fuera de alcance (specs futuras):**

- Pantalla del refugio en `/admin` para editar nombre, frase, ubicación, dirección o coordenadas; se siguen editando en Studio.
- Mapa incrustado (iframe de Google Maps u OpenStreetMap).
- Cambios a `/adopta`, `/esterilizacion` y `/donar` (solo cambia su lugar en el menú).
- Cambios al contenido de Problemáticas, Colaboración y Redes; solo se mueven.
- Un tercer botón en la presentación.
- Reescribir el texto de RF-30 en la spec padre o la SPEC 02.
- Anuncios (SPEC 13, RF-18).

## Modelo de datos

### Migración `ubicacion_refugio`

```sql
alter table refugio
	add column direccion text check (direccion is null or btrim(direccion) <> ''),
	add column latitud double precision check (latitud between -90 and 90),
	add column longitud double precision check (longitud between -180 and 180),
	add constraint refugio_coordenadas_completas check ((latitud is null) = (longitud is null));
```

- `direccion`: la calle tal como se muestra ("Calle Hidalgo 12, col. Centro"). No repite el municipio: ese ya está en `ubicacion`.
- `latitud` y `longitud`: el punto del enlace "Cómo llegar". Van juntas o ninguna.
- El trigger de recompilación de `refugio` ya existe, así que un cambio en Studio publica el sitio.
- Sin RPC ni políticas nuevas: el registro se edita solo en Studio.

### Esquema (`src/content.config.ts`)

```ts
const refugio = defineCollection({
	loader: cargadorRefugio(),
	schema: z.object({
		// … campos actuales …
		direccion: z.string().nullable(),
		latitud: z.number().nullable(),
		longitud: z.number().nullable(),
		es_ejemplo,
	}),
});
```

`cargadorRefugio` ya hace `select *`, así que no cambia.

### Semilla (`supabase/seed.sql`)

El registro de ejemplo del refugio recibe una dirección y coordenadas de ejemplo en el centro de Tenancingo (`18.9606`, `-99.5906`), para ver "Cómo llegar" en desarrollo.

### Enlace del mapa (`src/lib/mapas.ts`)

```ts
/** "Cómo llegar" del refugio: el punto exacto, o null sin coordenadas. */
export function enlaceMapaRefugio(refugio: Refugio): string | null;
```

Usa la misma URL de búsqueda que `enlaceMapa` (`https://www.google.com/maps/search/?api=1&query=lat,lng`).
Sin coordenadas devuelve `null` y no busca por nombre ni por dirección.

### JSON-LD (`datosRefugio` en `src/lib/seo.ts`)

```ts
address: {
	'@type': 'PostalAddress',
	streetAddress: refugio.direccion, // solo con dirección
	addressLocality: 'Tenancingo',
	addressRegion: 'Estado de México',
	addressCountry: 'MX',
},
geo: { '@type': 'GeoCoordinates', latitude, longitude }, // solo con coordenadas
```

Mismo formato que `datosNegocio`.

### Eventos de Umami

| Evento | Atributos | Dónde |
| --- | --- | --- |
| `como_llegar` | `origen`: `quienes` o `pie` | Botón "Cómo llegar" de `QuienesSomos` y enlace del `Pie` |
| `whatsapp` | `motivo`: `especie` | Botón de la tarjeta "Dona en especie" de `portada/Donativos` |
| `whatsapp` | `motivo`: `donativo` (ya existe) | Botón "Pedir datos para donar" de `portada/Donativos` |

## Cambios por archivo

| Archivo | Cambio |
| --- | --- |
| `supabase/migrations/<fecha>_ubicacion_refugio.sql` | Las 3 columnas y sus restricciones |
| `supabase/seed.sql` | Dirección y coordenadas de ejemplo |
| `src/content.config.ts` | 3 campos en `refugio` |
| `src/lib/mapas.ts` | `enlaceMapaRefugio` |
| `src/lib/seo.ts` | `address` como `PostalAddress` y `geo` en `datosRefugio` |
| `src/pages/index.astro` | Orden nuevo; un `CaminoHuellas` entre cada par, alternando dirección |
| `src/components/portada/Presentacion.astro` | Línea de ubicación bajo la frase, enlace a `#quienes` |
| `src/components/portada/QuienesSomos.astro` | Siempre visible; versión mínima; dirección y "Cómo llegar" |
| `src/components/portada/Donativos.astro` | Dos tarjetas: dinero y especie |
| `src/components/Encabezado.astro` | Enlaces en el orden nuevo |
| `src/components/Pie.astro` | Dirección y "Cómo llegar" |
| `src/pages/aviso-de-privacidad.astro` | Clics a "Cómo llegar" en lo que mide la analítica |
| `specs/README.md`, `CLAUDE.md`, `AGENTS.md` | Índice, orden de la portada, columnas, `enlaceMapaRefugio` y eventos |

### "Quiénes somos" (`#quienes`)

| | Con bloque `quienes_somos` publicado | Sin bloque |
| --- | --- | --- |
| Título | `bloque.titulo` | "Dónde estamos" |
| Texto y fotos | Sí | No |
| Ubicación (`ubicacion`) con ícono `map-pin` | Sí | Sí |
| Dirección | Si existe | Si existe |
| Botón "Cómo llegar" | Con coordenadas | Con coordenadas |
| Redes | Sí | Sí |

"Cómo llegar" abre en otra pestaña (`target="_blank" rel="noopener"`) y usa el ícono `navigation`.

### Donativos (`#donar`)

El título "Tu donativo cambia vidas" y su texto se quedan; abajo, dos tarjetas lado a lado desde `md` y apiladas en teléfono.

- **Dona dinero** (ícono `landmark`): texto "Pide los datos oficiales por WhatsApp para donar con seguridad."; botón principal "Pedir datos para donar" con el mismo mensaje que `/donar` (`Hola, quiero los datos para donar a {nombre}.`); enlace secundario "Ver todas las formas de ayudar" a `/donar`.
- **Dona en especie** (ícono `package`): con necesidades vigentes, `ListaNecesidades` con `nivel="h4"`; sin ellas, el texto "Croquetas, medicinas, cobijas y artículos de limpieza. Escríbenos y te decimos qué hace falta."; en ambos casos, botón "Quiero donar en especie" con el mensaje `Hola, quiero donar en especie a {nombre}. ¿Qué les hace falta?`.

Las tarjetas usan `<h3>`; la lista de necesidades queda en `<h4>`.

### Menú del encabezado

```ts
const enlaces = [
	{ texto: 'Quiénes somos', href: '/#quienes' },
	{ texto: 'Adopta', href: '/adopta' },
	{ texto: 'Donar', href: '/donar' },
	{ texto: 'Esterilización', href: '/esterilizacion' },
	{ texto: 'Negocios que ayudan', href: '/colabora' },
];
```

"Lo que enfrenta un refugio" sale del menú; la sección sigue en la portada con su `id="problematica"`.

## Plan de implementación

1. Crear la migración `ubicacion_refugio`, agregar los valores de ejemplo a `seed.sql` y los 3 campos al esquema. Comprobar con `npx supabase db reset` y `astro build` que compila igual que antes, y que en Studio un `update` con solo `latitud` falla.
2. Agregar `enlaceMapaRefugio` y el `PostalAddress` con `geo` en `datosRefugio`. Comprobar el JSON-LD en el HTML compilado de `/`.
3. Cambiar `QuienesSomos`: siempre visible, versión mínima, dirección y "Cómo llegar" con su evento.
4. Reordenar `src/pages/index.astro` y agregar la línea de ubicación a `Presentacion`.
5. Dividir `portada/Donativos` en las dos tarjetas con sus eventos.
6. Reordenar el menú de `Encabezado` y agregar la dirección y "Cómo llegar" al `Pie`.
7. Agregar los clics a "Cómo llegar" al aviso de privacidad.
8. Actualizar `specs/README.md` (la 12 con este título, anuncios a la 13 y la nota de que esta spec reemplaza el orden de RF-30), `CLAUDE.md` y `AGENTS.md` (orden de la portada, columnas de `refugio`, `enlaceMapaRefugio`, eventos de Umami y que el menú ya no tiene "Lo que enfrenta un refugio").
9. Paso manual en la nube después del merge: `npx supabase db push`; cuando el refugio confirme su dirección y su punto, capturarlos en Studio.

## Criterios de aceptación

### Datos

- [x] Después de `npx supabase db reset`, el registro `refugio` tiene `direccion`, `latitud` y `longitud` de ejemplo.
- [x] Un `update refugio set latitud = 18.96, longitud = null` falla con `refugio_coordenadas_completas`.
- [x] Un `update refugio set latitud = 91, longitud = 0` falla.
- [x] Un `update refugio set direccion = '  '` falla.
- [x] Con las 3 columnas en `null`, `astro build` termina sin errores.
- [x] Cambiar la dirección en Studio encola una llamada al hook de despliegue (local, con el receptor de prueba de la SPEC 08).

### Portada

- [x] Los `<section>` de `/` aparecen en este orden: Presentación, `#quienes`, `#adopta`, `#donar`, `#esterilizacion`, `#problematica`, `#colabora`, `#redes`.
- [x] Entre cada par de secciones hay un `CaminoHuellas` y su dirección alterna.
- [x] La presentación muestra "Tenancingo, Estado de México" con ícono de mapa bajo la frase, y al tocarla la página baja a `#quienes`.
- [x] Los botones "Quiero adoptar" y "Dona" de la presentación siguen iguales.
- [x] Con el bloque `quienes_somos` publicado, `#quienes` muestra su título, su texto, sus fotos, la ubicación, la dirección, "Cómo llegar" y las redes.
- [x] Con el bloque despublicado, `#quienes` muestra "Dónde estamos", la ubicación, la dirección, "Cómo llegar" y las redes, sin texto ni fotos.
- [x] Con `latitud` y `longitud` en `null`, no hay ningún enlace "Cómo llegar" en `/` ni en el pie de ninguna página.
- [x] Con `direccion` en `null`, no queda ninguna línea vacía donde iría la dirección.
- [x] "Cómo llegar" abre `https://www.google.com/maps/search/?api=1&query=18.9606%2C-99.5906` con los datos de ejemplo, en otra pestaña.
- [x] `#donar` muestra dos tarjetas, "Dona dinero" y "Dona en especie", lado a lado a 768 px y apiladas a 360 px.
- [x] "Pedir datos para donar" abre WhatsApp con el mismo mensaje que el botón de `/donar`.
- [x] "Ver todas las formas de ayudar" lleva a `/donar`.
- [x] Con necesidades vigentes, "Dona en especie" muestra la lista de necesidades con sus etiquetas de urgencia.
- [x] Sin necesidades vigentes, "Dona en especie" muestra el texto genérico y el botón "Quiero donar en especie".
- [x] La portada no tiene niveles de título saltados (un `<h1>`, `<h2>` por sección, `<h3>` por tarjeta, `<h4>` en la lista de necesidades).
- [x] A 360 px de ancho la portada no tiene desplazamiento horizontal.

### Encabezado y pie

- [x] El menú muestra, en orden: Quiénes somos, Adopta, Donar, Esterilización, Negocios que ayudan.
- [x] "Quiénes somos" del menú lleva a `/#quienes` desde cualquier página.
- [x] "Lo que enfrenta un refugio" ya no está en el menú y `/#problematica` sigue funcionando.
- [x] El pie de todas las páginas públicas muestra la dirección y "Cómo llegar" cuando existen.

### SEO y analítica

- [x] El JSON-LD de `/` tiene `address` con `@type` `PostalAddress`, `streetAddress`, `addressLocality` `Tenancingo` y `geo` con las coordenadas de ejemplo.
- [x] Sin dirección ni coordenadas, el JSON-LD tiene `PostalAddress` sin `streetAddress` y no tiene `geo`.
- [x] "Cómo llegar" de `#quienes` tiene `data-umami-event="como_llegar"` y `data-umami-event-origen="quienes"`; el del pie, `origen` `pie`.
- [x] El botón de "Dona en especie" tiene `data-umami-event="whatsapp"` y `data-umami-event-motivo="especie"`; "Pedir datos para donar", `motivo` `donativo`.
- [x] El aviso de privacidad menciona los clics a "Cómo llegar" entre lo que mide la analítica.
- [x] `npx astro check` no reporta errores.

## Decisiones

- **Sí:** Quiénes somos en 2.º lugar y los peludos en 3.º. Primero se entiende qué es y dónde está el refugio, y después cómo ayudar.
- **No:** dejar los peludos en 2.º (RF-30). La persona ve animales sin saber de quién son ni dónde están.
- **No:** meter "qué es y dónde está" dentro de la presentación. La presentación ya tiene nombre, frase, foto y dos botones; la línea de ubicación basta ahí.
- **Sí:** nota en esta spec y en el índice en lugar de reescribir RF-30 y la SPEC 02. Las specs implementadas quedan como registro de lo que se decidió en su momento.
- **Sí:** `direccion`, `latitud` y `longitud` juntas. La dirección se lee y las coordenadas llevan al punto exacto.
- **Sí:** las tres opcionales. El refugio todavía no confirma su dirección, y el sitio funciona sin ellas.
- **Sí:** restricciones en la tabla. El registro se edita en Studio, sin RPC que valide, así que la base de datos es la única que evita coordenadas a medias o fuera de rango.
- **Sí:** Studio para capturarlas. No existe pantalla del refugio en `/admin` y crearla es otra spec.
- **No:** pantalla `/admin/refugio`. Pide RPC, políticas y formulario para un registro que casi nunca cambia.
- **Sí:** sin coordenadas, no hay "Cómo llegar". Mejor no mostrarlo que mandar a la gente a un punto equivocado.
- **No:** buscar por nombre o dirección en Maps sin coordenadas. Depende de que el refugio esté dado de alta en Google y de cómo esté escrita la calle.
- **No:** mapa incrustado. Carga scripts de terceros, pesa en teléfono y el aviso de privacidad tendría que cubrirlo.
- **Sí:** "Quiénes somos" siempre visible con una versión mínima. Ahora es la segunda sección y es la que responde dónde está el refugio.
- **Sí:** dos tarjetas en donativos. El dinero y la ayuda en especie son dos caminos distintos y se piden de forma distinta.
- **Sí:** el botón de especie aparece con y sin necesidades vigentes. Donar en especie siempre pide coordinar la entrega por WhatsApp.
- **Sí:** mismo mensaje de WhatsApp que `/donar` para pedir datos. Un solo texto para el mismo motivo.
- **Sí:** "Lo que enfrenta un refugio" sale del menú. El menú queda con las prioridades; la sección sigue en la portada.
- **Sí:** dirección y "Cómo llegar" en el pie y en el JSON-LD. Se encuentra desde cualquier página y ayuda a que Google ubique al refugio.
- **Sí:** eventos `como_llegar` y `motivo` `especie`. Miden si las prioridades nuevas se usan, sin cookies, como el resto de la analítica.
- **Sí:** número 12 para esta spec y anuncios a la 13. Las specs se numeran en el orden en que se escriben.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Publicar la dirección exacta facilita que dejen animales en la puerta | Las columnas empiezan en `null`; solo se capturan cuando el refugio lo confirma, y sin ellas solo se ve el municipio. |
| Un `update` en Studio deja coordenadas a medias o invertidas | Las restricciones rechazan una sola coordenada y valores fuera de rango; se comprueba el enlace en la portada después de cada cambio. |
| Las coordenadas de ejemplo llegan a producción | `seed.sql` nunca se empuja a la nube (`db push` solo aplica migraciones); en la nube las columnas quedan en `null`. |
| Enlaces externos o guardados a `/#problematica` | La sección conserva su `id`; solo sale del menú. |
| La portada se ve repetida con dos bloques de fondo `suave` seguidos | El orden nuevo alterna: Quiénes somos (sin fondo), Adopciones (`suave`), Donativos (tarjetas), Esterilización (`suave`), Problemáticas (sin fondo), Colaboración (borde). |

## Lo que **no** entra en esta spec

- Pantalla del refugio en `/admin`.
- Mapa incrustado.
- Cambios a `/adopta`, `/esterilizacion` y `/donar`.
- Cambios al contenido de Problemáticas, Colaboración y Redes.
- Un tercer botón en la presentación.
- Reescribir RF-30 en la spec padre o la SPEC 02.
- Anuncios (SPEC 13, RF-18).
