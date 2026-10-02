-- Ubicación del refugio (SPEC 12): dirección escrita y punto del enlace "Cómo llegar".
-- Las tres son opcionales y se capturan en Studio, sin RPC que valide, así que las restricciones
-- evitan coordenadas a medias o fuera de rango. El trigger de recompilación de refugio ya existe.
alter table refugio
	add column direccion text check (direccion is null or btrim(direccion) <> ''),
	add column latitud double precision check (latitud between -90 and 90),
	add column longitud double precision check (longitud between -180 and 180),
	add constraint refugio_coordenadas_completas check ((latitud is null) = (longitud is null));
