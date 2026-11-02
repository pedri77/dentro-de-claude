// La consola de «Dentro de Claude»: capa de interfaz 1600 × 900 en tema oscuro IAcademy (fondo
// «void», superficies con borde, rojo solo de acento; títulos en DM Serif Display). update(state)
// redibuja lo vivo: la pregunta, la ventana de contexto, los contadores, los subagentes, el rótulo
// del momento y la línea de tiempo de la sesión real con su cabezal.
import dmSerif from './dm-serif-display-400-normal-latin.woff2';
import {DUR_TRAZA, HECHOS, PRINCIPAL, SUBS, TOTALES} from './sesion.js';

export const C = {
  ink: '#f1f1f1', mute: '#a4a7ba', faint: '#6b6d85', line: '#3a3a50', panel: 'rgba(26,26,46,.86)',
  btn: 'rgba(26,26,46,.92)', accent: '#ef4444', deep: '#dc2626', elev: '#2a2a3d', void: '#0f0f18',
  capas: ['#d6d9ea', '#8f9ac4', '#d9b46a', '#7c86c2'],
};
export const VIEW_NAMES = {general: 'GENERAL', contexto: 'CONTEXTO', modelo: 'MODELO', subagentes: 'SUBAGENTES', herramientas: 'HERRAMIENTAS'};
const HERR_COLOR = {Bash: '#ef4444', Read: '#9aa0b8', Write: '#b8a06a', Edit: '#b8a06a', Agent: '#f1f1f1', MCP: '#6f7896'};

const CSS = `
@font-face{font-family:'DM Serif Display';font-weight:400;font-display:block;src:url(data:font/woff2;base64,${dmSerif}) format('woff2')}
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:10px}
.hd{font-size:9px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;white-space:nowrap;color:${C.ink}}
.hd i{font-style:normal;color:${C.accent};margin-right:7px;letter-spacing:0}
.lb{font-size:8px;font-weight:600;letter-spacing:1.3px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.vl{font-size:11px;font-weight:600;letter-spacing:.2px;white-space:nowrap}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.serif{font-family:'DM Serif Display',Georgia,serif;font-weight:400}
.vb{position:absolute;height:20px;padding:0 9px;display:flex;align-items:center;font-size:8.5px;font-weight:700;letter-spacing:1.4px;border:1px solid ${C.line};background:${C.btn};color:${C.mute};border-radius:999px}
.call{position:absolute;white-space:nowrap;background:rgba(15,15,24,.82);border:1px solid ${C.line};border-radius:6px;padding:4px 8px}
.call b{display:block;font-size:8.5px;font-weight:700;letter-spacing:1.4px}
.call span{display:block;font-size:7.5px;letter-spacing:1px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
.ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.6px solid ${C.accent};opacity:0;z-index:49}
.bar{position:absolute;height:6px;border-radius:3px}
`;

