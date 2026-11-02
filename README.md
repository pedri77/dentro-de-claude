# Dentro de Claude · una pregunta real a Claude Code, por dentro

Una máquina en 3D que reproduce, segundo a segundo, **una sesión real de Claude Code**: cómo entra una pregunta en la ventana de contexto, qué parte se lee de caché, cuándo piensa el modelo, cómo pide herramientas y cómo reparte el trabajo entre cinco subagentes que trabajan en paralelo. Laboratorio de IA de [IAcademy](https://iacedemy.com).

**Ver:** <https://pedri77.github.io/dentro-de-claude/>

## Qué se ve

| Pieza | Qué representa | De dónde sale |
|---|---|---|
| Depósito de contexto | La ventana de 1.000.000 tokens. Capas: instrucciones de sistema, definiciones de herramientas, proyecto (CLAUDE.md, memoria, skills) y conversación. El anillo rojo es lo nuevo en cada llamada. | Tokens de cada llamada, de la sesión real |
| Modelo | Una caja sellada: relee todo el contexto en cada llamada y escribe la respuesta. **Lo que hay dentro no es público** y no se dibuja. | — |
| Banco de herramientas | Bash, Read, Write/Edit y Agent. El modelo no ejecuta nada: pide la herramienta, Claude Code la ejecuta y le devuelve el resultado. | Herramientas usadas en la sesión |
| Cinco subagentes | Cada uno con su propio contexto, a la misma escala que el principal. Por los tubos viajan los encargos (rojo) y vuelven los avisos (blanco). | Registros de los subagentes |
| Línea de tiempo | Las seis pistas reales: cuándo piensa cada uno y qué herramienta usa. | Sesión real |

**Una sola entrada**: el segundo de la sesión (0 a 252 s). El deslizador, las flechas o un clic en la línea de tiempo lo mueven; todo lo demás (piezas, paneles, contadores y sonido) sale de la misma función, `estadoAt(t)` en `maquina/sesion.js`.

## Datos y fuentes

| Dato | Valor | Tipo |
|---|---|---|
| Duración del turno | 252 s (4,2 min) | Medido |
| Llamadas al modelo | 48 (20 del principal, 28 de los subagentes) | Medido |
| Tokens leídos de caché | 8.808.589 | Medido |
| Tokens escritos por el modelo | 57.484 | Medido |
| Contexto del principal | de 271.685 a 296.455 tokens | Medido |
| Contexto de cada subagente | arranca en ≈ 84.000 y llega a ≈ 160.000 | Medido |
| Coste equivalente en precios de API | 6,59 $ (sin caché, 39,27 $) | Calculado con los tokens medidos |
| Precios de Claude Opus 5.5 | entrada 4 $/M · salida 20 $/M · lectura de caché 0,20 $/M · escritura de caché 5 $/M (5 min) y 8 $/M (1 h) | Documentación de Anthropic (06-10-2026) |
| Ventana de contexto | 1.000.000 tokens | Documentación de Anthropic |
| Reparto del arranque (sistema ≈ 4,4k · herramientas ≈ 33k · proyecto ≈ 17k) | — | **Estimado**: medido en caracteres en otra sesión del mismo equipo y pasado a tokens con 2,74 caracteres por token, calibrado con su primera llamada (54.624 tokens, 36.337 ya en caché) |

**Anonimización.** De la sesión solo se conservan tiempos, recuentos de tokens, el nombre del modelo y los nombres de las herramientas (las de servidores MCP se agrupan como «MCP» y los agentes propios como «agente propio»). No hay texto de mensajes, rutas, argumentos ni resultados. Los scripts que lo extraen están en `maquina/turnos.py` y `maquina/traza.py`.

**Una licencia de visualización.** Una herramienta real dura a veces menos de un segundo; en la película sería invisible. Por eso su cápsula y su luz se mantienen visibles al menos 6 s de sesión. Los contadores y la línea de tiempo usan siempre los tiempos reales.

**El coste es equivalente**: es lo que costarían esos tokens con los precios públicos de la API, no necesariamente lo que se pagó (con una suscripción no se factura por token).

## La película

Una visita guiada de 42 s (1920 × 1080, 60 fps) con sonido procedural sobre la misma línea de tiempo: un blip por cada llamada del principal, un tic por herramienta, un pop por cada subagente lanzado y una campanita cuando devuelve su resumen. Los 252 s reales se comprimen con los tramos de `maquina/warp.json`.

## El simulador 3D

Construido con el kit [teardown](https://github.com/elvarofficial/teardown) (MIT) sobre [claude-motion](https://github.com/whaleyxbt/claude-motion) (MIT): una página HTML autocontenida (< 1 MB) con three.js, sombras VSM, oclusión ambiental, bloom y visita automática que cede el control al visitante. Código en `maquina/` (`sesion.js` = el modelo de la sesión, `maquina.js` = geometría, `console.js` = paneles, `film.js` y `live.js` = película y página, `score.py` = sonido).

## Licencias

- Código de este repositorio: MIT (créditos a **teardown** y **claude-motion**, MIT).
- Fuentes: DM Serif Display, Inter y JetBrains Mono (SIL OFL 1.1).
- «Claude» y «Claude Code» son marcas de Anthropic. Este proyecto es educativo e independiente; no está afiliado a Anthropic.
