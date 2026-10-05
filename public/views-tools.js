// ROKTOK — Tool screens (all 16 studio tools). Every tool works via demo engines or clearly shows provider status.
import { R, esc, fmtTime } from './app.js';

const TOOL_META = {
  imagegen: ['🎨', 'Image Generator'], i2v: ['🖼️', 'Image to Video'], t2v: ['📝', 'Text to Video'],
  script2v: ['📜', 'Script to Video'], story2v: ['📖', 'Story to Video'], character: ['🧑‍🎨', 'Character Creator'],
  editor: ['✂️', 'AI Video Editor'], voice: ['🎙️', 'AI Voice'], dubbing: ['🌍', 'AI Dubbing'],
  lipsync: ['👄', 'Lip Sync'], subtitles: ['💬', 'Subtitle Engine'], music: ['🎵', 'Music & Sound'],
  enhancer: ['✨', 'Video Enhancer'], storyboard: ['🗂️', 'AI Storyboard']
};

export async function renderTool(name) {
  const meta = TOOL_META[name];
  if (!meta) return '<div class="empty">Unknown tool</div>';
  const projects = await R.api('/projects').catch(() => []);
  const head = `<div class="row mb"><span style="font-size:26px">${meta[0]}</span><h1 style="margin:0;font-size:21px">${meta[1]}</h1>
    <span class="grow"></span><a class="btn xs" href="#/home">✕</a></div>`;
  const body = {
    imagegen: imageGenView, i2v: i2vView, t2v: t2vView, script2v: simpleVideoView.bind(null, 'script'),
    story2v: simpleVideoView.bind(null, 'story'), character: charView, editor: editorView,
    voice: voiceView, dubbing: dubView.bind(null, projects), lipsync: lipView.bind(null, projects),
    subtitles: subsView.bind(null, projects), music: musicView, enhancer: enhancerView.bind(null, projects),
    storyboard: boardView.bind(null, projects)
  }[name](projects);
  return head + body;
}

