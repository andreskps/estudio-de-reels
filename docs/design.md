# Diseño

> Paso 4 — Diseño. Estado: **aprobado por el creador** (2026-11-27).

## Principios
1. **El chat es la puerta principal.** Todo se puede hacer hablando; el editor visual es para afinar, no obligatorio.
2. **Siempre un siguiente paso.** Un botón principal con el paso que toca y, si está bloqueado, por qué.
3. **Lo que eliges es lo que pasa.** Agente, modelo y esfuerzo visibles antes y después de cada mensaje.
4. **Nada se pisa.** Cada cambio es una versión nueva; los originales no se tocan.
5. **La marca manda.** Todo lo visual sale del perfil; la referencia inspira.
6. **Errores con salida.** Cada error dice qué pasó y qué botón lo arregla.

## Flujos

### Primer arranque
Abrir Estudio → "¿Es tu primera vez?" → **Cuentas** (conecta al menos un agente; prueba en verde) → **Crea tu marca** (asistente) → **Nuevo reel**.

### Asistente de marca (meta < 5 min)
1. Nombre del creador o marca + plataformas (Instagram / TikTok / Shorts).
2. Logo (opcional, arrastrar).
3. Fuente: subir archivo o elegir de 8–10 fuentes OFL con muestra.
4. Colores: principal, acento, contorno (sugeridos desde el logo).
5. Subtítulos: 3–4 tarjetas visuales (frase limpia, palabra resaltada, caja, mayúsculas) sobre un fotograma 9:16 con la zona segura dibujada.
6. "Nunca": casillas (emojis, SFX, logo, zoom de golpe, flash…).
7. Listo → resumen + "Afinar con mis reels" (opcional, agente `/marca`).
La vista previa 9:16 se actualiza en cada paso.

### Reel por chat
Nuevo reel (arrastrar clip + referencia opcional; elegir formato) → el chat propone el siguiente paso con botón: Transcribir → Analizar referencia → Plan (**Aprobar** / Pedir cambios) → Proponer edición → (automático: generar, validar, retención) → tarjeta con vista previa, "pasa X de Y" y sugerencias de retención (Aplicar / Descartar) → **Aprobar vista previa** → **Exportar** → MP4 final + QA.

### Pie del chat
```
[ Agente ▾ Claude ] [ Modelo ▾ Opus · recomendado ] [ Esfuerzo ▾ alto ]   [Enviar]
```
- Si el agente no tiene sesión: el selector lo muestra en rojo y "Conectar" sustituye a "Enviar".
- Cada respuesta lleva una etiqueta: `Claude · Opus · alto ✓` (confirmado) o `Codex · gpt-x · medio (sin confirmar)`; ⚠ si el CLI usó otro modelo.

### Cuentas
Una fila por agente: instalado · versión · sesión (✓ / vencida / no soportada) · último uso · [Probar] [Conectar] · modelo por defecto.

## Identidad visual de la base
- Neutra, para que la marca del creador destaque: fondo oscuro del Estudio actual (`estudio.css`), un acento por agente (avatares ya existentes).
- Tipografía de interfaz del sistema; las fuentes del perfil solo en vistas previas.
- Textos de interfaz en `estudio/public/textos.es.json` (preparado para traducir).
