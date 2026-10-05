// ROKTOK — Procedural cinematic SVG image engine (demo provider output)
// Produces genuine, downloadable artwork from prompts until an image provider is connected.

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
const rnd = (seed, i) => { const x = Math.sin(seed * 9301 + i * 49297) * 233280; return x - Math.floor(x); };

const ASPECTS = { '1:1': [1024, 1024], '16:9': [1280, 720], '9:16': [720, 1280], '4:3': [1024, 768], '3:4': [768, 1024] };

export function cinematicSVG(prompt = '', opts = {}) {
  const [W, H] = ASPECTS[opts.aspect] || ASPECTS['16:9'];
  const seed = hash(prompt + (opts.seed || ''));
  const lowSun = /sunset|golden|dusk|evening/i.test(prompt);
  const night = /night|moonlit|dark/i.test(prompt);
  const village = /village|house|mud|brick|rural/i.test(prompt);
  const city = /city|street|urban/i.test(prompt);
  const sky1 = night ? '#0b1026' : lowSun ? '#2b1a3d' : '#7db9e8';
  const sky2 = night ? '#1c2a55' : lowSun ? '#e8763a' : '#f2c98a';
  const sunY = lowSun ? H * 0.52 : night ? H * 0.2 : H * 0.3;
  const sunX = W * (0.25 + rnd(seed, 1) * 0.5);
  const layers = [];
  // mountain / skyline layers
  for (let L = 0; L < 3; L++) {
    const baseY = H * (0.52 + L * 0.12);
    let d = `M0 ${H} L0 ${baseY}`;
    const steps = 7 + L * 3;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * W;
      const y = baseY - rnd(seed + L * 7, i) * H * (0.16 - L * 0.04);
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L${W} ${H} Z`;
    const shade = night ? ['#131c38', '#0e1530', '#0a1026'][L] : lowSun ? ['#5a3b52', '#432c44', '#2e1f35'][L] : ['#8fa8c0', '#6f8ba8', '#54708e'][L];
    layers.push(`<path d="${d}" fill="${shade}"/>`);
  }
  // houses
  let houses = '';
  if (village || city) {
    const n = 5 + Math.floor(rnd(seed, 2) * 5);
    for (let i = 0; i < n; i++) {
      const hw = 60 + rnd(seed + 3, i) * 90, hh = 40 + rnd(seed + 5, i) * 60;
      const x = (i / n) * W + rnd(seed + 9, i) * 40 - 20;
      const y = H * 0.72 + rnd(seed + 11, i) * H * 0.06;
      const col = night ? '#1a2138' : lowSun ? '#7a4f3a' : '#a97e5c';
      const roof = night ? '#12182c' : lowSun ? '#5b382b' : '#7c5a41';
      houses += `<rect x="${x.toFixed(0)}" y="${(y - hh).toFixed(0)}" width="${hw.toFixed(0)}" height="${hh.toFixed(0)}" fill="${col}"/>`;
      houses += `<rect x="${x.toFixed(0)}" y="${(y - hh - 8).toFixed(0)}" width="${hw.toFixed(0)}" height="10" fill="${roof}"/>`;
      houses += `<rect x="${(x + hw * 0.35).toFixed(0)}" y="${(y - hh * 0.6).toFixed(0)}" width="14" height="20" fill="${night ? '#f4c66a' : '#2c1e17'}" opacity="0.9"/>`;
    }
  }
  // figures
  let figures = '';
  const nf = 1 + Math.floor(rnd(seed, 4) * 3);
  for (let i = 0; i < nf; i++) {
    const fx = W * (0.3 + rnd(seed + 13, i) * 0.45), fy = H * 0.86, s = H * (0.10 + rnd(seed, i) * 0.04);
    const cloth = ['#6b4a2f', '#3f4f5c', '#5a3d4a', '#41503c'][i % 4];
    figures += `<g transform="translate(${fx.toFixed(0)} ${fy.toFixed(0)})">
      <ellipse cx="0" cy="0" rx="${(s * 0.22).toFixed(1)}" ry="${(s * 0.05).toFixed(1)}" fill="rgba(0,0,0,.35)"/>
      <path d="M0 ${(-s).toFixed(1)} L${(s * 0.18).toFixed(1)} 0 L${(-s * 0.18).toFixed(1)} 0 Z" fill="${cloth}"/>
      <circle cx="0" cy="${(-s * 1.08).toFixed(1)}" r="${(s * 0.14).toFixed(1)}" fill="#b07b4f"/>
      <path d="M${(-s * 0.16).toFixed(1)} ${(-s * 0.72).toFixed(1)} L${(-s * 0.3).toFixed(1)} ${(-s * 0.2).toFixed(1)}" stroke="${cloth}" stroke-width="${(s * 0.08).toFixed(1)}" stroke-linecap="round"/>
      <path d="M${(s * 0.16).toFixed(1)} ${(-s * 0.72).toFixed(1)} L${(s * 0.3).toFixed(1)} ${(-s * 0.24).toFixed(1)}" stroke="${cloth}" stroke-width="${(s * 0.08).toFixed(1)}" stroke-linecap="round"/>
    </g>`;
  }
  const title = (opts.label || '').slice(0, 42);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>
    <radialGradient id="glow" cx="${(sunX / W).toFixed(2)}" cy="${(sunY / H).toFixed(2)}" r="0.45"><stop offset="0" stop-color="${night ? '#dfe8ff' : '#ffe9b8'}" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="grade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e2233" stop-opacity="0.25"/><stop offset="1" stop-color="#3a1f0e" stop-opacity="0.2"/></linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.06"/></feComponentTransfer><feComposite operator="over" in2="SourceGraphic"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${(H * 0.06).toFixed(0)}" fill="${night ? '#e8eeff' : '#fff3d0'}" opacity="0.95"/>
  ${layers.join('\n')}
  ${houses}
  <rect x="0" y="${(H * 0.88).toFixed(0)}" width="${W}" height="${(H * 0.12).toFixed(0)}" fill="${night ? '#0a0f20' : lowSun ? '#241726' : '#3c4a3a'}" opacity="0.9"/>
  ${figures}
  <rect width="${W}" height="${H}" fill="url(#grade)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" fill="transparent" opacity="0.5"/>
  <rect x="0" y="0" width="${W}" height="${(H * 0.06).toFixed(0)}" fill="#000"/>
  <rect x="0" y="${(H * 0.94).toFixed(0)}" width="${W}" height="${(H * 0.06).toFixed(0)}" fill="#000"/>
  ${title ? `<text x="${(W / 2).toFixed(0)}" y="${(H - 36)}" font-family="Arial, sans-serif" font-size="${Math.round(H * 0.045)}" font-weight="800" fill="#fff" text-anchor="middle" opacity="0.92" style="letter-spacing:2px">${escapeXml(title)}</text>` : ''}
  </svg>`;
}

export function characterSheetSVG(character, opts = {}) {
  const W = 1200, H = 800;
  const p = character.palette || {};
  const skin = p.skin || '#b07b4f', cloth = p.cloth || '#6b4a2f', cloth2 = p.cloth2 || '#8a6b45', hair = p.hair || '#1b1310';
  const figure = (x, s, label, flip) => `<g transform="translate(${x} ${H * 0.82}) scale(${flip ? -1 : 1} 1)">
      <ellipse cx="0" cy="0" rx="${s * 0.3}" ry="${s * 0.06}" fill="rgba(0,0,0,.3)"/>
      <path d="M0 ${-s * 1.0} L${s * 0.24} 0 L${-s * 0.24} 0 Z" fill="${cloth}"/>
      <rect x="${-s * 0.2}" y="${-s * 0.7}" width="${s * 0.4}" height="${s * 0.45}" fill="${cloth2}" opacity="0.85"/>
      <circle cx="0" cy="${-s * 1.12}" r="${s * 0.16}" fill="${skin}"/>
      <path d="M${-s * 0.16} ${-s * 1.16} a ${s * 0.16} ${s * 0.16} 0 0 1 ${s * 0.32} 0 z" fill="${hair}"/>
      <text x="0" y="${s * 0.22}" font-family="Arial" font-size="${Math.round(s * 0.09)}" fill="#c9d4e3" text-anchor="middle">${escapeXml(label)}</text>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111a2b"/><stop offset="1" stop-color="#1d2b40"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="48" y="72" font-family="Arial" font-size="44" font-weight="800" fill="#fff">${escapeXml(character.name)}</text>
  <text x="48" y="110" font-family="Arial" font-size="22" fill="#8fb6e8">CHARACTER REFERENCE SHEET · ${escapeXml((character.role || '').toUpperCase())} · consistency ${escapeXml(character.consistencyKey || '')}</text>
  ${figure(260, 220, 'FULL — FRONT')}
  ${figure(560, 220, 'FULL — 3/4', true)}
  <g transform="translate(860 330)"><circle r="120" fill="${skin}"/><path d="M-120 -20 a120 120 0 0 1 240 0 z" fill="${hair}"/>
    <circle cx="-42" cy="0" r="12" fill="#241a14"/><circle cx="42" cy="0" r="12" fill="#241a14"/>
    <path d="M-60 -44 q60 -30 120 0" stroke="${hair}" stroke-width="10" fill="none"/>
    <text y="170" font-family="Arial" font-size="22" fill="#c9d4e3" text-anchor="middle">FACE CLOSE-UP</text></g>
  <g font-family="Arial" font-size="19" fill="#d7e2f2">
    <text x="48" y="600">Face: ${escapeXml(character.face || '')}</text>
    <text x="48" y="632">Hair: ${escapeXml(character.hairstyle || '')}</text>
    <text x="48" y="664">Skin: ${escapeXml(character.skinTone || '')}</text>
    <text x="48" y="696">Build: ${escapeXml(character.bodyType || '')}</text>
    <text x="640" y="600">Clothing: ${escapeXml((character.clothing || '').slice(0, 52))}</text>
    <text x="640" y="632">Shoes: ${escapeXml(character.shoes || '')}</text>
    <text x="640" y="664">Voice: ${escapeXml((character.voice || '').slice(0, 46))}</text>
    <text x="640" y="696">Personality: ${escapeXml((character.personality || '').slice(0, 46))}</text>
  </g>
  <rect x="0" y="744" width="${W}" height="56" fill="#0a1220"/>
  <text x="48" y="780" font-family="Arial" font-size="18" fill="#7f93b0">ROKTOK · every scene references this exact identity</text>
  </svg>`;
}
function escapeXml(s = '') { return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }
