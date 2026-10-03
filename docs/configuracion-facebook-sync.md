# Sincronización desde Facebook

Cada día, a medianoche de Ciudad de México, un workflow de GitHub Actions lee las publicaciones recientes de las dos páginas de Facebook del refugio y crea **borradores** en el panel (SPEC 15 y SPEC 16):

- [SOS Ladridos de Esperanza Tenancingo](https://www.facebook.com/p/Sos-Ladridos-de-Esperanza-Tenancingo-100067644922613/)
- [Ladridos Esperanza](https://www.facebook.com/ladridos.esperanza.5/)

Nada se publica solo. Un peludo en adopción, una campaña de esterilización o una necesidad (lo que pide el refugio: alimento, arena, medicinas…) aparecen arriba en `/admin/peludos`, `/admin/campanas` o `/admin/necesidades` con la etiqueta **Por revisar** y el enlace **Ver en Facebook**. Al abrirlos y **Guardar** se publican; **Borrar** los descarta. Un post de "¡ya fue adoptado!" solo muestra el aviso "Facebook dice que fue adoptado" junto al peludo; el estado se cambia a mano.

Si a un post le falta un dato obligatorio (el nombre o la especie del peludo; la fecha, el lugar o el costo de la campaña), no se crea nada: queda en la tabla `publicaciones_facebook` como `incompleto` con su motivo y el refugio lo captura a mano. El script nunca inventa un dato.

Un post de adopción sin fotos (solo video o solo texto) sí crea el borrador, con la etiqueta **Sin foto**. Los videos no se leen: ni el video ni su miniatura se descargan ni van a Gemini. El panel no deja guardar un peludo sin al menos una foto, así que el refugio la agrega antes de publicarlo.

Las necesidades no se repiten. Un post crea un borrador por cada cosa **nueva** que pide (hasta 6); lo que ya está registrado como necesidad, borrador o publicada y de cualquier fecha, no se vuelve a crear ni se cambia. Si todo ya estaba, el post queda `ignorado` con `ya_registradas`. La vigencia es la fecha escrita en el post o, si no la dice, 30 días después del post; la urgencia es "Urgente" solo si el post dice "urgente", "urge", "urgencia" o "emergencia". El dinero (apoyo económico, donativos, transferencias), las rifas y los eventos no son necesidades. Si una necesidad ya registrada venció y se vuelve a pedir, se extiende su vigencia a mano en el panel.

## Cómo funciona

1. `scripts/sincronizar-facebook.mjs` pide a Apify (actor `apify/facebook-posts-scraper`) los últimos 10 posts de cada página.
2. Salta los que ya están en `publicaciones_facebook`.
3. Lee las necesidades reales ya registradas (`id`, `tipo` y `descripcion`).
4. Manda el texto, la primera foto (si tiene) y esa lista a Gemini (`gemini-flash-lite-latest`), que responde con un JSON con esquema fijo: categoría, datos del peludo, de la campaña o de cada necesidad (con el id de la ya registrada que pide lo mismo) y el texto que se lee en la foto.
5. Revisa que el nombre, la fecha, el costo y el cupo estén escritos en el post (en su texto o en el cartel), y que cada necesidad tenga alguna palabra escrita en el post.
6. Reduce las fotos con `sharp` (JPEG, 1600 px; 2400 px el cartel) y las sube al bucket `imagenes` como `peludos/fb-{post}-{n}.jpg` o `campanas/fb-{post}-1.jpg`.
7. Registra todo con la RPC `importar_post_facebook` en una sola transacción, que vuelve a descartar una necesidad con el mismo tipo y la misma descripción que una existente. Si falla, borra las fotos que subió y el post se reintenta al día siguiente.

Insertar un borrador dispara el deploy hook de Vercel como cualquier cambio de contenido, pero el sitio no lo muestra hasta que se guarda en el panel.

## Llaves

| Secreto | De dónde sale |
| --- | --- |
| `APIFY_TOKEN` | [Apify](https://console.apify.com/) → Settings → API & Integrations → Personal API token |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) → Get API key |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL (`https://oszxkkjnwxuztmbrmvja.supabase.co`) |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) |

Se guardan en GitHub: repositorio `PINNCODE/ladridosEsperanza` → Settings → Secrets and variables → Actions → New repository secret. Nunca en el código ni en un archivo con commit.

## Puesta en marcha (después del merge)

1. Aplicar las migraciones en la nube: `npx supabase db push`.
2. Crear los cuatro secretos en GitHub.
3. GitHub → Actions → **Sincronizar Facebook** → **Run workflow**, y revisar el resumen al final del log.

## Probar en local

Simulación: lee Apify y Gemini e imprime lo que haría, sin subir fotos ni escribir en Supabase.

```bash
APIFY_TOKEN=… GEMINI_API_KEY=… node scripts/sincronizar-facebook.mjs --dry-run
```

Contra Supabase local (`npx supabase start`), con la llave secreta de `npx supabase status`:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=… APIFY_TOKEN=… GEMINI_API_KEY=… \
  node scripts/sincronizar-facebook.mjs
```

Una segunda ejecución seguida debe decir "Ya registrado" en todos los posts.

## Problemas comunes

- **La ejecución sale en rojo.** El script termina con código 1 si Apify falla o si algún post dio error; el log dice cuál. Los posts con error se reintentan al día siguiente.
- **Gemini responde 404.** El modelo ya no está disponible para la llave. Agregar la variable `GEMINI_MODELO` (en el workflow, con otro modelo de `https://generativelanguage.googleapis.com/v1beta/models`) o cambiar el valor por omisión en el script.
- **Gemini responde 503 o 429.** Demanda alta o límite por minuto; el script reintenta dos veces y deja el post para el día siguiente.
- **"Se acabó la cuota diaria".** La capa gratis de Gemini permite 20 peticiones al día por modelo. Solo los posts nuevos cuentan, así que basta en el día a día; si se agota, la ejecución se detiene y los posts pendientes entran al día siguiente. Para probar varias veces el mismo día, usar otro modelo con `GEMINI_MODELO`.
- **Volver a procesar un post.** Borrar su fila de `publicaciones_facebook` en Studio; entra en la siguiente ejecución si sigue entre los 10 más recientes de su página. Por ejemplo, tras la SPEC 16, las filas con `resultado = 'ignorado'` o `motivo = 'sin_foto'` de la primera ejecución, para que las necesidades y las adopciones con video entren.
