# SPEC 11 — SEO, analítica y aviso de privacidad

> **Estado:** Implementado (faltan el paso 10 manual y las pruebas en producción)
> **Depende de:** SPEC 02, SPEC 03, SPEC 04, SPEC 05, SPEC 07
> **Fecha:** 2026-10-02
> **Objetivo:** Que el sitio público se encuentre y se comparta bien (mapa del sitio, etiquetas para compartir, datos estructurados y favicons del refugio), mida sus visitas y clics sin cookies en Umami, y tenga un aviso de privacidad completo que explique todo lo que guarda.

## Por qué existe esta spec

El índice juntaba en la 11 anuncios, analítica, SEO y aviso de privacidad.
Son cuatro áreas y los anuncios solos necesitan RPC, panel y espacios en las páginas, así que se dividen:

- **11 (esta):** SEO, analítica, aviso de privacidad y rendimiento móvil. Casi no toca la base de datos.
- **12:** anuncios (RF-18), con su panel y sus espacios en `/colabora`.

La analítica y el aviso van juntos porque el aviso tiene que decir qué mide la analítica.

## Alcance

**Dentro:**

- Favicons del refugio generados desde `supabase/semilla/imagenes/refugio/logo.jpg`, en lugar de los de Astro.
- Etiquetas para compartir en cada página pública: `canonical`, Open Graph y Twitter.
- Imagen para compartir por página: el logo del negocio en `/colabora/[slug]` y la foto principal del refugio en las demás.
- Datos estructurados JSON-LD: `AnimalShelter` en la portada y un tipo según la categoría en cada página de negocio.
- Mapa del sitio con `@astrojs/sitemap` y `robots.txt` que excluye `/admin`.
- `noindex` en la página 404.
- Analítica sin cookies con Umami Cloud: visitas automáticas y eventos de búsqueda, clics a negocios, clics a WhatsApp y envíos de Súmate.
- Tarjeta "Estadísticas" en `/admin` para las dos cuentas, con el enlace compartido de solo lectura de Umami.
- Aviso de privacidad reescrito con la estructura de la LFPDPPP, con el refugio como responsable y `privacidad@ladridosdeesperanza.org` para los derechos ARCO; conserva la nota "pendiente de revisión legal".
- Redirección de `privacidad@ladridosdeesperanza.org` al buzón del desarrollador con Cloudflare Email Routing (paso manual).
- Medición de rendimiento móvil (LCP menor a 2.5 s) en tres páginas, y corrección de lo que falle.

**Fuera de alcance (specs futuras):**

- Anuncios, espacios publicitarios y su panel (SPEC 12, RF-18).
- Anuncios automáticos tipo AdSense (fuera del MVP).
- Tablero de estadísticas propio dentro de `/admin`; el tablero es el de Umami.
- Revisión de accesibilidad AA con herramientas y sus correcciones.
- Respaldos diarios de la base de datos y de las imágenes.
- Imágenes para compartir generadas al compilar (tarjetas de 1200×630 con título).
- Manifiesto web, instalación como app o modo sin conexión.
- Revisión legal del aviso de privacidad por un profesional; la nota "pendiente de revisión legal" se quita cuando ocurra, fuera de esta spec.
- Banner de cookies: el sitio no usa cookies propias ni de terceros.

## Modelo de datos

Esta spec no agrega tablas, columnas, funciones ni migraciones.
Lee lo que ya cargan `src/lib/datos.ts` y `src/lib/cargadores.ts` (refugio, redes, negocios, categorías, horarios e imágenes).

### Variables de entorno nuevas

| Variable | Dónde | Sin ella |
| --- | --- | --- |
| `PUBLIC_UMAMI_ID` | Vercel, solo Production | No se carga el script de Umami; el sitio funciona igual |
| `PUBLIC_UMAMI_TABLERO` | Vercel, solo Production | No se muestra la tarjeta "Estadísticas" en `/admin` |

