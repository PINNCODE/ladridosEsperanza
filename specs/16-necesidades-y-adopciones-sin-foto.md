# SPEC 16 — Necesidades y adopciones sin foto desde Facebook

> **Estado:** Implementado
> **Depende de:** SPEC 08, SPEC 15
> **Fecha:** 2026-10-02
> **Objetivo:** Que la sincronización de Facebook también reúna, sin repetir, las cosas que pide el refugio como borradores de necesidad (con una imagen genérica de su tipo en el sitio), y que guarde todo post de adopción aunque no traiga foto, para que el refugio la agregue antes de publicar.

## Por qué existe esta spec

La primera ejecución real de la SPEC 15 (3 de octubre de 2026, 20 posts) dejó fuera dos cosas que el refugio sí quiere en el sitio:

- "Buenas noches, amig@s, … necesitamos sobres o latas para los michis, también arena y sob…" quedó `ignorado` (`otro_tema`): la SPEC 15 dejó fuera las necesidades.
- Daisy, una chihuahua presentada en un reel, quedó `incompleto` (`sin_foto`): el script descarta los videos y un peludo sin foto no se importa.

El refugio pide casi lo mismo cada semana. La meta es reunir la lista real de lo que necesita: cada cosa una sola vez, no un borrador por post.

Las necesidades hoy no tienen imagen y la lista "Necesidades del mes" es solo texto. Una imagen por tipo (alimento, medicina, …) hace la lista más fácil de leer sin pedirle al refugio una foto por cada petición.

## Alcance

**Dentro:**

- Categoría nueva `necesidad` en la clasificación de Gemini: el refugio pide cosas en especie. Un post crea un borrador de necesidad por cada cosa **nueva** que pide (hasta 6).
- Sin repetir: una cosa que ya está registrada como necesidad (borrador o publicada, de cualquier fecha) no se vuelve a crear ni se cambia. Si todo lo que pide un post ya está registrado, el post queda `ignorado` con `ya_registradas`.
- Columna `por_revisar` en `necesidades`. Los borradores no salen en el sitio y guardar desde el panel los publica, igual que peludos y campañas.
- Vigencia del borrador: la fecha escrita en el post si es futura; si no, 30 días después de la fecha del post.
- Urgencia del borrador: "urgente" solo si el post dice "urgente", "urge", "urgencia" o "emergencia"; si no, "necesaria".
- Panel `/admin/necesidades`: borradores primero con "Por revisar" y "Ver en Facebook", y en el formulario el aviso del borrador.
- Imagen genérica por tipo en "Necesidades del mes" (portada y `/donar`), también para las necesidades capturadas a mano: un archivo fijo por tipo en `src/assets/necesidades/`. Mientras falte el archivo de un tipo se usa su ícono de Lucide. Alimento usa `src/assets/refugio/gatos-comiendo.jpg` hasta que exista `alimento.jpg`.
- Todo post de adopción crea el borrador del peludo, aunque no traiga fotos (solo video o solo texto). El refugio agrega la foto después.
- Los videos no se leen: no se descargan, no se mandan a Gemini y tampoco su miniatura. Un post con video se clasifica solo con su texto (y sus fotos, si también trae).
- Ningún peludo se guarda sin al menos una foto, ni desde el panel ni con `guardar_peludo`. Un borrador sin foto muestra "Sin foto" en la lista y el formulario pide "Agrega al menos una foto." antes de publicarlo.
- `docs/configuracion-facebook-sync.md`, `specs/README.md`, `CLAUDE.md` y `AGENTS.md` al día: esta spec es la 16 y anuncios pasa a la 17.

**Fuera de alcance (specs futuras):**

