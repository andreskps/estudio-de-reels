# Fase 2 — La marca como perfil

**Objetivo:** que la marca deje de ser una carpeta fija (`marca/`) y pase a ser un **perfil** elegible: cada reel guarda el suyo, la base trae un perfil `ejemplo` neutro y la marca del creador sigue donde está como perfil `andres` (RF1, meta E5).

## Cambios
- `perfiles/indice.json` (nuevo): `{ activo, perfiles: [{ id, nombre, ruta, creado }] }` con `andres → marca` y `ejemplo → perfiles/ejemplo`. **`marca/` no se movió ni se tocó.**
- `perfiles/ejemplo/` (nuevo): `brand.json` (mismas claves que el de andres, Montserrat OFL 700/800, acento amarillo, sin datos personales), `brand.md`, `vocabulario.json` vacío, `LICENCIAS.md`, carpetas vacías `logo/ fuentes/ sfx/ musica/ mis-reels/`.
- `herramientas/perfiles.mjs` (nuevo): `resolverPerfil({ raiz, slug, id })` con un solo orden: `--perfil`/id pedido → `reels/<slug>/reel.json` → reel sin `reel.json` = `andres` → `REELS_PERFIL` → perfil activo. Además `listaPerfiles`, `fijarActivo`, `escribirReel` (nunca reasigna el perfil de un reel) y `rutasMisReels`. Rechaza perfiles desconocidos y rutas fuera del proyecto.
- `herramientas/lib.mjs`: `perfil(slug)`, `rutaPerfil(slug, …)`, `marca(slug, id?)` y la opción `--perfil <id>` en todas las herramientas (se quita de los argumentos).
- Herramientas: `generar`, `validar`, `qa`, `preparar` (brand + vocabulario del perfil), `buscar-sfx` (descarga y licencias al perfil), `indexar` (assets de todos los perfiles; andres conserva origen y carpetas), `generar-historia.py` (misma regla en Python).
- Estudio: `flujo.mjs → huellaVersion` lee la marca del perfil del reel (mismas claves: las aprobaciones ya guardadas siguen valiendo). Servidor: `marca(slug)` en edición, borradores, versiones y revisión; `/api/marca?slug=|perfil=` devuelve también el perfil; `GET /api/perfiles`, `POST /api/perfiles/activo`; un reel nuevo escribe `reel.json` con el perfil elegido o el activo; los prompts reciben `{{perfil}}`, `{{perfil_nombre}}`, `{{perfil_dir}}` y el agente corre con `REELS_PERFIL`; solo lectura incluye `mis-reels/` de cada perfil. Learner: juzga técnicas contra el perfil activo.
- Interfaz: selector de perfil activo en **Marca** (y su nombre en el menú), «Marca (perfil)» al crear un reel, el perfil en cada tarjeta y en la cabecera de cada proyecto, el editor usa la marca del perfil del reel.
- Instrucciones: `estudio/tareas/_contexto.md`, skills `reel`, `ajustar`, `sonido`, `marca`, agente `revisor-retencion`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md` y `edicion.esquema.md` hablan de `<perfil>/` en lugar de `marca/`.
- `estudio/perfiles.test.mjs` (nuevo): 7 pruebas.

## Validación
- `node --test estudio/agentes.test.mjs estudio/flujo.test.mjs estudio/perfiles.test.mjs` → **24 de 24 pasan**.
- **Regresión de los 4 reels entregados (E5)**, sin tocar sus versiones: se copió la última versión con `edicion.json` de cada uno a `reels/_regresion-<slug>/` y se generó **antes y después** del cambio.
  - Páginas de producto v7, Gymshark v9, Psicología v6: `index.html` y `compositions/` **idénticos byte a byte**; `validar` → **Pasa 9 de 9** antes y después, con el mismo informe.
  - Ranking v5: falla igual antes y después («subtítulo 36 sale de la zona segura»); es un error que ya tenía esa versión sin entregar (lo entregado es v4, hecha con el script antiguo).
- **Perfil `ejemplo`:** un reel de prueba con `reel.json → ejemplo` genera con la marca del ejemplo (subtítulos en peso 700 en lugar de 800); con `--perfil andres` vuelve a ser idéntico a la base; `--perfil nadie` falla con la lista de perfiles. `validar` del reel de prueba con `ejemplo` → **Pasa 9 de 9**.
- `marca/`: mismas 69 sumas SHA-1 antes y después (no se tocó).
- `grep` de `marca/` fija en código, tareas, skills y agentes: solo quedan el valor por defecto `andres → marca`, nombres de rutas de la API y clases CSS.
- En vivo (Estudio en 4747): `/api/perfiles`, `/api/marca` por reel y por perfil (`origen: reel.json` / `reel anterior a los perfiles`), perfil inválido → 400. En **Marca**, cambiar a «Ejemplo (neutro)» cambia colores, reglas y el menú. Con `ejemplo` activo, un reel nuevo queda con `reel.json → ejemplo`; pedir `andres` lo respeta; un perfil inexistente no crea nada. Un agente real (Claude haiku) respondió «`ejemplo` — carpeta `perfiles/ejemplo/`» desde el prompt. El perfil activo volvió a `andres`.
- **Tarea que edita (pendiente de la fase 1):** «Aplicar correcciones» con Claude sonnet/medio sobre el reel de prueba (perfil `ejemplo`): el servidor creó `v7` desde `v6`, el agente cambió solo `zooms[0]` de `edicion.json`, `generar` → ok y la revisión de reglas → 0 errores; modelo confirmado `claude-sonnet-5-5`. (Las tildes del pedido llegaron dañadas porque se envió con `curl` desde la terminal de Windows, no desde el Estudio.)

## Decisiones
- El `formato` sigue en `estudio.json` (ahí lo leen el flujo y la interfaz); `reel.json` guarda solo `perfil` y `creado`. Se unifican cuando la fase 4 rehaga el flujo guiado.
- El indexador mantiene `origen: "marca"` y las carpetas «Mis reels / Música / SFX» para andres, así no cambian los ids ni las carpetas de la biblioteca; otros perfiles usan `perfil:<id>` y el nombre entre paréntesis.
- El Learner juzga las técnicas contra el perfil **activo** (no hay reel en ese momento).

## Pendientes
- Crear, duplicar y archivar perfiles desde el Estudio (RF1.6): llega con el asistente de marca (fase 3). Hoy un perfil nuevo se crea a mano o con `/marca`.
- Real SFX tiene su biblioteca fija en `marca/sfx` (`.claude/skills/real-sfx/config.json`): sonido por perfil en la fase 5.
- Los reels de prueba de esta fase (`reels/_regresion-*`, `_prueba-ejemplo`, `2026-11-27-prueba-perfil-*`) se borraron al cerrar (eran copias, no originales).
- Sin commit: el proyecto aún no tiene git (fase 6); este registro hace de commit.