Las dos son opcionales: `astro.config.mjs` no detiene la compilación sin ellas.
`.env.example` las lista vacías con un comentario.

### Eventos de Umami

Las visitas a cada página las registra el script solo.
Los clics se marcan con atributos `data-umami-event` y `data-umami-event-{dato}` en el HTML, sin JavaScript propio.
Las búsquedas y Súmate llaman a `umami.track()` desde los `<script>` que ya existen.

| Evento | Datos | Dónde |
| --- | --- | --- |
| `whatsapp` | `motivo: adopcion`, `peludo: {nombre}` | `TarjetaPeludo` |
| `whatsapp` | `motivo: esterilizacion` | `FichaCampana`, `portada/Esterilizacion` |
| `whatsapp` | `motivo: donativo` · `apadrinar` · `voluntariado` | Los tres botones de `donar/FormasDeAyudar` |
| `whatsapp` | `motivo: contacto` | `Pie`, `portada/RedesContacto` |
| `whatsapp` | `motivo: negocio`, `negocio: {id}` | `colabora/ContactoNegocio` |
| `abrir_negocio` | `negocio: {id}`, `origen: catalogo` · `mas_negocios` | `TarjetaNegocio`, `MasNegocios` |
| `busqueda` | `lugar: catalogo`, `texto` | `CatalogoNegocios` |
| `busqueda` | `lugar: menu`, `negocio: {id}`, `texto` | `MenuNegocio` |
| `sumate_enviado` | ninguno | `FormularioSumate`, solo tras un `insert` exitoso (no con el campo trampa lleno) |

Reglas de `busqueda`:

- `texto` es `normalizar()` de `src/lib/busqueda.ts` (minúsculas, sin acentos), recortado a 60 caracteres.
- Se manda 1 s después de la última tecla y solo con 2 letras o más.
- No se repite si el texto es igual al último que se mandó en esa página.

Las visitas a `/adopta`, `/esterilizacion` y `/donar` cuentan como visitas normales; no llevan evento propio.

### Script de Umami

Va en `src/layouts/Layout.astro`, nunca en `LayoutPanel.astro`:

```html
<script
  defer
  src="https://cloud.umami.is/script.js"
  data-website-id="{PUBLIC_UMAMI_ID}"
  data-domains="{host de PUBLIC_URL_SITIO}"
  data-exclude-search="true"
  data-exclude-hash="true"
  data-do-not-track="true"
></script>
```

- `data-domains` evita contar visitas desde `localhost` o desde otro dominio.
- `data-exclude-search` y `data-exclude-hash` evitan que los filtros del catálogo (`?q=&categoria=…`) y las pestañas del menú (`#menu-{grupo}`) cuenten como visitas nuevas, y que el texto buscado quede en las URL.
- `data-do-not-track` respeta la opción "no rastrear" del navegador.

### Archivos

| Archivo | Contenido |
| --- | --- |
| `scripts/generar-favicons.mjs` | Genera los favicons desde `logo.jpg` con `sharp` (ya viene con Astro) |
| `public/favicon.ico` | 32×32 (un PNG dentro de un contenedor ICO) |
| `public/icono.png` | 192×192 |
| `public/apple-touch-icon.png` | 180×180 |
| `public/favicon.svg` | Se borra |
| `src/layouts/Layout.astro` | Favicons, `canonical`, Open Graph, Twitter, `robots`, JSON-LD y script de Umami; props nuevas |
| `src/layouts/LayoutPanel.astro` | Los mismos favicons; sin Umami ni etiquetas para compartir |
| `src/lib/seo.ts` | `tipoNegocio(categoriaId)`, `datosRefugio(…)`, `datosNegocio(…)` y `jsonLd(objeto)` (serializa y escapa `<` como `<`) |
| `src/lib/analitica.ts` | `registrar(evento, datos)` (llama a `window.umami?.track` si existe) y `registrarBusqueda(lugar, texto, extra)` con la espera de 1 s; sin imports de Astro |
| `src/pages/robots.txt.ts` | `robots.txt` con `Disallow: /admin` y la ruta del mapa del sitio |
| `astro.config.mjs` | Integración `@astrojs/sitemap` con filtro de `/admin` y `/404` |
| `src/pages/404.astro` | `indexar={false}` |
| `src/pages/index.astro` | JSON-LD del refugio |
| `src/pages/colabora/[slug].astro` | Imagen para compartir y JSON-LD del negocio |
| `src/pages/admin/index.astro` | Tarjeta "Estadísticas" |
| `src/pages/aviso-de-privacidad.astro` | Texto nuevo |
| Componentes de la tabla de eventos | Atributos `data-umami-event` |
| `src/components/colabora/CatalogoNegocios.astro`, `MenuNegocio.astro`, `FormularioSumate.astro` | Llamadas a `src/lib/analitica.ts` |