- Imagen editable por necesidad (columna, Storage y `CampoFotos`).
- Leer o analizar videos (contenido, audio o miniatura).
- Guardar o reproducir el video del post en el sitio.
- Elegir un cuadro del video como foto desde el panel.
- Extender la vigencia de una necesidad ya registrada cuando se vuelve a pedir: el refugio la ajusta en el panel.
- Juntar necesidades repetidas que ya estén en la base o que se capturen a mano.
- Un post que sea adopción y también necesidad: se queda con una sola categoría (ver Decisiones).
- Donativos en dinero, rifas o eventos como necesidades: siguen siendo `otro`.
- Pantalla de historial de `publicaciones_facebook` y avisos por correo (siguen fuera, como en la SPEC 15).
- Anuncios (SPEC 17, RF-18).

## Modelo de datos

### Migración `necesidades_desde_facebook`

```sql
alter table necesidades add column por_revisar boolean not null default false;
-- Post del que salió el borrador; varios borradores pueden venir del mismo post.
alter table necesidades add column publicacion_id uuid references publicaciones_facebook on delete set null;
create index necesidades_publicacion on necesidades (publicacion_id);

alter table publicaciones_facebook drop constraint publicaciones_facebook_resultado_check;
alter table publicaciones_facebook add constraint publicaciones_facebook_resultado_check
	check (resultado in ('peludo', 'campana', 'necesidad', 'adoptado', 'ignorado', 'incompleto'));
```

- `guardar_necesidad` pone `por_revisar = false` al guardar (aprobar = guardar).
- `guardar_peludo` lanza `datos_invalidos` con `detail = 'fotos'` si `fotos` viene vacío.
- `borrar_contenido` no cambia: borrar un borrador de necesidad lo descarta.
- La política de lectura de `necesidades` para el panel ya existe; las nuevas columnas no cambian RLS.

### `importar_post_facebook` con `resultado = 'necesidad'`

```jsonc
{
  "post_id": "…", "url_post": "…", "pagina": "…", "texto": "…", "publicado_en": "…",
  "resultado": "necesidad",
  "necesidades": [
    { "tipo": "alimento", "descripcion": "Sobres o latas para gatos", "urgencia": "necesaria", "fecha_vigencia": "2026-10-28" },
    { "tipo": "limpieza", "descripcion": "Arena para gatos", "urgencia": "necesaria", "fecha_vigencia": "2026-10-28" }
  ]
}
```

- Guarda primero la fila del post y luego cada necesidad con `publicacion_id` apuntando a ella.
- Antes de insertar, salta cada necesidad cuyo `descripcion` normalizada (minúsculas, sin acentos, sin espacios de sobra) sea igual a la de una necesidad existente con `es_ejemplo = false` y el mismo `tipo`. Es la red de seguridad; la comparación por significado la hace el script (ver abajo). Si no queda ninguna, guarda el post como `ignorado` con `ya_registradas`.
- Cada necesidad: id con `id_libre(tipo || '-' || fecha_vigencia, 'necesidades')` (igual que el panel), `por_revisar = true`, `es_ejemplo = false`.
- Entre 1 y 6 necesidades; si no, `datos_invalidos` con `detail = 'necesidades'`.
- Devuelve `{ "resultado", "necesidad_ids": [...] }`.
- Con `resultado = 'peludo'`, `fotos` puede venir vacío (antes lanzaba error).

### Cargador (`src/lib/cargadores.ts`)

`cargadorNecesidades` pide solo filas con `por_revisar = false`. El esquema de `src/content.config.ts` no cambia (Zod descarta `por_revisar` y `publicacion_id`).

### Script (`scripts/sincronizar-facebook.mjs`)

Cambios al esquema de Gemini:

```js
categoria: { type: 'STRING', enum: ['adopcion', 'campana', 'necesidad', 'adoptado', 'otro'] },
necesidades: {
	type: 'ARRAY', nullable: true,
	items: {
		type: 'OBJECT',
		properties: {
			tipo: { type: 'STRING', enum: ['alimento', 'medicina', 'cobijas', 'limpieza', 'otro'] },
			descripcion: { type: 'STRING' }, // corta, con lo que pide el post: "Arena para gatos"
			ya_registrada: { type: 'STRING', nullable: true }, // id de la necesidad existente que pide lo mismo
		},
		required: ['tipo', 'descripcion', 'ya_registrada'],
	},
},
vigencia: texto, // fecha hasta la que aplica, solo si el post la escribe
```

