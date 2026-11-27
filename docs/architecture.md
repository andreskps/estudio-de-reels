# Arquitectura

> Pasos 2 (Evaluación) y 4 (Diseño). Estado: **aprobado por el creador** (2026-11-27).

## Evaluación: ¿agente, automatización o código?
| Pieza | Decisión | Por qué |
|---|---|---|
| Perfiles, selector de modelo, gates del flujo, instalador | **Código** (Node, sin dependencias) | Reglas fijas y verificables; no deben depender de que un modelo "se acuerde". |
| Validación, QA, generación | **Automatización** (herramientas actuales) | Ya existen y son deterministas: `generar`, `validar`, `qa`, `reglas`. |
| Plan, edición, retención, afinar marca, Learner | **Agente** (Claude Code / Codex / Gemini por CLI) | Juicio creativo; el creador elige agente y modelo. |

Se mantiene la arquitectura actual (servidor Node + `public/` + CLIs como subprocesos); `ANALISIS-FLUJO.md` no encontró motivos para cambiar de framework.

### Costos
- La base no tiene costo propio. Cada creador usa su cuenta: suscripción de Claude (Pro/Max) o clave, ChatGPT/Codex, Gemini (el nivel gratuito hoy rechaza el CLI).
- Todo lo demás es local y gratis: HyperFrames, whisper.cpp, ffmpeg, Earshot, Openverse (100/min, 1000/día sin clave).
- El chat sigue mostrando tokens y $ por mensaje (solo informativo).

## Componentes

```
<raíz del repo>
├── estudio/
│   ├── servidor.mjs        API + flujo con gates
│   ├── agentes.mjs         adaptadores CLI (agente + modelo + esfuerzo)
│   ├── modelos.json        catálogo de modelos/esfuerzos por agente  (nuevo)
│   ├── cuentas.mjs         estado y prueba de sesión de cada CLI      (nuevo)
│   ├── perfiles.mjs        lista, activo, resolver perfil de un reel  (nuevo)
│   ├── flujo.mjs           etapas y siguiente paso
│   ├── tareas/             prompts del Estudio (una fuente por paso)
│   └── public/             interfaz (chat, editor, asistente de marca, cuentas)
├── herramientas/           generar, validar, qa, reglas… (reciben el perfil)
├── perfiles/
│   ├── indice.json         { activo, perfiles: [{id, nombre, ruta}] }  (nuevo)
│   └── ejemplo/            perfil neutro de la base                   (nuevo)
├── marca/                  perfil "andres" (se queda donde está; ruta en indice.json)
├── plantillas/             formatos: ranking, paginas-producto, historia, libre (nuevo)
├── reels/<slug>/reel.json  { perfil, formato, … }                     (nuevo)
├── biblioteca/             material compartido de la base + técnicas del Learner
└── local.json              rutas de whisper/ffmpeg, agente por defecto (no versionado)
```

### Perfiles
- `perfiles/indice.json` lista perfiles con su **ruta**: `andres → marca/`, `ejemplo → perfiles/ejemplo/`. Así la marca actual no se mueve (RF1.3) y `marca/mis-reels/` sigue de solo lectura.
- Resolución única en `herramientas/lib.mjs`: `perfil(slug?)` → `reels/<slug>/reel.json → perfil` → si no existe, perfil activo → si no, `andres` para los reels que ya existen (regla de compatibilidad).
- `marca()` pasa a `marca(slug)` y devuelve el `brand.json` del perfil. Todas las rutas a `marca/…` se resuelven con `rutaPerfil(slug, "sfx")`, etc.
- Herramientas por CLI aceptan `--perfil <id>`; los agentes reciben la ruta del perfil en el prompt (`{{perfil_dir}}`) y como variable `REELS_PERFIL`.
- Las listas de solo lectura (`SOLO_LECTURA` del servidor) incluyen `<perfil>/mis-reels/` de cada perfil.

### Agente, modelo y esfuerzo
- `modelos.json` (editable, sin tocar código):
  ```json
  { "claude": { "modelos": [{"id":"opus","nombre":"Opus"},{"id":"sonnet","nombre":"Sonnet"},{"id":"haiku","nombre":"Haiku"}],
                "esfuerzos": ["low","medium","high","xhigh","max"],
                "flags": {"modelo": ["--model","{m}"], "esfuerzo": ["--effort","{e}"]} },
    "codex":  { "modelos": [...], "esfuerzos": ["low","medium","high"],
                "flags": {"modelo": ["-m","{m}"], "esfuerzo": ["-c","model_reasoning_effort={e}"]} },
    "gemini": { "modelos": [...], "esfuerzos": [], "flags": {"modelo": ["-m","{m}"]} },
    "recomendado": { "plan": {...}, "proponer": {...}, "corregir": {...}, "retencion": {...}, "libre": {...} } }
  ```
  Flags comprobados con `--help` el 2026-11-27: Claude `--model`, `--effort`; Codex `-m`, `-c key=value`; Gemini `-m` (sin esfuerzo). La lista de modelos se revisa con cada versión de CLI; "por defecto del CLI" siempre existe.