### Props nuevas de `Layout`

```ts
interface Props {
	titulo: string;
	descripcion: string;
	/** Imagen para compartir; sin ella, la foto principal del refugio. */
	imagen?: Imagen;
	/** false agrega <meta name="robots" content="noindex">. Por omisión, true. */
	indexar?: boolean;
	/** Objeto schema.org que se escribe como JSON-LD en <head>. */
	estructurados?: Record<string, unknown>;
}
```

`LayoutColabora` pasa las tres props nuevas a `Layout`.

### Etiquetas en `<head>`

| Etiqueta | Valor |
| --- | --- |
| `link rel="canonical"` | `new URL(Astro.url.pathname, Astro.site)` |
| `og:type` | `website` |
| `og:site_name` | Nombre del refugio |
| `og:locale` | `es_MX` |
| `og:title`, `og:description`, `og:url` | `titulo`, `descripcion` y la URL canónica |
| `og:image`, `og:image:width`, `og:image:height`, `og:image:alt` | URL pública de Supabase de la imagen, sus medidas y "Logo de {negocio}" o "Foto de {refugio}" |
| `twitter:card` | `summary` con el logo de un negocio; `summary_large_image` con la foto del refugio |

Un negocio sin logo usa la foto del refugio.

### Datos estructurados

Portada, `AnimalShelter`:

| Campo | Valor |
| --- | --- |
| `name`, `url`, `logo`, `image` | Nombre, URL del sitio, logo y foto principal del refugio |
| `address` | `ubicacion` del refugio (texto) |
| `telephone` | `+{whatsapp}` |
| `sameAs` | Las URL de `redes` |

Página de negocio, tipo por `categoria_id`:

| Categoría | Tipo |
| --- | --- |
| `cafeterias` | `CafeOrCoffeeShop` |
| `panaderias` | `Bakery` |
| `taquerias`, `comida-corrida`, `pizzas` | `Restaurant` |
| Cualquier otra | `LocalBusiness` |

| Campo | Valor |
| --- | --- |
| `name`, `url`, `description`, `image` | Nombre, URL canónica, `descripcion_corta` y logo (si tiene) |
| `address` | `PostalAddress` con `streetAddress` = `direccion`, `addressLocality` = `Tenancingo`, `addressRegion` = `Estado de México`, `addressCountry` = `MX` |
| `geo` | `GeoCoordinates` si hay latitud y longitud |
| `telephone` | `+{whatsapp}` si tiene |
| `openingHoursSpecification` | Una entrada por turno de cada día abierto; los días "Por confirmar" y "Cerrado" no aparecen; un turno que cruza la medianoche se escribe con `closes` menor que `opens` |

### Aviso de privacidad

`/aviso-de-privacidad` conserva la nota "Texto provisional, pendiente de revisión legal." y agrega "Última actualización: {fecha}" (constante en la página).
Secciones, en este orden:

