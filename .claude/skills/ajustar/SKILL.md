---
name: ajustar
description: Crea una nueva versión (vN+1) de un reel ya editado aplicando las correcciones del creador, sin tocar la versión anterior, y guarda en la marca las preferencias permanentes. Úsala con /ajustar <slug> o cuando el creador pida cambios a un reel entregado.
---

# /ajustar — nueva versión con correcciones

**Perfil de marca:** `<perfil>/` es la carpeta del perfil del reel: `reels/<slug>/reel.json → perfil`, con su ruta en `perfiles/indice.json` (los reels sin `reel.json` usan el perfil activo). Sin reel, el perfil activo (`perfiles/indice.json → activo`). Las herramientas ya lo resuelven solas; si el Estudio te pasa la carpeta del perfil, usa esa. Nunca mezcles la marca de dos perfiles.

1. **Ubica la última versión:** el mayor `vN` en `reels/<slug>/composicion/`. Si el creador no dijo el slug, usa el reel más reciente y confírmalo en una línea.
2. **Copia, no edites:** duplica `composicion/vN/` → `composicion/vN+1/` (sin `node_modules/` ni `.hyperframes/`). `vN` y `salida/final-vN.mp4` quedan intactos.
3. **Revisa cambios hechos a mano:** si el creador editó en la app de HyperFrames, ejecuta `npx --yes hyperframes@0.9.5 history --since mine` en `vN+1` y construye sobre eso.
4. **Clasifica cada corrección:**
   - Solo para este reel (texto de un subtítulo, quitar una tarjeta, mover un zoom) → se aplica en `vN+1`.
   - Preferencia permanente ("nunca pongas emojis", "subtítulos más grandes siempre") → se aplica en `vN+1` **y** se anota en `<perfil>/brand.md` → "Historial de correcciones" con fecha y frase literal, y se refleja en `<perfil>/brand.json`. Si dudas, pregunta.
   - Cambio de palabra mal transcrita recurrente → añádela a `<perfil>/vocabulario.json`.
5. **Aplica** siguiendo `estudio/tareas/corregir.md` (fuente única, la misma que usa el Estudio), el contrato de `/hyperframes` y las reglas de `estudio/tareas/proponer.md` (zona segura, marca).
   - Si `vN` tiene `edicion.json`: edita **solo** `composicion/vN+1/edicion.json` y ejecuta `node herramientas/generar.mjs <slug> vN+1` (nunca toques el HTML generado). Si viene del Estudio, la carpeta `vN+1` ya está creada: no crees otra.
   - Si `vN` es de un script antiguo (`generar-vN.py`), puedes pasarla a datos con `node herramientas/migrar-a-edicion.mjs <slug> vN` (crea vN+1) y seguir sobre esa.
6. **Revisión de retención:** antes de la vista previa, lanza el subagente `revisor-retencion` sobre `vN+1` siguiendo `estudio/tareas/retencion.md` (igual que en `/reel`, paso 5b), muestra el veredicto y sus sugerencias, y aplica solo las que el creador apruebe.
7. **Valida, renderiza y QA** con `vN+1`:
   ```bash
   node herramientas/validar.mjs <slug> vN+1
   npx --yes hyperframes@0.9.5 render reels/<slug>/composicion/vN+1 -o reels/<slug>/salida/render-vN+1.mp4
   node herramientas/qa.mjs <slug> vN+1
   ```
   Mira las hojas de QA antes de entregar.
8. **Entrega:** ruta de `final-vN+1.mp4`, lista corta de lo que cambió y qué quedó guardado en la marca. Actualiza `ESTADO.md`.
