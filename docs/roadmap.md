# Roadmap

> Paso 5 — Planificación. Estado: **aprobado por el creador** (2026-11-27).
> Reglas: una fase a la vez · validar contra "Hecho cuando" antes de cerrar · registro en `docs/fases/fase-N.md` · un commit por fase (cuando exista el repo, fase 6; antes, el registro hace de commit) · preguntar al creador antes de la siguiente.

**MVP = fases 1 a 4**: elegir modelo de forma fiable, marca como perfil, asistente de marca y reel guiado por chat con la misma calidad. Las fases 5 y 6 dejan la base lista para otros creadores.

## Fase 0 — Descubrimiento y definición ✅ aprobada 2026-11-27
Docs `project`, `requirements`, `architecture`, `design`, `roadmap` y `fases/fase-0.md`.
**Hecho cuando:** el creador aprueba estos documentos.

## Fase 1 — Agente, modelo y esfuerzo fiables (lo que más duele hoy) ✅ 2026-11-27 (ver fases/fase-1.md)
Tareas:
1. `estudio/modelos.json` con el catálogo y recomendados por tarea.
2. `agentes.mjs`: `ejecutarAgente(id, prompt, { modelo, esfuerzo })`, flags desde el catálogo, valores validados; captura del modelo confirmado.
3. Servidor: `/api/agente` acepta y guarda `pedido`/`confirmado`; sin fallback implícito; error explicado si falta sesión o el valor no es válido.
4. `chat.js`: selectores de modelo y esfuerzo, recomendado, etiqueta por mensaje, sin cambio silencioso de agente, elección recordada por conversación.
5. `cuentas.mjs` + página Cuentas: instalado, versión, sesión, Probar, Conectar.
Pruebas:
- `node --test`: armado de argumentos por agente, valores inválidos rechazados, sin fallback.
- En vivo: batería Claude (2 modelos × consulta) + Codex (2 modelos × consulta); Gemini si hay cuenta compatible.
**Hecho cuando:** 100 % de los mensajes de la batería muestran agente/modelo/esfuerzo y el modelo confirmado coincide (o se marca "sin confirmar" donde el CLI no lo informa); elegir un agente sin sesión bloquea el envío con el arreglo; las pruebas pasan. *Depende del creador:* iniciar sesión de nuevo en `claude` (hoy vencida).

## Fase 2 — La marca como perfil ✅ 2026-11-27 (ver fases/fase-2.md)
Tareas:
1. `perfiles/indice.json` (`andres → marca/`, `ejemplo → perfiles/ejemplo/`), `estudio/perfiles.mjs`, `perfil()`/`rutaPerfil()` en `lib.mjs`.
2. Todas las herramientas, `flujo.mjs`, `learner.mjs`, servidor y `public/` usan el perfil del reel; `--perfil` en las CLI.
3. Prompts de `estudio/tareas/`, skills, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` con `{{perfil_dir}}` / "el perfil del reel" en lugar de `marca/`.
4. `reel.json` en reels nuevos; reels viejos → `andres`.
5. Perfil `ejemplo` neutro (fuente OFL, sin datos personales); selector de perfil en el Estudio.
Pruebas: `grep` sin rutas `marca/` fijas fuera del índice; `node --test`; `generar` + `validar` de los 4 reels entregados con el perfil `andres` (en una vN+1 temporal o en carpeta temporal, sin tocar versiones entregadas) → mismo `index.html` salvo rutas y mismo "pasa X de Y"; `generar` de un reel de prueba con `ejemplo`.
**Hecho cuando:** E5 cumplido y un reel de prueba genera con el perfil `ejemplo` sin tocar `marca/`.

## Fase 3 — Asistente de marca nueva ✅ 2026-11-27 (ver fases/fase-3.md)
Tareas: pantalla de pasos (design.md), lista OFL, colores sugeridos desde el logo, presets de subtítulos con vista previa 9:16, esquema de `brand.json` y validación, "Afinar con mis reels" vía agente.
Pruebas: `node --test` del esquema; crear 2 marcas distintas y generar el mismo reel de prueba con cada una (se ven diferentes y pasan `validar`).
**Hecho cuando:** E1 (< 5 min) medido con el creador y, si se puede, con una persona ajena.

## Fase 4 — Reel guiado por chat con la misma calidad 🟡 implementada 2026-11-27; falta E2/E4 con un reel real (ver fases/fase-4.md)
Tareas: máquina de etapas con gates en el servidor (hallazgos 1–3 y 5 de `ANALISIS-FLUJO.md`); cadena automática generar → reglas → validar → retención tras cada edición; sugerencias de retención como botones; aprobación ligada a la huella; una sola fuente de instrucciones (skills citan `estudio/tareas/`); retención con cualquier agente; modo sin paradas.
Pruebas: `flujo.test.mjs` ampliado (render bloqueado sin validación/aprobación; v nueva no aparece como entregada por un final viejo; consulta no crea versión); reel nuevo de punta a punta desde el Estudio.
**Hecho cuando:** E2 y E4 con un reel real del creador.

## Fase 5 — Plantillas, sonido, Learner y biblioteca por perfil
Tareas: `plantillas/` (ranking, páginas de producto, historia de marca, libre) desde los formatos aprobados; `/sonido` y Estudio con `sfx/` y licencias del perfil, "SFX por defecto" como ajuste del perfil; Learner calcula compatibilidad contra el perfil del reel; biblioteca base + perfil.
**Hecho cuando:** un reel de prueba con el perfil `ejemplo` usa una plantilla y un SFX de su perfil y pasa `validar` + `qa`; las técnicas muestran ⚠ según el perfil del reel.

## Fase 6 — Distribución en GitHub (Windows y Mac)
Tareas: `instalar.mjs` (Node, ffmpeg, whisper.cpp + modelo, HyperFrames, CLIs, Earshot opcional), detección de rutas por sistema, `local.json`, página Diagnóstico, `.gitignore` (reels, perfiles propios, biblioteca del creador, trabajos, `.env`, `.claude/settings.local.json`), `README.md`, licencia del repo, textos en `textos.es.json`, `git init` y primer commit.
Pruebas: instalación desde una carpeta limpia en Windows; en Mac (*depende de que alguien con Mac la pruebe*).
**Hecho cuando:** E2 desde instalación limpia en Windows y, si hay Mac disponible, en Mac.

## Pendientes de decidir (no bloquean la fase 1)
- Nombre del producto y licencia del repo (¿MIT?).
- Si Codex y Gemini son "soportados" al mismo nivel que Claude o "experimentales".
- Quién prueba en Mac.