const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const nf = (x) => Math.round(x ?? 0).toLocaleString('es-ES');
const fmt = (x, d = 1) => (x ?? 0).toLocaleString('es-ES', {minimumFractionDigits: d, maximumFractionDigits: d});
const kTok = (x) => `${fmt(x / 1000, 0)}k`;
const usd = (x) => `${fmt(x, 2)} $`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };

  // ------------------------------------------------------------ barra superior
  add(`<div style="position:absolute;left:14px;right:14px;top:8px;height:26px;border-bottom:1px solid ${C.line}"></div>`);
  add(`<div class="lb" style="left:20px;top:15px;position:absolute;color:${C.ink}">IACADEMY · LABORATORIO DE IA</div>`);
  const btn = {};
  {
    let x = 1586;
    const right = (key, txt, w) => {
      x -= w;
      btn[key] = add(`<div class="vb" style="left:${x}px;top:10px;width:${w}px;justify-content:center">${txt}</div>`);
      x -= 5;
    };
    right('pause', '❚❚ PAUSA', 84);
    x -= 8;
    right('abrir', 'ABRIR DEPÓSITO', 120);
    x -= 8;
    for (const k of Object.keys(VIEW_NAMES).reverse()) right(k, VIEW_NAMES[k], VIEW_NAMES[k].length * 7.6 + 22);
    add(`<div class="lb" style="position:absolute;left:${x - 34}px;top:16px">VISTA</div>`);
  }
  add(`<div class="lb" style="position:absolute;right:18px;top:40px;letter-spacing:1px;font-size:7.5px">ARRASTRA PARA ORBITAR · 1–5 VISTAS · A ABRE · ESPACIO PAUSA · ← → TIEMPO</div>`);

  // ------------------------------------------------------------ título
  add(`<div class="serif" style="position:absolute;left:30px;top:48px;font-size:34px;line-height:1">Dentro de <span style="color:${C.accent}">Claude</span></div>`);
  add(`<div class="lb" style="position:absolute;left:31px;top:90px;color:${C.mute};font-size:8.5px;letter-spacing:1.5px">UNA PREGUNTA REAL A CLAUDE CODE, POR DENTRO</div>`);

  // ------------------------------------------------------------ la pregunta (tiempo y fase)
  const QP = {x: 24, y: 112, w: 312, h: 186};
  add(`<div class="pn" style="left:${QP.x}px;top:${QP.y}px;width:${QP.w}px;height:${QP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${QP.x + 14}px;top:${QP.y + 12}px"><i>›››</i>LA PREGUNTA · UNA ENTRADA LO MUEVE TODO</div>`);
  const SL = {x: QP.x + 16, y: QP.y + 54, w: QP.w - 32};
  add(`<div class="lb" style="position:absolute;left:${SL.x}px;top:${SL.y - 19}px">SEGUNDO DE LA SESIÓN REAL</div>`);
  const tVal = add(`<div class="vl mono" style="position:absolute;right:${1600 - (SL.x + SL.w)}px;top:${SL.y - 21}px;color:${C.accent}"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;width:${SL.w}px;height:3px;border-radius:2px;background:${C.elev}"></div>`);
  const fill = add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;height:3px;border-radius:2px;background:${C.accent}"></div>`);
  const knob = add(`<div style="position:absolute;top:${SL.y - 6.5}px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:${C.ink};border:2px solid ${C.accent}"></div>`);
  add(`<svg style="position:absolute;left:${SL.x}px;top:${SL.y + 8}px" width="${SL.w}" height="14">${[0, 60, 120, 180, 240].map((v) => `<line x1="${(v / DUR_TRAZA) * SL.w}" x2="${(v / DUR_TRAZA) * SL.w}" y1="0" y2="4" stroke="${C.faint}" stroke-width=".8"/><text x="${Math.max(6, (v / DUR_TRAZA) * SL.w)}" y="12" font-size="6.5" text-anchor="middle" fill="${C.faint}">${v} s</text>`).join('')}</svg>`);
  add(`<div style="position:absolute;left:${QP.x + 16}px;top:${QP.y + 88}px;width:${QP.w - 32}px;display:grid;grid-template-columns:1fr auto;row-gap:6px">
    <span class="lb">AGENTE PRINCIPAL</span><span class="vl" data-k="fase"></span>
    <span class="lb">MODELO</span><span class="vl mono">${HECHOS.modelo}</span>
    <span class="lb">RAZONAMIENTO</span><span class="vl">${HECHOS.configuracion.razonamiento} · esfuerzo ${HECHOS.configuracion.esfuerzo}</span>
    <span class="lb">DURACIÓN REAL</span><span class="vl mono">${fmt(DUR_TRAZA / 60, 1)} min · ${TOTALES.llamadas} llamadas</span></div>`);

  // ------------------------------------------------------------ ventana de contexto
  const VP = {x: 24, y: 308, w: 312, h: 236};
  add(`<div class="pn" style="left:${VP.x}px;top:${VP.y}px;width:${VP.w}px;height:${VP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${VP.x + 14}px;top:${VP.y + 12}px"><i>›››</i>VENTANA DE CONTEXTO · 1.000.000 TOKENS</div>`);
  const ctxBig = add(`<div class="mono" style="position:absolute;left:${VP.x + 16}px;top:${VP.y + 32}px;font-size:20px;font-weight:700"></div>`);
  const ctxPct = add(`<div class="lb" style="position:absolute;left:${VP.x + 16}px;top:${VP.y + 60}px"></div>`);
  const BW = VP.w - 32;
  add(`<div style="position:absolute;left:${VP.x + 16}px;top:${VP.y + 78}px;width:${BW}px;height:12px;border-radius:3px;background:${C.elev}"></div>`);
  const segs = [0, 1, 2, 3, 4].map((i) => add(`<div style="position:absolute;top:${VP.y + 78}px;height:12px;background:${i === 4 ? C.accent : C.capas[i]}"></div>`));
  const ARR = HECHOS.arranque;
  add(`<div style="position:absolute;left:${VP.x + 16}px;top:${VP.y + 100}px;width:${BW}px;display:grid;grid-template-columns:10px 1fr auto;column-gap:6px;row-gap:5px;align-items:center">
    ${[['Instrucciones de sistema', ARR.sistema_tokens_aprox], ['Definiciones de herramientas', ARR.herramientas_tokens_aprox], ['Proyecto: CLAUDE.md, memoria, skills', ARR.proyecto_y_mensaje_tokens_aprox]].map(([n, v], i) => `<i style="width:8px;height:8px;border-radius:2px;background:${C.capas[i]}"></i><span class="lb" style="text-transform:none;letter-spacing:.3px;font-size:9px">${n}</span><span class="vl mono" style="font-size:9.5px">≈ ${kTok(v)}</span>`).join('')}
    <i style="width:8px;height:8px;border-radius:2px;background:${C.capas[3]}"></i><span class="lb" style="text-transform:none;letter-spacing:.3px;font-size:9px">Conversación hasta ahora</span><span class="vl mono" style="font-size:9.5px" data-k="conv"></span>
    <i style="width:8px;height:8px;border-radius:2px;background:${C.accent}"></i><span class="lb" style="text-transform:none;letter-spacing:.3px;font-size:9px">Nuevo en esta llamada</span><span class="vl mono" style="font-size:9.5px" data-k="nuevo"></span></div>`);
  add(`<div style="position:absolute;left:${VP.x + 16}px;top:${VP.y + 192}px;width:${BW}px;height:1px;background:${C.line}"></div>`);
  add(`<div style="position:absolute;left:${VP.x + 16}px;top:${VP.y + 200}px;width:${BW}px;display:grid;grid-template-columns:1fr auto">
    <span class="lb">LEÍDO DE CACHÉ EN ESTA LLAMADA</span><span class="vl mono" style="color:${C.accent}" data-k="hit"></span></div>`);
  add(`<div class="lb" style="position:absolute;left:${VP.x + 16}px;top:${VP.y + 218}px;font-size:6.6px;letter-spacing:.6px;color:${C.faint}">ARRANQUE: OTRA SESIÓN DEL MISMO EQUIPO · 2,74 CAR./TOKEN</div>`);

  // ------------------------------------------------------------ contadores, derecha
  const KP = {x: 1264, y: 58, w: 312, h: 214};
  add(`<div class="pn" style="left:${KP.x}px;top:${KP.y}px;width:${KP.w}px;height:${KP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${KP.x + 14}px;top:${KP.y + 12}px"><i>›››</i>CONTADORES DE LA SESIÓN</div>`);
  add(`<div style="position:absolute;left:${KP.x + 16}px;top:${KP.y + 34}px;width:${KP.w - 32}px;display:grid;grid-template-columns:1fr auto;row-gap:7px">
    <span class="lb">LLAMADAS AL MODELO</span><span class="vl mono" data-k="llam"></span>
    <span class="lb">SUBAGENTES TRABAJANDO</span><span class="vl mono" data-k="act"></span>
    <span class="lb">TOKENS LEÍDOS DE CACHÉ</span><span class="vl mono" data-k="leida"></span>
    <span class="lb">TOKENS ESCRITOS POR EL MODELO</span><span class="vl mono" data-k="sal"></span></div>`);
  add(`<div style="position:absolute;left:${KP.x + 16}px;top:${KP.y + 116}px;width:${KP.w - 32}px;height:1px;background:${C.line}"></div>`);
  add(`<div class="lb" style="position:absolute;left:${KP.x + 16}px;top:${KP.y + 126}px">COSTE EQUIVALENTE EN PRECIOS DE API</div>`);
  const cBig = add(`<div class="mono" style="position:absolute;left:${KP.x + 16}px;top:${KP.y + 140}px;font-size:20px;font-weight:700;color:${C.accent}"></div>`);
  const CW = KP.w - 32;
  add(`<div class="bar" style="left:${KP.x + 16}px;top:${KP.y + 172}px;width:${CW}px;background:${C.elev}"></div>`);
  const barSin = add(`<div class="bar" style="left:${KP.x + 16}px;top:${KP.y + 172}px;background:${C.faint}"></div>`);
  const barCon = add(`<div class="bar" style="left:${KP.x + 16}px;top:${KP.y + 172}px;background:${C.accent}"></div>`);
  const cSin = add(`<div class="lb" style="position:absolute;left:${KP.x + 16}px;top:${KP.y + 186}px;text-transform:none;letter-spacing:.3px;font-size:9px"></div>`);

  // ------------------------------------------------------------ subagentes, derecha
  const SP = {x: 1264, y: 282, w: 312, h: 262};
  add(`<div class="pn" style="left:${SP.x}px;top:${SP.y}px;width:${SP.w}px;height:${SP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${SP.x + 14}px;top:${SP.y + 12}px"><i>›››</i>SUBAGENTES · CONTEXTO PROPIO</div>`);
  const filas = SUBS.map((S, i) => {
    const y = SP.y + 36 + i * 40;
    add(`<div class="lb" style="position:absolute;left:${SP.x + 16}px;top:${y}px;color:${C.ink}">SUBAGENTE ${i + 1}</div>`);
    const est = add(`<div class="lb" style="position:absolute;right:${1600 - (SP.x + SP.w - 16)}px;top:${y}px"></div>`);
    add(`<div class="bar" style="left:${SP.x + 16}px;top:${y + 14}px;width:${SP.w - 32}px;background:${C.elev}"></div>`);
    const bar = add(`<div class="bar" style="left:${SP.x + 16}px;top:${y + 14}px;background:${C.capas[3]}"></div>`);
    const txt = add(`<div class="lb" style="position:absolute;left:${SP.x + 16}px;top:${y + 24}px;text-transform:none;letter-spacing:.3px;font-size:8.5px;color:${C.mute}"></div>`);
    return {est, bar, txt};
  });
  add(`<div class="lb" style="position:absolute;left:${SP.x + 16}px;top:${SP.y + 240}px;font-size:6.8px;letter-spacing:.8px;color:${C.faint}">BARRA = SU CONTEXTO SOBRE 1M · EL DEL PRINCIPAL NO SE COPIA</div>`);

  // ------------------------------------------------------------ rótulo del momento
  const rotT = add(`<div class="serif" style="position:absolute;left:360px;width:880px;top:652px;text-align:center;font-size:26px;line-height:1.1;text-shadow:0 2px 18px #0f0f18,0 0 6px #0f0f18"></div>`);
  const rotB = add(`<div style="position:absolute;left:400px;width:800px;top:688px;text-align:center;font-size:12.5px;line-height:1.45;color:#c9cbd8;text-shadow:0 1px 10px #0f0f18,0 0 4px #0f0f18"></div>`);

  // ------------------------------------------------------------ línea de tiempo de la sesión
  const TL = {x: 24, y: 744, w: 1552, h: 140};
  add(`<div class="pn" style="left:${TL.x}px;top:${TL.y}px;width:${TL.w}px;height:${TL.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${TL.x + 14}px;top:${TL.y + 10}px"><i>›››</i>LA SESIÓN REAL, PISTA A PISTA</div>`);
  const LEY = Object.entries({Bash: HERR_COLOR.Bash, Read: HERR_COLOR.Read, 'Write / Edit': HERR_COLOR.Write, Agent: HERR_COLOR.Agent});
  add(`<div style="position:absolute;right:${1600 - (TL.x + TL.w - 14)}px;top:${TL.y + 9}px;display:flex;gap:12px;align-items:center">${LEY.map(([n, c]) => `<span class="lb" style="display:flex;align-items:center;gap:5px"><i style="width:9px;height:9px;border-radius:2px;background:${c}"></i>${n}</span>`).join('')}<span class="lb" style="display:flex;align-items:center;gap:5px"><i style="width:14px;height:5px;border-radius:2px;background:${C.capas[1]}"></i>EL MODELO PIENSA</span></div>`);
  const X0 = TL.x + 120;
  const XW = TL.w - 140;
  const tx = (t) => X0 + (t / DUR_TRAZA) * XW;
  const pistas = [{n: 'PRINCIPAL', L: PRINCIPAL}, ...SUBS.map((S, i) => ({n: `SUBAGENTE ${i + 1}`, L: S}))];
  let svgTL = '';
  pistas.forEach((p, k) => {
    const y = TL.y + 32 + k * 17;
    svgTL += `<text x="${TL.x + 14}" y="${y + 9}" font-size="7.5" font-weight="700" letter-spacing="1.1" fill="${k ? C.mute : C.ink}" font-family="Inter">${p.n}</text>`;
    svgTL += `<line x1="${X0}" x2="${X0 + XW}" y1="${y + 6}" y2="${y + 6}" stroke="${C.line}" stroke-width=".6"/>`;
    if (k) svgTL += `<rect x="${tx(p.L.lanzado)}" y="${y + 1}" width="${tx(p.L.termina) - tx(p.L.lanzado)}" height="10" rx="2" fill="${C.elev}"/>`;
    for (const c of p.L.calls) svgTL += `<rect x="${tx(c.ini)}" y="${y + 3}" width="${Math.max(1.2, tx(c.fin) - tx(c.ini))}" height="6" rx="1.5" fill="${C.capas[1]}"/>`;
    for (const h of p.L.herr) svgTL += `<rect x="${tx(h.t)}" y="${y}" width="${Math.max(2, tx(h.fin) - tx(h.t))}" height="12" rx="1.5" fill="${HERR_COLOR[h.herr] || C.mute}"/>`;
  });
  for (const v of [0, 30, 60, 90, 120, 150, 180, 210, 240]) svgTL += `<text x="${tx(v)}" y="${TL.y + TL.h - 4}" font-size="6.5" text-anchor="middle" fill="${C.faint}" font-family="JetBrains Mono">${v} s</text>`;
  add(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1600" height="900">${svgTL}</svg>`);
  const cabezal = add(`<div style="position:absolute;top:${TL.y + 28}px;height:${pistas.length * 17 + 4}px;width:2px;margin-left:-1px;background:${C.accent};box-shadow:0 0 8px ${C.accent}"></div>`);

  // ------------------------------------------------------------ superposiciones
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="24" height="24" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#f1f1f1" stroke="#0f0f18" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);

  const K = {};
  for (const n of ui.querySelectorAll('[data-k]')) K[n.dataset.k] = n;
  const knobAt = (t) => [SL.x + (Math.min(DUR_TRAZA, Math.max(0, t)) / DUR_TRAZA) * SL.w, SL.y + 1.5];
  const timelineX = (cx) => ((cx - X0) / XW) * DUR_TRAZA;
  const PANELS = [[24, 112, 336, 544], [1264, 58, 1576, 544], [24, 744, 1576, 884], [360, 646, 1240, 728], [900, 6, 1590, 48]];
  const covered = (x, y) => PANELS.some(([a, b, c, d]) => x > a - 8 && x < c + 8 && y > b - 8 && y < d + 8);
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  const FASE = {piensa: 'Piensa y escribe', herramienta: 'Usa una herramienta', espera: 'Espera a los subagentes'};
  const ROT = {i: -1};

  const update = (s) => {
    const e = s.est;
    const p = e.principal;
    // tiempo
    const [kx] = knobAt(s.tt);
    knob.style.left = `${kx.toFixed(1)}px`;
    fill.style.width = `${(kx - SL.x).toFixed(1)}px`;
    tVal.textContent = `${fmt(s.tt, 0)} s de ${fmt(DUR_TRAZA, 0)}`;
    const fase = p.fase === 'espera' && e.activos === 0 ? (s.tt < 1 ? 'Recibe la pregunta' : 'Prepara la siguiente llamada') : FASE[p.fase];
    K.fase.textContent = fase + (p.herr.length ? ` · ${p.herr[0]}` : p.reciente && p.fase !== 'espera' ? ` · tras ${p.reciente.herr}` : '');
    K.fase.style.color = p.fase === 'piensa' ? C.accent : C.ink;

    // ventana de contexto
    ctxBig.textContent = `${nf(p.ctx)} tokens`;
    ctxPct.textContent = `${fmt((p.ctx / HECHOS.ventana_tokens) * 100, 1)} % DE LA VENTANA OCUPADO`;
    const ARRt = [ARR.sistema_tokens_aprox, ARR.herramientas_tokens_aprox, ARR.proyecto_y_mensaje_tokens_aprox];
    const nuevo = Math.min(p.ctx, p.cache.escrita + p.cache.nueva);
    const conv = Math.max(0, p.ctx - nuevo - ARRt.reduce((a, b) => a + b, 0));
    let x = VP.x + 16;
    [...ARRt, conv, nuevo].forEach((v, i) => {
      const w = (v / HECHOS.ventana_tokens) * BW;
      segs[i].style.left = `${x.toFixed(1)}px`;
      segs[i].style.width = `${Math.max(i === 4 ? 2 : 0, w).toFixed(1)}px`;
      x += w;
    });
    K.conv.textContent = kTok(conv);
    K.nuevo.textContent = nf(nuevo);
    const tot = p.cache.leida + p.cache.escrita + p.cache.nueva;
    K.hit.textContent = tot ? `${fmt((p.cache.leida / tot) * 100, 1)} %` : '—';

    // contadores
    K.llam.textContent = `${e.llamadas} / ${TOTALES.llamadas}`;
    K.act.textContent = `${e.activos} de ${SUBS.length}`;
    K.leida.textContent = nf(e.leida);
    K.sal.textContent = nf(e.salida);
    cBig.textContent = usd(e.coste);
    barSin.style.width = `${((e.sinCache / TOTALES.sinCache) * CW).toFixed(1)}px`;
    barCon.style.width = `${((e.coste / TOTALES.sinCache) * CW).toFixed(1)}px`;
    cSin.innerHTML = `Sin caché serían <b style="color:${C.ink}">${usd(e.sinCache)}</b>${e.sinCache > 0.5 ? ` · ${fmt(e.sinCache / Math.max(0.01, e.coste), 1)} veces más` : ''}`;

    // subagentes
    e.subs.forEach((sb, i) => {
      const f = filas[i];
      const col = sb.estado === 'trabaja' ? C.accent : sb.estado === 'terminado' ? C.ink : C.faint;
      f.est.textContent = sb.estado === 'apagado' ? 'SIN LANZAR' : sb.estado === 'trabaja' ? (sb.herr[0] ? `● ${sb.herr[0].toUpperCase()}` : '● PIENSA') : '✓ RESUMEN ENVIADO';
      f.est.style.color = col;
      f.bar.style.width = `${((sb.ctx / HECHOS.ventana_tokens) * (SP.w - 32)).toFixed(1)}px`;
      f.bar.style.background = sb.estado === 'trabaja' ? C.capas[3] : sb.estado === 'terminado' ? C.capas[2] : C.elev;
      f.txt.textContent = sb.estado === 'apagado' ? 'Esperando encargo' : `${kTok(sb.ctx)} de contexto · ${sb.hechas} llamadas · ${nf(sb.salida)} tokens escritos`;
    });

    // rótulo
    const r = s.rotulo;
    if (r && r.i !== ROT.i) {
      ROT.i = r.i;
      const [tt, tb] = ROTULOS_REF.get()[r.i] || ['', ''];
      rotT.textContent = tt;
      rotB.textContent = r.i === 8 ? `${TOTALES.llamadas} llamadas, 5 subagentes y ${fmt(TOTALES.leida / 1e6, 1)} millones de tokens de caché en ${fmt(DUR_TRAZA / 60, 1)} min. Coste equivalente: ${usd(TOTALES.coste)}; sin caché, ${usd(TOTALES.sinCache)}.` : tb;
    }
    const a = r ? Math.min(1, r.desde / 0.5) : 1;
    rotT.style.opacity = rotB.style.opacity = String(a);
    rotT.style.transform = rotB.style.transform = `translateY(${((1 - a) * 8).toFixed(1)}px)`;

    // cabezal
    cabezal.style.left = `${tx(s.tt).toFixed(1)}px`;

    // vistas y botones
    for (const k of Object.keys(VIEW_NAMES)) {
      const on = (s.viewOn[k] || 0) > 0.5;
      btn[k].style.background = on ? C.ink : C.btn;
      btn[k].style.color = on ? C.void : C.mute;
    }
    const ab = s.abrir > 0.5;
    btn.abrir.style.background = ab ? C.accent : C.btn;
    btn.abrir.style.color = ab ? C.ink : C.mute;
    btn.abrir.style.borderColor = ab ? C.accent : C.line;
    btn.pause.textContent = s.paused ? '▶ SEGUIR' : '❚❚ PAUSA';

    // etiquetas sobre la máquina
    const calls = [];
    const A = s.anclas;
    const vista = s.view;
    const o = Math.min(1, (s.since ?? 1) / 0.8);
    const push = (p3, name, sub, dx, dy) => {
      const at = s.project(...p3);
      if (!at || at[0] < 60 || at[0] > 1540 || at[1] < 60 || at[1] > 640 || covered(at[0], at[1])) return;
      if (covered(at[0] + dx + (dx < 0 ? -180 : 180), at[1] + dy)) return;
      calls.push({at, name, sub, dx, dy});
    };
    if (vista === 'general' || vista === 'contexto') push(A.nivel(e), 'VENTANA DE CONTEXTO', `${kTok(p.ctx)} DE 1.000k TOKENS`, -70, -60);
    if (vista !== 'subagentes') push(A.modelo(), 'MODELO · CAJA SELLADA', 'SUS PESOS NO SON PÚBLICOS', 70, -80);
    if (vista === 'general') push(A.banco(), 'HERRAMIENTAS', 'LAS EJECUTA CLAUDE CODE, NO EL MODELO', 70, 50);
    if (vista === 'herramientas') {
      const N = {Bash: ['BASH', 'EJECUTA ÓRDENES'], Read: ['READ', 'LEE FICHEROS'], Write: ['WRITE · EDIT', 'ESCRIBE Y CAMBIA'], Agent: ['AGENT', 'LANZA SUBAGENTES']};
      ['Bash', 'Read', 'Write', 'Agent'].forEach((n, i) => push(A.estacion(n), N[n][0], N[n][1], i < 2 ? -50 : 50, 70 + (i % 2) * 34));
    }
    if (vista === 'subagentes') e.subs.forEach((sb, i) => i % 2 === 0 && push(A.sub(i), `SUBAGENTE ${i + 1}`, sb.estado === 'apagado' ? 'SIN LANZAR' : `${kTok(sb.ctx)} PROPIOS`, 60, -40 - i * 6));
    let lh = '';
    let ch = '';
    for (const c of calls) {
      const [ax, ay] = c.at;
      const lx = ax + c.dx;
      const ly = ay + c.dy;
      lh += `<g opacity="${o.toFixed(2)}"><polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${(lx + (c.dx < 0 ? -26 : 26)).toFixed(1)},${ly.toFixed(1)}" fill="none" stroke="${C.mute}" stroke-width=".8"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.accent}"/></g>`;
      ch += `<div class="call" style="left:${(lx + (c.dx < 0 ? -30 : 30)).toFixed(1)}px;top:${(ly - 9).toFixed(1)}px;opacity:${o.toFixed(2)};transform:translateX(${c.dx < 0 ? '-100%' : '0'});text-align:${c.dx < 0 ? 'right' : 'left'}"><b>${c.name}</b><span>${c.sub}</span></div>`;
    }
    callSvg.innerHTML = lh;
    callG.innerHTML = ch;
    pointer(s.cursor);
  };
  return {btn, root: ui, covered, knobAt, timelineX, TL, update, pointer};
}

// los rótulos viven en film.js; la consola los recibe por aquí para no crear una dependencia circular
export const ROTULOS_REF = {lista: [], get() {
  return this.lista;
}};
