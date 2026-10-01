# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

The site reads its data from Supabase at build time, so start local Supabase (Docker) before `astro dev` or `astro build`:

```
npx supabase start
```

`npx supabase db reset` reapplies the migrations and the seed. Data changes in Supabase show up in `astro dev` after restarting the dev server (the loaders run at startup).

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Playwright MCP screenshots always go in `.playwright-mcp-screenshots/` (pass `filename: ".playwright-mcp-screenshots/<name>.png"` to every screenshot call). Both that folder and `.playwright-mcp/` are git-ignored.

Build for production: `astro build`
Preview production build: `astro preview`
Type check: `npx astro check`

## Project Structure

This is an Astro 7 site (`ladridosdeesperanzaweb`) for the Ladridos de Esperanza animal shelter. Specs live in `specs/` (roadmap in `specs/README.md`); the parent spec and HTML prototype are in `referencias/`.

- `src/layouts/Layout.astro` — HTML shell (`lang="es-MX"`); props `titulo` and `descripcion`; renders the sample-data ribbon, `Encabezado`, `<main>` and `Pie`, plus an optional `barra` slot (adds `viewport-fit=cover` and bottom padding when used)
- `src/layouts/LayoutColabora.astro` — `Layout` plus the fixed bottom bar `BarraRefugio` (Adopta / Esteriliza / Dona); every `/colabora` page uses it
- `src/pages/` — file-based routes (`index.astro` home with 8 sections, `adopta.astro`, `esterilizacion.astro`, `donar.astro`, `404.astro`, `colabora/index.astro` catalog "Come por los Peludos", `colabora/[slug].astro` one page per published business); there is no `/transparencia` and the site never shows money the shelter received
- `src/components/` — `Encabezado`, `Pie`, `CintaEjemplo`, `Icono` (only way to render Lucide icons; `nombre` in kebab-case), and reusable pieces `CarruselPeludos`, `TarjetaPeludo`, `CaminoHuellas`, `FigurasFlotantes`, `EncabezadoPagina` (the `<h1>` of each shelter page), `VisorCartel` (enlargeable poster in a native `<dialog>`), `ListaNecesidades`
- `src/components/portada/` — one component per home section (`Presentacion`, `Adopciones`, `QuienesSomos`, `Problematicas`, `Esterilizacion`, `Donativos`, `Colaboracion`, `RedesContacto`)
- `src/components/adopta/`, `src/components/esterilizacion/`, `src/components/donar/` — sections of each shelter page; the pages only assemble them
- `src/components/colabora/` — `BarraRefugio`, `TarjetaNegocio`, `CatalogoNegocios` (search, filters and "abierto ahora" in one native `<script>`; state lives in the URL `?q=&categoria=&abierto=1&promocion=1`) and `SumaTuNegocio`; the business page uses `CabeceraNegocio`, `MenuNegocio` (group tabs with the active one in the hash `#menu-{grupo}`, plus a menu search; without JS every group shows), `HorariosNegocio`, `ContactoNegocio`, `AporteNegocio`, `NotaRefugio` and `MasNegocios`
- `src/styles/global.css` — Tailwind v4 import and design tokens in `@theme` (`bg-fondo`, `text-acento`, `font-titulos`, …); light mode only
- `src/styles/animaciones.css` — CSS-only animation classes (`latido`, `flotar`, `asomarse`, `huella`, `aparecer`); only `transform` and `opacity`, all off with "reduce motion"
- `src/content.config.ts` — all content collections with Zod schemas (Spanish `snake_case` fields, same as the Postgres columns); images are `{ url, ancho, alto }`
- `supabase/` — Supabase CLI project: `migrations/` (content tables with RLS and no policies, the public `imagenes` bucket, and the rebuild triggers plus the daily `pg_cron` job), `seed.sql` (all sample data; edit sample records here) and `semilla/imagenes/` (sample images loaded into the bucket); editable shelter texts live in `bloques_contenido` by `seccion` (`quienes_somos`, `proceso_adopcion`, `esterilizacion_por_que`, `esterilizacion_cuidados`, `esterilizacion_preguntas`, `voluntariado`), and a part with no published block is not shown
- `src/lib/supabase.ts` — build-time Supabase client with the secret key; only `src/lib/cargadores.ts` imports it
- `src/lib/cargadores.ts` — one content-collection loader per table; rebuilds the nested shape (menu, hours, promotion, images) the schemas expect
- `src/lib/imagenes.ts` — `Imagen` type and `medidas(imagen, ancho)` for `<Image>` with remote images
- `src/lib/datos.ts` — the only place that reads collections (`obtener`, `obtenerRefugio`, plus queries such as `peludosDisponibles`, `proximaCampana(hoy)`, `campanaAnterior`, `necesidadesVigentes(hoy)`, `bloquesDeSeccion(seccion)`, `destinosDonativo`, `negociosPublicados`, `promocionVigente(negocio, hoy)`, `categoriasConNegocios`, `menuDisponible(negocio)` without unavailable dishes); pages never call `getCollection` directly
- `src/lib/formato.ts` — `formatearPesos`, `formatearFecha`, `formatearMes`, `formatearPrecio`, `parrafos` (splits block text on blank lines); dates are formatted in UTC because collection dates are UTC midnight
- `src/lib/whatsapp.ts` — `enlaceWhatsApp(numero, mensaje?)`
- `src/lib/mapas.ts` — `enlaceMapa(negocio, ubicacion)`: Google Maps search with coordinates, or name and address
- `src/lib/horarios.ts` — `momentoEnMexico`, `estadoHorario`, `formatearHora`, `textoDia`; "abierto ahora" always in `America/Mexico_City`, with midnight-crossing shifts; no Astro imports so browser scripts can use it
- `src/lib/busqueda.ts` — `normalizar` (lowercase, no accents), `textoBusqueda(negocio, categoria)` built at compile time, `coincide` (every word must appear), `textoPlatillo` and `idGrupo` for the business menu

Fonts (Bricolage Grotesque, DM Sans) are self-hosted through the Astro fonts API in `astro.config.mjs`.

### Sample data

Every collection record has `es_ejemplo`. Records with `es_ejemplo: true` are only included when `PUBLIC_MOSTRAR_EJEMPLOS=true` (copy `.env.example` to `.env` for development; it also has the local `SUPABASE_URL`; paste the local secret key from `npx supabase status` into `SUPABASE_SECRET_KEY`). Without it they are filtered out, and the build fails until a real `refugio` record exists — this is intentional so sample data never ships. `.env` exists only locally, so a published preview with sample data needs `PUBLIC_MOSTRAR_EJEMPLOS=true` set in the hosting environment.

### Hosting

The site is static and hosted on Vercel from `main`, with `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `PUBLIC_MOSTRAR_EJEMPLOS=true` set there. Any change to a content table calls the Vercel deploy hook through `pg_net` (once per statement), and `pg_cron` calls it daily at 00:05 Mexico City time. The hook URL lives only in Supabase Vault as `deploy_hook_vercel`; without it (local development) nothing is called.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