- Instrucciones: "necesidad" es cuando el refugio pide cosas en especie (alimento, medicinas, cobijas, artículos de limpieza, arena, …). Dinero, rifas, eventos y carreras son "otro". Si un post es adopción o campaña y además pide cosas, gana adopción o campaña.
- Sin repetir: antes de llamar a Gemini con un post, el script lee una vez por ejecución las necesidades con `es_ejemplo = false` (borradores y publicadas, `id`, `tipo` y `descripcion`) y las pasa en las instrucciones. Gemini marca en `ya_registrada` el id de la que pide lo mismo ("latas para gatos" y "sobres o latas para los michis" son la misma). El script descarta las que traen un id que existe. Las necesidades que crea en la ejecución se suman a la lista, así dos posts del mismo día no repiten.
- Urgencia: la decide el script, no Gemini. Es `urgente` si el texto del post o `texto_en_foto`, normalizado, contiene `urgente`, `urge`, `urgencia` o `emergencia`.
- Vigencia: `vigencia` si su fecha está escrita en el post y es posterior a hoy. Si no, la fecha del post en Ciudad de México más 30 días. Si esa fecha ya pasó, el post queda `incompleto` con `fecha_pasada`.
- Nada inventado: una necesidad entra solo si al menos una palabra de 4 letras o más de su `descripcion` (normalizada) aparece en el post o en `texto_en_foto`. Si no queda ninguna, el post queda `incompleto` con `sin_necesidades`. Se toman las primeras 6.
- Videos: `post()` sigue tomando solo los medios `Photo`, como hoy; los medios `Video` y su miniatura se ignoran. Con fotos, la primera va a Gemini como hoy. Sin fotos, Gemini clasifica solo con el texto y estima `tamano` con lo que diga el texto; el refugio lo revisa.
- Adopción sin fotos: crea el peludo con `fotos: []`. El motivo `sin_foto` desaparece. Los demás obligatorios de la SPEC 15 (nombre escrito, especie, un solo peludo) no cambian.
- El resumen final cuenta también `necesidad`.

### Imagen por tipo (`src/lib/necesidades.ts`, nuevo)

| Tipo | Archivo | Mientras falte el archivo | Ícono (Lucide) |
| --- | --- | --- | --- |
| `alimento` | `src/assets/necesidades/alimento.jpg` | `src/assets/refugio/gatos-comiendo.jpg` | `bone` |
| `medicina` | `src/assets/necesidades/medicina.jpg` | ícono | `pill` |
| `cobijas` | `src/assets/necesidades/cobijas.jpg` | ícono | `bed` |
| `limpieza` | `src/assets/necesidades/limpieza.jpg` | ícono | `spray-can` |
| `otro` | `src/assets/necesidades/otro.jpg` | ícono | `package` |

- `imagenNecesidad(tipo)` devuelve `{ imagen?: ImageMetadata, icono: string }`. Lee la carpeta con `import.meta.glob('../assets/necesidades/*.jpg', { eager: true })`, así un archivo faltante no rompe el build.
- Agregar o cambiar una imagen es un commit, no una edición del panel (igual que las fotos del refugio, SPEC 14).
- `ListaNecesidades` muestra a la izquierda de cada fila un cuadro de 48 × 48 px redondeado: la imagen con `<Image>` recortada (`object-cover`) o el ícono sobre `bg-suave`. Es decorativa (`alt=""`): la descripción va al lado.

### Panel

| Lugar | Cambio |
| --- | --- |
| `/admin/necesidades` | Borradores primero, con "Por revisar" y "Ver en Facebook" (la `url_post` de su `publicacion_id`) |
| `/admin/necesidades/editar` de un borrador | `AvisoBorrador` igual que peludos y campañas |
| `/admin/peludos` | Un borrador sin fotos lleva también la etiqueta "Sin foto" |
| `/admin/peludos/editar` | Guardar sin fotos muestra "Agrega al menos una foto." y no llama a la RPC |

