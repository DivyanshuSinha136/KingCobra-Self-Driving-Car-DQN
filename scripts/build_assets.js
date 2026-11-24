#!/usr/bin/env node
/* Generates every SVG in docs/img/ — banners, icons, animated icons, the shared-network and architecture diagrams, the
 * results card and the terminal "screenshots" (rendered from real command output saved in docs/img/src/*.txt).
 *
 *     node scripts/build_assets.js        (or: make assets)
 *
 * Dependency-free. The SVGs use SMIL animation, which GitHub, browsers and most viewers play inside <img>.
 * The dashboard PNG screenshots are separate: see scripts/screenshots.py.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'img');
const ICONS = path.join(OUT, 'icons');
fs.mkdirSync(ICONS, { recursive: true });

const C = { bg: '#0a0e13', bg2: '#0f1b26', panel: '#111820', line: '#1f2b38', line2: '#2a3a4b', text: '#d3deea', muted: '#7d8ea0',
  accent: '#22d3ee', accent2: '#0891b2', head: '#a5f3fc', food: '#fbbf24', violet: '#a78bfa', good: '#34d399', bad: '#f43f5e' };
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const write = (rel, svg) => { fs.writeFileSync(path.join(OUT, rel), svg.trim() + '\n'); };

/* ───────────────────────── icons (24×24, stroke) ───────────────────────── */
const I = (body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${body}</svg>`;
const icons = {
  rocket:   I('<path d="M12 3c3.5 1.5 5.5 5 5.5 9l-2 3h-7l-2-3c0-4 2-7.5 5.5-9z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.5 15 8 19l4-1.5M14.5 15 16 19l-4-1.5"/>'),
  terminal: I('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M12.5 15H17"/>'),
  brain:    I('<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="19" cy="17" r="2"/><path d="m6.8 7 3.4 4M6.8 17l3.4-4M13.9 11l3.4-3M13.9 13l3.4 3"/>'),
  folder:   I('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>'),
  api:      I('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5.5l-3 13"/>'),
  test:     I('<path d="M9 3h6M10 3v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-8.5V3"/><path d="m9.5 15 1.8 1.8 3.2-3.4"/>'),
  warning:  I('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="' + C.accent + '"/>'),
  license:  I('<circle cx="12" cy="12" r="9"/><path d="M14.8 9.6a3.4 3.4 0 1 0 0 4.8"/>'),
  chart:    I('<path d="M4 4v16h16"/><path d="m7.5 15 3.5-4 3 2.5 4.5-6"/>'),
  tag:      I('<path d="M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7a1.5 1.5 0 0 1 1 .44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.7 7.7a1.5 1.5 0 0 1-2.12 0l-7.3-7.3a1.5 1.5 0 0 1-.44-1.04z"/><circle cx="8" cy="8" r="1.4"/>'),
  branch:   I('<circle cx="6" cy="5.5" r="2"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="8.5" r="2"/><path d="M6 7.5v9M18 10.5c0 4-6 3-11 6"/>'),
  book:     I('<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/>'),
  bug:      I('<rect x="8" y="8" width="8" height="11" rx="4"/><path d="M9.5 8a2.5 2.5 0 0 1 5 0M4 11h4M16 11h4M4.5 18l3.5-2M19.5 18 16 16M5 6l3 2.5M19 6l-3 2.5M12 12v7"/>'),
  gear:     I('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>'),
  car:      I('<path d="M4 14.5 6 9.5A2 2 0 0 1 7.9 8h8.2A2 2 0 0 1 18 9.5l2 5v3.5H4z"/><circle cx="8" cy="18" r="1.8" fill="' + C.bg + '"/><circle cx="16" cy="18" r="1.8" fill="' + C.bg + '"/><path d="M6.5 13h11"/>'),
  wheel:    I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M3.5 10.5 9.8 11.4M20.5 10.5 14.2 11.4M12 14.2V20.8"/>'),
  traffic:  I('<rect x="3" y="5" width="7" height="5" rx="1.6"/><rect x="14" y="5" width="7" height="5" rx="1.6"/><rect x="8.5" y="14" width="7" height="5" rx="1.6"/><path d="M6.5 10v2.5h11V10M12 12.5V14"/>'),
  drift:    I('<path d="M5 20c0-6 4-8 8-9s6-3 6-7"/><path d="M8 20c0-3 2-4.5 5-5.5"/><path d="M11 20c0-1.5 1-2.4 3-3"/>'),
  reverse:  I('<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a4.5 4.5 0 0 1 0 9H12"/>'),
  snake:    I('<path d="M4 18h7V10h8"/><circle cx="19" cy="10" r="1.6" fill="' + C.accent + '"/>'),
  eye:      I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  shield:   I('<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  list:     I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  camera:   I('<rect x="3" y="6.5" width="18" height="13" rx="3"/><circle cx="12" cy="13" r="3.3"/><path d="M8.5 6.5 9.8 4h4.4l1.3 2.5"/>'),
  sparkle:  I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
  check:    I('<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16 9.5"/>'),
};
// animated icons --------------------------------------------------------
icons['live'] = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="${C.good}"/>
<circle cx="12" cy="12" r="3.2" fill="none" stroke="${C.good}" stroke-width="1.6"><animate attributeName="r" values="3.2;10.5" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite"/></circle>
<circle cx="12" cy="12" r="3.2" fill="none" stroke="${C.good}" stroke-width="1.6"><animate attributeName="r" values="3.2;10.5" dur="1.8s" begin="0.9s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="1.8s" begin="0.9s" repeatCount="indefinite"/></circle></svg>`;
icons['training'] = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M4 4v16h16" stroke="${C.line2}" stroke-width="1.6"/>
<path d="M5 18c3-.5 3-3 5.5-4s3 1 5-2.5 2.5-4 3.5-5" stroke="${C.accent}" stroke-width="2" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"><animate attributeName="stroke-dashoffset" values="100;0;0;100" keyTimes="0;0.55;0.9;1" dur="3.2s" repeatCount="indefinite"/></path>
<circle r="1.9" fill="${C.head}"><animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1;1;0" keyTimes="0;0.55;0.9;1" calcMode="linear" path="M5 18c3-.5 3-3 5.5-4s3 1 5-2.5 2.5-4 3.5-5"/></circle></svg>`;
icons['snake-loader'] = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round">
<rect x="4.5" y="4.5" width="15" height="15" rx="3.5" stroke="${C.line2}" stroke-width="1.2"/>
<rect x="4.5" y="4.5" width="15" height="15" rx="3.5" stroke="${C.accent}" stroke-width="3" pathLength="100" stroke-dasharray="26 74"><animate attributeName="stroke-dashoffset" from="0" to="-100" dur="2.2s" repeatCount="indefinite"/></rect>
<rect x="4.5" y="4.5" width="15" height="15" rx="3.5" stroke="${C.head}" stroke-width="3.4" pathLength="100" stroke-dasharray="5 95"><animate attributeName="stroke-dashoffset" from="-21" to="-121" dur="2.2s" repeatCount="indefinite"/></rect></svg>`;
icons['drifting-car'] = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g><animateTransform attributeName="transform" type="rotate" values="-28 12 12;28 12 12;-28 12 12" dur="1.8s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1" keyTimes="0;.5;1"/><rect x="8" y="3.5" width="8" height="17" rx="3.4" fill="${C.accent}"/><rect x="9.6" y="6" width="4.8" height="3.6" rx="1.2" fill="${C.bg}"/><rect x="9.6" y="14.5" width="4.8" height="2.4" rx="1" fill="${C.bg}"/></g><g fill="${C.muted}"><circle cx="5" cy="20" r="1.2"><animate attributeName="opacity" values="0;.9;0" dur="1.8s" repeatCount="indefinite"/></circle><circle cx="19" cy="20" r="1.2"><animate attributeName="opacity" values="0;.9;0" dur="1.8s" begin=".9s" repeatCount="indefinite"/></circle></g></svg>`;
icons['q-bars'] = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="${C.accent}">
<rect x="4" y="9" width="4" height="11" rx="1.2"><animate attributeName="height" values="11;5;11" dur="1.6s" repeatCount="indefinite"/><animate attributeName="y" values="9;15;9" dur="1.6s" repeatCount="indefinite"/></rect>
<rect x="10" y="4" width="4" height="16" rx="1.2"><animate attributeName="height" values="16;10;16" dur="1.6s" begin="0.4s" repeatCount="indefinite"/><animate attributeName="y" values="4;10;4" dur="1.6s" begin="0.4s" repeatCount="indefinite"/></rect>
<rect x="16" y="12" width="4" height="8" rx="1.2"><animate attributeName="height" values="8;14;8" dur="1.6s" begin="0.8s" repeatCount="indefinite"/><animate attributeName="y" values="12;6;12" dur="1.6s" begin="0.8s" repeatCount="indefinite"/></rect></g></svg>`;
for (const [name, svg] of Object.entries(icons)) fs.writeFileSync(path.join(ICONS, name + '.svg'), svg.trim() + '\n');

/* ───────────────────────── shared pieces ───────────────────────── */
const defs = (id, w, h) => `
<defs>
  <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
  <radialGradient id="${id}-glow1" cx="0.12" cy="0.1" r="0.7"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}-glow2" cx="0.95" cy="0.9" r="0.6"><stop offset="0" stop-color="${C.violet}" stop-opacity="0.15"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></radialGradient>
  <pattern id="${id}-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${C.line}" stroke-width="1" opacity="0.55"/></pattern>
  <radialGradient id="${id}-food" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.food}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.food}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" rx="18" fill="url(#${id}-bg)"/>
<rect width="${w}" height="${h}" rx="18" fill="url(#${id}-grid)"/>
<rect width="${w}" height="${h}" rx="18" fill="url(#${id}-glow1)"/>
<rect width="${w}" height="${h}" rx="18" fill="url(#${id}-glow2)"/>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="17.5" fill="none" stroke="${C.line2}"/>`;

const logo = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 32})">
  <rect x="2" y="2" width="28" height="28" rx="8" fill="#0f1a24" stroke="#20374a" stroke-width="1.2"/>
  <rect x="9" y="11" width="14" height="10" rx="3.5" fill="${C.accent}"/><rect x="17" y="13" width="4" height="6" rx="1.5" fill="#0f1a24"/>
  <path d="M5 26h6M21 26h6" stroke="${C.muted}" stroke-width="2.4" stroke-linecap="round"/></g>`;

const chip = (x, y, text, color = C.accent) => {
  const w = Math.round(text.length * 8.3 + 30);
  return { w, svg: `<g><rect x="${x}" y="${y}" width="${w}" height="32" rx="16" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-opacity="0.45"/>
  <text x="${x + w / 2}" y="${y + 21}" text-anchor="middle" font-family="${MONO}" font-size="14" fill="${color}">${esc(text)}</text></g>` };
};
const chips = (x, y, list) => { let cx = x, out = ''; for (const [t, col] of list) { const c = chip(cx, y, t, col); out += c.svg; cx += c.w + 12; } return out; };

/** A mini circuit with three cars running round it (SMIL, one shared period so the loop is seamless), the lead car
 * trailing its lidar. */
function circuit(id, ox, oy, size) {
  const m = size * 0.16, x0 = ox + m, x1 = ox + size - m, y0 = oy + m, y1 = oy + size - m, r = size * 0.2;
  const d = `M${x0 + r} ${y0} H${x1 - r} a${r} ${r} 0 0 1 ${r} ${r} V${y1 - r} a${r} ${r} 0 0 1 ${-r} ${r} H${x0 + r} a${r} ${r} 0 0 1 ${-r} ${-r} V${y0 + r} a${r} ${r} 0 0 1 ${r} ${-r}Z`;
  const dur = 10;
  const car = (col, delay, lidar) => `<g><animateMotion dur="${dur}s" repeatCount="indefinite" rotate="auto" begin="${delay}s" path="${d}"/>
    ${lidar ? [-1.05, -0.52, 0, 0.52, 1.05].map(a => `<line x1="0" y1="0" x2="${Math.cos(a) * 46}" y2="${Math.sin(a) * 46}" stroke="${C.accent}" stroke-opacity="0.5" stroke-width="1.3"><animate attributeName="stroke-opacity" values="0.15;0.6;0.15" dur="1.4s" repeatCount="indefinite"/></line>`).join('') : ''}
    <rect x="-13" y="-6.5" width="26" height="13" rx="4" fill="${col}"/><rect x="2" y="-4.6" width="6" height="9.2" rx="1.8" fill="#0a0e13" fill-opacity="0.75"/><rect x="11" y="-5.2" width="2" height="3" fill="#fff6c9"/><rect x="11" y="2.2" width="2" height="3" fill="#fff6c9"/></g>`;
  return `<g>
  <rect x="${ox}" y="${oy}" width="${size}" height="${size}" rx="16" fill="#070a0e" stroke="${C.line2}"/>
  <path d="${d}" fill="none" stroke="#1b2530" stroke-width="40" stroke-linejoin="round"/>
  <path d="${d}" fill="none" stroke="#e0364e" stroke-width="42" stroke-linejoin="round" stroke-opacity="0.9" stroke-dasharray="7 7" opacity="0.55"/>
  <path d="${d}" fill="none" stroke="#1b2530" stroke-width="36" stroke-linejoin="round"/>
  <path d="${d}" fill="none" stroke="${C.food}" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="9 9"/>
  ${car(C.violet, -0.0, false)}${car('#fb923c', -3.4, false)}${car(C.accent, -6.7, true)}
  </g>`;
}

/* ───────────────────────── banners ───────────────────────── */
write('banner.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="340" viewBox="0 0 1280 340" role="img" aria-labelledby="t d">
<title id="t">KingCobra Self-Driving Car DQN</title><desc id="d">Several cars driven by one shared Double DQN, written in KingCobra</desc>
${defs('bn', 1280, 340)}
${logo(64, 70, 104)}
<text x="190" y="132" font-family="${SANS}" font-size="56" font-weight="700" fill="#fff" letter-spacing="-1">Self-Driving <tspan fill="${C.accent}">Car DQN</tspan></text>
<text x="192" y="176" font-family="${SANS}" font-size="23" fill="${C.muted}">One shared Double DQN drives every car in traffic,</text>
<text x="192" y="204" font-family="${SANS}" font-size="23" fill="${C.muted}">with drift and reverse — all in <tspan fill="${C.accent}" font-weight="600">KingCobra</tspan>.</text>
${chips(64, 252, [['shared network', C.accent], ['traffic', C.violet], ['drift', C.food], ['reverse', C.good], ['live dashboard', C.accent], ['MIT', C.muted]])}
${circuit('bn', 900, 40, 260)}
</svg>`);

const banner2 = (file, id, title, sub, glyph) => write(file, `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="200" viewBox="0 0 1280 200" role="img" aria-label="${esc(title)}">
${defs(id, 1280, 200)}
${logo(64, 52, 84)}
<text x="168" y="106" font-family="${SANS}" font-size="46" font-weight="700" fill="#fff" letter-spacing="-0.5">${esc(title)}</text>
<text x="170" y="142" font-family="${SANS}" font-size="20" fill="${C.muted}">${esc(sub)}</text>
${glyph}
</svg>`);

// contributing: an animated git graph
const gitGraph = `<g transform="translate(860 40)" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 60H360" stroke="${C.line2}" stroke-width="3"/>
  <path d="M90 60C130 60 130 110 170 110H250C290 110 290 60 330 60" stroke="${C.violet}" stroke-width="3" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"><animate attributeName="stroke-dashoffset" values="100;0;0;100" keyTimes="0;0.4;0.9;1" dur="5s" repeatCount="indefinite"/></path>
  ${[10, 90, 330, 360].map((x, i) => `<circle cx="${x}" cy="60" r="9" fill="${C.bg}" stroke="${C.accent}" stroke-width="3"><animate attributeName="r" values="9;11;9" dur="2.4s" begin="${i * 0.5}s" repeatCount="indefinite"/></circle>`).join('')}
  ${[190, 230].map((x, i) => `<circle cx="${x}" cy="110" r="9" fill="${C.bg}" stroke="${C.violet}" stroke-width="3"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.15;0.3;0.9;1" dur="5s" begin="${i * 0.3}s" repeatCount="indefinite"/></circle>`).join('')}
  <circle r="5" fill="${C.head}"><animateMotion dur="5s" repeatCount="indefinite" path="M10 60H90C130 60 130 110 170 110H250C290 110 290 60 330 60H360"/></circle>
</g>`;
// changelog: an animated release timeline
const timeline = `<g transform="translate(860 52)" fill="none" stroke-linecap="round">
  <path d="M10 56H370" stroke="${C.line2}" stroke-width="3"/>
  <path d="M10 56H370" stroke="${C.accent}" stroke-width="3" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"><animate attributeName="stroke-dashoffset" values="100;0;0;100" keyTimes="0;0.5;0.92;1" dur="5s" repeatCount="indefinite"/></path>
  ${[10, 130, 250].map(x => `<circle cx="${x}" cy="56" r="8" fill="${C.bg}" stroke="${C.line2}" stroke-width="3"/>`).join('')}
  <g><circle cx="370" cy="56" r="11" fill="${C.accent}"><animate attributeName="r" values="11;14;11" dur="2s" repeatCount="indefinite"/></circle>
  <circle cx="370" cy="56" r="20" stroke="${C.accent}" stroke-width="2"><animate attributeName="r" values="14;26" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0" dur="2s" repeatCount="indefinite"/></circle>
  <rect x="320" y="94" width="100" height="30" rx="15" fill="${C.accent}" fill-opacity="0.12" stroke="${C.accent}" stroke-opacity="0.5"/><text x="370" y="114" text-anchor="middle" font-family="${MONO}" font-size="14" font-weight="700" fill="${C.accent}">v1.0.1</text></g>
</g>`;
banner2('banner-contributing.svg', 'bc', 'Contributing', 'Set up, test, and send a change — the short version.', gitGraph);
banner2('banner-changelog.svg', 'bl', 'Changelog', 'What changed in each release of KingCobra Snake DQN.', timeline);

/* thin animated divider */
write('divider.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="14" viewBox="0 0 1280 14" role="presentation">
<defs><linearGradient id="dv" x1="0" x2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient></defs>
<path d="M0 7H1280" stroke="${C.line}" stroke-width="2"/>
<path d="M0 7H1280" stroke="url(#dv)" stroke-width="3" stroke-linecap="round" pathLength="1000" stroke-dasharray="140 860"><animate attributeName="stroke-dashoffset" from="140" to="-1000" dur="6s" repeatCount="indefinite"/></path>
</svg>`);

/* ───────────────────────── results card (real numbers) ───────────────────────── */
const card = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'driver_ddqn.json'), 'utf8'));
const drift = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'drifter_ddqn.json'), 'utf8'));
const un = card.eval_unseen;
const tiles = [
  [(un.completion * 100).toFixed(0) + '%', 'laps completed', `${un.runs} laps on ${card.test_tracks.length} unseen tracks`, C.accent],
  [un.mean_speed.toFixed(1) + ' m/s', 'mean speed', `lap time ${un.mean_lap_time.toFixed(1)} s · top speed 22 m/s`, C.good],
  [(card.parameters / 1000).toFixed(1) + 'k', 'parameters', 'one network drives every car', C.violet],
  [(card.train_seconds / 60).toFixed(1) + ' min', 'training time', `${card.episodes} episodes × ${card.config.sim.cars} cars · 1 CPU core`, C.food],
];
write('results.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="170" viewBox="0 0 1280 170" role="img" aria-label="Results: ${(un.completion * 100).toFixed(0)} percent of laps completed on unseen tracks at ${un.mean_speed.toFixed(1)} metres per second, ${card.parameters} parameters, ${(card.train_seconds / 60).toFixed(1)} minutes of training">
<defs><linearGradient id="rs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#131c26"/><stop offset="1" stop-color="#0e151d"/></linearGradient></defs>
${tiles.map(([big, label, sub, col], i) => { const x = i * 322 + 2;
  return `<g transform="translate(${x} 0)"><rect x="0.5" y="0.5" width="304" height="168" rx="16" fill="url(#rs)" stroke="${C.line2}"/>
  <rect x="24" y="26" width="30" height="4" rx="2" fill="${col}"/>
  <text x="24" y="92" font-family="${MONO}" font-size="52" font-weight="700" fill="${col}">${esc(big)}<animate attributeName="opacity" values="0;1" dur="0.6s" begin="${i * 0.15}s" fill="freeze"/></text>
  <text x="24" y="122" font-family="${SANS}" font-size="16" font-weight="600" fill="${C.text}" letter-spacing="1.2">${esc(label.toUpperCase())}</text>
  <text x="24" y="148" font-family="${MONO}" font-size="13" fill="${C.muted}">${esc(sub)}</text></g>`; }).join('')}
</svg>`);

/* ───────────────────────── architecture diagram ───────────────────────── */
const box = (x, y, w, h, title, sub, col = C.accent) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${C.panel}" stroke="${C.line2}"/>
  <rect x="${x}" y="${y}" width="5" height="${h}" rx="2.5" fill="${col}"/>
  <text x="${x + 22}" y="${y + 34}" font-family="${MONO}" font-size="17" font-weight="700" fill="${col}">${esc(title)}</text>
  <text x="${x + 22}" y="${y + 58}" font-family="${SANS}" font-size="13.5" fill="${C.muted}">${esc(sub)}</text></g>`;
const flows = [
  { d: 'M230 100H290', label: 'cars', lx: 260, ly: 88, dur: 2.2 },
  { d: 'M490 100H550', label: 'N obs', lx: 520, ly: 88, dur: 2.2 },
  { d: 'M650 60C650 10 130 10 130 60', label: 'N actions (one batched forward pass)', lx: 390, ly: 24, dur: 4.5, col: C.food },
  { d: 'M130 140V240', label: 'n-step', lx: 100, ly: 198, dur: 2.8, anchor: 'end' },
  { d: 'M230 280H650V140', label: 'one shared minibatch', lx: 440, ly: 270, dur: 3.6, col: C.violet },
  { d: 'M810 100H750', label: 'drives', lx: 780, ly: 88, dur: 2.2 },
  { d: 'M910 140V240', label: 'best / last checkpoint', lx: 925, ly: 195, dur: 2.8, anchor: 'start' },
  { d: 'M910 320V420', label: 'loads', lx: 925, ly: 375, dur: 2.8, anchor: 'start' },
  { d: 'M810 460H750', label: 'API', lx: 780, ly: 448, dur: 2.2, col: C.good },
];
write('architecture.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="540" viewBox="0 0 1100 540" role="img" aria-label="Architecture: the world with traffic feeds one observation per car to one shared agent; transitions of all cars flow through one replay buffer back to the agent; the trainer writes model files that the server loads and serves to the browser dashboard">
<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.5 9 5 1 8.5z" fill="${C.muted}"/></marker></defs>
<rect width="1100" height="540" rx="18" fill="${C.bg}"/><rect x="0.5" y="0.5" width="1099" height="539" rx="17.5" fill="none" stroke="${C.line2}"/>
${flows.map(f => `<path d="${f.d}" fill="none" stroke="${f.col || C.muted}" stroke-opacity="0.7" stroke-width="2" marker-end="url(#ar)"/>
<text x="${f.lx}" y="${f.ly}" text-anchor="${f.anchor || 'middle'}" font-family="${SANS}" font-size="12.5" fill="${f.col || C.muted}">${esc(f.label)}</text>`).join('\n')}
${box(30, 60, 200, 80, 'world.kc', 'traffic · collisions · radar', C.accent)}
${box(290, 60, 200, 80, 'features.kc', '22 inputs per car', C.accent)}
${box(550, 60, 200, 80, 'agent.kc', 'ONE shared Double DQN', C.violet)}
${box(810, 60, 240, 80, 'trainer.kc', 'loop · eval · checkpoints', C.food)}
${box(30, 240, 200, 80, 'replay.kc', 'one buffer for all cars', C.violet)}
${box(810, 240, 240, 80, 'models/', '.kcnn · .json · .metrics.json', C.good)}
${box(810, 420, 240, 80, 'server.kc', 'routes · sessions · CSP', C.good)}
${box(550, 420, 200, 80, 'web/', 'canvas dashboard', C.accent)}
${box(30, 420, 330, 80, 'car.kc · track.kc', 'dynamic tyres · drift · reverse · roads', C.food)}
<path d="M130 320V420" fill="none" stroke="${C.muted}" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="4 5" marker-end="url(#ar)"/>
<text x="118" y="378" text-anchor="end" font-family="${SANS}" font-size="12.5" fill="${C.muted}">physics</text>
${flows.map((f, i) => `<circle r="3.6" fill="${f.col || C.head}"><animateMotion dur="${f.dur}s" begin="${(i * 0.37).toFixed(2)}s" repeatCount="indefinite" path="${f.d}"/></circle>`).join('\n')}
</svg>`);

/* ───────────────────────── the shared network: observation i -> action i ───────────────────────── */
{
  const N = 4, rows = [], ys = [], colors = [C.accent, '#fb923c', C.violet, C.good];
  const actions = ['left + gas', 'straight + gas', 'right + brake', 'left + handbrake'];
  for (let i = 0; i < N; i++) ys.push(78 + i * 78);
  const net = { x: 430, y: 52, w: 240, h: 340 };
  let body = '';
  ys.forEach((y, i) => {
    const col = colors[i];
    body += `<g><rect x="30" y="${y}" width="270" height="56" rx="12" fill="${C.panel}" stroke="${C.line2}"/><rect x="30" y="${y}" width="5" height="56" rx="2.5" fill="${col}"/>
      <text x="52" y="${y + 24}" font-family="${MONO}" font-size="15" font-weight="700" fill="${col}">Observation ${String(i + 1).padStart(2, '0')}</text>
      <text x="52" y="${y + 44}" font-family="${SANS}" font-size="12.5" fill="${C.muted}">car ${i + 1}: lidar · cars · motion · road</text></g>`;
    body += `<g><rect x="800" y="${y}" width="270" height="56" rx="12" fill="${C.panel}" stroke="${C.line2}"/><rect x="1065" y="${y}" width="5" height="56" rx="2.5" fill="${col}"/>
      <text x="822" y="${y + 24}" font-family="${MONO}" font-size="15" font-weight="700" fill="${col}">Action ${String(i + 1).padStart(2, '0')}</text>
      <text x="822" y="${y + 44}" font-family="${MONO}" font-size="12.5" fill="${C.muted}">${esc(actions[i])}</text></g>`;
    const cy = y + 28, ty = net.y + 70 + i * 66;
    const inPath = `M300 ${cy}C365 ${cy} 365 ${ty} 430 ${ty}`, outPath = `M670 ${ty}C735 ${ty} 735 ${cy} 800 ${cy}`;
    body += `<path d="${inPath}" fill="none" stroke="${col}" stroke-opacity="0.55" stroke-width="2" marker-end="url(#ar2)"/><path d="${outPath}" fill="none" stroke="${col}" stroke-opacity="0.55" stroke-width="2" marker-end="url(#ar2)"/>
      <circle r="4" fill="${col}"><animateMotion dur="2.6s" begin="${(i * 0.4).toFixed(1)}s" repeatCount="indefinite" path="${inPath}"/></circle>
      <circle r="4" fill="${col}"><animateMotion dur="2.6s" begin="${(i * 0.4 + 1.3).toFixed(1)}s" repeatCount="indefinite" path="${outPath}"/></circle>`;
  });
  write('shared-network.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="440" viewBox="0 0 1100 440" role="img" aria-label="One shared KingCobra neural network: observation i of car i goes in, action i comes out, for every car">
<defs><marker id="ar2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.5 9 5 1 8.5z" fill="${C.muted}"/></marker>
<linearGradient id="nn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0.14"/></linearGradient></defs>
<rect width="1100" height="440" rx="18" fill="${C.bg}"/><rect x="0.5" y="0.5" width="1099" height="439" rx="17.5" fill="none" stroke="${C.line2}"/>
<text x="550" y="34" text-anchor="middle" font-family="${SANS}" font-size="15" fill="${C.muted}" letter-spacing="1.2">ONE BATCHED FORWARD PASS · THE SAME WEIGHTS FOR EVERY CAR</text>
<rect x="${net.x}" y="${net.y}" width="${net.w}" height="${net.h}" rx="20" fill="url(#nn)" stroke="${C.accent}" stroke-opacity="0.8" stroke-width="1.6"><animate attributeName="stroke-opacity" values="0.4;0.95;0.4" dur="2.6s" repeatCount="indefinite"/></rect>
${[0, 1, 2, 3].map(l => [0, 1, 2, 3].map(k => `<circle cx="${net.x + 40 + l * 53}" cy="${net.y + 50 + k * 52 + (l % 2) * 26}" r="7" fill="${C.bg}" stroke="${C.accent}" stroke-opacity="0.7"><animate attributeName="fill" values="${C.bg};${C.accent};${C.bg}" dur="2.6s" begin="${((l * 4 + k) * 0.13).toFixed(2)}s" repeatCount="indefinite"/></circle>`).join('')).join('')}
<text x="${net.x + net.w / 2}" y="${net.y + net.h - 56}" text-anchor="middle" font-family="${MONO}" font-size="20" font-weight="700" fill="${C.accent}">Shared KingCobra NN</text>
<text x="${net.x + net.w / 2}" y="${net.y + net.h - 32}" text-anchor="middle" font-family="${SANS}" font-size="13" fill="${C.muted}">22 → 128 → 128 → 12  ·  21k weights</text>
${body}
<text x="165" y="${ys[N - 1] + 92}" text-anchor="middle" font-family="${MONO}" font-size="15" fill="${C.muted}">⋮   Observation N</text>
<text x="935" y="${ys[N - 1] + 92}" text-anchor="middle" font-family="${MONO}" font-size="15" fill="${C.muted}">Action N   ⋮</text>
</svg>`);
}