- `ejecutarAgente(id, prompt, { modelo, esfuerzo })` arma los argumentos desde el catálogo (valores validados contra la lista: nada del usuario llega al shell sin validar).
- **Confirmación:** se lee el modelo que informa el CLI al arrancar (Claude: evento `system`/`init` con `model`; Codex y Gemini: si su JSON lo trae). El trabajo guarda `pedido: {agente, modelo, esfuerzo}` y `confirmado: {modelo}`; la interfaz muestra ambos y avisa si difieren o si no se pudo confirmar.
- **Sin cambios silenciosos:** se elimina el fallback de `chat.js` y el uso implícito de `por_tarea` en el servidor cuando el pedido llega sin agente; el servidor rechaza con un error explicado.
- `cuentas.mjs`: detecta instalación (`where`/`which`), versión y sesión con una prueba mínima (pedido corto, se cachea unos minutos); clasifica errores conocidos (OAuth vencido, nivel no soportado, sin clave) y da el arreglo. "Conectar" abre una terminal del sistema con el login del CLI (Windows: `start`, Mac: `open -a Terminal`).

### Flujo con gates (misma calidad que `/reel`)
- `flujo.mjs` es la máquina de etapas: `preparado → referencia → plan → plan_aprobado → edicion(vN) → validada(vN) → retencion(vN) → preview_aprobada(vN) → exportada(vN)`.
- El servidor aplica los gates (no la interfaz): `render` exige `validada` + `preview_aprobada` con huella vigente (`huellaVersion`, ya existe en `flujo.mjs`).
- Tras cada tarea que edita: `generar` → `reglas` → `validar` → `retencion` (encadenados por el servidor) → el chat muestra el informe y las sugerencias como botones.
- Retención con cualquier agente: `estudio/tareas/retencion.md` contiene el mismo criterio que `.claude/agents/revisor-retencion.md` (una sola fuente; el agente de Claude Code lo incluye por referencia).
- **Una sola fuente por paso:** las instrucciones de cada paso viven en `estudio/tareas/<paso>.md`; las skills `/reel`, `/ajustar`, `/marca`, `/sonido` dicen "sigue `estudio/tareas/<paso>.md`" en vez de repetir el texto. Así chat y Claude Code no divergen.
- Las consultas (`libre`) no crean versión (ya es así en `libre.md`; se comprueba que el servidor tampoco la cree).

## Modelo de datos (nuevo o cambiado)
| Archivo | Contenido |
|---|---|
| `perfiles/indice.json` | `{ "activo": "andres", "perfiles": [{ "id", "nombre", "ruta", "creado" }] }` |
| `<perfil>/brand.json` | igual que hoy + `version_esquema`, `sonido.sfx_por_defecto` (bool) |
| `reels/<slug>/reel.json` | `{ "perfil", "formato", "creado", "sin_paradas" }` |
| `estudio/trabajos/<id>.json` | + `meta.pedido {agente, modelo, esfuerzo}`, `meta.confirmado {modelo}` |
| `estudio/modelos.json` | catálogo (arriba) |
| `local.json` (no versionado) | rutas de whisper/ffmpeg, agente/modelo por defecto, puerto |

## Decisiones
- D1 Perfil por **ruta** en un índice, no carpeta fija: la marca actual no se mueve.
- D2 Reels sin `reel.json` = perfil `andres` (compatibilidad); los nuevos siempre lo escriben.
- D3 Los gates viven en el servidor; la interfaz solo los muestra.
- D4 Catálogo de modelos en JSON editable; nunca se inventa un modelo que el CLI no acepte: se prueba con "Probar" en Cuentas.
- D5 Distribución por GitHub + `instalar.mjs`; los datos del creador fuera del repo.
- D6 Se mantiene "agentes sin recortes": elegir modelo no quita skills, herramientas ni MCP.

## Riesgos
- Los alias de modelos cambian con cada CLI → catálogo editable + "por defecto del CLI".
- Codex/Gemini pueden no informar el modelo usado → se muestra "pedido, sin confirmar".
- Mac: no hay un Mac en este equipo para probar; la fase de distribución necesita que alguien lo pruebe.
- Skills de Claude Code vs tareas del Estudio pueden divergir → regla de una sola fuente (RF4.6).
