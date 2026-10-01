# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Playwright MCP screenshots always go in `.playwright-mcp-screenshots/` (pass `filename: ".playwright-mcp-screenshots/<name>.png"` to every screenshot call). Both that folder and `.playwright-mcp/` are git-ignored.

Build for production: `astro build`
Preview production build: `astro preview`

## Project Structure

This is an Astro 7 site (`ladridosdeesperanzaweb`) for the Ladridos de Esperanza animal shelter. Specs live in `specs/` (roadmap in `specs/README.md`); the parent spec and HTML prototype are in `referencias/`.

- `src/layouts/Layout.astro` — HTML shell (`lang="es-MX"`); props `titulo` and `descripcion`; renders the sample-data ribbon, `Encabezado`, `<main>` and `Pie`, plus an optional `barra` slot (adds `viewport-fit=cover` and bottom padding when used)
- `src/layouts/LayoutColabora.astro` — `Layout` plus the fixed bottom bar `BarraRefugio` (Adopta / Esteriliza / Dona); every `/colabora` page uses it
- `src/pages/` — file-based routes (`index.astro` home with 8 sections, `adopta.astro`, `esterilizacion.astro`, `donar.astro`, `404.astro`, `colabora/index.astro` catalog "Come por los Peludos"); there is no `/transparencia` and the site never shows money the shelter received
- `src/components/` — `Encabezado`, `Pie`, `CintaEjemplo`, `Icono` (only way to render Lucide icons; `nombre` in kebab-case), and reusable pieces `CarruselPeludos`, `TarjetaPeludo`, `CaminoHuellas`, `FigurasFlotantes`, `EncabezadoPagina` (the `<h1>` of each shelter page), `VisorCartel` (enlargeable poster in a native `<dialog>`), `ListaNecesidades`
- `src/components/portada/` — one component per home section (`Presentacion`, `Adopciones`, `QuienesSomos`, `Problematicas`, `Esterilizacion`, `Donativos`, `Colaboracion`, `RedesContacto`)
- `src/components/adopta/`, `src/components/esterilizacion/`, `src/components/donar/` — sections of each shelter page; the pages only assemble them
- `src/components/colabora/` — `BarraRefugio`, `TarjetaNegocio`, `CatalogoNegocios` (search, filters and "abierto ahora" in one native `<script>`; state lives in the URL `?q=&categoria=&abierto=1&promocion=1`) and `SumaTuNegocio`
- `src/styles/global.css` — Tailwind v4 import and design tokens in `@theme` (`bg-fondo`, `text-acento`, `font-titulos`, …); light mode only
- `src/styles/animaciones.css` — CSS-only animation classes (`latido`, `flotar`, `asomarse`, `huella`, `aparecer`); only `transform` and `opacity`, all off with "reduce motion"
- `src/content.config.ts` — all content collections with Zod schemas (Spanish `snake_case` fields)
- `src/data/` — collection data as JSON; one file per business in `src/data/negocios/`; editable shelter texts live in `bloques-contenido.json` by `seccion` (`quienes_somos`, `proceso_adopcion`, `esterilizacion_por_que`, `esterilizacion_cuidados`, `esterilizacion_preguntas`, `voluntariado`), and a part with no published block is not shown
- `src/lib/datos.ts` — the only place that reads collections (`obtener`, `obtenerRefugio`, plus queries such as `peludosDisponibles`, `proximaCampana(hoy)`, `campanaAnterior`, `necesidadesVigentes(hoy)`, `bloquesDeSeccion(seccion)`, `destinosDonativo`, `negociosPublicados`, `promocionVigente(negocio, hoy)`, `categoriasConNegocios`); pages never call `getCollection` directly
- `src/lib/formato.ts` — `formatearPesos`, `formatearFecha`, `formatearMes`, `parrafos` (splits block text on blank lines); dates are formatted in UTC because collection dates are UTC midnight
- `src/lib/whatsapp.ts` — `enlaceWhatsApp(numero, mensaje)`
- `src/lib/horarios.ts` — `momentoEnMexico`, `estadoHorario`, `formatearHora`; "abierto ahora" always in `America/Mexico_City`, with midnight-crossing shifts; no Astro imports so browser scripts can use it
- `src/lib/busqueda.ts` — `normalizar` (lowercase, no accents), `textoBusqueda(negocio, categoria)` built at compile time, `coincide` (every word must appear)
- `src/assets/` — images referenced from the data files

Fonts (Bricolage Grotesque, DM Sans) are self-hosted through the Astro fonts API in `astro.config.mjs`.

### Sample data

Every record has `es_ejemplo`. Records with `es_ejemplo: true` are only included when `PUBLIC_MOSTRAR_EJEMPLOS=true` (copy `.env.example` to `.env` for development). Without it they are filtered out, and the build fails until a real `refugio` record exists — this is intentional so sample data never ships. `.env` exists only locally, so a published preview with sample data needs `PUBLIC_MOSTRAR_EJEMPLOS=true` set in the hosting environment.

The build prints `[WARN] [file-loader] No items found` for `registros-cifras.json` and `anuncios.json` while they are empty arrays; this is expected.

Type check: `npx astro check`

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
