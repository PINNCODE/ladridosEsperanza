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
| 13 | Anuncios | Por escribir | RF-18 |

## Decisiones que aplican a todas las specs

- Los datos se leen de Supabase al compilar con loaders propios de content collections (`src/lib/cargadores.ts`, esquemas en `src/content.config.ts`); los datos de ejemplo viven en `supabase/seed.sql` (SPEC 06).
- Ninguna página llama a `getCollection` directamente: siempre pasa por `src/lib/datos.ts`.
- La interactividad del sitio público se hace con `<script>` nativos de Astro, sin Svelte ni React.
- Campos de datos en español y `snake_case`.
- Los registros `es_ejemplo` solo se muestran con `PUBLIC_MOSTRAR_EJEMPLOS=true`.
- La calculadora de aportes del prototipo no forma parte del sitio.
- El formulario Súmate y el panel `/admin` son páginas estáticas que hablan con Supabase desde el navegador con la llave publicable; los protegen las políticas RLS, que exigen sesión `aal2` (TOTP) y el rol de `usuarios_panel` (SPEC 07).
- No se publica ningún monto de dinero recibido por el refugio, de personas ni de negocios; `/transparencia` y RF-19 salen del MVP (SPEC 03). La portada queda con 8 secciones y la colección `informes_transparencia` ya no existe. Las equivalencias de "En qué se usa un donativo" sí se muestran.
- El orden de la portada es el de la SPEC 12: Presentación, Quiénes somos, Adopciones, Donativos, Esterilización, Problemáticas, Colaboración y Redes. Reemplaza el de RF-30 y la SPEC 02, que no se reescribieron.

## Pendiente de decidir antes de escribir cada spec

- **13:** anuncios (RF-18), por escribir.

## Antes de publicar

- Pedirle al refugio las fotos y el logo en resolución original. Las del prototipo vienen en baja resolución (Luna y Canelo miden menos de 200 px de ancho, el patio 387 px y el logo 225 px) y se ven borrosas en pantallas de alta densidad.
- Confirmar con el refugio cómo funcionan el apadrinamiento y el voluntariado (requisitos y condiciones) antes de publicar las tarjetas de `/donar`.
