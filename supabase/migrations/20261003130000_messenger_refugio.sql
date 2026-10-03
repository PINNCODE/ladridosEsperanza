-- Contacto por Messenger (SPEC 18): el refugio no tiene WhatsApp, atiende por mensajes directos en la
-- página de Facebook SOS Ladridos de Esperanza Tenancingo. `messenger` es lo que va después de m.me/:
-- el usuario de la página o su id numérico. El update dispara el trigger de recompilación de refugio.
alter table refugio add column messenger text;

update refugio set messenger = '100067644922613' where id = 'refugio';

alter table refugio
	alter column messenger set not null,
	add constraint refugio_messenger_valido check (messenger ~ '^[A-Za-z0-9.]{5,50}$');

-- El número era de relleno; los negocios conservan su propio whatsapp.
alter table refugio drop column whatsapp;
