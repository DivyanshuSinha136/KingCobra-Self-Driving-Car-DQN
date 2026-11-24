/* Self-Driving Car DQN dashboard.
 *
 * Plain browser JavaScript, no dependencies, no build step. The server (src/server.kc) sends a strict
 * Content-Security-Policy, so everything lives in this one file and style.css.
 *
 *   1. pure helpers      — no DOM; exported for `node tests/web/pure.test.js`
 *   2. API client
 *   3. rendering         — road canvas, telemetry, shared-network panel, Q grid, features, chart, model card, benchmark
 *   4. game loop + input — tick scheduling, keyboard driving, camera
 */
(function () {
  'use strict';

  /* ═════════════════════════ 1. pure helpers ═════════════════════════ */

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  /** Wrap an angle to (-pi, pi]. */
  function wrapAngle(a) { a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a === -Math.PI ? Math.PI : a; }
  /** Interpolate angles along the shortest arc. */
  function lerpAngle(a, b, t) { return a + wrapAngle(b - a) * t; }
  /** Interpolated pose between two consecutive snapshots of the same car. */
  function lerpPose(p, q, t) {
    if (!p) return { x: q.x, y: q.y, theta: q.theta };
    return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), theta: lerpAngle(p.theta, q.theta, t) };
  }

  /** World→screen transform that fits `bounds` into a w×h canvas (y axis flipped: world y is up). */
  function fitTransform(b, w, h, pad) {
    const bw = b.maxx - b.minx, bh = b.maxy - b.miny;
    const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    return { s, ox: (w - bw * s) / 2 - b.minx * s, oy: (h + bh * s) / 2 + b.miny * s };
  }
  const toScreen = (T, x, y) => [T.ox + x * T.s, T.oy - y * T.s];

  function boundsOf(points) {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const p of points) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
    return { minx, maxx, miny, maxy };
  }

  /** Index (0..11) → { steer: 0 left | 1 straight | 2 right, pedal: 0..3 }. */
  const decodeAction = a => ({ steer: Math.floor(a / 4), pedal: a % 4 });
  /** Pressed keys → the (steer, pedal) body for POST /api/drive. +1 steer = left. */
  function controlsFromKeys(keys) {
    const left = keys.has('left'), right = keys.has('right');
    const steer = left && !right ? 1 : right && !left ? -1 : 0;
    const pedal = keys.has('hand') ? 3 : keys.has('gas') ? 0 : keys.has('brake') ? 2 : 1;
    return { steer, pedal };
  }
  /** Map a keyboard key to a control name, or null. */
  function keyName(key) {
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': return 'gas';
      case 'ArrowDown': case 's': case 'S': return 'brake';
      case 'ArrowLeft': case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      case ' ': return 'hand';
      default: return null;
    }
  }

  /** Cell backgrounds for the Q grid: relative opacity 0.05..0.75 of each value inside [min, max]. */
  function qAlphas(q) {
    const lo = Math.min(...q), hi = Math.max(...q);
    if (!(hi - lo > 1e-9)) return q.map(() => 0.25);
    return q.map(v => 0.05 + 0.7 * (v - lo) / (hi - lo));
  }

  function describeEnd(cause) {
    switch (cause) {
      case 'lap': return { title: 'Lap complete', text: 'The ego car drove a full lap.', cls: 'is-win' };
      case 'wrecked': return { title: 'Wrecked', text: 'Too many wall scrapes.', cls: 'is-dead' };
      case 'stuck': return { title: 'Stuck', text: 'The car stopped moving.', cls: 'is-dead' };
      case 'reverse': return { title: 'Wrong way', text: 'The car drove backwards along the road.', cls: 'is-dead' };
      case 'timeout': return { title: 'Time limit', text: 'The step limit was reached.', cls: 'is-dead' };
      default: return { title: 'Run over', text: '', cls: 'is-dead' };
    }
  }

  function niceCeil(x) {
    if (!(x > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function nearestRow(history, frac, maxEpisode) {
    if (!history.length) return -1;
    const target = frac * maxEpisode;
    let best = 0, bd = Infinity;
    history.forEach((r, i) => { const d = Math.abs(r.episode - target); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const fmt = (x, d = 1) => (typeof x === 'number' && isFinite(x)) ? x.toFixed(d) : '—';
  const fmtSeconds = s => s < 90 ? `${s.toFixed(0)} s` : s < 5400 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(1)} h`;
  const kmh = v => v * 3.6;
  const deg = r => r * 180 / Math.PI;

  const Pure = { clamp, lerp, wrapAngle, lerpAngle, lerpPose, fitTransform, toScreen, boundsOf, decodeAction, controlsFromKeys, keyName,
    qAlphas, describeEnd, niceCeil, nearestRow, fmt, fmtSeconds, kmh, deg };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Pure; return; }

  /* ═════════════════════════ 2. API client ═════════════════════════ */

  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('selfdrive-dqn:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('selfdrive-dqn:' + k, JSON.stringify(v)); } catch (_) { /* private mode */ } }
  };
  const SID = (() => {
    try {
      let s = sessionStorage.getItem('selfdrive-dqn:sid');
      if (!s) { const b = new Uint8Array(8); crypto.getRandomValues(b); s = Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); sessionStorage.setItem('selfdrive-dqn:sid', s); }
      return s;
    } catch (_) { return 'default'; }
  })();

  async function api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60000);
    try {
      const res = await fetch(`${path}${sep}sid=${SID}`, {
        method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store'
      });
      let data = null;
      try { data = await res.json(); } catch (_) { /* non-JSON */ }
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      setConn(true);
      return data;
    } catch (e) {
      if (e.name === 'AbortError') e = new Error('request timed out');
      if (e instanceof TypeError) { setConn(false); e = new Error('cannot reach the server'); }
      throw e;
    } finally { clearTimeout(timer); }
  }

  /* ═════════════════════════ 3. rendering ═════════════════════════ */

  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PEDALS = ['gas', 'coast', 'brake / reverse', 'handbrake'];
  const STEERS = ['left', 'straight', 'right'];
  const RAY_ANGLES = [Math.PI / 2, Math.PI / 3, Math.PI / 6, 0, -Math.PI / 6, -Math.PI / 3, -Math.PI / 2];
  const CAR_COLORS = ['#22d3ee', '#fb923c', '#a78bfa', '#34d399', '#f472b6', '#facc15', '#60a5fa', '#f87171'];
  const CAR_L = 4.2, CAR_W = 1.9, RANGE = 40;

  function toast(msg, isError) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' is-error' : '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  let online = null;
  function setConn(ok) {
    if (online === ok) return;
    online = ok;
    const el = $('conn');
    el.textContent = ok ? 'connected' : 'offline';
    el.className = 'pill ' + (ok ? 'pill-on' : 'pill-off');
    if (!ok) { pause(); retryHealth(); }
  }
  function retryHealth() {
    const t = setInterval(async () => {
      try { await fetch('/api/health', { cache: 'no-store' }); clearInterval(t); setConn(true); init(false); } catch (_) { /* keep trying */ }
    }, 2000);
  }

  function fitCanvas(canvas, ctx, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- road canvas ---- */
  const road = $('road');
  const rctx = road.getContext('2d');
  const FX = { skids: [], smoke: [] };          // purely visual: tyre marks and smoke puffs (world coordinates)
  let cam = { x: 0, y: 0, s: 6 };               // chase camera state (smoothed)

  function roadPath(ctx, T, pts) {
    pts.forEach((p, i) => { const [sx, sy] = toScreen(T, p[0], p[1]); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
    ctx.closePath();
  }

  function carPoseOf(c) {
    const t = reduceMotion ? 1 : clamp((performance.now() - G.tickStart) / G.tickDur, 0, 1);
    const prev = G.prev && G.prev.cars.find(p => p.id === c.id);
    // a car that was reset/respawned jumps; never interpolate across a jump
    const jumped = prev && Math.hypot(prev.x - c.x, prev.y - c.y) > 8;
    return lerpPose(prev && !jumped ? prev : null, c, t);
  }

  function drawCar(ctx, T, pose, color, c, isEgo) {
    const [sx, sy] = toScreen(T, pose.x, pose.y);
    const L = CAR_L * T.s, W = CAR_W * T.s;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-pose.theta);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.roundRect(-L / 2 + 2, -W / 2 + 2, L, W, W * 0.3); ctx.fill();
    // body
    ctx.fillStyle = c.done ? '#3b4654' : color;
    ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, W * 0.3); ctx.fill();
    ctx.fillStyle = 'rgba(8,14,20,0.75)';                       // windscreen + rear window
    ctx.beginPath(); ctx.roundRect(L * 0.05, -W * 0.38, L * 0.2, W * 0.76, W * 0.12); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-L * 0.3, -W * 0.34, L * 0.14, W * 0.68, W * 0.1); ctx.fill();
    // lights
    const braking = c.action % 4 === 2 && c.vx > 0.5 || c.action % 4 === 3;
    ctx.fillStyle = braking ? '#ff2d4d' : '#7a1e2c';
    ctx.fillRect(-L / 2, -W * 0.42, L * 0.05, W * 0.24); ctx.fillRect(-L / 2, W * 0.18, L * 0.05, W * 0.24);
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(L / 2 - L * 0.04, -W * 0.42, L * 0.04, W * 0.22); ctx.fillRect(L / 2 - L * 0.04, W * 0.2, L * 0.04, W * 0.22);
    if (c.vx < -0.3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(-L / 2, -W * 0.1, L * 0.04, W * 0.2); }   // reverse light
    if (isEgo) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.2, T.s * 0.12); ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, W * 0.3); ctx.stroke(); }
    ctx.restore();
  }

  function drawLidar(ctx, T, pose, c) {
    const [sx, sy] = toScreen(T, pose.x, pose.y);
    c.rays.forEach((d, i) => {
      const a = pose.theta + RAY_ANGLES[i];
      const ex = sx + Math.cos(a) * d * T.s, ey = sy - Math.sin(a) * d * T.s;
      const col = d < 6 ? '255,80,100' : d < 15 ? '251,191,36' : '34,211,238';
      ctx.strokeStyle = `rgba(${col},0.55)`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = `rgba(${col},0.95)`; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, TAU); ctx.fill();
    });
    // car "radar" sectors: a red wedge wherever another car is close
    c.car_rays.forEach((d, i) => {
      if (d >= RANGE - 0.5) return;
      const a = pose.theta + RAY_ANGLES[i];
      ctx.fillStyle = 'rgba(244,63,94,0.28)'; ctx.strokeStyle = 'rgba(244,63,94,0.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, Math.max(8, d * T.s), -(a + Math.PI / 12), -(a - Math.PI / 12));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
  }

  function drawRoad(now) {
    const rect = road.getBoundingClientRect();
    const W = rect.width || 640, H = rect.height || 400;
    fitCanvas(road, rctx, W, H);
    const ctx = rctx;
    ctx.fillStyle = '#080c11'; ctx.fillRect(0, 0, W, H);
    const tr = G.track, s = G.snap;
    if (!tr) return;

    // camera: whole track, or a smoothed chase view on the ego car
    let T;
    if (G.camera === 'chase' && s) {
      const ego = carPoseOf(s.cars[0]);
      const target = { x: ego.x, y: ego.y, s: Math.min(W, H * 1.6) / 70 };
      cam.x = lerp(cam.x, target.x, 0.18); cam.y = lerp(cam.y, target.y, 0.18); cam.s = lerp(cam.s, target.s, 0.1);
      T = { s: cam.s, ox: W / 2 - cam.x * cam.s, oy: H / 2 + cam.y * cam.s };
    } else {
      T = fitTransform(G.bounds, W, H, 26);
      cam = { x: (G.bounds.minx + G.bounds.maxx) / 2, y: (G.bounds.miny + G.bounds.maxy) / 2, s: T.s };
    }

    // infield grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
    const step = 10 * T.s;
    for (let x = ((T.ox % step) + step) % step; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = ((T.oy % step) + step) % step; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // asphalt: the ring between the two edges
    ctx.beginPath(); roadPath(ctx, T, tr.left); roadPath(ctx, T, tr.right);
    ctx.fillStyle = '#1b2530'; ctx.fill('evenodd');
    // kerbs: red/white dashes along both edges
    for (const edge of [tr.left, tr.right]) {
      ctx.lineWidth = Math.max(2, T.s * 0.5);
      ctx.setLineDash([T.s * 2, T.s * 2]);
      ctx.strokeStyle = '#d9e2ec'; ctx.beginPath(); roadPath(ctx, T, edge); ctx.stroke();
      ctx.lineDashOffset = T.s * 2; ctx.strokeStyle = '#e0364e'; ctx.beginPath(); roadPath(ctx, T, edge); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    // centre line
    ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1.4; ctx.setLineDash([T.s * 3, T.s * 3]);
    ctx.beginPath(); roadPath(ctx, T, tr.center); ctx.stroke(); ctx.setLineDash([]);
    // start / finish
    {
      const a = toScreen(T, tr.left[0][0], tr.left[0][1]), b = toScreen(T, tr.right[0][0], tr.right[0][1]);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, T.s * 0.9); ctx.setLineDash([T.s * 1.1, T.s * 1.1]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    }

    // tyre marks + smoke
    for (const k of FX.skids) {
      const [sx, sy] = toScreen(T, k.x, k.y);
      ctx.fillStyle = `rgba(6,8,10,${0.5 * k.a})`; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.2, T.s * 0.45), 0, TAU); ctx.fill();
    }
    for (const p of FX.smoke) {
      const [sx, sy] = toScreen(T, p.x, p.y);
      ctx.fillStyle = `rgba(200,210,220,${0.22 * p.a})`; ctx.beginPath(); ctx.arc(sx, sy, T.s * (0.8 + 2.2 * (1 - p.a)), 0, TAU); ctx.fill();
    }

    if (!s) return;
    // NPCs first, ego last (on top) with its lidar underneath
    const egoPose = carPoseOf(s.cars[0]);
    drawLidar(ctx, T, egoPose, s.cars[0]);
    for (let i = s.cars.length - 1; i >= 0; i--) {
      const c = s.cars[i];
      drawCar(ctx, T, carPoseOf(c), CAR_COLORS[c.id % CAR_COLORS.length], c, i === 0);
    }
    // little id tags
    ctx.font = `600 ${Math.max(10, T.s * 1.5)}px ui-monospace, Menlo, Consolas, monospace`; ctx.textAlign = 'center';
    for (const c of s.cars) {
      const [sx, sy] = toScreen(T, carPoseOf(c).x, carPoseOf(c).y);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(c.id === 0 ? 'EGO' : String(c.id), sx, sy - CAR_W * T.s * 1.1);
    }
  }

  /** Spawn / age the purely visual effects each time a new snapshot arrives. */
  function updateFx(s) {
    for (const k of FX.skids) k.a -= 0.012;
    for (const p of FX.smoke) p.a -= 0.07;
    FX.skids = FX.skids.filter(k => k.a > 0); FX.smoke = FX.smoke.filter(p => p.a > 0);
    for (const c of s.cars) {
      const sliding = c.drifting || (c.action % 4 === 3 && c.speed > 3) || (c.action % 4 === 2 && c.speed > 8);
      if (!sliding) continue;
      const cs = Math.cos(c.theta), sn = Math.sin(c.theta);
      for (const off of [-1.3, 1.3]) {      // rear wheels
        const x = c.x - cs * 1.4 - sn * off * 0.7, y = c.y - sn * 1.4 + cs * off * 0.7;
        FX.skids.push({ x, y, a: 1 }); FX.smoke.push({ x, y, a: 1 });
      }
    }
    if (FX.skids.length > 1500) FX.skids.splice(0, FX.skids.length - 1500);
  }

  /* ---- HUD, telemetry, network panel, Q grid, features ---- */
  function renderHud(s) {
    const ego = s.cars[0];
    $('kmh').textContent = Math.round(kmh(ego.speed));
    const gear = $('gear'); gear.textContent = ego.gear; gear.classList.toggle('is-rev', ego.gear === 'R');
    $('badgeDrift').classList.toggle('is-hidden', !ego.drifting);
    $('badgeRev').classList.toggle('is-hidden', ego.gear !== 'R');
    $('badgeScrape').classList.toggle('is-hidden', !ego.scraped);
    $('steerKnob').style.setProperty('--sx', (-ego.steer / 0.42 * 50) + 'px');

    $('tSpeed').textContent = `${fmt(ego.speed, 1)} m/s`;
    $('tSlip').textContent = `${fmt(deg(ego.slip), 0)}°`;
    $('tYaw').textContent = `${fmt(ego.omega, 2)} rad/s`;
    $('tProg').textContent = `${fmt(ego.progress * 100, 1)} %`;
    $('tTime').textContent = `${fmt(s.time, 1)} s`;
    $('tLat').textContent = `${fmt(ego.lateral, 1)} m`;
    $('tScr').textContent = ego.scrapes;
    $('tHit').textContent = ego.hits;
    $('tDrift').textContent = `${fmt(s.session.drift_seconds, 1)} s`;
    $('lapFill').style.setProperty('--w', clamp(ego.progress * 100, 0, 100).toFixed(1) + '%');
    $('sLaps').textContent = s.session.laps;
    $('sBest').textContent = s.session.best_lap == null ? '—' : `${fmt(s.session.best_lap, 1)} s`;
    $('sRuns').textContent = s.session.runs;
    const st = $('status');
    st.textContent = ego.done ? describeEnd(ego.cause).title.toLowerCase() : G.running ? (G.mode === 'ai' ? 'AI driving' : 'you drive') : 'paused';
    road.setAttribute('aria-label', `Track ${s.track}. ${s.cars.length} cars. Ego speed ${Math.round(kmh(ego.speed))} kilometres per hour, ${fmt(ego.progress * 100, 0)} percent of the lap.`);
    $('npcsOut').textContent = s.npcs;

    renderNetwork(s);
    renderQ(s);
    document.querySelectorAll('#features .frow').forEach(row => {
      const v = s.features[Number(row.dataset.index)];
      row.querySelector('.ffill').style.setProperty('--w', (clamp(Math.abs(v), 0, 1) * 100).toFixed(0) + '%');
      row.querySelector('.fval').textContent = v.toFixed(2);
    });
  }

  /** "Shared NN" panel: one row per car, observation → network → action. */
  function renderNetwork(s) {
    const obs = $('obsCol'), act = $('actCol');
    const n = s.cars.length;
    if (obs.children.length !== n) {
      obs.textContent = ''; act.textContent = '';
      s.cars.forEach(c => {
        for (const host of [obs, act]) {
          const r = document.createElement('div'); r.className = 'nrow'; r.style.setProperty('--c', CAR_COLORS[c.id % CAR_COLORS.length]);
          r.innerHTML = '<span class="dot"></span><span class="nlab"></span><span class="arrow"></span>';
          host.appendChild(r);
        }
      });
    }
    s.cars.forEach((c, i) => {
      const o = obs.children[i], a = act.children[i];
      o.querySelector('.nlab').textContent = `${c.id === 0 ? 'ego' : 'npc ' + c.id} · ${Math.round(kmh(c.speed))} km/h`;
      o.querySelector('.arrow').textContent = '→';
      o.classList.toggle('is-done', c.done);
      const ad = decodeAction(c.action);
      a.querySelector('.nlab').textContent = `${STEERS[ad.steer]} + ${PEDALS[ad.pedal].split(' ')[0]}`;
      a.querySelector('.arrow').textContent = '';
      a.classList.toggle('is-done', c.done);
    });
    $('netTag').textContent = `${n} car${n === 1 ? '' : 's'} · 1 network`;
  }

  function buildQGrid() {
    const g = $('qgrid'); g.textContent = '';
    const corner = document.createElement('div'); corner.className = 'qh'; g.appendChild(corner);
    PEDALS.forEach(p => { const h = document.createElement('div'); h.className = 'qh'; h.textContent = p.replace('brake / reverse', 'brake/rev'); g.appendChild(h); });
    STEERS.forEach((st, si) => {
      const h = document.createElement('div'); h.className = 'qh row'; h.textContent = st; g.appendChild(h);
      PEDALS.forEach((_, pi) => { const c = document.createElement('div'); c.className = 'qcell'; c.dataset.action = si * 4 + pi; c.textContent = '—'; g.appendChild(c); });
    });
  }
  function renderQ(s) {
    const al = qAlphas(s.q);
    document.querySelectorAll('#qgrid .qcell').forEach(c => {
      const a = Number(c.dataset.action);
      c.style.setProperty('--a', al[a].toFixed(2));
      c.textContent = fmt(s.q[a], 1);
      c.classList.toggle('is-best', a === s.best_action);
    });
    const bd = decodeAction(s.best_action);
    $('policy').textContent = s.cars[0].done ? 'finished' : `${STEERS[bd.steer]} + ${PEDALS[bd.pedal].split(' ')[0]}`;
  }

  function buildFeatureRows(names) {
    const groups = [
      ['Road lidar (free distance to the edge)', /^road_/, ''],
      ['Other cars (nearest in each 30° sector)', /^car_/, 'is-danger'],
      ['Own motion', /^(speed_|yaw_|steer)/, 'is-food'],
      ['Road geometry', /^(lateral|heading|curve)/, 'is-space']
    ];
    const host = $('features'); host.textContent = '';
    for (const [title, re, cls] of groups) {
      const idx = names.map((n, i) => re.test(n) ? i : -1).filter(i => i >= 0);
      if (!idx.length) continue;
      const g = document.createElement('div'); g.className = 'fgroup'; g.textContent = title; host.appendChild(g);
      for (const i of idx) {
        const r = document.createElement('div'); r.className = 'frow ' + cls;
        r.innerHTML = '<span class="fname"></span><span class="ftrack"><span class="ffill"></span></span><span class="fval">0.00</span>';
        r.querySelector('.fname').textContent = names[i].replace(/_/g, ' ');
        r.dataset.index = i; host.appendChild(r);
      }
    }
    $('featCount').textContent = `${names.length} inputs per car`;
  }

  function showOverlay(s) {
    const o = $('overlay'), ego = s.cars[0];
    if (!ego.done) { o.classList.add('is-hidden'); return; }
    const d = describeEnd(ego.cause);
    o.className = 'overlay ' + d.cls;
    $('overlayTitle').textContent = d.title;
    $('overlayText').textContent = `${d.text} ${ego.cause === 'lap' ? `Lap time ${fmt(s.time, 1)} s.` : `Progress ${fmt(ego.progress * 100, 0)} %.`}`;
    $('overlayBtn').textContent = G.mode === 'ai' && $('autoRestart').checked ? 'Restarting…' : 'Drive again';
  }

  /* ---- training chart ---- */
  const curve = $('curve');
  const cctx = curve.getContext('2d');
  let metrics = { history: [] };
  let hover = -1;
  const PAD = { l: 44, r: 42, t: 12, b: 38 };

  function drawCurve() {
    const rect = curve.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (!W || !H) return;
    fitCanvas(curve, cctx, W, H);
    const ctx = cctx;
    ctx.clearRect(0, 0, W, H);
    const hist = metrics.history || [];
    $('curveEmpty').classList.toggle('is-hidden', hist.length > 0);
    if (!hist.length) return;
    const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    const maxEp = Math.max(...hist.map(r => r.episode));
    const X = ep => PAD.l + pw * ep / maxEp, Y = v => PAD.t + ph * (1 - v);
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const y = PAD.t + ph * i / 5;
      ctx.strokeStyle = i === 5 ? '#2a3a4b' : '#16212c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, y + 0.5); ctx.lineTo(W - PAD.r, y + 0.5); ctx.stroke();
      ctx.fillStyle = '#7d8ea0'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(100 * (1 - i / 5))}%`, PAD.l - 7, y);
      ctx.fillStyle = '#9a7b1e'; ctx.textAlign = 'left'; ctx.fillText((1 - i / 5).toFixed(1), W - PAD.r + 7, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#7d8ea0';
    const step = niceCeil(maxEp / 5);
    for (let ep = 0; ep <= maxEp + 1e-9; ep += step) ctx.fillText(String(ep), X(ep), H - PAD.b + 8);
    ctx.fillText('episode (one episode = a pack of cars driving together)', PAD.l + pw / 2, H - 14);
    const line = (get, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); let started = false;
      hist.forEach(r => { const v = get(r); if (v == null) return; const x = X(r.episode), y = Y(v); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    line(r => r.epsilon, '#fbbf24', 1.4, [5, 4]);
    line(r => r.train_progress, '#a78bfa', 1.8);
    line(r => r.eval_progress, '#34d399', 1.8);
    line(r => r.eval_completion, '#22d3ee', 2.4);
    hist.forEach(r => { if (r.eval_completion != null) { ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(X(r.episode), Y(r.eval_completion), 3, 0, TAU); ctx.fill(); } });
    const tip = $('tip');
    if (hover >= 0 && hover < hist.length) {
      const r = hist[hover], x = X(r.episode);
      ctx.strokeStyle = 'rgba(165,243,252,0.35)'; ctx.beginPath(); ctx.moveTo(x + 0.5, PAD.t); ctx.lineTo(x + 0.5, PAD.t + ph); ctx.stroke();
      const pc = v => v == null ? '—' : `${(v * 100).toFixed(0)}%`;
      tip.innerHTML = `<b>episode ${r.episode}</b><br><span class="c-eval">laps done</span> ${pc(r.eval_completion)} · <span class="c-prog">progress</span> ${pc(r.eval_progress)}<br>` +
        `<span class="c-train">train progress</span> ${pc(r.train_progress)}<br><span class="c-eps">epsilon</span> ${fmt(r.epsilon, 2)} · loss ${fmt(r.loss, 4)}`;
      tip.classList.remove('is-hidden');
      tip.style.left = clamp(x + 12, 4, W - tip.offsetWidth - 4) + 'px'; tip.style.top = (PAD.t + 4) + 'px';
    } else tip.classList.add('is-hidden');
  }
  curve.addEventListener('pointermove', e => {
    const rect = curve.getBoundingClientRect();
    const frac = clamp((e.clientX - rect.left - PAD.l) / (rect.width - PAD.l - PAD.r), 0, 1);
    const maxEp = Math.max(1, ...((metrics.history || []).map(r => r.episode)));
    const i = nearestRow(metrics.history || [], frac, maxEp);
    if (i !== hover) { hover = i; drawCurve(); }
  });
  curve.addEventListener('pointerleave', () => { hover = -1; drawCurve(); });

  /* ---- model card + benchmark ---- */
  function fact(dt, dd, big) {
    const wrap = document.createElement('div');
    const a = document.createElement('dt'); a.textContent = dt;
    const b = document.createElement('dd'); b.textContent = dd; if (big) b.className = 'big';
    wrap.append(a, b); return wrap;
  }
  const pct = v => `${fmt(v * 100, 0)} %`;

  function renderModel(card) {
    G.modelName = card.name || 'model';
    $('modelName').textContent = `${card.name || 'model'} · ${card.algorithm || ''}`.trim();
    const host = $('modelFacts'); host.textContent = '';
    if (!card.eval_unseen) { host.appendChild(fact('Status', card.note || 'no model card')); return; }
    const u = card.eval_unseen, a = card.eval_seen;
    $('netShape').textContent = (card.network || []).join('→');
    host.append(
      fact('Unseen tracks — laps done', pct(u.completion), true),
      fact('Unseen tracks — mean speed', `${fmt(u.mean_speed, 1)} m/s`, true),
      fact('Train tracks — laps done', pct(a.completion)),
      fact('Test lap time', `${fmt(u.mean_lap_time, 1)} s`),
      fact('Algorithm', card.algorithm),
      fact('Network', (card.network || []).join('→')),
      fact('Parameters', String(card.parameters)),
      fact('Actions', `${(card.actions || []).length} (steer × pedal)`),
      fact('Observation', `${card.input_dim} features / car`),
      fact('Episodes', `${card.episodes} (packs of ${card.config.sim.cars} cars)`),
      fact('Transitions', String(card.total_steps)),
      fact('Training time', fmtSeconds(card.train_seconds)),
      fact('Best checkpoint', `episode ${card.best_episode}`),
      fact('Tracks', `${card.train_tracks.length} train · ${card.val_tracks.length} val · ${card.test_tracks.length} test`),
      fact('Seed', String(card.seed))
    );
    if (card.config) $('cfgDump').textContent = JSON.stringify(card.config, null, 2);
  }

  const CMP = [
    ['Laps completed', r => r.completion * 100, v => `${fmt(v, 0)} %`, 'high', 100],
    ['Mean progress', r => r.mean_progress * 100, v => `${fmt(v, 0)} %`, 'high', 100],
    ['Mean speed', r => r.mean_speed, v => `${fmt(v, 1)} m/s`, 'high', 22],
    ['Mean lap time', r => r.mean_lap_time, v => `${fmt(v, 1)} s`, 'low', 60],
    ['Car contacts / run', r => r.hits_per_run, v => fmt(v, 2), 'low', 4],
    ['Wall scrapes / run', r => r.scrapes_per_run, v => fmt(v, 1), 'low', 30],
    ['Wrecked', r => r.wreck_rate * 100, v => `${fmt(v, 0)} %`, 'low', 100],
    ['Drifting (share of time)', r => r.drift_share * 100, v => `${fmt(v, 1)} %`, 'none', 20],
    ['Reversing (share of time)', r => r.reverse_share * 100, v => `${fmt(v, 1)} %`, 'none', 20]
  ];
  function renderBench(r) {
    $('benchOut').classList.remove('is-hidden'); $('benchHint').classList.add('is-hidden');
    const host = $('cmpRows'); host.textContent = '';
    for (const [name, get, show, better, max] of CMP) {
      const a = get(r.ai), b = get(r.baseline);
      const row = document.createElement('div'); row.className = 'cmp-row';
      const n = document.createElement('span'); n.className = 'cmp-name'; n.textContent = name; row.appendChild(n);
      [['ai', a, b], ['base', b, a]].forEach(([kind, v, other]) => {
        const cell = document.createElement('div');
        const win = better === 'high' ? v > other + 1e-9 : better === 'low' ? v < other - 1e-9 : false;
        cell.className = 'cmp-val' + (win ? ' win' : '');
        const t = document.createElement('b'); t.textContent = isFinite(v) ? show(v) : '—';
        const bar = document.createElement('div'); bar.className = 'cmp-bar ' + kind;
        const i = document.createElement('i'); i.style.setProperty('--w', clamp(isFinite(v) ? v / max * 100 : 0, 0, 100).toFixed(0) + '%');
        bar.appendChild(i); cell.append(t, bar); row.appendChild(cell);
      });
      host.appendChild(row);
    }
  }

  /* ═════════════════════════ 4. game loop + input ═════════════════════════ */

  const G = {
    snap: null, prev: null, track: null, bounds: null, trackId: null, tickStart: 0, tickDur: 100,
    mode: store.get('mode', 'ai'), camera: store.get('camera', 'overview'), running: false, busy: false, timer: null,
    speed: clamp(store.get('speed', 10), 1, 40), keys: new Set(), restartTimer: null, modelName: '', model: null, wasRunning: false
  };

  async function loadTrack(id) {
    if (G.trackId === id && G.track) return;
    const t = await api('GET', `/api/track?id=${id}`);
    G.track = t; G.trackId = id; G.bounds = boundsOf(t.left.concat(t.right));
    $('trackSel').value = String(id);
  }

  async function setSnapshot(s, keepPrev) {
    if (G.trackId !== s.track) { await loadTrack(s.track); FX.skids = []; FX.smoke = []; }
    G.prev = keepPrev && G.snap && G.snap.track === s.track && s.cars[0].steps === G.snap.cars[0].steps + 1 ? G.snap : null;
    G.snap = s;
    G.tickStart = performance.now();
    G.tickDur = G.running ? 1000 / G.speed : 100;
    updateFx(s);
    renderHud(s); showOverlay(s);
    if (s.cars[0].done) onEgoDone();
  }

  function onEgoDone() {
    pause();
    if (G.mode === 'ai' && $('autoRestart').checked) {
      clearTimeout(G.restartTimer);
      G.restartTimer = setTimeout(async () => { await doReset(); if (G.mode === 'ai') play(); }, 1400);
    }
  }

  async function doReset(trackId) {
    clearTimeout(G.restartTimer); pause();
    const q = new URLSearchParams({ npcs: $('npcs').value });
    if (G.model) q.set('model', G.model);
    if (trackId !== undefined) q.set('track', trackId); else if (G.trackId !== null) q.set('track', G.trackId);
    try { await setSnapshot(await api('POST', `/api/reset?${q}`), false); } catch (e) { toast(e.message, true); }
  }

  async function tick() {
    if (G.busy || !G.snap || G.snap.cars[0].done) return;
    G.busy = true;
    try {
      const s = G.mode === 'ai' ? await api('POST', '/api/ai-step') : await api('POST', '/api/drive', controlsFromKeys(G.keys));
      await setSnapshot(s, true);
    } catch (e) { toast(e.message, true); pause(); } finally { G.busy = false; }
  }

  function loop() {
    if (!G.running) return;
    const started = performance.now();
    tick().finally(() => {
      if (!G.running) return;
      G.timer = setTimeout(loop, Math.max(0, 1000 / G.speed - (performance.now() - started)));
    });
  }
  function play() { if (G.running || !G.snap || G.snap.cars[0].done) return; G.running = true; syncControls(); loop(); }
  function pause() { G.running = false; clearTimeout(G.timer); syncControls(); if (G.snap) renderHud(G.snap); }
  function syncControls() {
    $('btnPlay').textContent = G.running ? '⏸ Pause' : '▶ Play';
    $('modeAi').classList.toggle('is-on', G.mode === 'ai'); $('modeHuman').classList.toggle('is-on', G.mode === 'human');
    $('modeAi').setAttribute('aria-pressed', String(G.mode === 'ai')); $('modeHuman').setAttribute('aria-pressed', String(G.mode === 'human'));
    $('btnCam').textContent = `Camera: ${G.camera}`;
  }
  async function setMode(m, restart) {
    if (G.mode === m && !restart) return;
    G.mode = m; store.set('mode', m); pause(); G.keys.clear(); syncControls();
    if (restart) await doReset(); else if (G.snap) renderHud(G.snap);
  }
  function setSpeed(v) {
    G.speed = clamp(v, 1, 40); $('speed').value = G.speed; $('speedOut').textContent = `${(G.speed / 10).toFixed(1)}×`;
    store.set('speed', G.speed); if (G.running) G.tickDur = 1000 / G.speed;
  }
  function setCamera(c) { G.camera = c; store.set('camera', c); syncControls(); }

  window.addEventListener('keydown', async e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
    const k = keyName(e.key);
    if (k && (G.mode === 'human' || k !== 'hand')) {
      e.preventDefault();
      if (G.mode !== 'human' && k !== 'hand') await setMode('human', true);        // pressing a driving key takes the wheel
      G.keys.add(k);
      if (G.snap && G.snap.cars[0].done) await doReset();
      if (!G.running) play();
      return;
    }
    switch (e.key) {
      case ' ': e.preventDefault(); G.running ? pause() : play(); break;
      case 'n': case 'N': tick(); break;
      case 'r': case 'R': doReset(); break;
      case 'm': case 'M': setMode(G.mode === 'ai' ? 'human' : 'ai', true); break;
      case 'c': case 'C': setCamera(G.camera === 'overview' ? 'chase' : 'overview'); break;
      case '[': setSpeed(G.speed - (G.speed > 10 ? 2 : 1)); break;
      case ']': setSpeed(G.speed + (G.speed >= 10 ? 2 : 1)); break;
      default: break;
    }
  });
  window.addEventListener('keyup', e => { const k = keyName(e.key); if (k) G.keys.delete(k); });
  window.addEventListener('blur', () => G.keys.clear());

  $('btnPlay').addEventListener('click', () => { G.running ? pause() : play(); });
  $('btnStep').addEventListener('click', () => { pause(); tick(); });
  $('btnReset').addEventListener('click', () => doReset());
  $('btnCam').addEventListener('click', () => setCamera(G.camera === 'overview' ? 'chase' : 'overview'));
  $('overlayBtn').addEventListener('click', async () => { await doReset(); play(); });
  $('modeAi').addEventListener('click', () => setMode('ai', true));
  $('modeHuman').addEventListener('click', () => setMode('human', true));
  $('speed').addEventListener('input', e => setSpeed(Number(e.target.value)));
  $('npcs').addEventListener('change', () => doReset());
  $('npcs').addEventListener('input', e => { $('npcsOut').textContent = e.target.value; });
  $('trackSel').addEventListener('change', e => doReset(Number(e.target.value)));
  $('modelSel').addEventListener('change', async e => { G.model = e.target.value; store.set('model', G.model); await loadModelInfo(G.model); await doReset(); if (G.mode === 'ai') play(); });
  $('autoRestart').checked = store.get('auto', true);
  $('autoRestart').addEventListener('change', e => store.set('auto', e.target.checked));
  $('btnBench').addEventListener('click', async () => {
    const btn = $('btnBench'); btn.disabled = true; btn.textContent = 'Racing…';
    try { renderBench(await api('GET', `/api/benchmark?group=${$('benchGroup').value}&starts=2&model=${G.model || ''}`)); }
    catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.textContent = 'Run'; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.running) { G.wasRunning = true; pause(); } else if (!document.hidden && G.wasRunning) { G.wasRunning = false; play(); } });
  window.addEventListener('resize', () => drawCurve());
  if (window.ResizeObserver) new ResizeObserver(() => drawCurve()).observe(curve.parentElement);

  function frame(now) { drawRoad(now); requestAnimationFrame(frame); }

  /** Load the model card and the learning curves of one model into the page. */
  async function loadModelInfo(name) {
    const [card, mets] = await Promise.all([api('GET', `/api/model?model=${name}`), api('GET', `/api/metrics?model=${name}`)]);
    renderModel(card); metrics = mets; hover = -1; drawCurve();
    return card;
  }

  async function init(first) {
    try {
      const [lib, snap, models] = await Promise.all([api('GET', '/api/tracks'), api('GET', '/api/state'), api('GET', '/api/models')]);
      const want = store.get('model', null);
      G.model = snap.model;
      const msel = $('modelSel'); msel.textContent = '';
      models.models.forEach(m => { const o = document.createElement('option'); o.value = m.name; o.textContent = `${m.name.replace('_ddqn', '')} (${m.style})`; msel.appendChild(o); });
      msel.value = G.model;
      const card = await loadModelInfo(G.model);
      buildFeatureRows(card.features || []); buildQGrid();
      if (first && want && want !== G.model && models.models.some(m => m.name === want)) { G.model = want; msel.value = want; await loadModelInfo(want); }
      const sel = $('trackSel'); sel.textContent = '';
      for (const grp of ['train', 'val', 'test']) {
        const og = document.createElement('optgroup'); og.label = grp === 'test' ? 'unseen test tracks' : grp === 'val' ? 'validation tracks' : 'training tracks';
        lib.tracks.filter(t => t.group === grp).forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = `#${t.id} · ${t.length} m`; og.appendChild(o); });
        sel.appendChild(og);
      }
      $('npcs').value = snap.npcs; $('npcsOut').textContent = snap.npcs;
      if (G.model !== snap.model) await doReset(); else await setSnapshot(snap, false);
      if (first) {
        setSpeed(G.speed); syncControls(); requestAnimationFrame(frame);
        if (G.mode === 'ai' && !snap.cars[0].done) setTimeout(() => { if (G.mode === 'ai' && !G.running) play(); }, 350);   // re-check: the user may have switched mode meanwhile
      }
    } catch (e) { toast(e.message, true); }
  }
  init(true);
})();