| Sección | Contenido |
| --- | --- |
| Quién es responsable | Nombre y ubicación del refugio (de la tabla `refugio`) y el correo `privacidad@ladridosdeesperanza.org` |
| Qué datos guardamos | Los del formulario Súmate: nombre y tipo del negocio, WhatsApp, nombre y mensaje si se escriben, fecha y aceptación del aviso. Ningún dato sensible |
| Para qué los usamos | Solo para escribir por WhatsApp y platicar cómo sumar el negocio. Sin finalidades secundarias ni publicidad |
| Estadísticas de visitas | Umami sin cookies; no guarda la IP ni identifica a nadie. Cuenta páginas vistas, búsquedas (el texto, sin acentos), clics a WhatsApp y a negocios y envíos de Súmate. Respeta "no rastrear" |
| WhatsApp | Los botones abren WhatsApp; el sitio no guarda la conversación, que queda sujeta al aviso de WhatsApp |
| Quién más los trata | Supabase (base de datos), Vercel (hospedaje y registros técnicos) y Umami (estadísticas), solo para dar el servicio. No se venden ni se transfieren |
| Cuánto tiempo los guardamos | Mientras se platica la colaboración o el negocio colabora, o hasta que se pida borrarlos |
| Tus derechos (ARCO) y cómo revocar tu consentimiento | Escribir a `privacidad@ladridosdeesperanza.org` con el nombre del negocio, el WhatsApp usado y lo que se pide; respuesta en un máximo de 20 días hábiles |
| Cambios a este aviso | Se publican en esta página con su fecha |

El enlace de WhatsApp para borrar la solicitud se quita: el canal de privacidad es el correo.

### Tarjeta "Estadísticas" en `/admin`

- Visible para las dos cuentas, solo si `PUBLIC_UMAMI_TABLERO` tiene valor.
- Ícono `chart-line`, título "Estadísticas", texto "Visitas, búsquedas y clics a WhatsApp de cada semana, en Umami."
- Abre el enlace en otra pestaña (`target="_blank" rel="noopener"`).

## Plan de implementación

1. Crear `scripts/generar-favicons.mjs`, generar los tres archivos de `public/`, borrar `favicon.svg` y cambiar los `<link rel="icon">` de `Layout` y `LayoutPanel`. Comprobar en `astro dev` que la pestaña muestra el logo del refugio.
2. Agregar a `Layout` las props `imagen` e `indexar` con `canonical`, Open Graph, Twitter y `robots`; pasarlas desde `LayoutColabora`, `[slug].astro` (logo) y `404.astro`. Comprobar las etiquetas en el HTML compilado de `/`, `/colabora/cafe-del-jardin` y `/404`.
3. Crear `src/lib/seo.ts` y la prop `estructurados`; agregar el JSON-LD de la portada y de cada negocio. Validar los dos en el validador de schema.org.
4. Instalar `@astrojs/sitemap` con su filtro y crear `src/pages/robots.txt.ts`. Comprobar que `dist/sitemap-index.xml` lista las páginas públicas y ninguna de `/admin`.
5. Agregar el script de Umami a `Layout` con `PUBLIC_UMAMI_ID` y crear `src/lib/analitica.ts`. Comprobar que sin la variable el HTML no tiene el script.
6. Agregar los atributos `data-umami-event` a los componentes de la tabla de eventos.
7. Conectar `registrarBusqueda` en `CatalogoNegocios` y `MenuNegocio`, y `registrar('sumate_enviado')` en `FormularioSumate`. Comprobar con un `window.umami` falso en la consola que se llaman con los datos esperados.
8. Agregar la tarjeta "Estadísticas" a `/admin` y las dos variables a `.env.example`.
9. Reescribir `/aviso-de-privacidad`.
10. Paso manual: crear el sitio en Umami Cloud con el dominio de producción y su enlace compartido; poner `PUBLIC_UMAMI_ID` y `PUBLIC_UMAMI_TABLERO` en Vercel (Production); crear en Cloudflare Email Routing la regla `privacidad@` → buzón del desarrollador; publicar en `main`.
11. Medir con Lighthouse móvil en producción `/`, `/colabora` y `/colabora/cafe-del-jardin`. Si alguna tiene LCP de 2.5 s o más, corregir (por ejemplo `fetchpriority="high"` o medidas de la imagen principal) y volver a medir.
12. Actualizar `specs/README.md` (la 11 con este título y su enlace; nueva fila 12 "Anuncios" con RF-18 "Por escribir"; quitar el pendiente de favicons) y `CLAUDE.md` (favicons y su script, `seo.ts`, `analitica.ts`, eventos de Umami, las dos variables nuevas, mapa del sitio, `robots.txt` y el correo de privacidad).