/* ───────────────────────── terminal "screenshots" (real output) ───────────────────────── */
function terminal(file, srcFile, title) {
  const lines = fs.readFileSync(path.join(OUT, 'src', srcFile), 'utf8').replace(/\n+$/, '').split('\n');
  const lh = 20, padTop = 58, w = 940, h = padTop + lines.length * lh + 30;
  const colorize = (line, i) => {
    if (line.startsWith('$ ')) return `<tspan fill="${C.good}">$</tspan><tspan fill="${C.text}">${esc(line.slice(1))}</tspan>`;
    let m;
    if ((m = line.match(/^(.*?)( \| EVAL .*?)(  \* best)?$/))) return `<tspan fill="${C.muted}">${esc(m[1])}</tspan><tspan fill="${C.accent}">${esc(m[2])}</tspan>${m[3] ? `<tspan fill="${C.food}">${esc(m[3])}</tspan>` : ''}`;
    if (/^\s+ok\s/.test(line)) return `<tspan fill="${C.good}">  ok</tspan><tspan fill="${C.muted}">${esc(line.replace(/^\s+ok/, ''))}</tspan>`;
    if (/passed/.test(line)) return `<tspan fill="${C.good}" font-weight="700">${esc(line)}</tspan>`;
    if (/^(final|best checkpoint|saved)/.test(line)) return `<tspan fill="${C.head}">${esc(line)}</tspan>`;
    if (/^(AI|train tracks|unseen test tracks|test tracks)/.test(line)) return `<tspan fill="${C.accent}" font-weight="700">${esc(line)}</tspan>`;
    if (/^==/.test(line)) return `<tspan fill="${C.accent}" font-weight="700">${esc(line)}</tspan>`;
    if (/^tests\//.test(line)) return `<tspan fill="${C.text}">${esc(line)}</tspan>`;
    return `<tspan fill="${C.muted}">${esc(line)}</tspan>`;
  };
  write(file, `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<rect width="${w}" height="${h}" rx="14" fill="#0b1118"/><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${C.line2}"/>
<path d="M0 14a14 14 0 0 1 14-14h${w - 28}a14 14 0 0 1 14 14v30H0z" fill="#121b25"/><path d="M0 44H${w}" stroke="${C.line2}"/>
<circle cx="26" cy="22" r="6" fill="#f43f5e"/><circle cx="48" cy="22" r="6" fill="#fbbf24"/><circle cx="70" cy="22" r="6" fill="#34d399"/>
<text x="${w / 2}" y="27" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${C.muted}">${esc(title)}</text>
<g font-family="${MONO}" font-size="13.5" xml:space="preserve">
${lines.map((l, i) => `<text x="24" y="${padTop + 14 + i * lh}" xml:space="preserve" style="white-space:pre">${colorize(l, i)}</text>`).join('\n')}
<rect x="24" y="${padTop + lines.length * lh + 1}" width="8" height="15" fill="${C.accent}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.1s" repeatCount="indefinite"/></rect></g>
</svg>`);
}
terminal('terminal-train.svg', 'train.txt', 'make train — kingcobra-self-driving-car');
terminal('terminal-test.svg', 'test.txt', 'make test — kingcobra-self-driving-car');
terminal('terminal-eval.svg', 'eval_ai.txt', 'make eval — kingcobra-self-driving-car');

console.log('assets written to', path.relative(process.cwd(), OUT) || OUT);