## Cambios por archivo

| Archivo | Cambio |
| --- | --- |
| `supabase/migrations/<fecha>_necesidades_desde_facebook.sql` | Nueva: columnas, check, `importar_post_facebook`, `guardar_necesidad` y `guardar_peludo` al día |
| `supabase/seed.sql` | `por_revisar` en necesidades; un post de ejemplo `necesidad` con 2 borradores y un peludo de ejemplo por revisar sin fotos |
| `src/lib/cargadores.ts` | Filtro `por_revisar = false` en necesidades |
| `src/lib/necesidades.ts` | Nuevo: `imagenNecesidad(tipo)` |
| `src/assets/necesidades/` | Carpeta nueva (con `.gitkeep` hasta que lleguen las imágenes) |
| `src/components/ListaNecesidades.astro` | Imagen o ícono por fila |
| `src/pages/admin/necesidades.astro`, `src/pages/admin/necesidades/editar.astro` | Borradores, enlace, avisos |
| `src/pages/admin/peludos.astro`, `src/pages/admin/peludos/editar.astro` | "Sin foto" y foto obligatoria |
| `scripts/sincronizar-facebook.mjs` | Categoría `necesidad` y adopciones sin foto |
| `docs/configuracion-facebook-sync.md` | Necesidades, adopciones sin foto (los videos no se leen) y cómo reprocesar posts |
| `specs/README.md`, `CLAUDE.md`, `AGENTS.md` | Fila 16, anuncios en la 17, necesidades y adopciones sin foto en la descripción de la sincronización |

## Plan de implementación

1. Confirmar en la nube (Studio o `execute_sql`) que ningún peludo publicado tiene 0 fotos. Si alguno tiene, avisar antes de seguir: no se podrá volver a guardar sin agregarle una.
2. Migración y semilla. `npx supabase db reset` corre sin errores.
3. Filtro en `cargadorNecesidades`. `astro build` con los ejemplos: los borradores de necesidad no salen en la portada ni en `/donar`.
4. `src/lib/necesidades.ts`, la carpeta `src/assets/necesidades/` y la imagen o ícono en `ListaNecesidades`. Revisar portada y `/donar` en el navegador a 375 px y 1280 px.
5. Panel de necesidades: lista y formulario. Probar en local con `refugio@ejemplo.test`: guardar el borrador lo publica y borrarlo lo descarta.
6. Panel de peludos: "Sin foto" y foto obligatoria. Probar con el peludo de ejemplo sin fotos.
7. Script: esquema, instrucciones, `decidir` para necesidades y adopciones sin foto. Probar `--dry-run` con llaves reales.
8. Ejecutar el script contra Supabase local: un post de necesidades crea un borrador por cosa, un segundo post que pide lo mismo no crea nada y un reel de adopción crea el peludo sin fotos.
9. Documentación: `docs/configuracion-facebook-sync.md`, `specs/README.md`, `CLAUDE.md` y `AGENTS.md`.
10. Pasos manuales **después del merge**: `npx supabase db push`. Luego, para reprocesar lo que la primera ejecución dejó fuera, borrar en Studio las filas de `publicaciones_facebook` con `resultado = 'ignorado'` o `motivo = 'sin_foto'` y correr el workflow a mano (las necesidades de los posts reprocesados no se repiten entre sí). Solo vuelven los posts que sigan entre los 10 más recientes de cada página, y son unas 15 llamadas a Gemini de las 20 gratis al día. Si Daisy ya no está entre ellos, se captura a mano.

## Criterios de aceptación

### Datos y RPC