## Criterios de aceptación

### Favicons

- [x] `public/favicon.svg` ya no existe y `public/` tiene `favicon.ico` (32×32), `icono.png` (192×192) y `apple-touch-icon.png` (180×180) con el logo del refugio.
- [x] Las páginas públicas y las de `/admin` enlazan los tres archivos y ninguna enlaza `favicon.svg`.

### Etiquetas para compartir

- [x] Cada página pública compilada tiene `canonical`, `og:title`, `og:description`, `og:url`, `og:image` (URL absoluta), `og:locale` `es_MX` y `twitter:card`.
- [x] `/colabora/cafe-del-jardin` usa el logo del negocio en `og:image` y `twitter:card` `summary`; `/` usa la foto principal del refugio y `summary_large_image`.
- [x] Un negocio sin logo usa la foto del refugio en `og:image`.
- [x] `/404` tiene `<meta name="robots" content="noindex">` y las demás páginas públicas no.
- [ ] Pegar la URL de producción de un negocio en WhatsApp muestra su nombre, su descripción y su logo.

### Datos estructurados

- [x] La portada tiene un JSON-LD `AnimalShelter` con nombre, URL, logo, teléfono y las 4 redes en `sameAs`.
- [x] `/colabora/cafe-del-jardin` tiene un JSON-LD `CafeOrCoffeeShop` con dirección, horarios y geo si la semilla trae coordenadas.
- [x] Un negocio de una categoría sin tipo en el mapa usa `LocalBusiness`.
- [x] Un turno que cruza la medianoche aparece con `closes` menor que `opens`, y los días "Por confirmar" y "Cerrado" no aparecen.
- [x] El validador de schema.org (validator.schema.org) no marca errores en la portada ni en `/colabora/cafe-del-jardin`.
- [x] Un texto con `</script>` en `descripcion_corta` no rompe el HTML (se escribe como `</script>`).

### Mapa del sitio y robots

- [x] `dist/sitemap-index.xml` existe y su mapa lista `/`, `/adopta`, `/esterilizacion`, `/donar`, `/colabora`, `/colabora/sumate`, `/aviso-de-privacidad` y cada negocio publicado.
- [x] El mapa no lista ninguna ruta de `/admin` ni `/404`.
- [x] `/robots.txt` tiene `Disallow: /admin` y `Sitemap: {PUBLIC_URL_SITIO}/sitemap-index.xml`.

### Analítica

- [x] Sin `PUBLIC_UMAMI_ID`, ninguna página tiene el script de Umami; con ella, todas las públicas lo tienen y ninguna de `/admin`.
- [x] El script lleva `data-domains` con el host de producción, `data-exclude-search`, `data-exclude-hash` y `data-do-not-track`.
- [ ] El sitio no crea ninguna cookie (revisado en las herramientas del navegador en producción).
- [x] Cada enlace de la tabla de eventos lleva su `data-umami-event` y sus datos en el HTML compilado.
- [x] Escribir "Chilaquiles" en el catálogo y esperar 1 s llama una vez a `umami.track('busqueda', { lugar: 'catalogo', texto: 'chilaquiles' })`; escribir una sola letra no llama.
- [x] Buscar "latte" en el menú del café llama a `umami.track` con `lugar: 'menu'` y `negocio: 'cafe-del-jardin'`.
- [x] Enviar Súmate con éxito llama a `umami.track('sumate_enviado')`; con el campo trampa lleno, no.
- [x] Sin el script cargado (bloqueador de anuncios), buscar y enviar Súmate funcionan sin errores en la consola.
- [ ] En producción, cambiar filtros del catálogo y pestañas del menú no suma visitas en Umami.
- [ ] En producción, un clic a WhatsApp de un peludo aparece en Umami como evento `whatsapp` con `motivo` `adopcion` y el nombre del peludo.
- [ ] El enlace compartido de Umami muestra las visitas y los eventos de los últimos 7 días sin iniciar sesión.

