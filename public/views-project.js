// ROKTOK — My Projects + Project Workspace (story, script, characters, locations, storyboard, subtitles, audio, editor, exports)
import { R, esc, fmtTime } from './app.js';
import { RoktokPlayer } from './renderer.js';

// ================= PROJECTS LIST =================
export async function renderProjects() {
  const list = await R.api('/projects');
  return `<div class="row between mb"><h1 style="margin:0">My Projects</h1><button class="btn primary sm" id="newProj">＋ New</button></div>
  ${list.length ? list.map(p => `
    <div class="list-item" data-open="${p.id}">
      <div class="thumb">${p.hasVideo ? '🎬' : '📁'}</div>
      <div class="meta"><b>${esc(p.name)}</b>
        <small>${p.duration ? p.duration + 's · ' : ''}${p.shots ? p.shots + ' shots · ' : ''}${(p.language || 'en').toUpperCase()} · ${new Date(p.updatedAt).toLocaleDateString()}</small></div>
      <button class="btn xs" data-menu="${p.id}">⋮</button>
    </div>`).join('') : `
    <div class="empty"><div class="big">📁</div>No projects yet.<div class="mt"><a class="btn primary" href="#/create">Create your first video</a></div></div>`}`;
}
export async function mountProjects() {
  document.querySelectorAll('[data-open]').forEach(el => el.onclick = e => {
    if (e.target.closest('[data-menu]')) return;
    R.go('#/project/' + el.dataset.open);
  });
  document.querySelectorAll('[data-menu]').forEach(b => b.onclick = e => { e.stopPropagation(); projMenu(b.dataset.menu); });
  const np = document.getElementById('newProj');
  if (np) np.onclick = async () => { const p = await R.api('/projects', { body: { name: 'New Project' } }); R.go('#/project/' + p.id); };
}
function projMenu(id) {
  R.sheet(`<h3>Project actions</h3>
    <div class="grid2">
      <button class="btn block" data-a="open">📂 Open</button>
      <button class="btn block" data-a="rename">✏️ Rename</button>
      <button class="btn block" data-a="dup">🧬 Duplicate</button>
      <a class="btn block" href="/api/projects/${id}/export">⬇️ Export JSON</a>
      <button class="btn block" data-a="create">🎬 Continue to video</button>
      <button class="btn danger block" data-a="del">🗑 Delete</button>
    </div>`,
    root => root.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a; R.closeSheet();
      if (a === 'open') R.go('#/project/' + id);
      if (a === 'create') R.go('#/create');
      if (a === 'dup') { const p = await R.api('/projects/' + id + '/duplicate', { body: {} }); R.toast('Duplicated', 'ok'); R.rerender(); }
      if (a === 'rename') renameSheet(id);
      if (a === 'del') R.confirm('Delete this project permanently?', async () => { await R.api('/projects/' + id, { method: 'DELETE' }); R.toast('Deleted', 'ok'); R.rerender(); }, 'Delete');
    }));
}
function renameSheet(id) {
  R.sheet(`<h3>Rename project</h3><input type="text" id="rnInput" placeholder="Project name"/>
    <div class="row mt"><button class="btn grow" data-close>Cancel</button><button class="btn primary grow" id="rnSave">Save</button></div>`,
    root => root.querySelector('#rnSave').onclick = async () => {
      const name = root.querySelector('#rnInput').value.trim(); if (!name) return;
      await R.api('/projects/' + id, { method: 'PATCH', body: { name } });
      R.closeSheet(); R.toast('Renamed', 'ok'); R.rerender();
    });
}

// ================= WORKSPACE =================
const TABS = [['overview', '🏠 Overview'], ['script', '📜 Script'], ['characters', '🧑‍🎨 Cast'], ['locations', '📍 Locations'],
  ['storyboard', '🎞 Storyboard'], ['subtitles', '💬 Subtitles'], ['audio', '🎵 Audio'], ['editor', '✂️ Editor'], ['exports', '📦 Export']];

