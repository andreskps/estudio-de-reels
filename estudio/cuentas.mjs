// Estado de la cuenta de cada agente: instalado, versión, sesión y una prueba real con el modelo elegido.
// "Conectar" abre una terminal del sistema con el inicio de sesión del CLI (el creador escribe ahí; el Estudio no ve contraseñas).
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENTES, catalogo, coincideModelo, diagnosticar, disponible, ejecutarAgente, marcarNoDisponible, quitarNoDisponible, validarEleccion } from "./agentes.mjs";

const correr = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", shell: true, windowsHide: true, timeout: 20000 });
const cache = new Map(); // id -> { fecha, estado }
// La última prueba de cada agente se guarda: si Gemini rechazó la cuenta, sigue bloqueado aunque se reinicie el Estudio.
const RUTA_PRUEBAS = join(import.meta.dirname, "cuentas-pruebas.json");
const leerPruebas = () => { try { return JSON.parse(readFileSync(RUTA_PRUEBAS, "utf8")); } catch { return {}; } };
const guardarPrueba = (id, r) => { const p = leerPruebas(); p[id] = r; writeFileSync(RUTA_PRUEBAS, JSON.stringify(p, null, 2)); };
const VIGENCIA_MS = 60_000;

// Sesión según el propio CLI, sin gastar tokens.
function sesionDe(id) {
  if (id === "claude") {
    const r = correr("claude", ["auth", "status"]);
    try { const j = JSON.parse(r.stdout); return j.loggedIn ? { ok: true, detalle: `Sesión iniciada (${j.authMethod ?? "cuenta"})` } : { ok: false, detalle: "Sin sesión" }; }
    catch { return { ok: null, detalle: (r.stdout || r.stderr || "").trim().slice(0, 160) || "No se pudo leer el estado" }; }
  }
  if (id === "codex") {
    const r = correr("codex", ["login", "status"]);
    const t = `${r.stdout}${r.stderr}`.trim();
    return r.status === 0 && /logged in/i.test(t) ? { ok: true, detalle: t.split(/\r?\n/)[0] } : { ok: false, detalle: t.slice(0, 160) || "Sin sesión" };
  }
  if (id === "gemini") {
    // El CLI no tiene "status": con clave de API funciona; con cuenta personal depende del nivel (se sabe al Probar).
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return { ok: true, detalle: "Clave de API configurada" };
    return { ok: null, detalle: "Sin clave GEMINI_API_KEY; la cuenta personal puede ser rechazada. Pulsa «Probar»." };
  }
  return { ok: null, detalle: "" };
}

export function estado(id, { forzar = false } = {}) {
  const c = cache.get(id);
  if (!forzar && c && Date.now() - c.fecha < VIGENCIA_MS) return c.estado;
  const a = AGENTES[id];
  const instalado = disponible(id);
  const cat = catalogo().agentes[id];
  const e = { id, nombre: a.nombre, instalado, version: "", sesion: { ok: false, detalle: `No encuentro «${a.comando}». Instálalo y vuelve a abrir el Estudio.` }, por_defecto_cli: cat.por_defecto_cli, avisos: [] };
  if (instalado) {
    e.version = (correr(a.comando, ["--version"]).stdout || "").trim().split(/\r?\n/)[0];
    e.sesion = sesionDe(id);
    const def = cat.por_defecto_cli?.modelo;
    const ids = cat.modelos.map((m) => m.id).filter(Boolean);
    const rechazado = def && cat.modelos.find((m) => m.id === def)?.no_disponible;
    if (rechazado) e.avisos.push(`Tu configuración de ${a.nombre} usa «${def}», que tu cuenta rechazó. «El de tu configuración» fallará: elige otro modelo.`);
    else if (id === "codex" && def && ids.length && !ids.includes(def))
      e.avisos.push(`Tu configuración de Codex usa «${def}», que no aparece entre los modelos de tu cuenta. Si eliges «El de tu configuración» puede fallar; elige un modelo de la lista.`);
  }
  e.ultima_prueba = leerPruebas()[id] ?? null;
  // Si el CLI no sabe decir si hay sesión (Gemini), manda la última prueba real.
  if (instalado && e.sesion.ok !== true && e.ultima_prueba) {
    const d = e.ultima_prueba.diagnostico;
    if (d && (d.tipo === "sesion" || d.tipo === "cuenta")) e.sesion = { ok: false, detalle: d.mensaje };
    else if (e.ultima_prueba.ok && e.sesion.ok === null) e.sesion = { ok: true, detalle: "La última prueba respondió bien" };
  }
  cache.set(id, { fecha: Date.now(), estado: e });
  return e;
}
// Un pedido del chat que falló por la cuenta cuenta como prueba fallida (así el chat bloquea el siguiente envío).
export function registrarFallo(id, modelo, diagnostico) { guardarPrueba(id, { ok: false, modelo: modelo ?? "", diagnostico, fecha: new Date().toISOString(), desde: "chat" }); cache.delete(id); }
export const estados = (o) => Object.keys(AGENTES).map((id) => estado(id, o));