### Panel

- [x] Con `PUBLIC_UMAMI_TABLERO`, `/admin` muestra la tarjeta "Estadísticas" a la cuenta `administrador` y a la cuenta `refugio`, y abre el tablero en otra pestaña; sin la variable, no aparece.

### Aviso de privacidad

- [x] `/aviso-de-privacidad` tiene las 9 secciones en el orden de la spec, la nota "pendiente de revisión legal" y la fecha de última actualización.
- [x] El aviso nombra al refugio como responsable con su ubicación y da `privacidad@ladridosdeesperanza.org` como enlace `mailto:`.
- [x] El aviso menciona Umami, Supabase y Vercel, y dice que el sitio no usa cookies.
- [ ] Un correo enviado a `privacidad@ladridosdeesperanza.org` llega al buzón del desarrollador.
- [x] El formulario Súmate y el pie siguen enlazando el aviso.

### Rendimiento

- [ ] Lighthouse móvil en producción da LCP menor a 2.5 s en `/`, `/colabora` y `/colabora/cafe-del-jardin`; los valores medidos se anotan en las observaciones de esta spec.

### Compilación

- [x] `astro build` y `astro check` terminan sin errores.
- [x] A 360 px, `/aviso-de-privacidad` y `/admin` no tienen desplazamiento horizontal.

### Observaciones de la validación

Validado el 2026-10-02 en local, con Supabase en Docker (Colima), `astro build`, `astro check` y `astro preview`; Chromium sin interfaz (Playwright) a 360 y 1024 px, con un `window.umami` falso inyectado antes de cargar cada página.
Las sesiones `aal2` del panel se abrieron con el script de Node que calcula los códigos TOTP.

