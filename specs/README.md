# Índice de specs — Ladridos de Esperanza

Hoja de ruta para construir el MVP descrito en `referencias/spec-ladridos-de-esperanza.md` (spec padre).
El prototipo de referencia es `referencias/Ladridos de Esperanza — Refugio en Tenancingo (prototipo).html`.
Cada spec deja el sitio funcionando y se implementa con `/spec-impl NN-slug` una vez aprobada.

## Estado

| # | Spec | Estado | Cubre (RF de la spec padre) |
| --- | --- | --- | --- |
| 01 | [Fundación del sitio y datos de ejemplo](01-fundacion-y-datos-de-ejemplo.md) | Implementado | Base de RF-14, RF-27 y RF-32; modelo de datos completo |
| 02 | [Portada del refugio](02-portada-del-refugio.md) | Implementado | RF-21, RF-22, RF-23, RF-28, RF-30, RF-31 |
| 03 | Páginas del refugio: `/adopta`, `/esterilizacion`, `/donar`, `/transparencia` | Por escribir | RF-11, RF-12, RF-24, RF-25, RF-26, RF-19 (solo lectura) |
| 04 | Catálogo `/colabora` con búsqueda, filtros y barra fija | Por escribir | RF-01, RF-02, RF-03, RF-13 |
| 05 | Página de negocio `/colabora/[slug]` | Por escribir | RF-04 a RF-10 |
| 06 | Datos en Supabase sin cambiar las páginas | Por escribir | Base para 07 y 08 |
| 07 | Formulario Súmate y panel `/admin` | Por escribir | RF-15, RF-16, RF-17, RF-29 |
| 08 | Anuncios, analítica, SEO y aviso de privacidad | Por escribir | RF-18, RF-20 y requisitos no funcionales |

## Decisiones que aplican a todas las specs

- Los datos se leen de content collections (`src/content.config.ts`, archivos en `src/data/`) hasta la SPEC 06.
- Ninguna página llama a `getCollection` directamente: siempre pasa por `src/lib/datos.ts`.
- La interactividad del sitio público se hace con `<script>` nativos de Astro, sin Svelte ni React.
- Campos de datos en español y `snake_case`.
- Los registros `es_ejemplo` solo se muestran con `PUBLIC_MOSTRAR_EJEMPLOS=true`.
- La calculadora de aportes del prototipo no forma parte del sitio.

## Pendiente de decidir antes de escribir cada spec

- **03:** si `/adopta` reutiliza el carrusel de la portada o usa una cuadrícula.
- **05:** si el QR (RF-17) se genera al compilar o en el panel.
- **06:** que el sitio también se recompile a diario, para que las necesidades vencidas y las campañas pasadas dejen de mostrarse (la SPEC 02 las filtra con la fecha de compilación).
- **06:** adaptador de hospedaje (Vercel o Cloudflare Pages) y cómo se recompila el sitio cuando cambia un dato (RF-16 pide menos de 1 minuto). Incluye configurar `PUBLIC_MOSTRAR_EJEMPLOS` en el hospedaje para la vista previa con ejemplos.
- **07:** framework del panel (la spec padre propone React) y verificación en dos pasos con Supabase.
- **08:** reemplazar los favicons de Astro (`public/favicon.svg` y `favicon.ico`) por los del refugio, junto con los metadatos para compartir.

## Antes de publicar

- Pedirle al refugio las fotos y el logo en resolución original. Las del prototipo vienen en baja resolución (Luna y Canelo miden menos de 200 px de ancho, el patio 387 px y el logo 225 px) y se ven borrosas en pantallas de alta densidad.
