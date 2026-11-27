# Fase 0 — Descubrimiento y definición

**Objetivo:** entender qué falla hoy y definir la base genérica antes de escribir código.

**Cambios:** se crearon `docs/project.md`, `docs/requirements.md`, `docs/architecture.md`, `docs/design.md`, `docs/roadmap.md` y este registro. No se tocó código, reels, versiones ni originales.

**Entrevista (2026-11-27), respuestas del creador:**
- Qué falla al elegir el modelo: no se puede elegir, no se sabe cuál se usa, la cuenta/sesión falla y a veces se ignora lo elegido (las cuatro).
- Usuarios: cualquiera que la descargue.
- "Sencillo": todo desde el chat + marca en 5 minutos.
- Selector: agente + modelo + esfuerzo.
- Plataforma: Windows y Mac, repo en GitHub.
- Cuentas de IA: cada creador con la suya.
- Marca actual: un perfil más.
- Metas: marca < 5 min, primer reel sin terminal, modelo elegido = usado, misma calidad que Claude Code.
- Interfaz: español primero, preparada para traducir.
- Alcance inicial: sonido, Learner, biblioteca y plantillas.

**Evidencia revisada:** `estudio/agentes.mjs` lanza los CLI sin `--model`/`--effort`; `chat.js` cambia de agente si el elegido no figura como instalado; el servidor usa `config.json → por_tarea` si el pedido llega sin agente; en `estudio/trabajos/` hay un error "OAuth session expired" de Claude. `claude --help`, `codex exec --help` y `gemini --help` confirman `--model`/`--effort`, `-m`/`-c` y `-m`.

**Validación:** el creador aprobó los cinco documentos el 2026-11-27 ("Aprobados, empieza fase 1").

**Pendientes:** nombre y licencia del repo; nivel de soporte de Codex/Gemini; quién prueba en Mac.
