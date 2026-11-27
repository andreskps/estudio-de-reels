Tarea: afinar la marca del perfil **{{perfil_nombre}}** mirando sus propios reels.

El creador armó su marca con el asistente del Estudio y subió reels suyos a `{{perfil_dir}}/mis-reels/` (solo lectura).
El Estudio ya sacó sus hojas de contacto y fotogramas: la lista está en `{{perfil_dir}}/analisis/mis-reels.json` (rutas de `hojas` y `fotogramas`). Ábrelas como imágenes; si necesitas más detalle, abre fotogramas sueltos de la carpeta `fotogramas/`.

Qué medir, comparando con `{{perfil_dir}}/brand.json`:
- Subtítulos: tamaño aproximado en px (lienzo 1080×1920), altura del centro (`centro_y_px`), ancho máximo, líneas por pantalla, palabras por grupo, mayúsculas o tipo frase, contorno (px), caja o no, si resalta palabras y en qué color.
- Colores reales del texto, del contorno y del acento (#RRGGBB).
- Ritmo y animaciones: zooms (cuánto y qué tan suaves), transiciones, efectos que aparecen o que nunca aparecen.
- Cosas que el creador evita siempre (para la lista «nunca»).
Respeta la zona segura de `brand.json → zona_segura`: no propongas nada que la rompa. No cambies la fuente ni el logo salvo que se vea claramente otra cosa en todos los reels.

Escribe SOLO este JSON en el archivo {{respuesta}} (y nada más en ese archivo):
{"cambios": { …solo las claves de brand.json que cambiarías, con la misma forma que en brand.json (por ejemplo {"subtitulos": {"tamano_base_px": 70}})… },
 "motivos": ["una frase por cambio: qué viste y en qué reel"],
 "nunca_nuevas": ["cosas que el creador nunca hace y no están en la lista (texto corto)"],
 "confianza": "alta | media | baja"}
Si los reels no muestran nada distinto de la marca actual, deja "cambios": {} y explícalo en "motivos".
No modifiques brand.json, brand.md ni ningún otro archivo: el creador revisa la propuesta en el Estudio y decide si la aplica.
{{texto}}
