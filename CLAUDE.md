# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Build for production: `astro build`
Preview production build: `astro preview`

## Project Structure

This is an Astro 7 site (`ladridosdeesperanzaweb`). The current state is a clean scaffold:

- `src/layouts/Layout.astro` — base HTML shell with `<slot />` for page content
- `src/pages/index.astro` — entry page, composes Layout + Welcome component
- `src/components/` — Astro components

Pages map directly to routes (file-based routing). New pages go in `src/pages/`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
