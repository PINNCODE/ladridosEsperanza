# Índice de specs — Ladridos de Esperanza

Hoja de ruta para construir el MVP descrito en `referencias/spec-ladridos-de-esperanza.md` (spec padre).
El prototipo de referencia es `referencias/Ladridos de Esperanza — Refugio en Tenancingo (prototipo).html`.
Cada spec deja el sitio funcionando y se implementa con `/spec-impl NN-slug` una vez aprobada.

## Estado

| # | Spec | Estado | Cubre (RF de la spec padre) |
| --- | --- | --- | --- |
| 01 | [Fundación del sitio y datos de ejemplo](01-fundacion-y-datos-de-ejemplo.md) | Implementado | Base de RF-14, RF-27 y RF-32; modelo de datos completo |
| 02 | [Portada del refugio](02-portada-del-refugio.md) | Implementado | RF-21, RF-22, RF-23, RF-28, RF-30, RF-31 |
| 03 | [Páginas del refugio: adopta, esterilización y donar](03-paginas-adopta-esterilizacion-donar.md) | Implementado | RF-11, RF-12, RF-24, RF-25, RF-26; retira Transparencia (RF-19 sale del MVP) |
| 04 | [Catálogo `/colabora` con búsqueda, filtros y barra fija](04-catalogo-colabora.md) | Implementado | RF-01, RF-02, RF-03, RF-13 |
| 05 | [Página de negocio `/colabora/[slug]`](05-pagina-de-negocio.md) | Implementado | RF-04 a RF-10; el QR (RF-17) pasa a la 07 |
| 06 | [Datos en Supabase y publicación en Vercel](06-datos-en-supabase.md) | Implementado | Base para 07 y 08; parte de RF-16 (cambio visible en menos de 1 minuto) |
| 07 | [Formulario Súmate y base del panel `/admin`](07-sumate-y-base-del-panel.md) | Implementado | RF-15, RF-17 (QR por negocio) y la base de RF-16 (sesión con TOTP, roles y RLS) |
| 08 | [Panel del refugio](08-panel-del-refugio.md) | Implementado | Parte de RF-16 (peludos y campañas), RF-22, RF-26 (editable) y RF-29; necesidades, textos e imágenes |
| 09 | [Panel de negocios](09-panel-de-negocios.md) | Implementado | Parte de RF-16 (negocios, horarios, promociones y categorías) |
| 10 | [Editor de menús](10-editor-de-menus.md) | Implementado | Parte de RF-16 (menús: grupos, secciones, platillos y precios) |
| 11 | [SEO, analítica y aviso de privacidad](11-seo-analitica-y-aviso-de-privacidad.md) | Implementado | RF-20, aviso de privacidad completo y rendimiento móvil |
| 12 | [Portada con prioridades: qué es, dónde está y cómo ayudar](12-portada-con-prioridades.md) | Implementado | Reemplaza el orden de RF-30 (los peludos pasan al 3.er lugar); ubicación y "Cómo llegar" del refugio |
| 13 | [Adopciones: galería con "me gusta" y ficha de cada peludo](13-adopciones-galeria-y-ficha.md) | Implementado | Reemplaza la cuadrícula de RF-11; ficha `/adopta/{id}`, convivencia, hitos con padrino y "me gusta" público |
| 14 | [Fotos del refugio: carrusel en la portada y fotos en las páginas](14-fotos-del-refugio-y-carrusel-de-portada.md) | Implementado | Carrusel de 9 fotos reales en la presentación (RF-21), fotos en esterilización, donativos en especie y los encabezados, e imagen para compartir; las fotos viven en el repo y `refugio.foto_principal_id` ya no existe |
| 15 | [Sincronización desde Facebook: borradores de peludos y campañas para revisar](15-sincronizacion-facebook.md) | Implementado | Requisito nuevo (no RF-19, que es Transparencia); lectura diaria con Apify y Gemini, borradores `por_revisar` que se publican al guardarlos en el panel y avisos de adopción |
| 16 | [Necesidades y adopciones sin foto desde Facebook](16-necesidades-y-adopciones-sin-foto.md) | Implementado | Requisito nuevo; borradores de necesidad sin repetir lo ya registrado, imagen genérica por tipo en "Necesidades del mes", adopciones sin foto (los videos no se leen) y foto obligatoria para publicar un peludo |
| 17 | [Datos reales y negocios ocultos](17-datos-reales-y-negocios-ocultos.md) | Aprobado (código listo; faltan los pasos de datos 7 a 10) | Sitio sin datos de ejemplo ni listón; todo lo de negocios oculto tras `PUBLIC_MOSTRAR_NEGOCIOS` (`docs/mostrar-negocios.md`) |
| 18 | [Contacto por Messenger](18-contacto-por-messenger.md) | Aprobado (código listo; faltan `npx supabase db push` y corregir 2 textos en `/admin/textos`, pasos 6 y 7) | El refugio no tiene WhatsApp: todo botón de contacto abre Messenger con la página SOS Ladridos de Esperanza Tenancingo y copia el mensaje; `refugio.messenger` reemplaza a `refugio.whatsapp` |
| 19 | Anuncios | Por escribir | RF-18 |

