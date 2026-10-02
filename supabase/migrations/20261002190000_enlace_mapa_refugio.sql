-- Enlace de Google Maps a la ficha del refugio. Si existe, "Cómo llegar" lo usa en lugar de las
-- coordenadas, porque abre el lugar con su nombre, fotos y reseñas y no solo un punto.
-- Se captura en Studio, así que la restricción solo admite enlaces https de Google Maps.
alter table refugio
	add column enlace_mapa text check (
		enlace_mapa ~ '^https://(www\.google\.com/maps/|maps\.google\.com/|maps\.app\.goo\.gl/)'
	);
