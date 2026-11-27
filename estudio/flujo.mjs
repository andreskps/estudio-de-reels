import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolverPerfil } from '../herramientas/perfiles.mjs';

export const FORMATOS = {
  libre: { nombre: 'A tu medida', descripcion: 'Una edición sobria guiada por tu referencia.', instrucciones: 'Sigue la marca y el plan aprobado. No añadas efectos decorativos.' },
  historia: { nombre: 'Historia de marca', descripcion: 'B-roll completo, tú en una esquina y subtítulos arriba.', instrucciones: 'B-roll a pantalla completa de inicio a fin. Creador sin fondo al 50 %, abajo a la derecha, sin espejo. Subtítulos con centro y=880. Solo tarjeta blanca inicial si el contenido lo pide; sin contadores ni títulos de capítulo.' },
  producto: { nombre: 'Páginas de producto', descripcion: 'La página protagonista, con espacio para mostrar cada detalle.', instrucciones: 'Durante demostraciones: página completa, creador recortado al 50 % abajo a la derecha, sin subtítulos. Intro y cierre: busto al 70 % y subtítulos bajo el mentón dentro de zona segura. Identifica los tramos a partir de la transcripción.' },
  ranking: { nombre: 'Ranking', descripcion: 'Puntos claros, gráficos grandes y ritmo tranquilo.', instrucciones: 'Ranking con números e iconos grandes y legibles. Subtítulos breves, cortes secos. Zooms suaves de 1,04x (entrada y salida lentas) donde haya que enfatizar, sin máximo fijo. Ajusta la cantidad de puntos al contenido real.' },
};
export const huella = (texto) => createHash('sha256').update(texto).digest('hex');
export function huellaVersion(raiz, slug, version) {
  const base = join(raiz, 'reels', slug, 'composicion', version);
  const archivos = [];
  function recorrer(dir) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'meta.json') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.(json|html|css|js|mjs)$/.test(e.name)) archivos.push([p.slice(base.length), readFileSync(p, 'utf8').replace(/\sdata-hf-id="[^"]*"/g, '')]);
      else { const s = statSync(p); archivos.push([p.slice(base.length), s.size, s.mtimeMs]); }
    }
  }
  recorrer(base);
  // La marca del perfil del reel (mismas claves que antes: las aprobaciones ya guardadas siguen valiendo).
  const dirPerfil = resolverPerfil({ raiz, slug }).dir;
  for (const f of ['brand.json', 'brand.md']) archivos.push([f, readFileSync(join(dirPerfil, f), 'utf8')]);
  return huella(JSON.stringify(archivos));
}
// Tareas de agente. Solo las que tienen `version` crean vN+1 (RF4.4: una consulta nunca crea versión).
// `revisa`: la tarea se puede encadenar sola después de editar (validar → retención).
export const TAREAS = {
  plan: { titulo: "Crear plan de edición", reel: true },
  referencia: { titulo: "Analizar referencia", reel: true },
  proponer: { titulo: "Proponer edición completa", reel: true, version: true },
  corregir: { titulo: "Aplicar correcciones", reel: true, version: true, texto: true },
  retencion: { titulo: "Revisión de retención", reel: true, versionExistente: true },
  describir: { titulo: "Describir para la biblioteca", item: true },
  libre: { titulo: "Instrucción libre", texto: true },
  aprender: { titulo: "Aprender técnicas (Learner)", oculta: true },
  "afinar-marca": { titulo: "Afinar marca con mis reels", perfil: true },
};
export const creaVersion = (tarea) => !!TAREAS[tarea]?.version;

// Por qué no se puede exportar una versión todavía (null = se puede). Mismo orden que el flujo:
// validar → revisión de retención → ver y aprobar la vista previa (RF4.2).
export function motivoBloqueoRender(rev = {}) {
  if (!rev.validada) return "Valida esta versión primero (zona segura, solapes, duración de subtítulos).";
  if (!rev.retencion) return "Falta la revisión de retención de esta versión.";
  if (!rev.aprobada) return "Mira la vista previa de esta versión y apruébala antes de exportar.";
  return null;
}

