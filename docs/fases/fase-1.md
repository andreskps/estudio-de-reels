# Fase 1 — Agente, modelo y esfuerzo fiables

**Objetivo:** que desde el chat del Estudio se elija agente, modelo y esfuerzo, que se use exactamente eso, que se vea en cada mensaje y que los problemas de cuenta se expliquen con su arreglo (RF3, meta E3).

## Cambios
- `estudio/modelos.json` (nuevo): catálogo editable por agente (modelos, esfuerzos, cómo se pasan al CLI) y recomendados por tarea (Opus alto por defecto; Opus muy alto en plan y propuesta; Codex `gpt-6.1-sol` alto).
- `estudio/agentes.mjs`: `catalogo()` (Codex suma los modelos de tu cuenta desde `~/.codex/models_cache.json`), `validarEleccion()` (solo valores del catálogo y sin caracteres de shell), `argsDe()` (Claude `--model/--effort`, Codex `-m/-c model_reasoning_effort` antes del `-`, Gemini `-m`), `modeloInformado()` (lee el modelo del evento `init` de Claude), `coincideModelo()`, `diagnosticar()` (sesión vencida, modelo sin acceso, cuenta no soportada, límite) y registro de modelos rechazados (`modelos-no-disponibles.json`). `ejecutarAgente()` recibe `modelo`, `esfuerzo` y `onModelo`.
- `estudio/cuentas.mjs` (nuevo): estado por agente (instalado, versión, sesión con `claude auth status` / `codex login status`), «Probar» (pedido mínimo en carpeta temporal con el modelo y esfuerzo elegidos), «Conectar» (abre una terminal con `claude auth login`, `codex login` o `gemini`; Windows y Mac), última prueba guardada en `cuentas-pruebas.json`.
- `estudio/servidor.mjs`: `eleccionAgente()` valida agente, modelo, esfuerzo y sesión **antes** de crear versiones; si el pedido no trae nada usa el por defecto/recomendado y lo anota en `origen`. Cada trabajo guarda `meta.pedido_ia` y `meta.confirmado`; si el CLI dice usar otro modelo se avisa. Al terminar, un fallo de cuenta o de modelo queda en `meta.diagnostico`, se marca el modelo como no disponible o la cuenta como rechazada. Rutas `GET /api/cuentas`, `POST /api/cuentas/<id>/probar|conectar`; `/api/agentes` incluye el catálogo. El Learner usa la misma validación.
- `estudio/public/chat.js`: selectores de modelo y esfuerzo junto al agente, «★ Recomendado», estado de la cuenta, elección recordada por conversación, **sin el cambio silencioso de agente** que había; el envío se bloquea si el agente no está listo y el error se muestra en el chat con «Abrir Cuentas». Cada mensaje lleva su etiqueta: agente · modelo · esfuerzo · ✓ modelo confirmado / (sin confirmar) / no respondió.
- `estudio/public/app.js` + `index.html`: página **Cuentas y modelos** (`#/cuentas`). `estilos.css`: estilos de la fila de IA.
- `estudio/agentes.test.mjs` (nuevo): 8 pruebas.

## Validación
- `node --test estudio/agentes.test.mjs estudio/flujo.test.mjs` → **17 de 17 pasan**.
- Pruebas reales desde Cuentas (API `probar`): Claude haiku/bajo → confirmó `claude-haiku-5-5`; Claude sonnet/bajo → `claude-sonnet-5-5`; Codex `gpt-6.1-sol`/bajo → responde; Codex `gpt-6.2-sol` → «Tu cuenta no tiene acceso a ese modelo» y queda marcado no disponible; Gemini → «no acepta esta cuenta con el CLI».
- Batería del chat (`/api/agente`, tarea Consultar): Claude opus/alto → confirmado `claude-opus-5-5`; Claude sonnet/medio → `claude-sonnet-5-5`; Codex `gpt-6.1-sol`/alto y `gpt-5.6-sol`/medio → responden (Codex no informa el modelo: «sin confirmar», se le pasó con `-m`). **4 de 4 mensajes con agente/modelo/esfuerzo visibles y, donde el CLI lo informa, coincidentes.**
- Bloqueos sin crear nada: Gemini (cuenta rechazada), Codex con «El de tu configuración» (`gpt-6.2-sol` rechazado), Codex `gpt-6.2-sol` y un modelo inventado → **4 de 4 rechazados con su explicación**.
- En el navegador (Estudio en 4747): la fila de IA muestra modelo/esfuerzo/recomendado y «● conectado»; con Gemini el botón Enviar queda desactivado con el motivo; con Codex la opción de su configuración aparece «no disponible»; los mensajes fallidos muestran el diagnóstico y «Abrir Cuentas».

## Decisiones
- Codex y Gemini no informan el modelo usado: se muestra «(sin confirmar)»; la garantía es que se pasa con su flag y que un rechazo se detecta y se muestra.
- El modelo por defecto de Codex en `~/.codex/config.toml` (`gpt-6.2-sol`) aparece en la lista de modelos pero tu cuenta de ChatGPT lo rechaza; por eso el recomendado de Codex es `gpt-6.1-sol`. No se tocó tu configuración de Codex.
- Gemini queda bloqueado hasta que haya `GEMINI_API_KEY` o una prueba correcta.

## Pendientes
- No se probó una tarea que **edita** (crea vN+1) para no tocar los reels entregados; se probará con el reel de prueba de la fase 2/4.
- La página del Learner y la descripción de biblioteca aún eligen solo agente: usan el modelo recomendado (se ve en la etiqueta del chat). Pasarlas al mismo selector en la fase 4.
- `modelos-no-disponibles.json` y `cuentas-pruebas.json` son estado local: van al `.gitignore` en la fase 6.
- Sin commit: el proyecto aún no tiene git (se crea en la fase 6); este registro hace de commit.
