# Fase 4 — Reel guiado por chat con la misma calidad

**Estado:** implementada y probada. **Falta cerrarla con un reel real del creador** (E2 y E4).

**Objetivo:** que un reel hecho desde el chat del Estudio pase por los mismos controles que `/reel` en Claude Code:
- validación;
- revisión de retención antes de la vista previa;
- aprobación de esa misma versión;
- render y QA a −14 LUFS.

Además, el Estudio indica siempre el siguiente paso y, si alguno está bloqueado, por qué (RF4).

## Cambios
- `estudio/flujo.mjs`:
  - `TAREAS` vive aquí y se exporta. `creaVersion(tarea)`: solo `proponer` y `corregir` crean vN+1; las consultas no (RF4.4).
  - `siguientePaso` sigue después de editar: validar → revisión de retención → ver y aprobar (con cuántas sugerencias faltan por decidir) → exportar → QA. Antes solo decía «Continuar edición».
  - `motivoBloqueoRender(rev)` dice por qué no se puede exportar todavía (RF4.2).
  - `pasoAutomatico(e)` decide qué hace el modo sin paradas.
- `estudio/servidor.mjs`:
  - **Estado por versión** (`revisionVersion`): validada, retención, aprobada, render y sugerencias pendientes, todo atado a la huella. La retención guarda su huella en `retencion-vN.json`; las revisiones anteriores solo tienen el `.md` y siguen valiendo. `etapasDe` incluye `rev` de la última versión y el estado de sin paradas.
  - **Exportar** exige validación, retención y aprobación de esa versión. `validar` marca la versión con `marcarValidada`.
  - **Cadena automática** (`revisarDespuesDeEditar`): después de `proponer` o `corregir`, en el mismo trabajo y con el mismo agente, modelo y esfuerzo, hace generar → reglas → validar → revisión de retención. Se detiene en el primer fallo y dice cuál.
  - **Retención con cualquier agente:** la tarea escribe el `.md` y un JSON con veredicto, caídas y sugerencias (`texto`, `pedido`, `segundo`, `choca_marca`). El servidor lo guarda como `retencion-vN.json`.
  - **Sugerencias como botones:** `POST /api/proyecto/<slug>/sugerencias`. Aplicar junta las elegidas en una sola corrección (vN+1, con su propia validación y retención); descartar las marca. Las decisiones quedan en `estudio.json → sugerencias`.
  - **Aprobaciones:** quedan en una función `aprobar()`.
  - **Modo sin paradas** (`POST /api/proyecto/<slug>/sin-paradas`, RF4.5): guarda el agente, el modelo y el esfuerzo (validados antes) y, cada vez que un paso termina bien, lanza el siguiente.
    - Aprueba el plan y la vista previa solo (marcados `auto`).
    - Se detiene si un paso falla, si un paso no hace avanzar el reel o al entregar.
    - Nunca se salta la validación ni la retención, y no aplica sugerencias.
- **Una sola fuente de instrucciones** (RF4.6):
  - `estudio/tareas/plan.md`, `proponer.md`, `corregir.md` y `retencion.md` concentran lo que antes estaba repetido en las skills (gancho y miniatura, tramos, reglas de composición, zona segura, `resaltar`, JSON de retención).
  - Las skills `/reel` (pasos 3, 4 y 5b) y `/ajustar` (pasos 5 y 6), y el agente `revisor-retencion`, apuntan a esos archivos.
  - `proponer.md` ya no cita `marca/` fijo, sino `{{perfil_dir}}`.
  - `edicion.esquema.md` documenta `resaltar`.
