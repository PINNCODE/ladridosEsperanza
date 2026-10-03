# Mostrar u ocultar los negocios ("Come por los Peludos")

Desde la SPEC 17 todo lo de negocios depende de la variable `PUBLIC_MOSTRAR_NEGOCIOS`. Solo con el valor `true` se ve; sin ella (o con otro valor) se oculta. En Vercel no existe, así que Producción y los Previews la ocultan. En local, `.env.example` la trae en `true`.

## Qué cambia con la variable

| Lugar | Con `PUBLIC_MOSTRAR_NEGOCIOS=true` | Sin la variable |
| --- | --- | --- |
| Menú del encabezado | "Negocios que ayudan" | No sale |
| Portada | Sección "Colaboración" | No sale (la portada queda con 7 secciones o menos) |
| `/donar` | Tarjeta "Come en negocios que ayudan" | No sale |
| `/colabora` y `/colabora/sumate` | Catálogo y formulario Súmate | Redirigen a `/` |
| `/colabora/{negocio}` | Página de cada negocio publicado | No se genera (404) |
| Sitemap | Incluye `/colabora` | No incluye nada de `/colabora` |
| Aviso de privacidad | Habla de Súmate y de los negocios | Solo del "me gusta", las estadísticas y WhatsApp |
| Panel (administrador) | Negocios, Categorías, Solicitudes y QR | No salen; sus páginas redirigen a `/admin` |

Nada se borra: el código, las tablas, las políticas RLS y los datos siguen igual. La variable se lee al compilar, así que un cambio solo se ve después de un nuevo deploy.

## Volver a mostrarlos

1. En Vercel, Settings → Environment Variables, agregar `PUBLIC_MOSTRAR_NEGOCIOS` con el valor `true` solo en Preview y volver a desplegar un Preview (por ejemplo, "Redeploy" del último Preview). Los Previews leen la misma base de la nube que Producción.
2. En `/admin` de ese Preview, cargar las categorías reales en Categorías y al menos un negocio con su menú en Negocios, con estado "Publicado". Agregar la variable también en Production (`true`).
3. Volver a desplegar Production: guardar cualquier cosa en el panel (el disparador llama al deploy hook) o "Redeploy" del último deploy en Vercel.
4. Revisar en https://www.ladridosdeesperanza.org:
   - el enlace "Negocios que ayudan" en el menú,
   - la sección de colaboración en la portada,
   - la tarjeta "Come en negocios que ayudan" en `/donar`,
   - `/colabora`, la página de cada negocio y `/colabora/sumate` (enviar una solicitud de prueba y verla en `/admin/solicitudes`),
   - `/sitemap-0.xml` con las URL de `/colabora`,
   - el aviso de privacidad con los párrafos de Súmate.
5. Imprimir los QR desde `/admin/qr` solo después de abrir la página publicada del negocio desde el dominio propio.

## Volver a ocultarlos

1. Borrar `PUBLIC_MOSTRAR_NEGOCIOS` de Vercel en Production y en Preview.
2. Volver a desplegar Production.

Los QR que ya estén impresos llevarán a la 404 mientras los negocios estén ocultos.