- **Paso 10 (manual), pendiente.** Crear el sitio en Umami Cloud y su enlace compartido, poner `PUBLIC_UMAMI_ID` y `PUBLIC_UMAMI_TABLERO` en Vercel (solo Production) y crear la regla `privacidad@` en Cloudflare Email Routing (revisando que los correos del panel por Resend sigan saliendo). Los criterios que dependen de producción siguen sin marcar.
- **Paso 11 (rendimiento).** Lighthouse 13 móvil (simulado, con la limitación por omisión) sobre `astro preview` local: `/` LCP 1.7 s, `/colabora` 1.5 s y `/colabora/cafe-del-jardin` 1.7 s (CLS 0, 0 y 0.036; puntuación 100 en las tres). No hubo nada que corregir; falta repetir la medición en producción después de publicar.
- **Prop `textoImagen`.** `Layout` y `LayoutColabora` reciben además `textoImagen` para el `og:image:alt` ("Logo de {negocio}"); la imagen sola no trae el nombre del negocio.
- **Favicons.** `favicon.ico` es un contenedor ICO con un PNG de 32 × 32; `icono.png` (192 × 192) y `apple-touch-icon.png` (180 × 180) salen del mismo `logo.jpg`. Las 14 páginas públicas y las de `/admin` enlazan los tres archivos.
- **Etiquetas para compartir.** La semilla no trae logos de negocio: el criterio del logo se probó poniendo en local el `logo.jpg` del refugio como logo del Café del Jardín (`og:image` del logo, 225 × 225, `twitter:card` `summary`, alt "Logo de Café del Jardín") y se revirtió. Sin logo, el café usa la foto del patio y `summary_large_image`. La URL canónica lleva la diagonal final, igual que el mapa del sitio.
- **Datos estructurados.** validator.schema.org (su endpoint `validate` con el HTML compilado) da 0 errores y 0 avisos en la portada (`AnimalShelter`), el Café del Jardín (`CafeOrCoffeeShop`) y Tacos Don Chuy (`Restaurant`). Tacos Don Chuy trae `geo` y teléfono, el sábado con `opens` 13:00 y `closes` 00:30, y sin domingo. El café no tiene coordenadas en la semilla, así que no lleva `geo`. Una categoría temporal `neverias` dio `LocalBusiness`, y una `descripcion_corta` con `</script><b>x</b>` quedó como `\u003c/script>` en el JSON-LD; en los atributos `content` sigue tal cual, que es HTML válido dentro de comillas.
- **Mapa del sitio y robots.** `sitemap-0.xml` lista las 7 páginas públicas y los 6 negocios publicados de la base local (los 5 de la semilla y uno creado en pruebas del panel); ninguna de `/admin` ni `/404`.
- **Analítica.** Sin `PUBLIC_UMAMI_ID` ninguna página tiene el script; con un valor de prueba lo tienen las 14 públicas y ninguna de `/admin`, con `data-domains` igual al host de `PUBLIC_URL_SITIO`. "c" no manda nada; "Chilaquiles" manda una sola vez `busqueda` con `{ lugar: 'catalogo', texto: 'chilaquiles' }` a 1 s de la última tecla, y agregar un espacio no la repite. "latte" en el menú manda `{ lugar: 'menu', negocio: 'cafe-del-jardin', texto: 'latte' }`. Súmate manda `sumate_enviado` solo tras el `insert`; con el campo trampa, nada. Sin `window.umami`, buscar y enviar Súmate no dejan errores en la consola, y la página no crea cookies (local).
- **Panel.** Con `PUBLIC_UMAMI_TABLERO`, las cuentas `administrador` y `refugio` ven "Estadísticas" con `target="_blank"`; sin la variable no se compila la tarjeta. `/admin` y `/aviso-de-privacidad` miden 360 px de ancho a 360 px.
- **Aviso.** El salto de línea antes del enlace al correo se perdía al compilar ("escríbenos aprivacidad@…"); se arregló con `{' '}`.


## Decisiones