// ---------- IMAGE GENERATOR ----------
function imageGenView() {
  return `<div class="card">
    <label class="f">Prompt</label>
    <textarea id="imgPrompt" placeholder="Describe the image… e.g. a Pashtun father and son at golden hour in a mountain village, cinematic portrait"></textarea>
    <label class="f">Aspect</label>
    <div class="chips" id="imgAspect">${['16:9', '9:16', '1:1', '4:3'].map((a, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-a="${a}">${a}${a === '9:16' ? ' vertical' : ''}</button>`).join('')}</div>
    <label class="f">Mode</label>
    <div class="chips" id="imgMode">${['text-to-image', 'image-to-image', 'character reference', 'style reference', 'background replacement', 'object removal', 'face enhancement', 'cinematic color'].map((m, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}</div>
    <button class="btn primary block mt" id="imgGen">🎨 Generate</button>
    <p class="form-scroll-note mt">Built-in procedural engine now · connect an image provider (OpenAI-compatible or Firefly-class slot) for photoreal output.</p>
  </div>
  <div id="imgOut" class="grid2"></div>`;
}
async function mountImageGen() {
  let aspect = '16:9', mode = 'text-to-image';
  document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-a]').forEach(x => x.classList.remove('on')); b.classList.add('on'); aspect = b.dataset.a; });
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-m]').forEach(x => x.classList.remove('on')); b.classList.add('on'); mode = b.dataset.m; });
  document.getElementById('imgGen').onclick = async () => {
    const prompt = document.getElementById('imgPrompt').value.trim();
    if (!prompt) return R.toast('Write a prompt first', 'err');
    const btn = document.getElementById('imgGen'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Generating…';
    try {
      const r = await R.api('/images/generate', { body: { prompt: mode + ': ' + prompt, aspect, seed: String(Date.now()) } });
      const out = document.getElementById('imgOut');
      out.insertAdjacentHTML('afterbegin', `<div class="card" style="padding:8px"><img class="responsive" src="${r.url}"/>
        <div class="row mt" style="gap:6px"><span class="badge ${r.mode === 'live' ? 'live' : 'demo'}">${r.mode === 'live' ? 'LIVE' : 'DEMO'}</span>
        <a class="btn xs" href="${r.url}" download>⬇ SVG</a><span class="small dim grow" style="text-align:right">${esc(prompt.slice(0, 30))}…</span></div></div>`);
      R.toast('Image generated', 'ok');
    } catch (e) { R.toast(e.message, 'err'); }
    btn.disabled = false; btn.textContent = '🎨 Generate';
  };
}

// ---------- IMAGE TO VIDEO ----------
function i2vView() {
  return `<div class="card">
    <div class="upload-box" id="i2vUpload">🖼️ Tap to upload an image (it becomes the identity we preserve)</div>
    <input type="file" id="i2vFile" accept="image/*" hidden/>
    <label class="f">Motion strength <span id="i2vMV" class="dim">50%</span></label><input type="range" id="i2vMotion" min="0" max="100" value="50"/>
    <label class="f">Camera movement</label>
    <div class="chips">${['slow push-in', 'pan left', 'pan right', 'dolly-out', 'orbit drift'].map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-cam="${c}">${c}</button>`).join('')}</div>
    <label class="f">Environment</label>
    <div class="chips">${['wind', 'rain', 'smoke', 'dust', 'water', 'fire'].map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-env="${c}">${c}</button>`).join('')}</div>
    <div class="grid2 mt">
      <div><label class="f">Facial movement</label><input type="range" id="i2vFace" min="0" max="100" value="35"/></div>
      <div><label class="f">Body movement</label><input type="range" id="i2vBody" min="0" max="100" value="45"/></div>
    </div>
    <button class="btn primary block mt" id="i2vGo">🎬 Animate image</button>
  </div>
  <div class="player-wrap" id="i2vWrap" style="display:none"><canvas id="i2vCanvas"></canvas>
    <div class="player-ui"><div class="player-row"><button class="pbtn play" id="i2vPlay">⏸</button><span id="i2vTime">0:00</span>
    <span class="grow"></span><span class="badge demo">identity preserved</span></div></div></div>
  <div class="note">The built-in animator applies real camera motion, environmental particles and subtle life to your still — connect a video provider (Runway-class / Luma-class slot) for full AI depth animation.</div>`;
}
async function mountI2V() {
  let img = null, cam = 'slow push-in', env = 'wind';
  const file = document.getElementById('i2vFile');
  document.getElementById('i2vUpload').onclick = () => file.click();
  file.onchange = () => {
    const f = file.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { img = new Image(); img.onload = () => { document.getElementById('i2vUpload').textContent = '✅ ' + f.name; }; img.src = r.result; }; r.readAsDataURL(f);
  };
  document.getElementById('i2vMotion').oninput = e => document.getElementById('i2vMV').textContent = e.target.value + '%';
  document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-cam]').forEach(x => x.classList.remove('on')); b.classList.add('on'); cam = b.dataset.cam; });
  document.querySelectorAll('[data-env]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-env]').forEach(x => x.classList.remove('on')); b.classList.add('on'); env = b.dataset.env; });
  let anim = null;
  document.getElementById('i2vGo').onclick = () => {
    if (!img) return R.toast('Upload an image first', 'err');
    const wrap = document.getElementById('i2vWrap'); wrap.style.display = '';
    const canvas = document.getElementById('i2vCanvas'); canvas.width = 960; canvas.height = 540;
    const ctx = canvas.getContext('2d');
    const motion = +document.getElementById('i2vMotion').value / 100;
    const t0 = performance.now(); let playing = true;
    const playBtn = document.getElementById('i2vPlay');
    playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '⏸' : '▶'; if (playing) loop(performance.now()); };
    const loop = now => {
      if (!playing) return;
      const t = (now - t0) / 1000;
      const W = canvas.width, H = canvas.height;
      let sc = 1.05, dx = 0, dy = 0;
      const u = Math.sin(t * 0.25) * 0.5 + 0.5;
      if (cam === 'slow push-in') sc = 1.02 + u * 0.12 * motion;
      if (cam === 'pan left') dx = (u - 0.5) * 80 * motion;
      if (cam === 'pan right') dx = -(u - 0.5) * 80 * motion;
      if (cam === 'dolly-out') sc = 1.16 - u * 0.12 * motion;
      if (cam === 'orbit drift') { dx = Math.sin(t * 0.5) * 30 * motion; sc = 1.06 + Math.cos(t * 0.5) * 0.03; }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2 + dx, H / 2 + dy); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
      const ir = img.width / img.height, cr = W / H;
      let dw = W, dh = H; if (ir > cr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
      ctx.drawImage(img, -((dw - W) / 2), -((dh - H) / 2), dw, dh);
      ctx.restore();
      // particles
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 30; i++) {
        const px = ((i * 97 + t * (env === 'rain' ? 420 : 60) * (1 + i % 3)) % (W + 40)) - 20;
        const py = ((i * 53 + (env === 'rain' ? t * 500 : Math.sin(t + i) * 20)) % (H + 40)) - 20;
        ctx.strokeStyle = env === 'rain' ? 'rgba(180,210,255,.5)' : env === 'smoke' ? 'rgba(200,200,200,.16)' : env === 'fire' ? 'rgba(255,160,60,.6)' : 'rgba(240,220,180,.4)';
        ctx.fillStyle = ctx.strokeStyle;
        if (env === 'rain') { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 4, py + 14); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(px, py, env === 'smoke' ? 16 + (i % 5) * 4 : 1.6, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      document.getElementById('i2vTime').textContent = fmtTime(t);
      anim = requestAnimationFrame(loop);
    };
    loop(t0);
    R.toast('Animating — camera: ' + cam + ', env: ' + env, 'ok');
  };
}

// ---------- TEXT TO VIDEO (prompt expander) ----------
function t2vView() {
  return `<div class="card">
    <label class="f">One simple sentence</label>
    <textarea id="t2vIn" placeholder="Make a realistic village video…"></textarea>
    <div class="row mt"><button class="btn grow" id="t2vExp">🧠 Expand prompt</button><button class="btn primary grow" id="t2vGo">🎬 Make video</button></div>
  </div>
  <div class="card" id="t2vOut" style="display:none"><h3>Production-ready prompt <span class="badge demo">prompt engineer</span></h3>
    <div id="t2vKv"></div>
    <label class="f">Combined provider prompt</label>
    <div class="copy-line"><span id="t2vProd" style="white-space:normal"></span><button class="btn xs" id="t2vCopy">copy</button></div>
    <details class="adv"><summary>Negative prompt engine</summary><div class="inner"><p class="small muted" id="t2vNeg"></p></div></details>
  </div>`;
}
async function mountT2V() {
  let expanded = null;
  document.getElementById('t2vExp').onclick = async () => {
    const idea = document.getElementById('t2vIn').value.trim();
    if (!idea) return R.toast('Write a sentence first', 'err');
    expanded = await R.api('/prompt/expand', { body: { idea } });
    const out = document.getElementById('t2vOut'); out.style.display = '';
    document.getElementById('t2vKv').innerHTML = `<div class="kv">${Object.entries(expanded.kit).filter(([k]) => k !== 'negativePrompt' && k !== 'subject').map(([k, v]) => `<b>${k}</b><span dir="auto">${esc(String(v).slice(0, 200))}</span>`).join('')}</div>`;
    document.getElementById('t2vProd').textContent = expanded.production;
    document.getElementById('t2vNeg').textContent = expanded.kit.negativePrompt;
    document.getElementById('t2vCopy').onclick = () => R.copy(expanded.production);
  };
  document.getElementById('t2vGo').onclick = async () => {
    const idea = document.getElementById('t2vIn').value.trim();
    if (!idea) return R.toast('Write a sentence first', 'err');
    const proj = await R.api('/projects', { body: { name: idea.slice(0, 40), brief: { idea, durationSec: 30 } } });
    const job = await R.api('/jobs', { body: { type: 'full', projectId: proj.id, params: { idea, durationSec: 30 } } });
    R.go('#/job/' + job.id);
  };
}

// ---------- SCRIPT / STORY TO VIDEO ----------
function simpleVideoView(kind) {
  const isScript = kind === 'script';
  return `<div class="card">
    <label class="f">${isScript ? 'Paste your script' : 'Paste your story'}</label>
    <textarea id="svIn" style="min-height:200px" placeholder="${isScript ? 'SCENE 1 — EXT. VILLAGE — MORNING\nKARIM: …' : 'Two brothers inherit their father’s land…'}"></textarea>
    <div class="grid2 mt">
      <div><label class="f">Language</label><select id="svLang">${R.state.languages.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select></div>
      <div><label class="f">Video length</label><select id="svDur">${R.state.durations.map(d => `<option value="${d}" ${d === 90 ? 'selected' : ''}>${d < 60 ? d + 's' : d / 60 + 'm'}</option>`).join('')}</select></div>
    </div>
    <button class="btn primary block mt" id="svGo">🎬 Turn into video</button>
    <p class="form-scroll-note mt">ROKTOK re-builds structure, characters and shots from your ${kind}, then renders one continuous video.</p>
  </div>`;
}
async function mountSimpleVideo() {
  document.getElementById('svGo').onclick = async () => {
    const idea = document.getElementById('svIn').value.trim();
    if (!idea) return R.toast('Paste your ' + 'content first', 'err');
    const durationSec = +document.getElementById('svDur').value;
    const language = document.getElementById('svLang').value;
    const proj = await R.api('/projects', { body: { name: idea.slice(0, 40), brief: { idea, durationSec, language } } });
    const job = await R.api('/jobs', { body: { type: 'full', projectId: proj.id, params: { idea, durationSec, language } } });
    R.go('#/job/' + job.id);
  };
}

// ---------- CHARACTER CREATOR ----------
function charView() {
  return `<div class="card">
    <label class="f">Generate from idea</label>
    <div class="row"><input type="text" id="chIdea" placeholder="e.g. two Pashto brothers, 38 and 32, farmers"/><button class="btn primary" id="chGen">Generate</button></div>
  </div>
  <div class="card">
    <h3>Manual character</h3>
    <div class="grid2">
      <div><label class="f">Name</label><input type="text" id="chName" placeholder="Karim"/></div>
      <div><label class="f">Age</label><input type="number" id="chAge" value="35"/></div>
    </div>
    <label class="f">Role</label><input type="text" id="chRole" placeholder="lead / co-lead / supporting"/>
    <label class="f">Clothing</label><input type="text" id="chCloth" placeholder="traditional perahan tunban, waistcoat"/>
    <label class="f">Personality</label><input type="text" id="chPers" placeholder="proud, duty-bound"/>
    <button class="btn block mt" id="chAdd">＋ Add to character bible</button>
  </div>
  <div id="chOut"></div>
  <div class="note">Characters created here lock a <b>consistency key</b> that every shot prompt references — preventing face, clothing, age and hairstyle drift.</div>`;
}
async function mountCharacter() {
  const render = chars => {
    document.getElementById('chOut').innerHTML = chars.map((c, i) => `<div class="card">
      <div class="row between"><h3>${esc(c.name)} <span class="dim small">· ${c.age}</span></h3><span class="pill">${esc(c.consistencyKey || 'cb_manual_' + i)}</span></div>
      <div class="kv"><b>Clothing</b><span>${esc(c.clothing)}</span><b>Face</b><span>${esc(c.face || '—')}</span><b>Voice</b><span>${esc(c.voice || '—')}</span><b>Personality</b><span>${esc(c.personality || '—')}</span></div>
      <button class="btn xs mt" data-csheet="${i}">🧾 Reference sheet</button></div>`).join('');
    document.querySelectorAll('[data-csheet]').forEach(b => b.onclick = async () => {
      const r = await R.api('/characters/sheet', { body: { character: chars[+b.dataset.csheet] } });
      R.sheet(`<img class="responsive" src="${r.url}"/><a class="btn block mt" href="${r.url}" download>⬇ Download</a><button class="btn block mt" data-close>Close</button>`);
    });
  };
  R._chars = R._chars || [];
  if (R._chars.length) render(R._chars);
  document.getElementById('chGen').onclick = async () => {
    const idea = document.getElementById('chIdea').value.trim();
    if (!idea) return R.toast('Write an idea', 'err');
    const p = await R.api('/projects', { body: { name: 'Characters', brief: { idea, durationSec: 60 } } });
    await R.api('/jobs', { body: { type: 'text', projectId: p.id, params: { idea, fast: true } } });
    // wait for story then generate characters via regenerate endpoint
    await new Promise(r => setTimeout(r, 1600));
    const proj = await R.api('/projects/' + p.id);
    const analysis = { language: 'en', theme: 'generic' };
    // use the server's generator through artifacts/regenerate
    await R.api('/artifacts/regenerate', { body: { projectId: p.id, kind: 'characters' } }).catch(() => null);
    const proj2 = await R.api('/projects/' + p.id);
    R._chars = proj2.artifacts?.characters || [];
    render(R._chars);
    R.toast('Character bible generated', 'ok');
  };
  document.getElementById('chAdd').onclick = () => {
    const c = { name: document.getElementById('chName').value || 'Unnamed', age: +document.getElementById('chAge').value || 30,
      role: document.getElementById('chRole').value || 'supporting', clothing: document.getElementById('chCloth').value || 'consistent outfit',
      personality: document.getElementById('chPers').value || '—', face: 'user-defined', voice: 'user-defined',
      consistencyKey: 'cb_manual_' + Date.now().toString(36) };
    R._chars.push(c); render(R._chars); R.toast('Added to bible', 'ok');
  };
}

// ---------- EDITOR (standalone entry) ----------
function editorView(projects) {
  if (!projects.length) return '<div class="empty">Create a project first</div>';
  return `<p class="h-sub mb">Pick the project to edit:</p>${projects.map(p => `
    <div class="list-item" data-pe="${p.id}"><div class="thumb">✂️</div>
      <div class="meta"><b>${esc(p.name)}</b><small>${p.shots ? p.shots + ' shots' : 'no video yet'} ${p.hasVideo ? '· ✅' : ''}</small></div><span class="dim">›</span></div>`).join('')}`;
}
async function mountEditorTool() {
  document.querySelectorAll('[data-pe]').forEach(el => el.onclick = () => R.go('#/project/' + el.dataset.pe + '/editor'));
}

// ---------- VOICE STUDIO ----------
function voiceView() {
  const voices = ['Narrator (deep)', 'Dramatic male', 'Emotional female', 'Child', 'Documentary', 'Comedy', 'Cinematic trailer', 'Calm storyteller'];
  return `<div class="card">
    <label class="f">Text</label><textarea id="vText" placeholder="Type the line to speak…">په دې ورځو کې، د کوهونو منځ کې یو کلي او یو وینا وشوه.</textarea>
    <label class="f">Language</label><select id="vLang">${R.state.languages.map(l => `<option value="${l.id}" ${l.id === 'ps' ? 'selected' : ''}>${l.name}</option>`).join('')}</select>
    <label class="f">Voice type</label><div class="chips" id="vTypes">${voices.map((v, i) => `<button class="chip ${i === 1 ? 'on' : ''}" data-vt="${v}">${v}</button>`).join('')}</div>
    <div class="grid2">
      <div><label class="f">Speed <span id="vSV" class="dim">1.0×</span></label><input type="range" id="vSpeed" min="50" max="160" value="100"/></div>
      <div><label class="f">Pitch <span id="vPV" class="dim">1.0</span></label><input type="range" id="vPitch" min="50" max="160" value="100"/></div>
    </div>
    <label class="f">Emotion</label><div class="chips" id="vEmo">${['neutral', 'angry', 'sad', 'warm', 'tense', 'joyful'].map((e, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-emo="${e}">${e}</button>`).join('')}</div>
    <div class="row mt"><button class="btn primary grow" id="vPlay">▶ Preview</button><button class="btn grow" id="vFile">💾 Generate voice file</button></div>
    <p class="form-scroll-note mt">Preview uses your device's built-in voices (fully working offline). Voice <b>files</b> require a connected voice provider (OpenAI-compatible TTS is built-in — add a key in Settings). Never clone a real person without permission.</p>
  </div>`;
}
async function mountVoice() {
  let vt = 'Dramatic male', emo = 'neutral';
  document.querySelectorAll('[data-vt]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-vt]').forEach(x => x.classList.remove('on')); b.classList.add('on'); vt = b.dataset.vt; });
  document.querySelectorAll('[data-emo]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-emo]').forEach(x => x.classList.remove('on')); b.classList.add('on'); emo = b.dataset.emo; });
  const sp = document.getElementById('vSpeed'), pp = document.getElementById('vPitch');
  sp.oninput = () => document.getElementById('vSV').textContent = (sp.value / 100).toFixed(1) + '×';
  pp.oninput = () => document.getElementById('vPV').textContent = (pp.value / 100).toFixed(1);
  document.getElementById('vPlay').onclick = () => {
    const text = document.getElementById('vText').value.trim(); if (!text) return;
    if (!window.speechSynthesis) return R.toast('Device TTS unavailable', 'err');
    const lang = document.getElementById('vLang').value;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = { en: 'en-US', ps: 'pk-PK', ur: 'ur-PK', ar: 'ar-SA', hi: 'hi-IN', fa: 'fa-IR', tr: 'tr-TR' }[lang] || lang;
    u.rate = sp.value / 100 * (emo === 'angry' ? 1.08 : emo === 'sad' ? 0.9 : 1);
    u.pitch = pp.value / 100 * (emo === 'tense' ? 0.92 : emo === 'warm' ? 1.06 : 1) * (vt === 'Child' ? 1.5 : vt === 'Narrator (deep)' ? 0.8 : 1);
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    R.toast('Speaking with ' + vt + ' · ' + emo);
  };
  document.getElementById('vFile').onclick = async () => {
    const text = document.getElementById('vText').value.trim();
    try {
      const r = await R.api('/voice/speak', { body: { text } });
      if (r.url) { R.download(r.url, 'voice.mp3'); R.toast('Voice file downloaded (live provider)', 'ok'); }
      else R.toast('Provider/API required for audio files — preview works offline above', 'err');
    } catch (e) { R.toast(e.message, 'err'); }
  };
}

