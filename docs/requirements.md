# Requerimientos

> Paso 3 — Definición. Estado: **aprobado por el creador** (2026-11-27).

## Criterios de éxito (metas numéricas)
| # | Meta | Cómo se mide |
|---|------|--------------|
| E1 | **Marca nueva en < 5 min** | Un creador sin experiencia termina el asistente con logo, fuente y colores propios; cronómetro desde "Crear marca" hasta "Marca lista". Prueba con 1 persona ajena al proyecto + 1 prueba propia. |
| E2 | **Primer reel sin terminal** | Desde una instalación limpia, clip + referencia → `final-v1.mp4` solo con el chat y botones del Estudio; 0 comandos escritos en consola después de instalar. |
| E3 | **Modelo elegido = modelo usado** | En 100 % de los mensajes de una batería de prueba (3 agentes × 2 modelos × tareas de consulta y edición) el mensaje muestra agente, modelo y esfuerzo, y coinciden con lo elegido. 0 cambios silenciosos de agente o modelo. |
| E4 | **Misma calidad que Claude Code** | Un reel editado por chat en el Estudio pasa `validar.mjs` (X de X), tiene su revisión de retención presentada antes de la vista previa y su `qa.mjs` entrega −14 LUFS ±0,5 y pico ≤ −1 dBTP; las mismas condiciones que `/reel`. |
| E5 | **Sin regresiones** | Los reels entregados (`ranking`, `paginas-producto`, `gymshark`, `psicologia`) con el perfil del creador actual generan la misma composición (mismo `index.html` salvo rutas) y pasan `validar.mjs` igual que hoy. |

## Funcionales

### RF1 — Perfiles de marca
- RF1.1 Cada marca es un **perfil** con: `brand.json`, `brand.md`, `vocabulario.json`, `LICENCIAS.md`, `logo/`, `fuentes/`, `sfx/`, `musica/`, `mis-reels/`, plantillas propias.
- RF1.2 Hay un **perfil activo** y cada reel guarda a qué perfil pertenece; abrir un reel usa su perfil aunque el activo sea otro.
- RF1.3 La marca actual pasa a ser el perfil `andres` **sin mover ni copiar** `marca/` (en especial `marca/mis-reels/`).
- RF1.4 La base trae un perfil `ejemplo` neutro, con fuente OFL y sin datos personales.
- RF1.5 Herramientas (`generar`, `validar`, `qa`, `reglas`, `indexar`, `buscar-sfx`, `aprender`…), prompts de `estudio/tareas/`, skills y `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` leen el perfil del reel, nunca `marca/` fijo.
- RF1.6 Selector de perfil en el Estudio (crear, cambiar, duplicar, archivar).

### RF2 — Asistente de marca nueva
- RF2.1 Pasos cortos con vista previa en vivo sobre un fotograma 9:16: nombre y plataformas → logo (opcional) → fuente (subir o elegir de una lista OFL) → colores (selector + sugeridos desde el logo) → estilo de subtítulos (3–4 presets visuales) → lista "Nunca" (casillas) → listo.
- RF2.2 Zona segura por plataforma con valores por defecto (Instagram/TikTok/Shorts), editable.
- RF2.3 Opcional: subir 1–3 reels propios y pedir a un agente que afine la marca (`/marca`), como propuesta que el creador aprueba.
- RF2.4 El resultado se valida contra un esquema; nunca queda un `brand.json` roto.

### RF3 — Agente, modelo y esfuerzo en el chat
- RF3.1 Junto al cuadro de texto: **agente**, **modelo** y **esfuerzo**, con "Recomendado para esta tarea" marcado.
- RF3.2 Catálogo editable por agente (`modelos.json`): alias, nombre visible, esfuerzos que admite y cómo se pasan al CLI. Opción "lo que tenga configurado el CLI".
- RF3.3 Se envía exactamente lo elegido. Si no se puede (agente no instalado, sin sesión, modelo no disponible) el mensaje **no se envía** y el chat explica por qué y cómo arreglarlo. Nunca hay cambio silencioso.
- RF3.4 Cada mensaje muestra lo que se pidió y lo que el CLI **confirmó** (p. ej. el `model` del evento de inicio de Claude); si no coinciden, aviso visible.
- RF3.5 La elección se recuerda por conversación y se puede fijar un valor por defecto por tarea.
- RF3.6 Página **Cuentas**: estado de cada agente (instalado, sesión, nivel de cuenta) con una prueba mínima y un botón "Conectar" que abre el inicio de sesión del CLI.

### RF4 — Flujo guiado con la misma calidad
- RF4.1 El chat de un reel muestra siempre el **siguiente paso** y por qué está bloqueado: preparar (transcribir) → analizar referencia → plan → **aprobar plan** → proponer edición → validar → revisión de retención → **aprobar vista previa** → exportar (render + QA).
- RF4.2 Exportar exige validación sin errores y aprobación de **esa** versión (la aprobación caduca si cambian edición, marca o recursos).
- RF4.3 La revisión de retención se ejecuta antes de cada vista previa con cualquier agente y sus sugerencias se presentan como botones "aplicar / descartar".
- RF4.4 Las consultas no crean versiones; solo las tareas que editan crean vN+1.
- RF4.5 Modo "sin paradas" opcional, como en `/reel`.
- RF4.6 Los pasos del flujo tienen **una sola fuente de instrucciones** compartida por las skills de Claude Code y las tareas del Estudio, para que chat y Claude Code no diverjan.

### RF5 — Módulos por perfil
- RF5.1 Sonido: `/sonido` y su versión en el Estudio usan `sfx/` y `LICENCIAS.md` del perfil; "sin SFX por defecto" es un ajuste del perfil, no de la base.
- RF5.2 Learner: las técnicas son de la base (compartidas); su compatibilidad se calcula contra el perfil del reel.
- RF5.3 Biblioteca: material de la base + material del perfil; los reels se indexan sin moverlos.
- RF5.4 Formatos/plantillas (ranking, páginas de producto, historia de marca, libre) como plantillas de la base que cada perfil puede ajustar.

### RF6 — Instalación y distribución
- RF6.1 Repo de GitHub con un comando de instalación para Windows y Mac (`node instalar.mjs` o `npm run instalar`) que comprueba y guía: Node, ffmpeg, whisper.cpp + modelo, HyperFrames, CLIs de agentes, Earshot (opcional).
- RF6.2 Rutas detectadas por sistema (sin `%LOCALAPPDATA%` fijo); configuración local en un archivo no versionado.
- RF6.3 Los datos del creador (reels, perfiles propios, biblioteca, trabajos) quedan fuera del repo (`.gitignore`).
- RF6.4 Página **Diagnóstico** en el Estudio con el mismo chequeo que el instalador.

## No funcionales
- RNF1 Español neutro de "tú"; textos de la interfaz en un solo archivo para traducir.
- RNF2 Servidor solo en 127.0.0.1; prompts por stdin; textos de referencia/transcripción tratados como datos.
- RNF3 Node sin dependencias en el servidor (se mantiene).
- RNF4 Originales de solo lectura y versiones inmutables (se mantiene).
- RNF5 Calidad sobre ahorro: los agentes arrancan completos.
- RNF6 Cada fase con pruebas automáticas (`node --test`) donde aplique y una prueba en vivo del Estudio.
