# Fase 3 — Asistente de marca nueva

**Objetivo:** que cualquier creador arme su marca desde el Estudio en menos de 5 minutos, sin tocar archivos (meta E1). También: crear, duplicar y archivar perfiles (RF1.6), un esquema que impida un `brand.json` roto, y «Afinar con mis reels» con un agente.

## Cambios
- `herramientas/marca-esquema.mjs` (nuevo, sin dependencias; lo usan herramientas, servidor y navegador):
  - `validarMarca`: errores en español con la clave exacta. Revisa colores #RRGGBB, fuentes y pesos, rutas dentro del perfil, tamaños, el ancho y el centro dentro de la zona segura, el resaltado, las plataformas y el audio. Las marcas sin `version_esquema` (la de andres) se aceptan.
  - `FUENTES_OFL`: 10 familias OFL que ya trae HyperFrames, con sus pesos.
  - `ESTILOS_SUBTITULO`: frase limpia, palabra resaltada, con caja y mayúsculas.
  - `OPCIONES_NUNCA`: cada casilla va a `nunca`, a `rasgos_prohibidos` (con los mismos nombres que `efectos.mjs`) y a `audio`/`logo`.
  - `marcaDesdeAsistente`, `textoMarca` (brand.md), `idDesdeNombre` y `fusionarPropuesta`.
- `herramientas/perfiles.mjs`:
  - `crearPerfil` copia otro perfil (por defecto `ejemplo`) sin `mis-reels/`, `analisis/` ni `historial/`, y nunca pisa un id ni una carpeta que ya existan.
  - `archivarPerfil` oculta el perfil sin borrarlo. No deja archivar el perfil activo ni el último que queda.
  - `guardarMarca` valida antes de escribir y guarda la versión anterior en `<perfil>/historial/` (salvo en la primera marca de un perfil nuevo).
  - `anotarPerfil` registra en el índice cuánto tardó el asistente.
- `herramientas/generar.mjs`: ahora respeta `subtitulos.mayusculas`, `caja` y `resaltado.modo: "palabra"`. La palabra resaltada es la de `resaltar` en el subtítulo o, si no hay, la más larga. También admite fuentes propias del perfil (`fuentes.*.archivo`): las copia a `assets/fonts/` y declara `@font-face`. Sin esas opciones, el HTML queda byte a byte igual que antes.
- `herramientas/reglas.mjs`: el cálculo de ancho de los subtítulos tiene en cuenta las mayúsculas (0,7 em por letra).
- `herramientas/hojas-mis-reels.mjs` (nuevo): genera las hojas de contacto de `<perfil>/mis-reels/` en `<perfil>/analisis/` (solo lee los originales).
- Servidor:
  - Perfiles:
    - `GET /api/perfiles?archivados`
    - `POST /api/perfiles`: crear o duplicar; el id sale del nombre y no se repite.
    - `POST /api/perfiles/<id>/archivar`
    - `POST /api/perfiles/<id>/marca { respuestas, duracion_s }`: solo para perfiles creados en el Estudio. Andres y el ejemplo no se rehacen.
    - `POST /api/perfiles/<id>/subir?destino=logo|fuentes|mis-reels`: nunca reemplaza un archivo. Las fuentes quedan en `LICENCIAS.md` y las OFL elegidas por nombre también.
  - Propuesta: `GET /api/marca` devuelve además `mis_reels` y la propuesta pendiente. `POST /api/perfiles/<id>/propuesta {trabajo, accion}` aplica o descarta; el servidor lee la propuesta de su propio trabajo, no de la página.
  - Tarea `afinar-marca` (`estudio/tareas/afinar-marca.md`): el servidor saca las hojas de contacto, el agente escribe solo un JSON de propuesta y el Estudio la valida con el esquema. Nada se aplica sin el creador.