export async function renderProject(id, tab) {
  let p;
  try { p = await R.api('/projects/' + id); } catch { return '<div class="empty">Project not found</div>'; }
  R._proj = p;
  const a = p.artifacts;
  const tabs = TABS.filter(t => a || ['overview'].includes(t[0]));
  let body = '';
  if (!a && tab !== 'overview') tab = 'overview';
  if (tab === 'overview') body = overviewTab(p);
  else if (tab === 'script') body = scriptTab(p);
  else if (tab === 'characters') body = castTab(p);
  else if (tab === 'locations') body = locTab(p);
  else if (tab === 'storyboard') body = boardTab(p);
  else if (tab === 'subtitles') body = subsTab(p);
  else if (tab === 'audio') body = audioTab(p);
  else if (tab === 'editor') body = editorTab(p);
  else if (tab === 'exports') body = exportsTab(p);

  return `<div class="row between mb"><h1 style="margin:0;font-size:20px">${esc(p.name)}</h1>
    <button class="btn sm" id="renameBtn">✏️</button></div>
  <div class="tabs">${tabs.map(([k, n]) => `<a href="#/project/${id}/${k}" class="${k === tab ? 'on' : ''}">${n}</a>`).join('')}</div>
  ${body}`;
}

function overviewTab(p) {
  const a = p.artifacts;
  if (!a) return `<div class="card"><h3>Empty project</h3>
    <p class="h-sub">Give ROKTOK an idea and the full pipeline fills this project with story, cast, locations, shots, audio, subtitles and a final render.</p>
    <a class="btn primary block mt" href="#/create">🎬 CREATE VIDEO</a></div>
    ${p.assets?.uploads?.length ? `<div class="card"><h3>📎 Attachments</h3>${p.assets.uploads.map(u => `<div class="small">${esc(u.name)}</div>`).join('')}</div>` : ''}`;
  const s = a.story || {}, f = a.final || {};
  return `<div class="card">
    <div class="row between"><h3>${esc(s.title || p.name)}</h3><span class="badge ${a.qc?.pass ? 'live' : 'stub'}">${a.qc?.pass ? 'QC PASS' : 'DRAFT'}</span></div>
    <p class="h-sub">${esc(s.logline || '')}</p>
    <div class="kv-inline mt">
      <span class="pill">⏱ ${p.brief.durationSec}s</span><span class="pill">🗣 ${esc(a.analysis?.languageName || '')}</span>
      <span class="pill">🎨 ${esc(a.analysis?.style || '')}</span><span class="pill">🎞 ${f.shotCount || a.shots?.length} shots</span>
      <span class="pill">📐 ${f.aspect || ''}</span><span class="pill">🎬 ${esc(s.genre || '')}</span></div>
    ${f.renderedAt ? `<a class="btn primary block mt" href="#/final/${p.id}">▶ OPEN FINAL VIDEO</a>` : `<button class="btn primary block mt" id="runFull">🎬 MAKE EVERYTHING</button>`}
  </div>
  <div class="grid2">
    <div class="card"><h3>🪝 Hook</h3><p class="small">${esc((a.hooks?.[0]?.text) || '—')}</p></div>
    <div class="card"><h3>🧪 QC</h3><p class="small">${esc(a.qc?.summary || '—')}</p></div>
  </div>
  <div class="card"><h3>📜 Story beats</h3>${(s.beats || []).map((b, i) => `<div class="small" style="padding:5px 0;border-bottom:1px dashed var(--line)"><b class="dim">${i + 1}.</b> ${esc(b)}</div>`).join('')}</div>`;
}
function scriptTab(p) {
  const sc = p.artifacts?.script?.scenes || [];
  return sc.map(s => `<div class="shot-card">
    <div class="top"><span class="num">${esc(s.slug)}</span><span class="pill">${s.durationSec}s</span></div>
    <div class="desc">${esc(s.action)}</div>
    ${(s.lines || []).map(l => `<div class="small" style="margin-top:7px"><b>${esc(l.speaker)}</b> <span class="dim">(${esc(l.emotion)})</span><div dir="auto">${esc(l.text)}</div></div>`).join('')}
  </div>`).join('') || '<div class="empty">No script yet</div>';
}
function castTab(p) {
  const cs = p.artifacts?.characters || [];
  return `<div class="row mb"><span class="badge vio">Character Bible</span><span class="small muted">identity locked across every shot</span></div>` +
    cs.map((c, i) => `<div class="card">
      <div class="row between"><h3>${esc(c.name)} <span class="dim small">· ${c.age} · ${esc(c.role)}</span></h3>
        <span class="pill">${esc(c.consistencyKey || '')}</span></div>
      <div class="kv">
        <b>Face</b><span>${esc(c.face)}</span><b>Hair</b><span>${esc(c.hairstyle)}</span><b>Skin</b><span>${esc(c.skinTone)}</span>
        <b>Build</b><span>${esc(c.bodyType)}</span><b>Clothing</b><span>${esc(c.clothing)}</span><b>Shoes</b><span>${esc(c.shoes)}</span>
        <b>Accessories</b><span>${esc(c.accessories)}</span><b>Personality</b><span>${esc(c.personality)}</span>
        <b>Voice</b><span>${esc(c.voice)}</span><b>Accent</b><span>${esc(c.accent)}</span><b>Emotion</b><span>${esc(c.emotionalTraits)}</span>
      </div>
      <div class="row mt" style="gap:8px">
        <button class="btn xs" data-sheet="${i}">🧾 Reference sheet</button>
        <button class="btn xs" data-upload-ref="${i}">🖼 Use my photo as identity</button>
      </div>
      ${c.refImage ? `<img class="responsive mt" src="${c.refImage}" alt="ref"/>` : ''}
    </div>`).join('');
}
function locTab(p) {
  const ls = p.artifacts?.locations || [];
  return ls.map(l => `<div class="card"><h3>${esc(l.name)}</h3><div class="kv">
    <b>Architecture</b><span>${esc(l.architecture)}</span><b>Colors</b><span>${esc(l.colors)}</span><b>Weather</b><span>${esc(l.weather)}</span>
    <b>Lighting</b><span>${esc(l.lighting)}</span><b>Furniture</b><span>${esc(l.furniture)}</span><b>Objects</b><span>${esc(l.objects)}</span>
    <b>Geography</b><span>${esc(l.geography)}</span><b>Period</b><span>${esc(l.period)}</span><b>Atmosphere</b><span>${esc(l.atmosphere)}</span></div></div>`).join('')
    || '<div class="empty">No locations</div>';
}
function boardTab(p) {
  const shots = p.artifacts?.shots || [];
  return `<div class="row mb wrap"><span class="badge vio">${shots.length} shots</span>
    <button class="btn xs" id="expBoard">⬇ Export shot list (JSON)</button>
    <a class="btn xs" href="#/final/${p.id}">▶ Preview cut</a></div>` +
    shots.map(s => `<div class="shot-card">
      <div class="top"><span class="num">SHOT ${String(s.idx + 1).padStart(2, '0')} · ${fmtTime(s.start)}</span>
        <span class="pill">${s.size}</span></div>
      <div class="desc">${esc(s.action)}</div>
      <div class="kv">
        <b>Camera</b><span>${esc(s.cameraPrompt)}</span>
        <b>Expression</b><span>${esc(s.expression)}</span><b>Body</b><span>${esc(s.bodyLanguage)}</span>
        <b>Light</b><span>${esc(s.lighting)}</span><b>Sound</b><span>${esc((s.soundDesign || []).join(', '))}</span>
        <b>Music</b><span>intensity ${s.musicIntensity}/1 · ${esc(s.pacing)}</span>
        <b>Transition</b><span>${esc(s.transition)}</span>
      </div>
      <details class="mt"><summary class="small dim" style="cursor:pointer">Provider prompt</summary>
        <p class="small muted" dir="auto" style="user-select:text">${esc(s.providerPrompt)}</p></details>
      ${s.regenerated ? '<span class="badge stub mt">regenerated by QC</span>' : ''}
    </div>`).join('');
}
function subsTab(p) {
  const sub = p.artifacts?.subtitles;
  if (!sub) return '<div class="empty">No subtitles</div>';
  return `<div class="row wrap mb"><span class="badge demo">${sub.items.length} cues · ${esc(sub.languageName)}</span>
    <a class="btn xs" href="/api/subtitles?project=${p.id}&format=srt" download>.SRT</a>
    <a class="btn xs" href="/api/subtitles?project=${p.id}&format=vtt" download>.VTT</a>
    <button class="btn xs primary" id="saveSubs">💾 Save edits</button></div>
    <table class="subs"><thead><tr><th>#</th><th>Time</th><th>Speaker</th><th>Text</th></tr></thead><tbody>
    ${sub.items.map((s, i) => `<tr><td class="dim">${i + 1}</td><td class="dim" style="white-space:nowrap">${s.start.toFixed(1)}–${s.end.toFixed(1)}</td>
      <td class="small">${esc(s.speaker)}</td><td><textarea data-sub="${i}" dir="auto">${esc(s.text)}</textarea></td></tr>`).join('')}
    </tbody></table>
    <div class="note mt">Word timing: ${esc(sub.wordTiming)}. Burned-in rendering uses these cues live in the player.</div>`;
}
function audioTab(p) {
  const au = p.artifacts?.audio;
  if (!au) return '<div class="empty">No audio plan</div>';
  return `<div class="card"><h3>🎵 Score — ${esc(au.music.title)}</h3>
    <p class="h-sub">Genre: <b>${esc(au.music.genre)}</b> · ${esc(au.music.autoFit)} · modes: ${au.music.modes.join(', ')}</p>
    ${au.music.segments.map(sg => `<div class="copy-line"><span>${fmtTime(sg.start)} → ${fmtTime(sg.start + sg.dur)} · <b>${esc(sg.mood)}</b> · intensity ${sg.intensity}</span></div>`).join('')}
    <span class="badge demo mt">${esc(au.music.providerStatus)}</span></div>
  <div class="card"><h3>🌬 Ambience beds</h3><div class="wrap">${au.ambience.map(a2 => `<span class="pill">${esc(a2)}</span>`).join('')}</div>
    <label class="f">Mix levels (dB)</label>
    <div class="kv"><b>Dialogue</b><span>${au.levels.dialogue} dB</span><b>Music</b><span>${au.levels.music} dB</span>
      <b>SFX</b><span>${au.levels.sfx} dB</span><b>Ambience</b><span>${au.levels.ambience} dB</span></div></div>
  <div class="card"><h3>🔊 SFX cues (${au.sfx.length})</h3>
    ${au.sfx.slice(0, 24).map(f => `<div class="copy-line"><span>${fmtTime(f.t)} · ${esc(f.name)}</span></div>`).join('')}
    ${au.sfx.length > 24 ? `<div class="small dim">+ ${au.sfx.length - 24} more…</div>` : ''}</div>
  <div class="card"><h3>🗣 Voice plan</h3>${(p.artifacts?.voicePlan || []).map(v => `<div class="copy-line"><span><b>${esc(v.name)}</b> — ${esc(v.voice)} · ${esc(v.accent)}</span></div>`).join('')}</div>`;
}
function editorTab(p) {
  const a = p.artifacts; if (!a) return '<div class="empty">No video</div>';
  const shots = a.shots || [];
  const edl = p.versions?.[p.versions.length - 1]?.edl || { shotIds: shots.map(s => s.id), cuts: [], speed: 1, subtitlesOn: true };
  const cutSet = new Set(edl.cuts || []);
  const ep = a.editPlan;
  return `<div class="card">
    <div class="row between"><h3 style="margin:0">🤖 AUTO EDIT</h3>
      <span class="badge ${ep?.autoEdit ? 'live' : ep ? 'stub' : 'err'}">${ep?.autoEdit ? 'ON' : ep ? 'BASELINE' : 'NOT RUN'}</span></div>
    ${ep ? `<div class="wrap mt">
        <span class="pill">${esc(ep.platformLabel || '')}</span><span class="pill">${ep.export?.aspect || ''} · ${ep.export?.w || '?'}×${ep.export?.h || '?'}</span>
        <span class="pill">${ep.pacing?.speed ?? 1}× pace</span><span class="pill">−${ep.removedSec || 0}s dead air</span>
        <span class="pill">${(ep.cuts || []).length} sections cut</span><span class="pill">${ep.transitions?.dissolve || 0} dissolves</span>
      </div>
      <p class="h-sub mt">${esc((ep.summary || []).join(' · '))}</p>` :
      `<p class="h-sub mt">No auto-edit pass yet — run it to apply professional cuts, pacing, color, audio balance, captions and platform export settings.</p>`}
    <button class="btn primary block mt" id="edAutoEdit">⚡ ${ep ? 'Re-run' : 'Run'} AUTO EDIT <span style="font-weight:400;font-size:12px">(all decisions automatic)</span></button>
  </div>
  <div class="player-wrap mb"><canvas id="edCanvas"></canvas>
    <div class="player-ui"><input type="range" class="scrub" id="edScrub" min="0" max="1000" value="0"/>
      <div class="player-row"><button class="pbtn play" id="edPlay">▶</button><span id="edTime">0:00 / 0:00</span>
      <span class="grow"></span><span class="pill" style="background:rgba(0,0,0,.4);color:#fff">${esc(edl.aspect || '16:9')}</span></div></div></div>

  <div class="card"><h3>🎬 Timeline</h3>
    <div class="tl-track"><label>VIDEO</label><div class="timeline" id="tlV">
      ${shots.map(s => `<div class="tl-shot ${cutSet.has(s.id) ? 'cut' : ''}" data-shot="${s.idx}" title="Shot ${s.idx + 1}" style="flex-grow:${s.dur}"><i>${s.idx + 1}</i></div>`).join('')}
    </div></div>
    <div class="tl-track"><label>MUSIC</label><div class="timeline">${shots.map(s => `<div class="tl-shot" style="background:linear-gradient(180deg,#5b3fa8,#38276b);flex-grow:${s.dur}"><i>♪</i></div>`).join('')}</div></div>
    <div class="tl-track"><label>SUBS</label><div class="timeline">${shots.map(s => `<div class="tl-shot" style="background:linear-gradient(180deg,#1f7a5a,#14513c);flex-grow:${s.dur}"><i>${s.dialogue.length ? '💬' : ''}</i></div>`).join('')}</div></div>
    <div class="kv-inline mt"><span class="pill">speed ${edl.speed || 1}x</span><span class="pill">grade: ${esc(edl.grade || 'auto')}</span>
      <span class="pill">subs ${edl.subtitlesOn !== false ? 'ON' : 'OFF'}</span><span class="pill">${(edl.cuts || []).length} cuts</span></div>
  </div>

  <div class="card"><h3>🤖 AI editing commands</h3>
    <div class="row"><input type="text" id="cmdInput" placeholder='Try: "make this cinematic" or "remove boring parts"'/><button class="btn primary" id="cmdGo">Go</button></div>
    <div class="chips mt">
      ${['Remove boring parts', 'Make this cinematic', 'Make the video faster', 'Make the dialogue louder', 'Remove background noise',
        'Add emotional music', 'Add subtitles', 'Make colors cinematic', 'Create a TikTok version', 'Create a YouTube version']
        .map(c => `<button class="chip tap" data-cmd="${esc(c)}">${c}</button>`).join('')}
    </div>
    <div id="cmdLog" class="small muted mt"></div>
  </div>
  <div class="note">The editor operates on a real edit-decision list: cuts, pacing, grades, levels, subtitle state and aspect all feed the render engine — nothing here is decorative.</div>`;
}
function exportsTab(p) {
  return `<div class="grid2">
    <a class="btn block primary" href="#/final/${p.id}">🎬 Final video page</a>
    <a class="btn block" href="/api/subtitles?project=${p.id}&format=srt" download>💬 .SRT</a>
    <a class="btn block" href="/api/subtitles?project=${p.id}&format=vtt" download>💬 .VTT</a>
    <a class="btn block" href="/api/projects/${p.id}/export" download>📦 Project JSON</a>
    <button class="btn block" id="expScript">📜 Script .txt</button>
    <button class="btn block" id="expBoard2">🎞 Shot list .json</button>
  </div>
  <div class="note mt">Video export (WebM, 720p/1080p settings) lives on the Final Video page with real-time rendering. MP4/4K requires a connected export provider or local ffmpeg.</div>`;
}

