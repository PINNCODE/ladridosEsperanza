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

- `src/layouts/Layout.astro` — HTML shell (`lang="es-MX"`); props `titulo` and `descripcion`; renders the sample-data ribbon, `Encabezado`, `<main>` and `Pie`
- `src/pages/` — file-based routes (`index.astro` provisional home, `404.astro`)
- `src/components/` — `Encabezado`, `Pie`, `CintaEjemplo`, and `Icono` (only way to render Lucide icons; `nombre` in kebab-case)
- `src/styles/global.css` — Tailwind v4 import and design tokens in `@theme` (`bg-fondo`, `text-acento`, `font-titulos`, …); light mode only
- `src/content.config.ts` — all content collections with Zod schemas (Spanish `snake_case` fields)
- `src/data/` — collection data as JSON; one file per business in `src/data/negocios/`
- `src/lib/datos.ts` — the only place that reads collections (`obtener`, `obtenerRefugio`); pages never call `getCollection` directly
- `src/lib/whatsapp.ts` — `enlaceWhatsApp(numero, mensaje)`
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
