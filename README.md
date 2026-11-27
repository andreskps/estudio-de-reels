# Estudio de Reels

Editor de Reels y TikToks con IA. Tú entregas un clip **ya cortado** y un video de referencia. Un agente (Claude Code, Codex o Gemini) añade subtítulos sincronizados, animaciones, zooms, tarjetas y sonido siguiendo **tu marca**. El motor de video es [HyperFrames](https://www.npmjs.com/package/hyperframes).

Todo corre en tu computadora. El Estudio es una app web local que solo escucha en `127.0.0.1`.

## Qué hace
- **Marca como perfil:** un asistente de 7 pasos crea tu marca (colores, fuente, subtítulos, logo y lo que nunca quieres ver). Puedes tener varias marcas.
- **Reel guiado:** clip + referencia → plan → apruebas → edición → validación → revisión de retención → vista previa → apruebas → MP4 final a −14 LUFS.
- **Reglas que no se saltan:** zona segura de 1080×1920, sin textos bajo los botones de la app, subtítulos legibles. No deja exportar sin validar y aprobar.
- **Modo sin paradas:** encadena todos los pasos y se detiene si algo falla.
- **Biblioteca y Learner:** B-roll, música, SFX y técnicas aprendidas de videos que te gustan.
- **Versiones:** cada cambio crea `vN+1`. Nunca se pisa una versión ni tus archivos originales.

## Requisitos
| Herramienta | Para qué | Instalación (Windows) | Instalación (Mac) |
|---|---|---|---|
| Node.js 20 o más | El Estudio y las herramientas | `winget install OpenJS.NodeJS.LTS` | `brew install node` |
| FFmpeg | Audio, fotogramas y QA | `winget install Gyan.FFmpeg` | `brew install ffmpeg` |
| whisper.cpp | Transcripción local | [Releases de whisper.cpp](https://github.com/ggml-org/whisper.cpp/releases) | `brew install whisper-cpp` |
| Un agente (al menos uno) | Edita y revisa | Ver abajo | Ver abajo |

**Agentes** (elige uno o varios; el Estudio deja elegir agente, modelo y esfuerzo en cada chat):
- [Claude Code](https://docs.claude.com/en/docs/claude-code): `npm install -g @anthropic-ai/claude-code`, luego `claude` para iniciar sesión. Es el recomendado.
- [Codex CLI](https://github.com/openai/codex): `npm install -g @openai/codex`, luego `codex login`.
- [Gemini CLI](https://github.com/google-gemini/gemini-cli): `npm install -g @google/gemini-cli`, luego `gemini`.

HyperFrames no se instala: las herramientas lo usan con `npx hyperframes@0.9.5`, que lo baja la primera vez.

### whisper.cpp
El Estudio busca `whisper-cli` en la variable de entorno `HYPERFRAMES_WHISPER_PATH`. En Windows también lo busca en `%LOCALAPPDATA%\whisper.cpp\Release\whisper-cli.exe`.

```powershell
setx HYPERFRAMES_WHISPER_PATH "C:\ruta\a\whisper-cli.exe"
```
Abre una terminal nueva después de `setx`.

## Empezar
```bash
git clone https://github.com/andreskps/estudio-de-reels.git
cd estudio-de-reels
node estudio/servidor.mjs
```
Abre http://localhost:4747. Para usar otro puerto, define la variable `ESTUDIO_PUERTO`.

1. **Marca → Crear marca:** el asistente arma tu perfil. Al empezar está activo el perfil «ejemplo», que es neutro.
2. **Cuentas y modelos:** pulsa «Probar» en el agente que vayas a usar.
3. **Proyectos → + Nuevo reel:** sube tu clip y la referencia, y sigue el botón «Continuar →».

También puedes trabajar sin el Estudio, desde Claude Code en esta carpeta: `/marca`, `/reel <slug>`, `/ajustar <slug>` y `/sonido <slug>`.

## Estructura
```
estudio/        servidor y app web (estudio/servidor.mjs), tareas de los agentes (estudio/tareas/)
herramientas/   generar, validar, qa, analizar-referencia, indexar, aprender…
perfiles/       tus marcas; perfiles/ejemplo/ es el perfil neutro de la base
reels/          un reel por carpeta (lo crea el Estudio; no se sube a git)
biblioteca/     B-roll, música, SFX y técnicas (no se sube a git)
.claude/        skills /reel, /ajustar, /marca, /sonido y el agente revisor-retencion
docs/           producto, requisitos, arquitectura, diseño, roadmap y registro por fases
```
Las reglas que siguen los agentes están en `CLAUDE.md` (Claude), `AGENTS.md` (Codex) y `GEMINI.md` (Gemini).

## Sonido (opcional)
- `node herramientas/buscar-sfx.mjs "whoosh"` busca SFX con licencia CC0 en Openverse y registra la licencia en tu perfil.
- Earshot (CLI + MCP) mide y genera SFX. Si lo instalas, copia `.mcp.json.example` a `.mcp.json`.
- La skill `real-sfx` se instala aparte en `.claude/skills/real-sfx/`.

## Pruebas
```bash
node --test estudio/agentes.test.mjs estudio/flujo.test.mjs estudio/perfiles.test.mjs estudio/marca.test.mjs
```

## Licencias
- El código está bajo la licencia [MIT](LICENSE).
- Usa solo música, SFX, fuentes y stickers propios o con licencia clara (CC0, OFL) y regístralos en `<perfil>/LICENCIAS.md`. Las fuentes OFL del asistente vienen con HyperFrames.

## Estado
Base funcional en Windows, probada con Claude Code y Codex. Mac aún no se ha probado. El instalador automático está en el roadmap (`docs/roadmap.md`, fase 6).