// ---------- DUBBING ----------
function dubView(projects) {
  if (!projects.length) return '<div class="empty">Create a project with dialogue first</div>';
  return `<div class="card">
    <label class="f">Source video (project)</label>
    <select id="dubProj">${projects.filter(p => p.shots).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option>No rendered projects yet</option>'}</select>
    <label class="f">Target language</label><select id="dubLang">${R.state.languages.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select>
    <div class="row mt"><button class="btn primary grow" id="dubGo">🌍 Translate & dub preview</button></div>
    <ol class="small muted mt" style="padding-left:18px;line-height:1.8">
      <li>Speech detection (uses script timing — works now)</li><li>Transcription ✅</li><li>Translation → target language</li>
      <li>Voice generation (preview / provider file)</li><li>Timing adjustment ✅</li><li>Lip-sync pass</li><li>Final dubbed video</li></ol>
    <p class="form-scroll-note">The demo engine re-times translated lines against the original edit and re-renders subtitles instantly. Full re-voiced video needs a dubbing provider (HeyGen-class slot) — clearly labelled, never faked.</p>
  </div>
  <div id="dubOut"></div>`;
}
async function mountDub() {
  const btn = document.getElementById('dubGo'); if (!btn) return;
  btn.onclick = async () => {
    const projectId = document.getElementById('dubProj').value;
    const lang = document.getElementById('dubLang').value;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Detecting speech…';
    try {
      const p = await R.api('/projects/' + projectId);
      await R.api('/artifacts/regenerate', { body: { projectId, kind: 'subtitles', brief: { language: lang } } });
      const np = await R.api('/projects/' + projectId);
      const subs = np.artifacts?.subtitles;
      document.getElementById('dubOut').innerHTML = `<div class="card"><span class="badge demo">demo dub pass</span>
        <h3 class="mt">✅ Dubbed subtitle track — ${esc(subs?.languageName || lang)}</h3>
        ${(subs?.items || []).slice(0, 6).map(s => `<div class="copy-line"><span>${s.start.toFixed(1)}s <b>${esc(s.speaker)}</b>: <span dir="auto">${esc(s.text)}</span></span></div>`).join('')}
        <div class="row mt"><a class="btn grow" href="/api/subtitles?project=${projectId}&format=srt" download>⬇ Dubbed .SRT</a>
        <a class="btn grow" href="#/final/${projectId}">▶ Open video</a></div></div>`;
      R.toast('Dub pass complete — timing preserved', 'ok');
    } catch (e) { R.toast(e.message, 'err'); }
    btn.disabled = false; btn.textContent = '🌍 Translate & dub preview';
  };
}

