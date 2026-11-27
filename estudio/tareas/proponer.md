Tarea: proponer la edición completa del reel `{{slug}}` en la versión nueva `{{version}}`.
(Fuente única: este archivo lo usan el Estudio y la skill `/reel` paso 4.)

Archivo que debes escribir (el único): reels/{{slug}}/composicion/{{version}}/edicion.json (formato en herramientas/edicion.esquema.md).
Ya existe como copia de la versión anterior (puede estar vacío si es la primera).

Usa: reels/{{slug}}/plan-edicion.md (si existe y está aprobado, síguelo), la transcripción con tiempos por palabra (reels/{{slug}}/transcripcion.json, ya corregida; si no existe, composicion/{{version}}/transcript.json), {{perfil_dir}}/brand.json y biblioteca/indice.json para elegir B-roll/motion (en "archivo" pon la ruta relativa a la raíz que trae el índice).
Técnicas aprendidas: biblioteca/tecnicas/*/tecnica.json. Si alguna con receta y compatible con la marca encaja con el momento, úsala en efectos[] (sin abusar).

Reglas de composición:
- `duracion` = la del clip (nunca más). Todo intervalo termina dentro del clip.
- Subtítulos: grupos de brand.subtitulos.palabras_por_grupo, cortados por frase o pausa, sin partir ideas, como mucho brand.subtitulos.lineas_max líneas (si no cabe, parte el grupo; no achiques), tiempos tomados de las palabras. Si la cara cae en `centro_y_px`, muévelos con `pos`/`y` dentro de la banda segura. Si la marca resalta palabras, pon en `resaltar` la palabra clave de cada grupo.
- Zona segura (brand.zona_segura): ningún texto, tarjeta ni gráfico legible fuera de la banda; nada bajo el riel de botones de la derecha.
- Colores, fuentes y animaciones solo de la marca; zooms siempre suaves (entrada ≥ `zoom_punch_in.duracion_min_s`, salida suave), anclados a la cara. Nada de la lista «Nunca».
- Música (si va) al nivel `musica_db_bajo_voz`; SFX solo con licencia en {{perfil_dir}}/LICENCIAS.md.
Cuando termines, ejecuta `node herramientas/generar.mjs {{slug}} {{version}}` y corrige edicion.json hasta que no dé errores. La validación y la revisión de retención vienen después (el Estudio las encadena solo).
{{texto}}
