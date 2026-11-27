# Proyecto: base de edición de Reels para cualquier creador

> Paso 1 — Descubrimiento. Estado: **aprobado por el creador** (2026-11-27).

## Problema
El Estudio de Reels funciona, pero está casado con un creador y una marca:

- **La marca está fija** en `marca/` (Montserrat 800, sin SFX, zona segura propia…). Herramientas, prompts de `estudio/tareas/`, skills (`/reel`, `/ajustar`, `/marca`, `/sonido`), `CLAUDE.md`, `AGENTS.md` y `GEMINI.md` leen `marca/brand.json` directamente. Otro creador no puede usarlo sin reescribir archivos.
- **Elegir el modelo es poco fiable.** El chat solo deja elegir el agente (Claude Code, Codex, Gemini). Lo que falla hoy, según el creador (las cuatro cosas):
  1. No puede elegir el modelo ni el esfuerzo desde el chat (salen de la configuración de cada CLI y no se ven).
  2. No sabe qué modelo respondió cada mensaje.
  3. La cuenta falla y el chat no dice cómo arreglarlo (Claude con la sesión OAuth vencida, Gemini rechazado por cuenta gratuita).
  4. A veces se ignora lo que elige: si el agente elegido no aparece como instalado, `chat.js` cambia a otro sin avisar, y el servidor usa `config.json → por_tarea` cuando el pedido llega sin agente.
- **Editar por chat no tiene la misma calidad que editar en Claude Code.** En Claude Code, `/reel` sigue el flujo completo (análisis de la referencia → plan aprobado → composición → `validar.mjs` → `revisor-retencion` → vista previa aprobada → render → `qa.mjs`). El Estudio tiene esas piezas sueltas: el render no exige validación ni aprobación, la revisión de retención es una acción aparte y cualquier consulta crea una versión (ver `ANALISIS-FLUJO.md`, hallazgos 1, 2 y 5).

## Para quién
- **Usuario principal: cualquier creador que descargue la base** desde GitHub, en Windows o Mac, sin conocimientos técnicos. Graba sus Reels/TikToks, los entrega ya cortados y quiere que queden editados con su marca.
- **El creador actual (Andres)** sigue usándola con su marca, que pasa a ser un perfil más.
- Cada creador paga la IA con **su propia cuenta** (suscripción o clave de Claude, ChatGPT/Codex o Gemini). La base no revende ni guarda claves de terceros.

## Qué significa "sencillo" (palabras del creador)
1. **Todo desde el chat:** sube clip y referencia, habla, y el chat lo guía paso a paso con botones (aprobar plan, aprobar vista previa, exportar).
2. **Marca en 5 minutos:** un asistente pregunta logo, fuente, colores y estilo, y deja la marca lista sin tocar JSON.

## Objetivo
Convertir el Estudio en una **base genérica de edición**: la marca es un perfil configurable, hay un asistente para crear una marca nueva, y el chat permite elegir **agente, modelo y esfuerzo** de forma fiable, con el mismo proceso y la misma calidad que la edición por chat en Claude Code.

## Alcance
**Entra:**
- Perfiles de marca (el actual migra a un perfil sin mover archivos; la base trae un perfil de ejemplo neutro).
- Asistente de marca nueva dentro del Estudio.
- Selector de agente + modelo + esfuerzo en el chat, con el modelo usado visible en cada mensaje y sin cambios silenciosos.
- Estado de cuentas de cada agente (conectado / sesión vencida / no soportado) con el paso para arreglarlo.
- Flujo guiado del reel en el chat con los mismos checkpoints y controles que `/reel` y `/ajustar`.
- Edición (subtítulos, zooms, tarjetas, B-roll), **Sonido** (`/sonido`, Earshot, Real SFX, Openverse), **Learner**, **Biblioteca** y **Formatos/plantillas** (ranking, páginas de producto, historia de marca), todos por perfil.
- Instalación desde GitHub para Windows y Mac, interfaz en español con los textos separados para traducir después.

**No entra (por ahora):**
- Instalador con doble clic (.exe/.dmg).
- Cortar el clip (el creador lo sigue entregando cortado).
- Publicar en redes, cuentas en la nube, colaboración en tiempo real.
- Interfaz en inglés (solo se deja preparada).
- Que la base cobre o gestione claves de API de los creadores.

## Restricciones
- Originales intocables: `reels/*/entrada/`, `reels/*/referencia/`, `marca/mis-reels/`; versiones nunca se sobrescriben.
- Motor HyperFrames fijado (`hyperframes@0.9.5`), Node sin dependencias en el servidor, transcripción local con whisper.cpp.
- Calidad primero: no recortar agentes (skills, herramientas, MCP, modelo) para ahorrar tokens.
- Solo material con licencia clara (propio, CC0, OFL, CC BY registrada).
- Proyecto sin git hoy; el repo de GitHub se crea en la fase de distribución.

## Herramientas actuales
HyperFrames 0.9.5 · whisper.cpp · ffmpeg · Claude Code 2.1.312 · Codex CLI 0.162.1 · Gemini CLI 0.59.0 · Earshot 1.0 · Real SFX · yt-dlp · Estudio (`estudio/servidor.mjs`, puerto 4747).