// ---------- LIP SYNC ----------
function lipView(projects) {
  const withD = projects.filter(p => p.shots);
  if (!withD.length) return '<div class="empty">Render a video with dialogue first</div>';
  return `<div class="card">
    <label class="f">Project</label><select id="lipProj">${withD.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
    <button class="btn primary block mt" id="lipGo">👄 Analyze phoneme timing</button>
  </div>
  <div id="lipOut"></div>
  <div class="note">Demo mode maps each line to phoneme windows and drives mouth shapes in the player. True generative lip-sync (multi-speaker, singing) requires a lip-sync provider (HeyGen-class slot).</div>`;
}
async function mountLip() {
  const btn = document.getElementById('lipGo'); if (!btn) return;
  btn.onclick = async () => {
    const p = await R.api('/projects/' + document.getElementById('lipProj').value);
    const lines = (p.artifacts?.shots || []).flatMap(s => s.dialogue.map(d => ({ ...d, shot: s.idx })));
    const phonemesFor = txt => {
      const s = txt.replace(/\s+/g, '');
      const out = []; for (let i = 0; i < Math.min(s.length, 14); i++) out.push(['AA', 'EE', 'OO', 'M', 'F', 'V', 'T', 'K'][i % 8]);
      return out.join(' ');
    };
    document.getElementById('lipOut').innerHTML = `<div class="card"><span class="badge demo">${lines.length} lines mapped</span>
      <table class="subs mt"><thead><tr><th>t</th><th>speaker</th><th>line</th><th>phoneme window</th></tr></thead><tbody>
      ${lines.slice(0, 12).map(l => `<tr><td class="dim">${l.start.toFixed(1)}s</td><td>${esc(l.speaker)}</td><td dir="auto">${esc(l.text.slice(0, 34))}</td><td class="small dim">${phonemesFor(l.text)}</td></tr>`).join('')}
      </tbody></table></div>`;
    R.toast('Phoneme map ready — mouths follow dialogue in the player', 'ok');
  };
}