// Siguiente paso de un reel (RF4.1). `e` = etapas del servidor; `e.rev` = estado de la última versión
// { validada, retencion, aprobada, render, sugerencias } (todo atado a la huella de esa versión).
export function siguientePaso(e) {
  if (!e.entrada) return { texto: 'Subir clip', accion: 'subir', detalle: 'Añade tu grabación ya cortada para empezar.' };
  if (e.ultima) {
    if (e.final_actual) return { texto: 'Ver entrega', accion: 'entrega', detalle: `${e.ultima} está exportada. Puedes descargarla o seguir editando.` };
    if (!e.editable) return { texto: 'Preparar editor', accion: 'accion:migrar', detalle: 'Convierte esta composición en una nueva versión editable.' };
    const r = e.rev ?? {}, previa = e.entregada ? ` · última entrega ${e.entregada}` : '';
    if (!r.validada) return { texto: 'Validar', accion: 'accion:validar', detalle: `${e.ultima} tiene cambios pendientes de entregar${previa}. Primero se revisa la zona segura, los solapes y los subtítulos.` };
    if (!r.retencion) return { texto: 'Revisión de retención', accion: 'agente:retencion', detalle: `${e.ultima} pasó la validación. Un agente revisa si retiene antes de que la veas.` };
    if (!r.aprobada) return { texto: 'Ver y aprobar', accion: 'preview', detalle: `Mira ${e.ultima} en la vista previa${r.sugerencias ? ` y decide las ${r.sugerencias} sugerencias de retención` : ''}; apruébala para poder exportar.` };
    if (!r.render) return { texto: 'Exportar', accion: 'accion:render', detalle: `${e.ultima} está aprobada: render y QA de audio (−14 LUFS).` };
    return { texto: 'Completar audio y QA', accion: 'accion:qa', detalle: `El render de ${e.ultima} existe; falta normalizar el audio y las hojas de QA.` };
  }
  if (!e.transcripcion || e.falta_recorte) return { texto: 'Preparar clip', accion: 'accion:preparar', detalle: e.transcripcion ? 'Completa el recorte de fondo para el formato elegido.' : 'Mide el video y transcribe tu voz con tiempos por palabra.' };
  if (e.referencia && !e.analisis) return { texto: 'Analizar referencia', accion: 'agente:referencia', detalle: 'Extrae las decisiones visuales que encajan con tu marca.' };
  if (!e.plan) return { texto: 'Crear plan', accion: 'agente:plan', detalle: 'Organiza el contenido con el formato elegido.' };
  if (!e.plan_aprobado) return { texto: 'Revisar plan', accion: 'plan', detalle: 'Revisa la propuesta y apruébala antes de componer.' };
  return { texto: 'Crear primera edición', accion: 'agente:proponer', detalle: 'Aplica el plan aprobado a tu clip y tus subtítulos.' };
}

// Modo sin paradas (RF4.5): qué hace el servidor solo con el siguiente paso. null = se detiene
// (falta algo del creador o ya está entregado). Los checkpoints se aprueban solos; las reglas no se saltan.
export function pasoAutomatico(e) {
  const a = siguientePaso(e).accion;
  if (a.startsWith('accion:')) return { tipo: 'accion', accion: a.slice(7) };
  if (a.startsWith('agente:')) return { tipo: 'agente', tarea: a.slice(7) };
  if (a === 'plan') return { tipo: 'aprobar', que: 'plan' };
  if (a === 'preview') return { tipo: 'aprobar', que: 'preview' };
  return null; // subir, editor, entrega
}

export function corregirVocabulario(palabras, reemplazos = {}) {
  const reglas = Object.entries(reemplazos).sort((a,b) => b[0].length-a[0].length);
  const salida = [];
  for (let i = 0; i < palabras.length;) {
    let usada = false;
    for (const [antes, despues] of reglas) {
      const n = antes.split(/\s+/).length, grupo = palabras.slice(i, i+n);
      if (grupo.length !== n || grupo.map(p=>p.text).join(' ').toLowerCase().replace(/[.,!?;:]$/,'') !== antes.toLowerCase()) continue;
      const partes = despues.split(/\s+/), inicio = grupo[0].start, fin = grupo.at(-1).end;
      partes.forEach((text,j) => salida.push({ text, start: inicio+(fin-inicio)*j/partes.length, end: inicio+(fin-inicio)*(j+1)/partes.length }));
      i += n; usada = true; break;
    }
    if (!usada) salida.push({ ...palabras[i++] });
  }
  return salida.map((p,i) => ({ ...p, id: `w${i}` }));
}