- Interfaz:
  - `estudio/public/marca.js` (nuevo): asistente de 7 pasos con vista previa 9:16 en vivo y página Marca por perfil.
  - **Asistente:**
    - Pasos: nombre y plataformas, logo, fuente (10 OFL o una subida con licencia declarada), colores, subtítulos, «Nunca» y Listo.
    - Colores sugeridos desde el logo.
    - Subtítulos: 4 tarjetas de estilo y tamaño Pequeño, Mediano o Grande.
    - Enter avanza.
    - El perfil se crea al final, así no quedan perfiles a medias.
    - Se mide el tiempo.
    - «Rehacer con el asistente» para los perfiles creados en el Estudio.
  - **Página Marca:**
    - Ver cualquier perfil con su vista previa.
    - Usarlo para los reels nuevos, crear, duplicar, archivar o restaurar, y ver los archivados.
    - «Afinar con mis reels»: subir reels y abrir el chat, donde se eligen agente, modelo y esfuerzo.
    - La propuesta muestra la tabla de cambios, el porqué, una vista previa de antes y después, y los botones Aplicar y Descartar.
  - **Proyectos:** con el perfil `ejemplo` activo aparece «Crea tu marca». El chat conoce el contexto «Marca · <perfil>».
- Pruebas: `estudio/marca.test.mjs` (nuevo, 9 pruebas).

## Validación
- `node --test estudio/agentes.test.mjs estudio/flujo.test.mjs estudio/perfiles.test.mjs estudio/marca.test.mjs` → **33 de 33 pasan**. Cubren el esquema, el asistente con cada estilo y cada fuente, las casillas «Nunca», los tamaños, crear y duplicar, archivar y guardar con historial.
- **Regresión de los reels entregados:** con el `generar.mjs` nuevo, Páginas de producto v7, Gymshark v9 y Psicología v6 (copias en `reels/_regresion-*`) dan `index.html` y `compositions/` **idénticos byte a byte** a los de la fase 2.
- `marca/`: mismas 69 sumas SHA-1 que antes de la fase 2.
- En vivo (Estudio en 4747):
  - Asistente completo con clics: logo de prueba → acento #E8562A y contorno #1B1F3B sugeridos; Oswald con «Palabra resaltada». El perfil se creó con su logo, su brand.json, el brand.md y los «Nunca» en `rasgos_prohibidos`.
  - Dos marcas más por API (Poppins con caja, Archivo Black en mayúsculas).
  - Errores correctos:
    - El asistente no deja rehacer `andres`.
    - Una marca inválida devuelve la lista de errores.
    - Un nombre repetido recibe el sufijo `-2`.
    - No se puede subir logo a `andres`, y una extensión que no es de fuente se rechaza.
  - Enter avanza y el tamaño «Grande» se ve en la vista previa.
- **E1 medido con el creador:** creó su marca «andre» con el asistente en **76 s** (Playfair Display 700, mayúsculas, @andressierra.ecom). La meta es menos de 5 min.

## Decisiones
- **La fase se dio por validada a pedido del creador**, sin la prueba «2 marcas generan el mismo reel y pasan `validar`». Esa prueba se detuvo antes de terminar y no se generaron reels de prueba. Que `generar` respeta los estilos lo cubren el código y la vista previa; el render real queda para el primer reel con una marca nueva (fase 4).
- La zona segura es una sola para Instagram, TikTok y Shorts (la más estricta); no cambia por plataforma.
- El logo se guarda y sirve para sugerir colores, pero no se dibuja en los reels (`posicion: "ninguna"`) salvo que se pida.
- Un perfil archivado sigue funcionando para sus reels; solo desaparece de las listas.
- `andres` es archivable si no es el activo (en una prueba se archivó por error y se restauró al momento).

## Pendientes
- E1 con una persona ajena al proyecto.
- «Afinar con mis reels» con un agente real: todo está conectado y la propuesta tiene su vista previa, pero no se probó con reels propios.
- Render real de una marca con caja, mayúsculas o palabra resaltada (`validar` de un reel) en la fase 4.
- El perfil activo quedó en **«andre»**, la marca que creó el creador. Los perfiles de prueba y las copias `reels/_regresion-*` se borraron.
- Sin commit: el proyecto aún no tiene git (fase 6).