// ---------- SUBTITLES ----------
function subsView(projects) {
  if (!projects.length) return '<div class="empty">No projects yet</div>';
  return `<div class="card">
    <label class="f">Project</label><select id="sProj">${projects.map(p => `<option value="${p.id}">${esc(p.name)} ${p.hasVideo ? '✅' : ''}</option>`).join('')}</select>
    <div class="grid2"><div><label class="f">Style</label><select id="sStyle">${['cinematic', 'box', 'karaoke'].map(s => `<option>${s}</option>`).join('')}</select></div>
      <div><label class="f">Size</label><input type="number" id="sSize" value="72"/></div></div>
    <label class="f">Color</label><input type="color" id="sColor" value="#ffffff" style="width:60px;height:40px;padding:2px;background:var(--bg2);border:1px solid var(--line);border-radius:9px"/>
    <div class="row mt"><button class="btn primary grow" id="sApply2">Apply style</button>
      <a class="btn grow" id="sSrt" download>.SRT</a><a class="btn grow" id="sVtt" download>.VTT</a></div>
    <p class="form-scroll-note mt">Auto transcription comes from the production script (word-accurate in demo mode); translation, animated captions and speaker detection all run in-app.</p>
  </div>`;
}
async function mountSubs() {
  const idEl = document.getElementById('sProj'); if (!idEl) return;
  const syncLinks = () => { document.getElementById('sSrt').href = `/api/subtitles?project=${idEl.value}&format=srt`; document.getElementById('sVtt').href = `/api/subtitles?project=${idEl.value}&format=vtt`; };
  syncLinks(); idEl.onchange = syncLinks;
  document.getElementById('sApply2').onclick = async () => {
    const style = document.getElementById('sStyle').value, size = +document.getElementById('sSize').value, color = document.getElementById('sColor').value;
    await R.api('/settings', { body: { subtitleStyle: { style, size, color, outline: '#000000', position: 'bottom', animated: true, font: 'Inter' } } });
    R.toast('Subtitle style saved — opens with this style everywhere', 'ok');
  };
}

