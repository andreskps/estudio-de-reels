Tarea: revisión de retención de la versión `{{version}}` del reel `{{slug}}`.
(Fuente única: este archivo lo usan el Estudio, con cualquier agente, y las skills `/reel` paso 5b y `/ajustar` paso 6.)

Sigue el procedimiento de .claude/agents/revisor-retencion.md (léelo completo) sobre reels/{{slug}}/composicion/{{version}}.
Escribe el resultado en reels/{{slug}}/retencion-{{version}}.md: veredicto, dónde se caerá la audiencia (con segundos) y hasta 6 sugerencias concretas que respeten la marca.

Escribe además SOLO este JSON en {{respuesta}} (el creador verá cada sugerencia como un botón «Aplicar / Descartar»):
{"veredicto": "Retiene / Retiene con ajustes / No retiene — X/10",
 "caidas": [{"desde": 3.0, "hasta": 5.5, "motivo": "…"}],
 "sugerencias": [{"texto": "qué cambiar y por qué, en una frase para el creador", "pedido": "la corrección exacta para el editor: elemento, tiempo y cambio en edicion.json", "segundo": 3.2, "choca_marca": false}]}
Las sugerencias que exigirían regrabar van solo en el .md («Para la próxima grabación»), no en el JSON.
No edites la composición ni la marca.
{{texto}}
