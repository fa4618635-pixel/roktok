// ROKTOK — Create wizard (universal video creator) — one screen, beginner-friendly
import { R, esc } from './app.js';

const PLATFORMS = [
  { id: 'tiktok', icon: '🎵', name: 'TikTok', sub: '9:16 · 1080×1920 · 30fps' },
  { id: 'instagram', icon: '📸', name: 'Instagram Reels', sub: '9:16 · 1080×1920 · 30fps' },
  { id: 'facebook', icon: '👥', name: 'Facebook Reels', sub: '9:16 · 1080×1920 · 30fps' },
  { id: 'youtube', icon: '▶️', name: 'YouTube', sub: '16:9 · 1920×1080 · 24fps' }
];

export async function renderCreate() {
  const st = R.state;
  const quick = R.query?.get('quick');
  const w = R.wiz = R.wiz || {};
  w.durationSec = w.durationSec || (quick ? 60 : 180);
  w.language = w.language || 'auto';
  w.style = w.style || 'cinematic';
  w.platform = w.platform || 'tiktok';
  w.autoEdit = w.autoEdit !== false;
  w.aspect = w.aspect || (['youtube'].includes(w.platform) ? '16:9' : '9:16');
  w.idea = w.idea ?? '';
  w.advanced = w.advanced || {};
  if (R.query?.get('make')) w.idea = w.idea || '';

  const durations = st.durations;
  return `
  <div class="row between mb">
    <h1 style="margin:0">${quick ? '⚡ Quick Create' : '🎬 Create Video'}</h1>
    <span class="badge demo">Universal creator</span>
  </div>
  <p class="h-sub mb">Write your idea. ROKTOK's AI Director handles story → script → characters → shots → voices → music → subtitles → <b>professional auto-edit</b> → one final video.</p>

  <div class="card">
    <label class="f">YOUR IDEA <span class="dim">(one sentence is enough — a script works too)</span></label>
    <textarea id="ideaBox" placeholder="e.g. Create a 3-minute ultra-realistic cinematic Pashto village drama about two brothers arguing over their father's land, with consistent characters, natural dialogue, drone shots, subtitles and a professional ending…">${esc(w.idea)}</textarea>
    <div class="row mt" style="gap:8px">
      <button class="btn sm" id="attachBtn">📎 Attach image / reference</button>
      <span class="pill" id="attachState">${w.attached ? '📎 1 reference attached' : 'no attachments'}</span>
    </div>
    <input type="file" id="attachInput" accept="image/*,audio/*,video/*" hidden/>
  </div>

  <div class="card">
    <h3>📱 Publish to</h3>
    <p class="h-sub">Format, resolution, bitrate, pacing and captions are chosen automatically for your platform.</p>
    <div class="grid2 mt" id="platGrid">
      ${PLATFORMS.map(p => `
        <button type="button" class="tool ${w.platform === p.id ? 'on' : ''}" data-p="${p.id}">
          <span class="ti">${p.icon}</span><span>${p.name}</span>
          <span class="dim" style="font-weight:700">${p.sub}</span>
          ${w.platform === p.id ? '<span class="badge demo" style="margin-top:2px">selected</span>' : ''}
        </button>`).join('')}
    </div>
  </div>

  <div class="card">
    <div class="row between">
      <div><h3 style="margin:0 0 4px">🤖 AUTO EDIT</h3>
        <span class="badge ${w.autoEdit ? 'live' : 'stub'}" id="aeState">${w.autoEdit ? 'ON — fully automatic' : 'OFF — baseline edit only'}</span></div>
      <button class="btn ${w.autoEdit ? 'primary' : ''} sm" id="aeToggle">${w.autoEdit ? 'ON' : 'OFF'}</button>
    </div>
    <p class="h-sub mt">When <b>ON</b>, ROKTOK makes <b>every editing decision</b> automatically from your script and platform: professional cuts &amp; transitions, automatic pacing, removal of dead air and awkward pauses, cinematic color correction with natural skin tones, voice clarity, background music auto-balanced with dialogue, sound effects, correctly-timed subtitles, framing/safe areas and complete export settings. The result is upload-ready — no CapCut or manual editing needed.</p>
  </div>

  <div class="card">
    <h3>⏱ Video length</h3>
    <div class="chips" id="durChips">
      ${durations.map(d => `<button class="chip ${w.durationSec === d ? 'on' : ''}" data-dur="${d}">${d < 60 ? d + ' seconds' : (d / 60) + ' minute' + (d > 60 ? 's' : '')}</button>`).join('')}
    </div>
  </div>

  <div class="grid2">
    <div class="card" style="margin:0">
      <h3>🗣 Language</h3>
      <select id="langSel">
        <option value="auto" ${w.language === 'auto' ? 'selected' : ''}>Auto-detect from idea</option>
        ${st.languages.map(l => `<option value="${l.id}" ${w.language === l.id ? 'selected' : ''}>${l.name} ${l.performanceMode ? '· native mode' : ''}</option>`).join('')}
      </select>
    </div>
    <div class="card" style="margin:0">
      <h3>🎞 Format <span class="dim small">(auto)</span></h3>
      <select id="aspectSel">
        ${['9:16', '16:9', '1:1', '4:3'].map(a => `<option value="${a}" ${w.aspect === a ? 'selected' : ''}>${a}${a === '9:16' ? ' · TikTok/Reels' : a === '16:9' ? ' · YouTube' : ''}</option>`).join('')}
      </select>
    </div>
  </div>

  <div class="card">
    <h3>🎨 Style</h3>
    <div class="chips" id="styleChips">
      ${st.styles.map(s => `<button class="chip ${w.style === s.id ? 'on' : ''}" data-style="${s.id}">${s.name}</button>`).join('')}
    </div>
  </div>

  <details class="adv" ${w.showAdv ? 'open' : ''} id="advBox">
    <summary>Advanced Controls</summary>
    <div class="inner">
      <div class="grid2">
        <div><label class="f">Emotional intensity</label>
          <select id="intSel">${['auto', 'low', 'medium', 'high'].map(v => `<option ${w.advanced.intensity === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="f">Realism</label>
          <select id="realSel">${['auto', 'ultra', 'natural', 'stylized'].map(v => `<option ${w.advanced.realism === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div><label class="f">Cinematic mode</label>
        <select id="cineSel"><option value="auto" ${(w.advanced.cinematic ?? 'auto') === 'auto' ? 'selected' : ''}>auto</option><option value="on" ${w.advanced.cinematic === 'on' ? 'selected' : ''}>on</option><option value="off" ${w.advanced.cinematic === 'off' ? 'selected' : ''}>off</option></select></div>
      <label class="row mt" style="gap:8px;font-size:13.5px"><input type="checkbox" id="subChk" ${w.advanced.subtitles !== false ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Burn subtitles</label>
      <label class="row mt" style="gap:8px;font-size:13.5px"><input type="checkbox" id="musicChk" ${w.advanced.music !== false ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Generate music & sound effects</label>
      <label class="row mt" style="gap:8px;font-size:13.5px"><input type="checkbox" id="hookChk" ${w.advanced.hook !== false ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Strong emotional hook (first 1–3s)</label>
    </div>
  </details>

  <div class="card mt">
    <div class="row between">
      <div><div class="small muted">Estimated generation cost</div><b id="estBox"><span class="spin"></span> calculating…</b></div>
      <span class="badge ${st.settings.budget === 'free' ? 'demo' : 'vio'}" id="budBadge">${st.settings.budget}</span>
    </div>
  </div>

  <button class="btn primary big block" id="genBtn">🎬 MAKE EVERYTHING <span style="font-weight:400;font-size:13px">+ AUTO EDIT</span></button>
  <p class="center small dim mt">One idea → story → script → characters → storyboard → shots → voices → music → subtitles → <b>professional auto-edit</b> → <b>one upload-ready video</b></p>
  `;
}

export async function mountCreate() {
  const w = R.wiz;
  const q = s => document.querySelector(s);

  // ---- platform picker (drives aspect + export preset) ----
  const setPlatform = (id, touched) => {
    w.platform = id;
    if (touched) w.platTouched = true;
    const aspect = id === 'youtube' ? '16:9' : '9:16';
    w.aspect = aspect;
    const sel = q('#aspectSel'); if (sel) sel.value = aspect;
    document.querySelectorAll('[data-p]').forEach(x => {
      x.classList.toggle('on', x.dataset.p === id);
      const badge = x.querySelector('.badge');
      if (x.dataset.p === id && !badge) x.insertAdjacentHTML('beforeend', '<span class="badge demo" style="margin-top:2px">selected</span>');
      if (x.dataset.p !== id && badge) badge.remove();
    });
  };
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => setPlatform(b.dataset.p, true));

  // ---- AUTO EDIT toggle ----
  const aeBtn = q('#aeToggle');
  aeBtn.onclick = () => {
    w.autoEdit = !w.autoEdit;
    aeBtn.textContent = w.autoEdit ? 'ON' : 'OFF';
    aeBtn.classList.toggle('primary', w.autoEdit);
    q('#aeState').textContent = w.autoEdit ? 'ON — fully automatic' : 'OFF — baseline edit only';
    q('#aeState').className = 'badge ' + (w.autoEdit ? 'live' : 'stub');
    R.toast(w.autoEdit ? 'AUTO EDIT on — ROKTOK makes every editing decision' : 'AUTO EDIT off — baseline professional edit only');
  };

  const saveIdea = () => { w.idea = q('#ideaBox').value; };
  const detectPlatform = () => {
    if (w.platTouched) return;
    const t = (w.idea || '').toLowerCase();
    if (/tiktok/.test(t)) setPlatform('tiktok');
    else if (/youtube|\byt\b/.test(t)) setPlatform('youtube');
    else if (/instagram|reels/.test(t)) setPlatform('instagram');
    else if (/facebook/.test(t)) setPlatform('facebook');
  };
  q('#ideaBox').addEventListener('input', e => { w.idea = e.target.value; detectPlatform(); });
  detectPlatform();

  document.querySelectorAll('[data-dur]').forEach(b => b.onclick = () => { w.durationSec = +b.dataset.dur; refresh(); });
  document.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { w.style = b.dataset.style; refresh(); });
  q('#langSel').onchange = e => w.language = e.target.value;
  q('#aspectSel').onchange = e => { w.aspect = e.target.value; };
  q('#advBox').addEventListener('toggle', e => w.showAdv = e.target.open);
  const bind = (id, key) => { const el = q(id); if (el) el.onchange = () => { w.advanced[key] = el.type === 'checkbox' ? el.checked : el.value; }; };
  bind('#intSel', 'intensity'); bind('#realSel', 'realism'); bind('#cineSel', 'cinematic');
  bind('#subChk', 'subtitles'); bind('#musicChk', 'music'); bind('#hookChk', 'hook');

  function refresh() {
    document.querySelectorAll('[data-dur]').forEach(b => b.classList.toggle('on', +b.dataset.dur === w.durationSec));
    document.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('on', b.dataset.style === w.style));
    estimate();
  }
  async function estimate() {
    saveIdea();
    try {
      const e = await R.api('/estimate', { body: { type: 'full', durationSec: w.durationSec, budget: R.state.settings.budget } });
      q('#estBox').innerHTML = `<b>$${e.usd.toFixed(3)}</b> <span class="small dim">· ${esc(e.note)}</span>`;
    } catch { q('#estBox').textContent = '—'; }
  }
  estimate();

  // attachments
  q('#attachBtn').onclick = () => q('#attachInput').click();
  q('#attachInput').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 30e6) return R.toast('Max 30MB', 'err');
    const dataUrl = await fileToDataUrl(f);
    w.attached = { name: f.name, dataUrl };
    q('#attachState').textContent = '📎 ' + f.name + ' attached';
    R.toast('Reference attached — it will seed character/style identity', 'ok');
  };

  q('#genBtn').onclick = async () => {
    saveIdea();
    if (!w.idea.trim()) { R.toast('Write your idea first ✍️', 'err'); q('#ideaBox').focus(); return; }
    if (R.state.settings.budget !== 'free' && R.state.settings.confirmPaidCalls) {
      const est = await R.api('/estimate', { body: { type: 'full', durationSec: w.durationSec, budget: R.state.settings.budget } });
      if (est.usd > 0 && R.state.providers.some(p => p.status === 'live')) {
        const ok = await confirmSheet(`This run may cost about $${est.usd.toFixed(3)} with your connected providers. Continue?`);
        if (!ok) return;
      }
    }
    try {
      const proj = await R.api('/projects', { body: { name: nameFromIdea(w.idea), brief: {
        idea: w.idea, durationSec: w.durationSec, language: w.language, style: w.style, aspect: w.aspect,
        platform: w.platform, autoEdit: w.autoEdit !== false,
        budget: R.state.settings.budget } } });
      if (w.attached) await R.api(`/projects/${proj.id}/assets`, { body: { dataUrl: w.attached.dataUrl, name: 'reference_' + w.attached.name.replace(/\W+/g, '') } });
      const job = await R.api('/jobs', { body: { type: 'full', projectId: proj.id, params: {
        idea: w.idea, durationSec: w.durationSec, language: w.language, style: w.style, aspect: w.aspect,
        platform: w.platform, autoEdit: w.autoEdit !== false,
        subtitles: w.advanced.subtitles, music: w.advanced.music, hook: w.advanced.hook } } });
      R.go('#/job/' + job.id);
    } catch (e) { R.toast(e.message, 'err'); }
  };
}
function nameFromIdea(idea) {
  const s = idea.trim().split(/[.!?\n]/)[0].replace(/^(create|make|generate|a|an|the|video of|video about)\s+/i, '');
  return (s.slice(0, 46) || 'New Production').replace(/\s+/g, ' ');
}
function fileToDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
function confirmSheet(msg) {
  return new Promise(res => {
    R.sheet(`<h3>💰 Cost confirmation</h3><p class="h-sub">${esc(msg)}</p>
      <div class="row mt"><button class="btn grow" data-close id="cNo">Cancel</button><button class="btn primary grow" id="cYes">Yes, generate</button></div>`,
      root => { root.querySelector('#cYes').onclick = () => { R.closeSheet(); res(true); };
        root.querySelector('#cNo').onclick = () => { R.closeSheet(); res(false); }; });
  });
}