export async function mountProject(id, tab) {
  const p = R._proj;
  const rb = document.getElementById('renameBtn'); if (rb) rb.onclick = () => renameSheet(id);
  const rf = document.getElementById('runFull');
  if (rf) rf.onclick = async () => {
    const job = await R.api('/jobs', { body: { type: 'full', projectId: id, params: { ...p.brief } } });
    R.go('#/job/' + job.id);
  };
  // storyboard export
  const eb = document.getElementById('expBoard') || document.getElementById('expBoard2');
  if (eb) eb.onclick = () => R.download(new Blob([JSON.stringify(p.artifacts?.shots || [], null, 2)], { type: 'application/json' }), 'shotlist.json');
  // subtitles save
  const ss = document.getElementById('saveSubs');
  if (ss) ss.onclick = async () => {
    const items = p.artifacts.subtitles.items.map((s, i) => ({ ...s, text: document.querySelector(`[data-sub="${i}"]`)?.value ?? s.text }));
    await R.api('/artifacts/subtitles', { body: { projectId: id, items } });
    p.artifacts.subtitles.items = items;
    R.toast('Subtitles saved & burned into player', 'ok');
  };
  // cast reference sheets
  document.querySelectorAll('[data-sheet]').forEach(b => b.onclick = async () => {
    const c = p.artifacts.characters[+b.dataset.sheet];
    const r = await R.api('/characters/sheet', { body: { projectId: id, character: c } });
    R.sheet(`<h3>${esc(c.name)} — reference sheet</h3><img class="responsive" src="${r.url}"/>
      <a class="btn block mt" href="${r.url}" download>⬇ Download sheet (SVG)</a><button class="btn block mt" data-close>Close</button>`);
  });
  document.querySelectorAll('[data-upload-ref]').forEach(b => b.onclick = () => uploadRef(id, +b.dataset.uploadRef, p));
  // editor
  if (tab === 'editor') mountEditor(id, p);
  const es = document.getElementById('expScript');
  if (es) es.onclick = () => { const lines = (p.artifacts?.script?.scenes || []).map(s => s.slug + '\n' + s.action + '\n' + s.lines.map(l => l.speaker + ': ' + l.text).join('\n')).join('\n\n'); R.download(new Blob([lines], { type: 'text/plain' }), 'script.txt'); };
}
function uploadRef(projectId, idx, p) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    const asset = await R.api(`/projects/${projectId}/assets`, { body: { dataUrl, name: 'charref_' + idx } });
    // attach as character identity
    const chars = p.artifacts.characters;
    chars[idx].refImage = asset.url;
    await R.api('/artifacts/patch', { body: { projectId, characters: chars } }).catch(() => null);
    R.toast('Reference photo locked as character identity ✅', 'ok');
    R.rerender();
  };
  inp.click();
}
function mountEditor(id, p) {
  const edCanvas = document.getElementById('edCanvas');
  if (!edCanvas) return;
  const rae = document.getElementById('edAutoEdit');
  if (rae) rae.onclick = async () => {
    rae.disabled = true; rae.innerHTML = '<span class="spin"></span> Applying edit decisions…';
    try {
      const r = await R.api('/editor/autoedit', { body: { projectId: id, autoEdit: true } });
      R.toast('AUTO EDIT: ' + (r.plan?.speed ? `pace ${r.plan.speed}× · ${r.plan.cuts} cuts · ${r.plan.export?.w}×${r.plan.export?.h}` : 'applied'), 'ok');
      R.rerender();
    } catch (e) { R.toast(e.message, 'err'); rae.disabled = false; rae.textContent = '⚡ Run AUTO EDIT'; }
  };
  const player = new RoktokPlayer(edCanvas);
  player.load(p, null); player.draw();
  const scrub = document.getElementById('edScrub'), lbl = document.getElementById('edTime'), pb = document.getElementById('edPlay');
  player.on('time', (t, d) => { lbl.textContent = fmtTime(t) + ' / ' + fmtTime(d); if (!scrub._drag) scrub.value = t / d * 1000; });
  lbl.textContent = '0:00 / ' + fmtTime(player.duration);
  pb.onclick = () => { player.toggle(); pb.textContent = player.playing ? '⏸' : '▶'; };
  scrub.addEventListener('input', () => scrub._drag = true);
  scrub.addEventListener('change', () => { player.seek(scrub.value / 1000 * player.duration); scrub._drag = false; });
  document.querySelectorAll('[data-shot]').forEach(el => el.onclick = () => {
    const n = +el.dataset.shot + 1;
    document.getElementById('cmdInput').value = 'remove shot ' + n;
    runCmd();
  });
  const runCmd = async () => {
    const cmd = document.getElementById('cmdInput').value.trim();
    if (!cmd) return;
    const log = document.getElementById('cmdLog');
    log.innerHTML = '<span class="spin"></span> Editing…';
    try {
      const r = await R.api('/editor/command', { body: { projectId: id, command: cmd } });
      const np = await R.api('/projects/' + id);
      R._proj = np;
      log.innerHTML = r.log.map(l => '✓ ' + esc(l)).join('<br>');
      player.load(np, null); player.draw();
      R.toast('Edit applied', 'ok');
      // refresh timeline visuals
      const cuts = new Set(player.edl.cuts || []);
      document.querySelectorAll('[data-shot]').forEach(el2 => {
        const s = player.shots.find(x => x.idx === +el2.dataset.shot);
        el2.classList.toggle('cut', !s);
      });
    } catch (e) { log.innerHTML = '<span style="color:var(--err)">' + esc(e.message) + '</span>'; }
  };
  document.getElementById('cmdGo').onclick = runCmd;
  document.getElementById('cmdInput').addEventListener('keydown', e => { if (e.key === 'Enter') runCmd(); });
  document.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => { document.getElementById('cmdInput').value = b.dataset.cmd; runCmd(); });
}