- **Sí:** dividir la 11 y dejar los anuncios en la 12. Los anuncios piden RPC, panel y espacios en las páginas; lo demás casi no toca la base.
- **Sí:** analítica y aviso en la misma spec. El aviso tiene que describir lo que mide la analítica.
- **Sí:** Umami Cloud. Sin cookies, plan gratuito suficiente para el tráfico esperado y eventos personalizados incluidos.
- **No:** Plausible. Igual de bueno, pero de pago después de la prueba.
- **No:** Vercel Web Analytics. Los eventos personalizados (WhatsApp, búsquedas) piden el plan Pro.
- **No:** tabla propia en Supabase. Habría que construir el tablero y defenderse del spam de eventos.
- **Sí:** el tablero de RF-20 es el enlace compartido de Umami desde `/admin`. Nadie del refugio necesita cuenta en Umami.
- **No:** tablero propio en `/admin`. Leer la API de Umami pide una llave que no puede ir en un sitio estático.
- **Sí:** clics con atributos `data-umami-event`. Sin JavaScript propio y fácil de revisar en el HTML.
- **Sí:** mandar el texto normalizado de las búsquedas. Sirve para saber qué platillos busca la gente; no es un dato personal y el aviso lo dice.
- **Sí:** esperar 1 s y pedir 2 letras antes de mandar una búsqueda. Una búsqueda por intención, no una por tecla.
- **Sí:** `data-exclude-search` y `data-exclude-hash`. Los filtros y las pestañas cambian la URL y contarían como visitas.
- **Sí:** respetar "no rastrear". Coherente con un sitio que promete no rastrear.
- **Sí:** variables de Umami solo en Production y opcionales. Las vistas previas y el desarrollo no ensucian las cifras y nada se rompe sin ellas.
- **Sí:** imagen para compartir por página con las imágenes que ya hay. El logo identifica al negocio en WhatsApp sin dependencias nuevas.
- **No:** imágenes generadas al compilar. Más trabajo y una dependencia para algo que el logo ya resuelve.
- **Sí:** tipo de schema.org según la categoría, con `LocalBusiness` por omisión. Más específico para Google; una categoría nueva no rompe nada.
- **Sí:** `addressLocality` fijo en Tenancingo. La spec padre limita el alcance a Tenancingo.
- **Sí:** `@astrojs/sitemap`. Integración oficial que se entera sola de las rutas generadas.
- **No:** mapa del sitio a mano. Habría que listar cada ruta y mantenerla.
- **Sí:** favicons desde el logo actual de 225 px. Se ven bien a 32 px; se regeneran con el mismo script cuando llegue el original.
- **No:** manifiesto web. El sitio no se instala como app.
- **Sí:** aviso completo con la estructura de la LFPDPPP y la nota "pendiente de revisión legal". Cubre lo que el sitio hace hoy sin fingir una revisión que no ha ocurrido.
- **Sí:** el refugio como responsable. Es quien recibe y usa las solicitudes.
- **Sí:** derechos ARCO por `privacidad@ladridosdeesperanza.org`. Deja constancia escrita, a diferencia de WhatsApp.
- **Sí:** la redirección llega al buzón del desarrollador. Se cambia en Cloudflare cuando el refugio tenga correo propio.
- **Sí:** guardar las solicitudes hasta que se pida borrarlas o deje de haber colaboración. Es lo que hace el sitio hoy; no hay borrado automático.
- **Sí:** de los requisitos no funcionales, solo rendimiento móvil. Accesibilidad AA y respaldos diarios quedan para otra spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un bloqueador impide cargar Umami y un script falla al llamarlo | `registrar()` usa `window.umami?.track`; hay un criterio sin el script. |
| Las cifras se inflan con visitas desde vistas previas o `localhost` | Variables solo en Production y `data-domains` con el host de producción. |
| Umami cambia su plan gratuito o deja de existir | La integración es un `<script>` y atributos `data-umami-event`; cambiar de proveedor toca `Layout` y `analitica.ts`, y los atributos se renombran con una búsqueda. |
| El texto buscado contiene un dato personal (alguien escribe su teléfono) | Se recorta a 60 caracteres y el aviso dice que se guarda; Umami no lo liga a nadie. |
| El logo de 225 px y la foto del patio (387×516, vertical) se ven chicos o recortados al compartir | Se aceptan por ahora; "Antes de publicar" del índice ya pide las imágenes originales. |
| Cloudflare Email Routing choca con los registros de Resend | Resend usa el subdominio `send` para su MX; Email Routing usa el dominio raíz. El paso 10 revisa que los correos del panel sigan saliendo. |
| El aviso no cumple algún punto de la ley | La nota "pendiente de revisión legal" sigue visible hasta que lo revise un profesional. |
| Un texto de la base rompe el JSON-LD o el HTML | `jsonLd()` escapa `<`; hay un criterio con `</script>`. |

## Lo que **no** entra en esta spec

- Anuncios y su panel (SPEC 12).
- Anuncios automáticos tipo AdSense.
- Tablero de estadísticas propio.
- Revisión de accesibilidad AA.
- Respaldos diarios.
- Imágenes para compartir generadas al compilar.
- Manifiesto web o app instalable.
- Revisión legal del aviso.
- Banner de cookies.

Cada una de estas, si llega, va en su propia spec.
