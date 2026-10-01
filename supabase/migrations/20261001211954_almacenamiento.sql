-- Bucket público de imágenes del sitio (SPEC 06): logos, fotos de peludos, carteles y bloques.
-- Es público para leer por URL; subir y borrar queda para el panel de la SPEC 07.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public;
