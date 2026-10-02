// /robots.txt (SPEC 11): todo el sitio público se indexa menos el panel, y el mapa del sitio
// lo genera @astrojs/sitemap.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
	const mapa = new URL('sitemap-index.xml', site);
	return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${mapa.href}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
