# edicion.json — formato

Una versión = `reels/<slug>/composicion/vN/edicion.json`. Es la única fuente de verdad: `node herramientas/generar.mjs <slug> <vN>` escribe `index.html` y `compositions/*.html` a partir de él y de `marca/brand.json`. Tiempos en segundos (3 decimales). Las listas se ordenan por `inicio`.

| Campo | Tipo | Qué es |
|---|---|---|
| `duracion` | número | = duración del clip (ffprobe). |
| `recorte` | bool | `true` → el creador se toma de `reels/<slug>/recorte/clip-recorte.webm` (sin fondo) y los `fondos` van detrás. `false` → el clip normal y los `fondos` lo tapan mientras duran. |
| `encuadre[]` | `{inicio, escala, origen, x, y}` | Cortes secos del creador desde `inicio`. Esquina inferior derecha al 50 %: `{"escala":0.5,"origen":"1080px 1920px"}`. Nunca voltear. |
| `zooms[]` | `{inicio, fin, escala, origen, vuelta?}` | Zoom suave (entrada `sine.inOut` de `inicio` a `fin`; luego vuelve a 1× en `vuelta` s, 0,6 por defecto, nunca de golpe; si `fin` = `duracion` se queda acercado). Respeta `brand.animaciones.zoom_punch_in` (escala, duración mínima; sin máximo fijo si `max_por_video` es null). |
| `fondos[]` | `{id, archivo, inicio, fin, desde?, velocidad?, kenburns?, ajuste?}` | B-roll a pantalla completa. `archivo`: ruta relativa a la raíz (la de `biblioteca/indice.json`) o nombre de archivo en `reels/<slug>/assets*/`. `desde` = segundo del video de origen. Imágenes: Ken Burns suave salvo `kenburns:false`. |
| `subtitulos[]` | `{inicio, fin, texto, pos, tamano?, y?, resaltar?}` | `pos` es una clave de `posiciones_subtitulo` (`normal` por defecto). Máx. `brand.subtitulos.lineas_max` líneas. `resaltar`: palabra del texto que va en el color de acento cuando la marca usa `resaltado.modo: "palabra"` (si falta, la más larga). |
| `posiciones_subtitulo` | `{clave: centro_y_px}` | `normal` = `brand.subtitulos.centro_y_px`. Añade claves propias (`alto`, `hook`, `arriba`…). |
| `sin_partir[]` | texto | Palabras con guion que no se parten entre líneas. |
| `tarjetas[]` | `{id, inicio, fin, titulo?, texto?, y, estilo}` | Tarjeta centrada; `y` = borde superior en px; `estilo`: `blanca` u `oscura`. |
| `motion[]` | `{id, archivo, inicio, fin, x, y, ancho, desde?}` | Motion graphic (video con alfa .webm/.mov o imagen) encima del creador. |
| `efectos[]` | `{id, receta, inicio, fin, params, tecnica?}` | Efecto de una receta de `herramientas/efectos.mjs` (flash-corte, fundido-negro, barrido, desenfoque-entrada, blanco-negro, vineta, texto-golpe, zoom-golpe, sacudida). `params` solo con las claves de esa receta; `tecnica` = slug de `biblioteca/tecnicas/` si viene del Learner. Las recetas con rasgos de `brand.animaciones.rasgos_prohibidos` dan aviso: no las uses salvo que el creador lo pida. |
| `audio.sfx[]` | `{id, archivo, inicio, volumen?, duracion?}` | Efecto de sonido puntual (p. ej. clic al cambiar de tarjeta). `volumen` lineal (0.25 por defecto), `duracion` 0.3 s por defecto. Solo con licencia en `LICENCIAS.md` del perfil del reel y si el reel lo pide (la marca va sin SFX por defecto). |
| `audio.musica` | `{archivo, volumen, desde}` o `null` | Música de fondo (volumen lineal; 0.1 ≈ −20 dB). Solo si el reel lo pide y con licencia en `LICENCIAS.md` del perfil del reel. |

Reglas comprobadas al generar y en el Estudio (`herramientas/reglas.mjs`): subtítulos ≥ 4 fotogramas, no vacíos, dentro de la duración y de la zona segura; tarjetas dentro de la zona segura; avisos por solapes, líneas estimadas, zooms de más y huecos de fondo con recorte. La medición exacta la hace `node herramientas/validar.mjs <slug> <vN>`.
