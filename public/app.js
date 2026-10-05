// ROKTOK — core app: API client, state, router, shell, home, settings
import { renderCreate, mountCreate } from './views-create.js';
import { renderJob, mountJob, renderFinal, mountFinal, renderShort, mountShort } from './views-final.js';
import { renderProjects, mountProjects, renderProject, mountProject } from './views-project.js';
import { renderTool, mountTool } from './views-tools.js';

export const R = {};
window.R = R;

// ---------------- API ----------------
R.api = async function (path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

R.state = null;
R.loadState = async () => { R.state = await R.api('/state'); applyTheme(); return R.state; };

function applyTheme() {
  const t = R.state?.settings?.theme || 'dark';
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'dark' ? '#0a0c12' : '#f4f6fb';
}
document.getElementById('themeBtn').onclick = async () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  R.state.settings = await R.api('/settings', { body: { theme: next } });
  applyTheme();
};

// ---------------- toasts / modal ----------------
R.toast = (msg, kind = '') => {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 3200);
};
R.sheet = (html, onMount) => {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="overlay"><div class="sheet"><div class="grab"></div>${html}</div></div>`;
  root.querySelector('.overlay').addEventListener('click', e => { if (e.target === e.currentTarget) R.closeSheet(); });
  const close = root.querySelectorAll('[data-close]');
  close.forEach(c => c.onclick = R.closeSheet);
  onMount?.(root);
  return root;
};
R.closeSheet = () => { document.getElementById('modal-root').innerHTML = ''; };
R.confirm = (msg, onYes, yesLabel = 'Confirm') => {
  R.sheet(`<h3>${esc(msg)}</h3><div class="row mt"><button class="btn grow" data-close>Cancel</button>
    <button class="btn danger grow" id="cfmYes">${esc(yesLabel)}</button></div>`,
    root => root.querySelector('#cfmYes').onclick = () => { R.closeSheet(); onYes(); });
};
R.download = (blobOrUrl, filename) => {
  const a = document.createElement('a');
  a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
R.copy = async (text) => {
  try { await navigator.clipboard.writeText(text); R.toast('Copied', 'ok'); }
  catch { R.toast('Copy failed', 'err'); }
};
window.addEventListener('offline', () => R.toast('You are offline — demo engines still work locally', 'err'));

// ---------------- PWA: install prompt + service worker ----------------
R.isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
R.deferredPrompt = null;
function refreshInstallUI() {
  const show = !R.isStandalone;
  const top = document.getElementById('installBtn');
  if (top) top.style.display = show ? '' : 'none';
  const hero = document.getElementById('heroInstall');
  if (hero) hero.style.display = show ? '' : 'none';
  const set = document.getElementById('setInstall');
  if (set) set.style.display = show ? '' : 'none';
}
R._refreshInstall = refreshInstallUI;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  R.deferredPrompt = e;           // Chrome/Edge Android: capture for one-tap install
  refreshInstallUI();
});
window.addEventListener('appinstalled', () => {
  R.isStandalone = true; R.deferredPrompt = null;
  refreshInstallUI();
  R.toast('ROKTOK installed to your home screen ✅', 'ok');
});
function installInstructions() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  R.sheet(`<h3>📲 Install ROKTOK</h3>
    <p class="h-sub">ROKTOK runs as an app on your phone — full-screen, home-screen icon, offline-ready, no store needed.</p>
    <div class="card mt"><b>${isIOS ? 'iPhone / iPad — Safari' : 'Android — Chrome'}</b>
      <ol class="small muted" style="padding-left:18px;line-height:1.9">
        ${isIOS
          ? '<li>Open this page in <b>Safari</b></li><li>Tap the <b>Share</b> button</li><li>Choose <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li>'
          : '<li>Tap the <b>⋮</b> menu in Chrome (top-right)</li><li>Tap <b>Install app</b> / <b>Add to Home screen</b></li><li>Confirm <b>Install</b></li>'}
      </ol>
      <p class="small dim mt">Afterwards ROKTOK opens in its own window — like a native Android app.</p>
    </div>
    <button class="btn block" data-close>Close</button>`);
}
R.installApp = async () => {
  if (R.isStandalone) { R.toast('ROKTOK is already installed ✅', 'ok'); return; }
  if (R.deferredPrompt) {
    try {
      R.deferredPrompt.prompt();
      const choice = await R.deferredPrompt.userChoice;   // user sees Chrome's native install sheet
      R.deferredPrompt = null;
      if (choice && choice.outcome === 'accepted') R.toast('Installing ROKTOK…', 'ok');
      refreshInstallUI();
      return;
    } catch { /* fall through to instructions */ }
  }
  installInstructions();                                   // iOS / unsupported: step-by-step
};
const _topInstall = document.getElementById('installBtn');
if (_topInstall) _topInstall.onclick = () => R.installApp();

// service worker → offline shell + home-screen installability
if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) location.reload();                  // new version: reload once
    else hadController = true;                              // first install: no reload
  });
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(() => refreshInstallUI()).catch(() => {});
}

export function esc(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export const fmtTime = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };

// ---------------- router ----------------
const view = document.getElementById('view');
async function navigate() {
  const hash = location.hash || '#/home';
  const [clean, query] = hash.split('?');
  R.query = new URLSearchParams(query || '');
  const [, rawName, a, b] = clean.split('/');
  const name = rawName || 'home';   // '/' or '' → home (also used by installed app start_url)
  document.querySelectorAll('#bottomnav a').forEach(el => {
    const nav = el.dataset.nav;
    el.classList.toggle('active', nav === name || (name === 'project' && nav === 'projects') || (name === 'final' && nav === 'create') || (name === 'job' && nav === 'create') || (name === 'tool' && nav === 'create') || (name === 'short' && nav === 'create'));
  });
  view.innerHTML = '<div class="empty"><span class="spin"></span> Loading…</div>';
  try {
    if (!R.state) await R.loadState();
    let html = null;
    if (name === 'home' || !name) html = await renderHome();
    else if (name === 'create') html = await renderCreate();
    else if (name === 'job') html = await renderJob(a);
    else if (name === 'final') html = await renderFinal(a, b);
    else if (name === 'short') html = await renderShort(a, b);
    else if (name === 'projects') html = await renderProjects();
    else if (name === 'project') html = await renderProject(a, b || 'overview');
    else if (name === 'tool') html = await renderTool(a, b);
    else if (name === 'settings') html = await renderSettings();
    else html = await renderHome();
    view.innerHTML = html;
    view.scrollTop = 0; window.scrollTo(0, 0);
    // mount hooks
    R.mounts?.[name]?.(a, b);
    R.mount?.(name, a, b);
  } catch (e) {
    view.innerHTML = `<div class="empty"><div class="big">⚠️</div><b>${esc(e.message)}</b>
      <div class="mt"><button class="btn" onclick="location.reload()">Reload</button></div></div>`;
  }
}
window.addEventListener('hashchange', navigate);
R.go = h => { location.hash = h; };
R.rerender = navigate;

// mount registry: view modules register R.mounts[routeName] = fn
R.mounts = R.mounts || {};

// ---------------- HOME ----------------
async function renderHome() {
  const projects = await R.api('/projects').catch(() => []);
  const recent = projects.slice(0, 3);
  const tools = TOOLS.map(t => `
    <a class="tool" href="#${t.h}"><span class="ti">${t.i}</span><span>${t.n}</span></a>`).join('');
  return `
  <section class="hero">
    <div class="tag">PERSONAL AI CREATIVE STUDIO</div>
    <h1>ROKTOK</h1>
    <p>ONE IDEA. ONE PROMPT. YOUR COMPLETE VIDEO.</p>
    <div class="qa-btns">
      <button class="btn primary big block" id="quickCreate">⚡ QUICK CREATE</button>
      <a class="btn vio block" href="#/create?make=1" id="makeEverything">🎬 MAKE EVERYTHING — full production</a>
      <button class="btn ghost block" id="heroInstall" style="display:none">📲 Install ROKTOK on your phone</button>
    </div>
  </section>

  <div class="row between mb"><h2 style="font-size:15px">Studio</h2>
    <span class="badge ${R.state.providers.some(p=>p.status==='live')?'live':'demo'}">${R.state.providers.some(p=>p.status==='live')?'Providers connected':'Demo engine active'}</span></div>
  <div class="tools">
    <a class="tool featured" href="#/create"><span class="ti">🎬</span><span><b>CREATE VIDEO</b><small>Full AI pipeline — idea in, final video out</small></span></a>
    ${tools}
  </div>

  ${recent.length ? `<h2 class="mt" style="font-size:15px">Recent projects</h2>${recent.map(p => `
    <div class="list-item" onclick="location.hash='#/project/${p.id}'">
      <div class="thumb">🎞️</div>
      <div class="meta"><b>${esc(p.name)}</b><small>${p.duration}s · ${p.shots} shots · ${p.language.toUpperCase()} ${p.hasVideo ? '· ✅ rendered' : ''}</small></div>
      <span class="dim">›</span>
    </div>`).join('')}` : ''}
  <div class="note mt">🧠 <b>How it works:</b> write one sentence → ROKTOK's AI Director writes the story, script, characters, locations, storyboard, voices, music, subtitles and renders <b>one final video</b>. Connect real AI providers in Settings to upgrade from the built-in demo engine.</div>
  `;
}
R.homeMount = () => {
  const qc = document.getElementById('quickCreate');
  if (qc) qc.onclick = () => R.go('#/create?quick=1');
  const hi = document.getElementById('heroInstall');
  if (hi) hi.onclick = () => R.installApp();
  refreshInstallUI();
};
const TOOLS = [
  { i: '🖼️', n: 'IMAGE TO VIDEO', h: '#/tool/i2v' },
  { i: '📝', n: 'TEXT TO VIDEO', h: '#/tool/t2v' },
  { i: '📜', n: 'SCRIPT TO VIDEO', h: '#/tool/script2v' },
  { i: '📖', n: 'STORY TO VIDEO', h: '#/tool/story2v' },
  { i: '🧑‍🎨', n: 'CHARACTER CREATOR', h: '#/tool/character' },
  { i: '🎨', n: 'IMAGE GENERATOR', h: '#/tool/imagegen' },
  { i: '✂️', n: 'AI VIDEO EDITOR', h: '#/tool/editor' },
  { i: '🎙️', n: 'AI VOICE', h: '#/tool/voice' },
  { i: '🌍', n: 'AI DUBBING', h: '#/tool/dubbing' },
  { i: '👄', n: 'LIP SYNC', h: '#/tool/lipsync' },
  { i: '💬', n: 'SUBTITLES', h: '#/tool/subtitles' },
  { i: '🎵', n: 'MUSIC & SOUND', h: '#/tool/music' },
  { i: '✨', n: 'VIDEO ENHANCER', h: '#/tool/enhancer' },
  { i: '🗂️', n: 'AI STORYBOARD', h: '#/tool/storyboard' },
  { i: '📁', n: 'MY PROJECTS', h: '#/projects' },
  { i: '⚙️', n: 'SETTINGS', h: '#/settings' }
];

// ---------------- SETTINGS ----------------
async function renderSettings() {
  const s = R.state.settings;
  const providers = R.state.providers;
  const budget = s.budget;
  const est = await R.api('/estimate', { body: { type: 'full', durationSec: 180, budget } }).catch(() => ({ usd: 0 }));
  return `
  <h1>Settings</h1>
  <div class="card">
    <h3>🎨 Appearance</h3>
    <label class="f">Theme</label>
    <div class="chips">
      <button class="chip ${s.theme === 'dark' ? 'on' : ''}" data-theme-set="dark">🌙 Dark</button>
      <button class="chip ${s.theme === 'light' ? 'on' : ''}" data-theme-set="light">☀️ Light</button>
    </div>
    <label class="f">Interface language</label>
    <select id="uiLang">${R.state.languages.map(l => `<option value="${l.id}" ${s.uiLang === l.id ? 'selected' : ''}>${l.name} · ${l.native}</option>`).join('')}</select>
  </div>

  <div class="card">
    <h3>💸 Budget mode <span class="badge ${budget === 'free' ? 'demo' : 'vio'}">${budget}</span></h3>
    <p class="h-sub">Never spends money without your confirmation. Free mode uses only the built-in demo engine.</p>
    <div class="chips">
      ${[['free', 'FREE / LOW COST'], ['balanced', 'BALANCED'], ['high', 'HIGH QUALITY'], ['maximum', 'MAXIMUM QUALITY']]
        .map(([id, n]) => `<button class="chip ${budget === id ? 'on' : ''}" data-budget="${id}">${n}</button>`).join('')}
    </div>
    <div class="note mt">Estimated cost of a 3-minute production in this mode: <b>$${est.usd.toFixed(3)}</b> · ${esc(est.note)}</div>
    <label class="row mt" style="gap:8px;font-size:13px"><input type="checkbox" id="confirmPaid" ${s.confirmPaidCalls ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Always ask before paid API calls</label>
  </div>

  <div class="card">
    <h3>🔌 AI Providers <span class="badge ${providers.some(p => p.status === 'live') ? 'live' : 'demo'}">${providers.filter(p => p.connected).length} connected</span></h3>
    <p class="h-sub">Multi-model architecture — the Smart Router picks the best provider per task and falls back automatically. Keys are stored server-side only, never in the browser.</p>
    ${providers.map(p => `
      <div class="list-item" style="cursor:default">
        <div class="meta"><b>${esc(p.name)}</b>
          <small>${p.categories.join(' · ')}</small><br/>
          <small class="dim">${esc(p.note || '')}</small></div>
        <div class="row" style="gap:6px">
          <span class="badge ${p.status === 'live' ? 'live' : p.status === 'demo' ? 'demo' : 'stub'}">${p.status === 'live' ? 'LIVE' : p.status === 'demo' ? 'READY' : p.status === 'stub-keyed' ? 'KEY SAVED' : 'API SLOT'}</span>
          ${p.status === 'demo' ? '' : p.connected
            ? `<button class="btn xs" data-disc="${p.id}">Disconnect</button><button class="btn xs" data-test="${p.id}">Test</button>`
            : `<button class="btn xs primary" data-connect="${p.id}">Connect</button>`}
        </div>
      </div>`).join('')}
    <div class="note">Providers marked <b>API SLOT</b> expose official-API adapter points (Runway-class, Kling-class, Veo-class, Luma, Pika, Firefly-class, ElevenLabs-class, HeyGen-class, Whisper-class, music, upscaling). Connect a key and the router will use them once the official adapter is enabled — the app never blocks on them: demo engines always work.</div>
  </div>

  <div class="card">
    <h3>🛡️ Safety & rights</h3>
    <label class="row" style="gap:8px;font-size:14px"><input type="checkbox" id="safetyChk" ${s.safety ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Content safety checks on</label>
    <p class="h-sub mt">ROKTOK refuses harmful/illegal briefs, does not clone real people's voices without permission, and only uses official APIs / demo engines you own rights to.</p>
  </div>

  <div class="card">
    <h3>⚙️ Render defaults</h3>
    <div class="grid2">
      <div><label class="f">Resolution</label>
        <select id="resSel">${['720p', '1080p', '4K (provider)'].map(r => `<option ${s.resolution === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div><label class="f">Frame rate</label>
        <select id="fpsSel">${[24, 25, 30, 60].map(f => `<option value="${f}" ${s.fps == f ? 'selected' : ''}>${f} FPS</option>`).join('')}</select></div>
    </div>
  </div>

  <div class="card" id="installCard">
    <h3>📲 Install as an app</h3>
    <p class="h-sub">Put ROKTOK on your home screen — opens full-screen like a native Android app, works offline for browsing your projects. No Play Store needed.</p>
    <button class="btn primary block mt" id="setInstall">📲 Install ROKTOK</button>
    <p class="form-scroll-note mt">Android (Chrome): the browser may show its own install prompt — accept it. iPhone (Safari): Share → Add to Home Screen.</p>
  </div>

  <div class="card">
    <h3>ℹ️ About</h3>
    <p class="h-sub">ROKTOK v1.0.0 — personal AI creative studio. Modular architecture: engines, providers, router, QC agent, render engine. Your projects live in <code>data/</code> on this machine.</p>
    <button class="btn danger sm" id="wipeBtn">Reset app data</button>
  </div>`;
}
R.settingsMount = () => {
  const q = s => document.querySelector(s);
  document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = async () => {
    R.state.settings = await R.api('/settings', { body: { theme: b.dataset.themeSet } }); applyTheme(); R.rerender();
  });
  document.querySelectorAll('[data-budget]').forEach(b => b.onclick = async () => {
    R.state.settings = await R.api('/settings', { body: { budget: b.dataset.budget } }); R.toast('Budget mode: ' + b.dataset.budget, 'ok'); R.rerender();
  });
  const ul = q('#uiLang'); if (ul) ul.onchange = async () => { R.state.settings = await R.api('/settings', { body: { uiLang: ul.value } }); R.toast('UI language saved', 'ok'); };
  const cp = q('#confirmPaid'); if (cp) cp.onchange = async () => { R.state.settings = await R.api('/settings', { body: { confirmPaidCalls: cp.checked } }); };
  const sc = q('#safetyChk'); if (sc) sc.onchange = async () => { R.state.settings = await R.api('/settings', { body: { safety: sc.checked } }); };
  const rs = q('#resSel'); if (rs) rs.onchange = async () => { R.state.settings = await R.api('/settings', { body: { resolution: rs.value } }); };
  const fs = q('#fpsSel'); if (fs) fs.onchange = async () => { R.state.settings = await R.api('/settings', { body: { fps: +fs.value } }); };
  document.querySelectorAll('[data-connect]').forEach(b => b.onclick = () => providerSheet(b.dataset.connect));
  document.querySelectorAll('[data-test]').forEach(b => b.onclick = async () => { R.toast('Testing…'); const r = await R.api(`/providers/${b.dataset.test}/test`, { body: {} }); R.toast(r.message, r.ok ? 'ok' : 'err'); });
  document.querySelectorAll('[data-disc]').forEach(b => b.onclick = async () => { await R.api(`/providers/${b.dataset.disc}/disconnect`, { body: {} }); await R.loadState(); R.rerender(); R.toast('Disconnected', 'ok'); });
  const wb = q('#wipeBtn'); if (wb) wb.onclick = () => R.confirm('Delete ALL local projects and settings?', () => location.reload(), 'Understood — reload');
  const si = q('#setInstall'); if (si) si.onclick = () => R.installApp();
  refreshInstallUI();
};
function providerSheet(id) {
  const p = R.state.providers.find(x => x.id === id);
  R.sheet(`<h3>Connect ${esc(p.name)}</h3>
    <p class="h-sub">${esc(p.keyHint || p.note)}</p>
    <label class="f">API key (stored server-side only)</label>
    <input type="password" id="pkInput" placeholder="sk-…" autocomplete="off"/>
    <div class="row mt"><button class="btn grow" data-close>Cancel</button><button class="btn primary grow" id="pkSave">Connect</button></div>
    <p class="form-scroll-note mt">Your key never appears in frontend code or browser storage.</p>`,
    root => root.querySelector('#pkSave').onclick = async () => {
      const key = root.querySelector('#pkInput').value.trim();
      if (!key) return R.toast('Enter a key', 'err');
      try {
        await R.api(`/providers/${id}/connect`, { body: { key } });
        const t = await R.api(`/providers/${id}/test`, { body: {} });
        R.closeSheet(); await R.loadState(); R.rerender();
        R.toast(t.message || 'Connected', t.ok ? 'ok' : 'err');
      } catch (e) { R.toast(e.message, 'err'); }
    });
}

// ---------------- master mount ----------------
R.mount = (name, a, b) => {
  if (name === 'home') R.homeMount();
  else if (name === 'settings') R.settingsMount();
  else if (name === 'create') mountCreate();
  else if (name === 'job') mountJob(a);
  else if (name === 'final') mountFinal(a, b);
  else if (name === 'short') mountShort(a, b);
  else if (name === 'projects') mountProjects();
  else if (name === 'project') mountProject(a, b || 'overview');
  else if (name === 'tool') mountTool(a, b);
};

navigate();