- [x] `npx supabase db reset` aplica la migración y la semilla sin errores.
- [x] `importar_post_facebook` con `resultado = 'necesidad'` y 2 necesidades crea 2 filas con `por_revisar = true`, `es_ejemplo = false` y el mismo `publicacion_id`, y una fila en `publicaciones_facebook`.
- [x] Con 0 o 7 necesidades lanza `datos_invalidos` y no deja ninguna fila.
- [x] Una necesidad con el mismo `tipo` y la misma descripción normalizada que una existente no se crea; si eran todas, el post queda `ignorado` con `ya_registradas`.
- [x] `importar_post_facebook` con `resultado = 'peludo'` y `fotos: []` crea el peludo por revisar sin fotos.
- [x] `guardar_peludo` con `fotos: []` lanza `datos_invalidos` con `detail = 'fotos'`.
- [x] `guardar_necesidad` sobre un borrador lo deja con `por_revisar = false`.
- [x] Borrar un borrador de necesidad deja su post en `publicaciones_facebook`, así que no se vuelve a importar.

### Sitio público

- [x] Los borradores de necesidad no salen en la portada ni en `/donar`.
- [x] Cada fila de "Necesidades del mes" muestra la imagen de su tipo o, si falta el archivo, su ícono.
- [x] Una necesidad de alimento muestra `gatos-comiendo.jpg` mientras no exista `src/assets/necesidades/alimento.jpg`, y la nueva imagen en cuanto el archivo existe.
- [x] `astro build` pasa con la carpeta `src/assets/necesidades/` vacía.

### Panel

- [x] `/admin/necesidades` muestra los borradores arriba con "Por revisar" y "Ver en Facebook".
- [x] `/admin/peludos` muestra "Sin foto" en el borrador sin fotos.
- [x] Guardar un peludo sin fotos muestra "Agrega al menos una foto." y no cambia nada en la base.

### Script

- [x] En `--dry-run`, el post real "necesitamos sobres o latas para los michis, también arena…" sale como `necesidad` con al menos 2 cosas (alimento y limpieza) y urgencia `necesaria`. Probado con su texto real: Apify ya no lo trae entre los 10 recientes.
- [x] El reel de Daisy, en `--dry-run`, sale como `peludo` sin fotos (si sigue entre los posts recientes; si no, con un post de video de la semilla de prueba local). Ya no estaba entre los recientes; se probó con su texto real.
- [x] Un post de adopción con nombre y especie pero sin foto ni video crea el peludo sin fotos.
- [x] Con "Arena para gatos" ya registrada, un post que pide "arenita para los michis" no crea otra necesidad.
- [x] Dos posts de la misma ejecución que piden lo mismo crean una sola necesidad.
- [x] Un post que pide dinero o anuncia una rifa sale como `otro`.
- [ ] Una necesidad cuyo texto no aparece en el post no se crea. (El filtro existe en `decidir`; en las pruebas Gemini no devolvió ninguna inventada, así que no se vio en acción. El filtro de dinero sí descartó "Donativo económico".)
- [x] Un post sin fecha de vigencia escrita crea borradores con `fecha_vigencia` = fecha del post + 30 días.
- [x] Con un post de video, ni el video ni su miniatura se descargan ni van a Gemini (la petición a Gemini no lleva imagen).

### Calidad

- [x] `npx astro check` y `astro build` pasan.
- [x] `specs/README.md`, `CLAUDE.md` y `AGENTS.md` dicen lo mismo sobre las specs 16 y 17.

## Decisiones