- Interfaz:
  - `estudio/public/flujo-ui.js` (nuevo):
    - `cajaSugerencias`: casillas, «Aplicar (n)» y «Descartar», con el agente elegido en el chat de ese reel.
    - `botonSinParadas`: una ventana explica qué hace y qué no antes de empezar.
  - **Proyecto → Resumen:** pasos nuevos «Validación de vN», «Revisión de retención» y «Vista previa y aprobación», con sus botones desactivados hasta que les toca. Junto a «Tu siguiente paso» está el botón **⏩ Sin paradas**; mientras corre, la página se refresca sola.
  - **Proyecto → Versiones:** las sugerencias de cada versión.
  - **Chat:** la tarjeta de una edición muestra el resultado de la validación y las sugerencias como botones. La revisión de retención suelta también muestra sus sugerencias.

## Validación
- `node --test estudio/agentes.test.mjs estudio/flujo.test.mjs estudio/perfiles.test.mjs estudio/marca.test.mjs` → **38 de 38 pasan**. Pruebas nuevas en `flujo.test.mjs`:
  - El orden de los pasos después de editar.
  - El render bloqueado sin validación, retención o aprobación.
  - Una versión nueva no aparece como entregada por un final viejo.
  - Solo `proponer` y `corregir` crean versión; una consulta no.
  - Sin paradas avanza paso a paso y se detiene donde hace falta el creador.
- En vivo (Estudio en 4747, solo lectura sobre los reels reales):
  - `GET /api/proyectos`: Gymshark v9, con cambios pendientes, ahora dice «Validar» (antes, «Continuar edición»), y Psicología, entregada, sigue en «Ver entrega».
  - La página de Gymshark muestra los pasos nuevos en orden, con los botones de retención, vista previa y aprobación desactivados.
  - La ventana de sin paradas se abre y se cierra sin lanzar nada.
  - Sin errores en la consola.
- **No probado todavía:** la cadena completa con un agente real, una edición → validar → retención → sugerencias → aprobar → exportar, y el modo sin paradas de punta a punta. Se dejó así para no crear versiones ni renders en los reels del creador sin su permiso.

## Corrección durante la prueba del creador (2026-11-27)
- **Síntoma:** con Codex, el chat decía «FFmpeg y la descarga de HyperFrames están bloqueados en esta sesión».
- **Causa:**
  - El sandbox `workspace-write` de Codex no tenía red, así que `npx hyperframes@0.9.5` fallaba con EACCES.
  - Tampoco podía escribir en la caché de npm (EPERM).
  - En Windows, el modo `elevated` (el de `~/.codex/config.toml`) corre como otro usuario, `CodexSandboxOnline`, que no puede leer `%LOCALAPPDATA%\Microsoft\WinGet`, donde vive ffmpeg («Acceso denegado»).
- **Arreglo** (`estudio/agentes.mjs → permisosCodex`): Codex sigue en `workspace-write` y además recibe:
  - red;
  - `windows.sandbox=unelevated`, que solo aplica al Estudio; la configuración global queda igual;
  - `--add-dir` para la caché de npm y la carpeta temporal.
- **Probado** con `codex exec` y gpt-6.1-sol: `ffmpeg -version` ✔, `npx hyperframes@0.9.5 --version` → 0.9.5 ✔, escritura en TEMP ✔. Pruebas: 38 de 38.

## Decisiones
- La revisión de retención usa el agente, modelo y esfuerzo que el creador eligió para la edición (calidad primero; no se baja de modelo para ahorrar).
- En sin paradas, las sugerencias de retención no se aplican solas: aplicarlas sería editar sin el OK del creador, y la skill `/reel` tampoco lo hace.
- Una aprobación automática queda marcada `auto: true` y se muestra como «Aprobada por el modo sin paradas».

## Pendientes (para cerrar la fase)
- **E2 y E4 con un reel real del creador:** clip y referencia → plan → aprobar → edición → (validar + retención automáticos) → sugerencias → vista previa → aprobar → exportar → `final-v1.mp4`. Debe pasar `validar` N de N, haber mostrado la retención antes de la vista previa y entregar −14 LUFS ±0,5 y pico ≤ −1 dBTP, sin usar la consola. Luego, una prueba en modo sin paradas.
- Sin commit: el proyecto aún no tiene git (fase 6).
