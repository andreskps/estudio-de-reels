// Preparación recuperable; nunca reemplaza el clip ni una transcripción corregida.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { HF, ejecutar, info, rutaReel, rutaPerfil, falla, marca } from './lib.mjs';
import { corregirVocabulario } from '../estudio/flujo.mjs';
const [slug] = process.argv.slice(2);
const R = rutaReel(slug), entrada = join(R, 'entrada');
const nombre = readdirSync(entrada).find(f => /\.(mp4|mov|m4v|webm)$/i.test(f));
if (!nombre) falla('Sube primero un clip de video.');
const clip = join(entrada, nombre), datos = info(clip);
if (!(datos.duracion > 0)) falla('No se pudo medir la duración del clip.');
writeFileSync(join(R, 'preparacion.json'), JSON.stringify({ ...datos, clip: nombre, fecha: new Date().toISOString() }, null, 2));
if (existsSync(join(R, 'transcripcion.json'))) { console.log('✔ Clip medido. Se conserva tu transcripción existente.'); process.exit(0); }
if (!datos.audio) falla('El clip no tiene audio. Añade una transcripción manual antes de crear el plan.');
const trabajo = join(R, 'analisis', 'transcripcion');
mkdirSync(trabajo, { recursive: true });
const configuracion = { paths: { assets: 'assets', blocks: 'compositions', components: 'compositions/components' } };
writeFileSync(join(trabajo, 'hyperframes.json'), JSON.stringify(configuracion, null, 2));
if (process.env.LOCALAPPDATA && !existsSync(process.env.HYPERFRAMES_WHISPER_PATH ?? '')) {
  const candidatosWhisper = [join(process.env.LOCALAPPDATA, 'whisper.cpp', '1.7.6', 'Release', 'whisper-cli.exe'), join(process.env.LOCALAPPDATA, 'whisper.cpp', 'Release', 'whisper-cli.exe')];
  const exe = candidatosWhisper.find(existsSync);
  if (exe) process.env.HYPERFRAMES_WHISPER_PATH = exe;
}
const modelo = existsSync(join(homedir(), '.cache', 'hyperframes', 'whisper', 'models', 'ggml-medium.bin')) ? 'medium' : 'small';
console.log('▶ Transcribiendo la voz. Este paso puede tardar varios minutos.');
const r = ejecutar('npx', ['--yes', HF, 'transcribe', `"${clip}"`, '--dir', `"${trabajo}"`, '--engine', 'whisper', '--model', modelo, '--language', marca(slug).creador?.idioma ?? 'es', '--no-runtime-install', '--json'], { shell: true });
if (r.status !== 0) {
  const detalle = `${r.stdout}\n${r.stderr}`;
  if (detalle.includes('whisper_unavailable')) falla('No se encontró Whisper local. Configura HYPERFRAMES_WHISPER_PATH con la ruta a whisper-cli.exe y vuelve a preparar el clip.', 1);
  falla(`No se pudo transcribir. ${detalle.slice(-1500)}`, 1);
}
const candidatos = [join(trabajo, 'assets', 'transcript.json'), join(trabajo, 'transcript.json')];
const archivo = candidatos.find(existsSync);
if (!archivo) falla('La transcripción no produjo transcript.json. Revisa el diagnóstico de HyperFrames.');
const raw = JSON.parse(readFileSync(archivo, 'utf8'));
const words = Array.isArray(raw) ? raw : raw.words;
if (!words?.length || words.some(p => !p.text || !Number.isFinite(p.start) || !Number.isFinite(p.end))) falla('La transcripción no contiene palabras con tiempos válidos.');
// Vocabulario del perfil del reel; un perfil sin vocabulario.json no corrige nada.
const rutaVocab = rutaPerfil(slug, 'vocabulario.json');
const vocab = existsSync(rutaVocab) ? JSON.parse(readFileSync(rutaVocab, 'utf8')) : { reemplazos: {} };
const acotadas = words.map(p => ({ ...p, start: Math.max(0, p.start), end: Math.min(datos.duracion, p.end) }))
  .filter(p => p.end > p.start);
const corregidas = corregirVocabulario(acotadas, vocab.reemplazos);
if (!corregidas.length) falla('No se detectaron palabras dentro del clip.');
const temp = join(R, 'transcripcion.json.tmp');
writeFileSync(temp, JSON.stringify(corregidas, null, 2));
renameSync(temp, join(R, 'transcripcion.json'));
console.log(`✔ Clip preparado · ${datos.duracion.toFixed(1)} s · ${corregidas.length} palabras. Revisa nombres propios antes de aprobar el plan.`);