- **Sí:** una necesidad por cosa pedida. Cada una lleva su tipo e imagen, y el refugio aprueba o descarta cada una.
- **No:** una sola necesidad con todo el texto. Mezclaría tipos con una sola imagen.
- **Sí:** 30 días de vigencia si el post no dice fecha. Los posts casi nunca la dicen; exigirla dejaría fuera casi todas las peticiones, y el refugio la ajusta al revisar.
- **No:** fin del mes del post. Un post del día 28 caducaría en 3 días.
- **Sí:** la urgencia la decide el script por palabras escritas. Evita que Gemini marque "urgente" algo que el post no dice.
- **Sí:** no repetir necesidades. La meta es la lista real de lo que necesita el refugio, no un borrador por cada post que vuelve a pedir lo mismo.
- **Sí:** se compara contra todas las necesidades reales, borradores y publicadas, de cualquier fecha. Una petición que vuelve no se crea otra vez; si la existente ya venció, el refugio extiende su vigencia en el panel.
- **No:** comparar solo por `tipo`. "Croquetas" y "sobres" son ambos alimento y son cosas distintas.
- **Sí:** Gemini decide si es la misma cosa (`ya_registrada`) y la RPC repite la comparación exacta. Las palabras cambian entre posts ("arena", "arenita"); la comparación exacta en la base evita un repetido aunque Gemini falle.
- **No:** extender sola la vigencia de una necesidad publicada al verla de nuevo. Cambiaría un dato publicado sin revisión (contra la SPEC 15).
- **Sí:** imagen fija por tipo en `src/assets/`, sin columna nueva. Sirve también para las necesidades capturadas a mano y no pide fotos al refugio.
- **No:** imagen editable por necesidad. Columna, Storage y `CampoFotos` por un beneficio pequeño; queda para otra spec.
- **Sí:** el ícono de Lucide mientras falte una imagen, y `gatos-comiendo.jpg` para alimento. El build no depende de que lleguen las 5 imágenes.
- **Sí:** `publicacion_id` en `necesidades` en lugar de un arreglo de ids en `publicaciones_facebook`. Un post da varias necesidades y la llave foránea limpia sola el enlace al borrar.
- **Sí:** una categoría por post; adopción o campaña ganan sobre necesidad. Es lo más importante del post y evita un esquema de varios resultados por post.
- **Sí:** todo post de adopción entra aunque no traiga foto, y el refugio agrega la foto. Así no se pierde un peludo por venir en reel o solo con texto.
- **No:** leer videos, ni siquiera su miniatura. Decisión del refugio: el post se clasifica con su texto y la foto la pone el refugio.
- **Sí:** sin foto, el tamaño lo estima Gemini con el texto. La columna no admite "Por confirmar"; el borrador no sale hasta que el refugio lo revisa y agrega la foto.
- **Sí:** foto obligatoria para todos los peludos, en el panel y en `guardar_peludo`. Ninguna tarjeta de `/adopta` debe salir vacía.
- **Sí:** número 16 para esta spec y anuncios a la 17. Las specs se numeran en el orden en que se escriben.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Gemini toma como necesidad un post de donativo en dinero o de rifa | Las instrucciones lo excluyen y todo queda en borrador; el refugio lo borra. |
| Gemini cree que dos cosas distintas son la misma y no crea una necesidad real | El post queda registrado con su texto en `publicaciones_facebook`; si falta algo, el refugio lo captura a mano. |
| Un borrador descartado se vuelve a pedir y regresa | Es lo esperado: borrar un borrador lo quita de la lista de comparación. Si no se quiere, se publica y se deja vencer. |
| La lista de necesidades crece y las instrucciones de Gemini se alargan | Solo van `id`, `tipo` y `descripcion` corta; cientos de necesidades caben de sobra en el contexto de Flash-Lite. |
| Sin foto, el tamaño estimado con el texto sale mal | Es un borrador: el refugio lo corrige al agregar la foto. |
| Un peludo publicado sin fotos ya no se puede guardar | El paso 1 del plan lo revisa en la nube antes de implementar. |
| Reprocesar los posts de la primera ejecución agota la cuota diaria de Gemini | Son unos 15 posts de 20 gratis; si se agota, el script se detiene y sigue al día siguiente (SPEC 15). |
| La imagen genérica no se parece a lo que se pide (alimento de perro con foto de gatos) | Es genérica por tipo y decorativa; la descripción dice lo que se pide. Cambiarla es reemplazar el archivo. |

## Lo que **no** entra en esta spec

- Imagen editable por necesidad.
- Guardar o mostrar el video del post.
- Extender sola la vigencia de una necesidad que se vuelve a pedir.
- Juntar necesidades repetidas que ya estén en la base o capturadas a mano.
- Varias categorías en un mismo post.
- Donativos en dinero, rifas o eventos.
- Historial de posts en el panel y avisos por correo.
- Anuncios (SPEC 17, RF-18).

Cada una, si llega, va en su propia spec.