## Decisiones que aplican a todas las specs

- Los datos se leen de Supabase al compilar con loaders propios de content collections (`src/lib/cargadores.ts`, esquemas en `src/content.config.ts`); los datos de ejemplo viven en `supabase/seed.sql` (SPEC 06).
- Ninguna página llama a `getCollection` directamente: siempre pasa por `src/lib/datos.ts`.
- La interactividad del sitio público se hace con `<script>` nativos de Astro, sin Svelte ni React.
- Campos de datos en español y `snake_case`.
- Los registros `es_ejemplo` solo se muestran con `PUBLIC_MOSTRAR_EJEMPLOS=true`; Vercel no la tiene una vez hechos los pasos de datos de la SPEC 17.
- Lo de negocios solo se ve con `PUBLIC_MOSTRAR_NEGOCIOS=true` (SPEC 17).
- El refugio se contacta solo por Messenger (`EnlaceMessenger`, evento `mensaje`); WhatsApp queda solo para los negocios (SPEC 18).
- La calculadora de aportes del prototipo no forma parte del sitio.
- El formulario Súmate y el panel `/admin` son páginas estáticas que hablan con Supabase desde el navegador con la llave publicable; los protegen las políticas RLS, que exigen sesión `aal2` (TOTP) y el rol de `usuarios_panel` (SPEC 07).
- No se publica ningún monto de dinero recibido por el refugio, de personas ni de negocios; `/transparencia` y RF-19 salen del MVP (SPEC 03). La portada queda con 8 secciones y la colección `informes_transparencia` ya no existe. Las equivalencias de "En qué se usa un donativo" sí se muestran.
- Los peludos se ven en la galería de `/adopta` y en su ficha `/adopta/{id}` (SPEC 13). El "me gusta" es lo único que el sitio público escribe en Supabase además de Súmate, siempre con las RPC `marcar_me_gusta` y `conteos_me_gusta`.
- Las fotos del refugio (no las de los peludos) viven en `src/assets/refugio/` y se listan en `src/lib/fotosRefugio.ts`; se cambian con un commit (SPEC 14).
- Lo que llega solo (la sincronización con Facebook) entra como borrador `por_revisar` y no sale en el sitio hasta que alguien del refugio lo guarda en el panel; el script nunca inventa un dato obligatorio (SPEC 15). Las necesidades que llegan así no repiten una ya registrada, y ningún peludo se publica sin foto (SPEC 16).
- El orden de la portada es el de la SPEC 12: Presentación, Quiénes somos, Adopciones, Donativos, Esterilización, Problemáticas, Colaboración y Redes. Reemplaza el de RF-30 y la SPEC 02, que no se reescribieron.

## Pendiente de decidir antes de escribir cada spec

- **19:** anuncios (RF-18), por escribir.

## Antes de publicar

- Pedirle al refugio el logo y las fotos de los peludos en resolución original. Las del prototipo vienen en baja resolución (Luna y Canelo miden menos de 200 px de ancho y el logo 225 px) y se ven borrosas en pantallas de alta densidad. Las fotos del refugio ya son las originales (SPEC 14).
- Confirmar con el refugio cómo funcionan el apadrinamiento y el voluntariado (requisitos y condiciones) antes de publicar las tarjetas de `/donar`.