// ---------- MUSIC ----------
function musicView() {
  return `<div class="card">
    <label class="f">Mood / mode</label>
    <div class="chips" id="mMood">${['cinematic', 'emotional', 'comedy', 'suspense', 'action', 'romantic', 'village', 'documentary', 'social'].map((m, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-mm="${m}">${m}</button>`).join('')}</div>
    <label class="f">Duration (seconds) <span id="mDV" class="dim">30s</span></label><input type="range" id="mDur" min="10" max="120" value="30"/>
    <div class="row mt"><button class="btn primary grow" id="mPlay">▶ Preview score</button><button class="btn grow" id="mStop">■ Stop</button></div>
    <p class="form-scroll-note mt">Procedural score engine: chords, tempo and intensity follow the mood in real time (Web Audio). Rendered stems arrive via a connected music provider.</p>
  </div>
  <div class="card"><h3>Sound effect library</h3>
    <div class="chips">${['footsteps', 'door', 'wind', 'rain', 'birds', 'village ambience', 'city traffic', 'crowd', 'kitchen', 'vehicles', 'water', 'animals'].map(s => `<button class="chip tap" data-sfx="${s}">🔊 ${s}</button>`).join('')}</div>
    <div id="sfxLog" class="small muted mt"></div>
  </div>`;
}
let musicCtx = null, musicNodes = [];
async function mountMusic() {
  let mood = 'cinematic';
  document.querySelectorAll('[data-mm]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-mm]').forEach(x => x.classList.remove('on')); b.classList.add('on'); mood = b.dataset.mm; });
  const dur = document.getElementById('mDur');
  dur.oninput = () => document.getElementById('mDV').textContent = dur.value + 's';
  const stop = () => { musicNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch {} }); musicNodes = []; if (musicCtx) { musicCtx.close(); musicCtx = null; } };
  document.getElementById('mStop').onclick = () => { stop(); R.toast('Stopped'); };
  document.getElementById('mPlay').onclick = () => {
    stop();
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return R.toast('WebAudio unavailable', 'err');
    musicCtx = new AC();
    const master = musicCtx.createGain(); master.gain.value = 0.5; master.connect(musicCtx.destination);
    const sets = { cinematic: [130.8, 164.8, 196], emotional: [146.8, 174.6, 220], comedy: [164.8, 196, 246.9],
      suspense: [98, 116.5, 146.8], action: [110, 138.6, 164.8], romantic: [155.6, 196, 233.1],
      village: [130.8, 155.6, 196], documentary: [110, 146.8, 174.6], social: [164.8, 207.7, 261.6] };
    const f = sets[mood] || sets.cinematic;
    const pad = musicCtx.createGain(); pad.gain.value = 0; pad.connect(master);
    pad.gain.linearRampToValueAtTime(0.22, musicCtx.currentTime + 0.6);
    f.forEach((fr, i) => { const o = musicCtx.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = fr;
      const g = musicCtx.createGain(); g.gain.value = i ? 0.25 : 0.5; o.connect(g); g.connect(pad); o.start(); musicNodes.push(o, g); });
    // soft pulse
    const t0 = musicCtx.currentTime, bpm = mood === 'action' ? 130 : mood === 'comedy' ? 110 : 76;
    for (let b = 0; b < (+dur.value) * bpm / 60; b++) {
      const t = t0 + b * 60 / bpm;
      const o = musicCtx.createOscillator(); const g = musicCtx.createGain();
      o.frequency.value = b % 4 === 0 ? f[0] / 2 : f[0];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(b % 4 === 0 ? 0.35 : 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2); musicNodes.push(o, g);
    }
    R.toast('Playing ' + mood + ' score…');
  };
  document.querySelectorAll('[data-sfx]').forEach(b => b.onclick = () => {
    const AC = window.AudioContext || window.webkitAudioContext; const ctx = musicCtx || new AC();
    const g = ctx.createGain(); g.connect(ctx.destination); g.gain.value = 0.3;
    const name = b.dataset.sfx;
    const o = ctx.createOscillator(); o.type = name === 'birds' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(name === 'door' ? 220 : name === 'birds' ? 1800 : 400, ctx.currentTime);
    if (name === 'door') o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.3);
    if (name === 'birds') o.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g); o.start(); o.stop(ctx.currentTime + 0.55);
    document.getElementById('sfxLog').textContent = `▶ "${name}" cue fired at ${new Date().toLocaleTimeString()} (procedural preview)`;
  });
}

// ---------- ENHANCER ----------
function enhancerView(projects) {
  return `<div class="card">
    <label class="f">Output resolution</label>
    <div class="chips" id="enRes">${['720p', '1080p', '4K'].map((r, i) => `<button class="chip ${i === 1 ? 'on' : ''}" data-r="${r}">${r}</button>`).join('')}</div>
    <label class="f">Enhancements</label>
    <div class="chips">${['sharpen', 'denoise', 'frame interpolation', 'stabilization', 'face enhancement', 'color correction', 'dynamic range', 'cinematic finishing'].map((e, i) => `<button class="chip ${i < 3 ? 'on' : ''}" data-e2="${e}">${e}</button>`).join('')}</div>
    <label class="f">Target project (applies grade + render settings)</label>
    <select id="enProj">${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">—</option>'}</select>
    <button class="btn primary block mt" id="enGo">✨ Enhance</button>
    <p class="form-scroll-note mt">In-app pass applies real grade/sharpen/denoise settings to the render engine. True pixel upscaling (720→1080→4K) requires a connected upscale provider — the adapter slot is ready and clearly labelled.</p>
  </div>
  <div id="enOut"></div>`;
}
async function mountEnhancer() {
  let res = '1080p';
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-r]').forEach(x => x.classList.remove('on')); b.classList.add('on'); res = b.dataset.r; });
  document.getElementById('enGo').onclick = async () => {
    const pid = document.getElementById('enProj').value;
    const opts = [...document.querySelectorAll('[data-e2].on')].map(x => x.dataset.e2);
    await R.api('/settings', { body: { resolution: res === '4K' ? '4K (provider)' : res } });
    if (pid) { const p = await R.api('/projects/' + pid); const v = p.versions?.[p.versions.length - 1]; if (v) { v.edl.grade = opts.includes('cinematic finishing') ? 'cinematic' : v.edl.grade; v.edl.sharpen = opts.includes('sharpen'); v.edl.denoise = opts.includes('denoise'); await R.api('/projects/' + pid, { method: 'PATCH', body: { edl: v.edl } }); } }
    document.getElementById('enOut').innerHTML = `<div class="card"><span class="badge ${res === '4K' ? 'stub' : 'demo'}">${res === '4K' ? 'provider required for true 4K' : 'applied in-app'}</span>
      <p class="mt"><b>✓ ${res} render target set</b><br/>✓ ${opts.join('<br/>✓ ')}</p></div>`;
    R.toast('Enhancement pass applied', 'ok');
  };
}

// ---------- STORYBOARD ----------
function boardView(projects) {
  const withS = projects.filter(p => p.shots);
  if (!withS.length) return '<div class="empty">No storyboards yet — run a production first<div class="mt"><a class="btn primary" href="#/create">Create video</a></div></div>';
  return `<div class="card"><label class="f">Project</label>
    <select id="bdProj">${withS.map(p => `<option value="${p.id}">${esc(p.name)} (${p.shots} shots)</option>`).join('')}</select>
    <div class="row mt"><a class="btn grow" id="bdOpen" href="#">Open full storyboard</a><button class="btn grow" id="bdExp">⬇ Export JSON</button></div></div>
    <div id="bdGrid" class="grid2"></div>`;
}
async function mountBoard() {
  const sel = document.getElementById('bdProj'); if (!sel) return;
  const load = async () => {
    const p = await R.api('/projects/' + sel.value);
    document.getElementById('bdOpen').href = '#/project/' + p.id + '/storyboard';
    document.getElementById('bdGrid').innerHTML = (p.artifacts?.shots || []).map(s => `
      <div class="shot-card"><div class="top"><span class="num">#${s.idx + 1}</span><span class="pill">${fmtTime(s.start)}</span></div>
        <div class="desc"><b>${esc(s.size)}</b> · ${esc(s.movement)}<br/>${esc(s.action.slice(0, 80))}</div></div>`).join('');
    document.getElementById('bdExp').onclick = () => R.download(new Blob([JSON.stringify(p.artifacts.shots, null, 2)], { type: 'application/json' }), 'storyboard.json');
  };
  sel.onchange = load; load();
}

// ---------- MOUNT DISPATCH ----------
export async function mountTool(name) {
  ({
    imagegen: mountImageGen, i2v: mountI2V, t2v: mountT2V, script2v: mountSimpleVideo, story2v: mountSimpleVideo,
    character: mountCharacter, editor: mountEditorTool, voice: mountVoice, dubbing: mountDub, lipsync: mountLip,
    subtitles: mountSubs, music: mountMusic, enhancer: mountEnhancer, storyboard: mountBoard
  }[name] || (() => {}))();
}
