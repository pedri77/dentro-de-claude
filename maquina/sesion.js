// El «modelo» de la máquina: una sesión real de Claude Code (anonimizada) reproducida segundo a segundo.
// Una sola entrada — el segundo de la traza, 0 a 252 s — y de ella sale todo: qué hace el agente
// principal (piensa, usa una herramienta, espera), cuánto contexto lleva y qué parte viene de caché,
// qué hace cada subagente, los avisos que vuelven, los tokens escritos y el coste equivalente de API.
// Nada se anima a mano: película, página y sonido leen estas funciones.
import HECHOS from '../claude-film/hechos.json';
import TRAZA from '../claude-film/traza.json';

export {HECHOS, TRAZA};
export const DUR_TRAZA = TRAZA.duracion_s;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
const P = HECHOS.precio_usd_por_millon;

const tokensDe = (u) => u.entrada + u.cache_leida + u.cache_escrita;
const costeDe = (u) =>
  (u.entrada * P.entrada + u.cache_leida * P.cache_lectura + u.cache_escrita_1h * P.cache_escritura_1h +
    (u.cache_escrita - u.cache_escrita_1h) * P.cache_escritura_5m + u.salida * P.salida) / 1e6;
const sinCacheDe = (u) => (tokensDe(u) * P.entrada + u.salida * P.salida) / 1e6;

/** Una línea de trabajo (el principal o un subagente) preparada para consultas por tiempo. */
function preparar(llamadas, herramientas, despertares, inicio0) {
  const herr = herramientas.map((h) => ({...h, fin: h.fin ?? h.t + 0.5}));
  let fin = inicio0;
  const calls = llamadas.map((c) => {
    // la llamada empieza cuando acaba lo anterior o cuando llega un aviso que la despierta
    const aviso = despertares.filter((d) => d > fin && d < c.t).pop();
    const ini = Math.max(fin, aviso ?? fin);
    const propias = herr.filter((h) => h.t >= c.t - 0.01 && h.t <= c.fin + 0.01);
    fin = Math.max(c.fin, ...propias.map((h) => h.fin));
    return {...c, ini, tokens: tokensDe(c.uso), coste: costeDe(c.uso), sinCache: sinCacheDe(c.uso)};
  });
  return {calls, herr};
}

const despertaresPrincipal = TRAZA.subagentes.map((s) => s.termina);
export const PRINCIPAL = preparar(TRAZA.llamadas, TRAZA.herramientas, despertaresPrincipal, 0);
export const SUBS = TRAZA.subagentes.map((s, i) => ({
  i,
  tipo: s.tipo,
  lanzado: s.lanzado,
  termina: s.termina,
  ...preparar(s.llamadas, s.herramientas, [], s.lanzado),
}));

const VIAJE = 7; // segundos de traza que tarda un encargo o un aviso en recorrer su tubo
// Una herramienta real dura a veces menos de un segundo: en la película sería invisible. Para dibujarla
// se mantiene visible al menos VISIBLE s de traza; los contadores siguen leyendo los tiempos reales.
const VISIBLE = 6;

/** Estado de una línea de trabajo en el segundo t. */
function linea(L, t) {
  const {calls, herr} = L;
  let k = -1;
  for (let i = 0; i < calls.length; i++) if (calls[i].ini <= t) k = i;
  const activaHerr = herr.filter((h) => h.t <= t && t < h.fin);
  const c = calls[k];
  let fase = 'espera';
  if (activaHerr.length) fase = 'herramienta';
  else if (c && t < c.fin + 0.15) fase = 'piensa';
  // contexto: salta en cada petición y se interpola mientras llegan resultados
  let ctx = calls[0]?.tokens ?? 0;
  if (k >= 0) {
    const sig = calls[k + 1];
    ctx = sig ? c.tokens + (sig.tokens - c.tokens) * ss(c.fin, sig.ini, t) : c.tokens;
  }
  let salida = 0;
  let coste = 0;
  let sinCache = 0;
  let leida = 0;
  let hechas = 0;
  for (const x of calls) {
    if (x.ini > t) break;
    const f = x.fin > x.t ? clamp((t - x.t) / (x.fin - x.t), 0, 1) : t >= x.t ? 1 : 0;
    salida += x.uso.salida * f;
    if (t >= x.ini) {
      coste += x.coste - (x.uso.salida * P.salida * (1 - f)) / 1e6;
      sinCache += x.sinCache - (x.uso.salida * P.salida * (1 - f)) / 1e6;
      leida += x.uso.cache_leida;
    }
    if (t >= x.fin) hechas++;
  }
  const usoAhora = c ? c.uso : calls[0]?.uso;
  let reciente = null;
  for (const h of herr) {
    const vis = Math.max(h.fin - h.t, VISIBLE);
    if (h.t <= t && t < h.t + vis) reciente = {herr: h.herr, k: (t - h.t) / vis};
  }
  return {
    reciente,
    fase,
    ctx,
    cache: usoAhora ? {leida: usoAhora.cache_leida, escrita: usoAhora.cache_escrita, nueva: usoAhora.entrada} : {leida: 0, escrita: 0, nueva: 0},
    herr: activaHerr.map((h) => h.herr),
    salida,
    coste,
    sinCache,
    leida,
    hechas,
    // intensidad de «pensar»: alta mientras el modelo escribe tokens
    pulso: fase === 'piensa' ? 1 : fase === 'herramienta' ? 0.35 : 0.08,
  };
}

/** El estado completo de la máquina en el segundo t de la traza. */
export function estadoAt(t) {
  t = clamp(t, 0, DUR_TRAZA);
  const p = linea(PRINCIPAL, t);
  const subs = SUBS.map((S) => {
    const on = t >= S.lanzado && t < S.termina;
    const l = t >= S.lanzado ? linea(S, Math.min(t, S.termina)) : null;
    return {
      i: S.i,
      tipo: S.tipo,
      estado: t < S.lanzado ? 'apagado' : on ? 'trabaja' : 'terminado',
      encargo: t >= S.lanzado ? clamp((t - S.lanzado) / VIAJE, 0, 1) : 0,
      aviso: t >= S.termina ? clamp((t - S.termina) / VIAJE, 0, 1) : 0,
      ctx: l ? l.ctx : 0,
      cache: l ? l.cache : {leida: 0, escrita: 0, nueva: 0},
      fase: on ? l.fase : 'espera',
      herr: on ? l.herr : [],
      reciente: on ? l.reciente : null,
      salida: l ? l.salida : 0,
      coste: l ? l.coste : 0,
      sinCache: l ? l.sinCache : 0,
      leida: l ? l.leida : 0,
      hechas: l ? l.hechas : 0,
      pulso: on ? l.pulso : 0,
    };
  });
  const todas = [p, ...subs];
  const sum = (k) => todas.reduce((a, x) => a + x[k], 0);
  const herrCuenta = {};
  for (const h of [...PRINCIPAL.herr, ...SUBS.flatMap((S) => S.herr)]) if (h.t <= t) herrCuenta[h.herr] = (herrCuenta[h.herr] || 0) + 1;
  return {
    t,
    principal: p,
    subs,
    activos: subs.filter((s) => s.estado === 'trabaja').length,
    llamadas: sum('hechas'),
    salida: sum('salida'),
    leida: sum('leida'),
    coste: sum('coste'),
    sinCache: sum('sinCache'),
    herrCuenta,
    respuesta: ss(DUR_TRAZA - 8, DUR_TRAZA, t),
  };
}

export const TOTALES = estadoAt(DUR_TRAZA);
