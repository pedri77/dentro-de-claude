#!/usr/bin/env node
// Compila claude-live con el kit teardown, ajusta <head> (idioma, título, descripción, tarjeta social)
// y deja la página en ../dentro-de-claude/site/index.html junto con el código de la máquina y los datos
// anonimizados. Uso, desde ~/Dev/Claude_proyectos/Claude/teardown:
//   node claude-shared/publicar.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SKILL = path.join(os.homedir(), '.omp/agent/skills/teardown');
const REPO = path.resolve(ROOT, '../dentro-de-claude');

execFileSync('node', [path.join(SKILL, 'sims/build.mjs'), path.join(ROOT, 'claude-live')], {stdio: 'inherit', cwd: ROOT});
let html = fs.readFileSync(path.join(ROOT, 'teardown-out/dist/claude-live.html'), 'utf8');
const HEAD = `<title>Dentro de Claude · una pregunta real a Claude Code, por dentro</title>
<meta name="description" content="Una máquina 3D que reproduce una sesión real de Claude Code: la ventana de contexto, la caché, el modelo, las herramientas y cinco subagentes en paralelo, con sus tokens y su coste. Laboratorio de IA de IAcademy.">
<meta property="og:title" content="Dentro de Claude · una pregunta real, por dentro">
<meta property="og:description" content="48 llamadas al modelo, 5 subagentes y 8,8 millones de tokens leídos de caché en 4,2 minutos, reproducidos en 3D.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://pedri77.github.io/dentro-de-claude/">
<meta property="og:image" content="https://pedri77.github.io/dentro-de-claude/portada.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 rx=%277%27 fill=%27%230f0f18%27/%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%276%27 fill=%27%23ef4444%27/%3E%3C/svg%3E">`;
html = html.replace('<html lang="en">', '<html lang="es">').replace(/<title>[^<]*<\/title>/, HEAD);
if (!html.includes('og:image')) throw new Error('no se pudo parchear el <head>');
fs.mkdirSync(path.join(REPO, 'site'), {recursive: true});
fs.writeFileSync(path.join(REPO, 'site/index.html'), html);
const portada = path.join(ROOT, 'teardown-out/claude-portada.png');
if (fs.existsSync(portada)) fs.copyFileSync(portada, path.join(REPO, 'site/portada.png'));
// el código de la máquina y los datos anonimizados, visibles en el repo
const M = path.join(REPO, 'maquina');
fs.mkdirSync(M, {recursive: true});
for (const f of fs.readdirSync(HERE)) if (/\.(js|mjs|py)$/.test(f)) fs.copyFileSync(path.join(HERE, f), path.join(M, f));
for (const f of ['main.js']) fs.copyFileSync(path.join(ROOT, 'claude-live', f), path.join(M, 'main-live.js'));
fs.copyFileSync(path.join(ROOT, 'claude-film/main.js'), path.join(M, 'main-film.js'));
for (const f of ['timeline.json', 'warp.json', 'traza.json', 'hechos.json']) fs.copyFileSync(path.join(ROOT, 'claude-film', f), path.join(M, f));
console.log('site/index.html', (html.length / 1024).toFixed(0), 'KB →', REPO);
