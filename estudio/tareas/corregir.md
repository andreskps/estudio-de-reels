Tarea: aplicar correcciones del creador al reel `{{slug}}`. La versión anterior es `{{desde}}`; trabaja en la nueva `{{version}}`.

Archivo que debes editar (el único): reels/{{slug}}/composicion/{{version}}/edicion.json
(formato en herramientas/edicion.esquema.md; la transcripción corregida con tiempos está en reels/{{slug}}/transcripcion.json).

(Fuente única: este archivo lo usan el Estudio y la skill `/ajustar` paso 5.)

Correcciones del creador:
"""
{{texto}}
"""

Si pide un efecto o una técnica ("como en el Learner", "el flash de…"), búscala en biblioteca/tecnicas/*/tecnica.json y añádela a efectos[] con su receta y parámetros.
Cambia solo lo que pide. Si una corrección es una preferencia permanente ("siempre", "nunca", "de ahora en adelante"), anótala al final de tu respuesta como "Preferencia para la marca: …" pero no edites la marca.
Cuando termines, ejecuta `node herramientas/generar.mjs {{slug}} {{version}}` y corrige edicion.json hasta que no dé errores.