// Prueba real: un pedido mínimo con el modelo y esfuerzo elegidos, en una carpeta temporal (no toca el proyecto).
export async function probar(id, eleccion = {}) {
  const { modelo, esfuerzo } = validarEleccion(id, eleccion, (() => { const c = catalogo(); for (const m of c.agentes[id].modelos) delete m.no_disponible; c.agentes[id].rechazados = {}; return c; })());
  const lineas = [];
  let confirmado = null;
  const inicio = Date.now();
  const cwd = mkdtempSync(join(tmpdir(), "estudio-prueba-"));
  const codigo = await new Promise((res) => {
    const timer = setTimeout(() => { proc?.kill(); lineas.push("✗ La prueba tardó más de 3 minutos."); }, 180_000);
    let proc;
    ejecutarAgente(id, "Responde solo con la palabra: ok", { cwd, modelo, esfuerzo, onLinea: (l) => lineas.push(l), onProceso: (p) => (proc = p), onModelo: (m) => (confirmado = m) })
      .then((c) => { clearTimeout(timer); res(c); }).catch((e) => { clearTimeout(timer); lineas.push(`✗ ${e.message}`); res(1); });
  });
  const texto = lineas.join("\n");
  const diag = diagnosticar(id, texto);
  const ok = codigo === 0 && !diag && /\bok\b/i.test(texto);
  if (diag?.tipo === "modelo") marcarNoDisponible(id, modelo, diag.mensaje);
  if (ok) quitarNoDisponible(id, modelo);
  const r = { ok, modelo, esfuerzo, confirmado, coincide: coincideModelo(modelo, confirmado), segundos: Math.round((Date.now() - inicio) / 1000), diagnostico: diag, salida: texto.slice(-600), fecha: new Date().toISOString() };
  guardarPrueba(id, r);
  estado(id, { forzar: true });
  return r;
}

// Abre una terminal visible con el login del CLI. Solo comandos fijos (nada del usuario llega aquí).
const LOGIN = { claude: "claude auth login", codex: "codex login", gemini: "gemini" };
export function conectar(id) {
  const cmd = LOGIN[id];
  if (!cmd) throw new Error(`agente desconocido: ${id}`);
  if (!disponible(id)) throw new Error(`${AGENTES[id].nombre} no está instalado.`);
  if (process.platform === "win32") spawn("cmd.exe", ["/c", "start", '""', "cmd", "/k", cmd], { detached: true, stdio: "ignore", windowsHide: false }).unref();
  else if (process.platform === "darwin") spawn("osascript", ["-e", `tell application "Terminal" to do script "${cmd}"`, "-e", 'tell application "Terminal" to activate'], { detached: true, stdio: "ignore" }).unref();
  else spawn("x-terminal-emulator", ["-e", cmd], { detached: true, stdio: "ignore" }).unref();
  cache.delete(id);
  return { ok: true, comando: cmd, ayuda: id === "gemini" ? "En la terminal elige cómo entrar. Si tu cuenta personal es rechazada, usa una clave de Google AI Studio (variable GEMINI_API_KEY) y reinicia el Estudio." : "Sigue los pasos en la ventana que se abrió y luego pulsa «Probar»." };
}
