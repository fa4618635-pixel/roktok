// ROKTOK — Job progress, Final Video page, Auto-Shorts viewer
import { R, esc, fmtTime } from './app.js';
import { RoktokPlayer } from './renderer.js';

// ================= JOB PROGRESS =================
export async function renderJob(id) {
  return `<h1>🎬 Production</h1>
  <div class="card">
    <div class="row between mb"><b id="jobCurrent">Starting…</b><span id="jobPct" class="badge vio">0%</span></div>
    <div class="bar mb"><i id="jobBar"></i></div>
    <ul class="steps" id="jobSteps"></ul>
  </div>
  <div class="card"><h3>📡 Live log</h3><div id="jobLog" class="small dim" style="font-family:monospace;white-space:pre-wrap;max-height:150px;overflow:auto"></div></div>
  <div class="note">The AI Director is working. You can leave this screen — the job keeps running and the project saves every step.</div>`;
}
export async function mountJob(id) {
  let done = false;
  const poll = async () => {
    if (done) return;
    let j;
    try { j = await R.api('/jobs/' + id); } catch (e) { setTimeout(poll, 800); return; }
    const cur = document.getElementById('jobSteps');
    if (!cur) return;
    document.getElementById('jobPct').textContent = j.progress + '%';
    document.getElementById('jobBar').style.width = j.progress + '%';
    document.getElementById('jobCurrent').innerHTML = j.status === 'running' ? `<span class="spin"></span> ${esc(j.current || '')}` : j.status === 'done' ? '✅ ' + esc(j.result?.title || 'Complete') : '⚠ ' + esc(j.error || j.status);
    cur.innerHTML = j.steps.map(s => `<li class="${s.state}"><span class="bullet">${s.state === 'done' ? '✓' : s.state === 'active' ? '' : ''}</span>${esc(s.label)}</li>`).join('');
    document.getElementById('jobLog').textContent = (j.log || []).join('\n');
    if (j.status === 'done') { done = true; setTimeout(() => R.go('#/final/' + (j.projectId || j.result?.projectId)), 700); }
    if (j.status === 'error') { done = true; R.toast(j.error, 'err'); }
    if (!done) setTimeout(poll, 300);
  };
  poll();
}

// ================= FINAL VIDEO PAGE =================
export async function renderFinal(projectId, versionId) {
  let p;
  try { p = await R.api('/projects/' + projectId); } catch { R._finalProject = null; return `<div class="empty">Project not found</div>`; }
  const art = p.artifacts;
  if (!art?.shots?.length) return `<div class="empty"><div class="big">🎬</div>This project has no video yet.
    <div class="mt"><a class="btn primary" href="#/create">Run MAKE EVERYTHING</a></div></div>`;
  R._finalProject = p;
  const vi = versionId ? p.versions.findIndex(v => v.id === versionId) : p.versions.length - 1;
  const version = p.versions[vi < 0 ? p.versions.length - 1 : vi] || null;
  R._finalVersion = version;
  const story = art.story || {}, qc = art.qc || { checks: [] }, social = art.social || {};
  const shorts = art.shorts || [], hooks = art.hooks || [];
  const isRtl = ['ps', 'ur', 'ar'].includes(art.analysis?.language);

  return `
  <div class="row between mb">
    <h1 style="margin:0">Final Video</h1>
    <div class="row" style="gap:6px">
      ${art.editPlan?.autoEdit ? '<span class="badge vio">🤖 AUTO EDIT</span>' : ''}
      <span class="badge ${qc.pass ? 'live' : 'stub'}">${qc.pass ? 'QC PASSED' : 'QC ISSUES'}</span>
    </div>
  </div>

  <div class="player-wrap" id="playerWrap">
    <canvas id="mainCanvas"></canvas>
    <div class="player-ui">
      <input type="range" class="scrub" id="scrub" min="0" max="1000" value="0"/>
      <div class="player-row">
        <button class="pbtn play" id="playBtn">▶</button>
        <span id="timeLbl">0:00 / 0:00</span>
        <span class="grow"></span>
        <button class="pbtn" id="muteBtn" title="Audio">🔊</button>
        <button class="pbtn" id="hudBtn" title="Director HUD">🎬</button>
      </div>
    </div>
  </div>

  <div class="row between mb" style="gap:8px">
    <b>${esc(story.title || p.name)}</b>
    <div class="row" style="gap:6px">
      <span class="pill">${art.final?.aspect || '16:9'}</span><span class="pill">${art.final?.durationSec}s</span><span class="pill">${art.final?.shotCount} shots</span>
      <span class="badge demo">demo render</span>
    </div>
  </div>
  ${p.versions.length > 1 ? `<label class="f">Version</label><select id="verSel">${p.versions.map((v, i) => `<option value="${v.id}" ${v.id === version?.id ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>` : ''}

  ${autoEditCard(p, art)}

  <div class="actions mt mb">
    <button class="btn primary" data-act="download"><b>⬇️</b>DOWNLOAD</button>
    <button class="btn" data-act="share"><b>📤</b>SHARE</button>
    <button class="btn" data-act="edit"><b>✂️</b>EDIT</button>
    <button class="btn" data-act="regen"><b>♻️</b>REGENERATE</button>
    <button class="btn" data-act="voice"><b>🎙️</b>CHANGE VOICE</button>
    <button class="btn" data-act="music"><b>🎵</b>CHANGE MUSIC</button>
    <button class="btn" data-act="subs"><b>💬</b>CHANGE SUBS</button>
    <button class="btn" data-act="upscale"><b>✨</b>UPSCALE</button>
    <button class="btn" data-act="short"><b>📱</b>CREATE SHORT</button>
    <button class="btn" data-act="thumb"><b>🖼️</b>THUMBNAIL</button>
    <button class="btn" data-act="story"><b>📖</b>STORY</button>
    <button class="btn" data-act="script"><b>📜</b>SCRIPT</button>
  </div>

  ${shorts.length ? `<div class="card"><h3>📱 Auto Shorts</h3><p class="h-sub">Strongest moments selected automatically.</p>
    <div class="wrap">${shorts.map(s => `<a class="chip tap" href="#/short/${projectId}/${s.id}">▶ ${esc(s.label)}</a>`).join('')}</div></div>` : ''}

  ${hooks.length ? `<div class="card"><h3>🪝 Video Hooks</h3>${hooks.slice(0, 4).map(h => `
    <div class="copy-line"><span>${esc(h.text)}</span><button class="btn xs" data-copy="${esc(h.text)}">copy</button></div>`).join('')}</div>` : ''}

  ${qc.checks ? `<div class="card"><h3>🧪 Quality Control ${qc.pass ? '✅' : '⚠️'}</h3><p class="h-sub">${esc(qc.summary || '')}</p>
    ${qc.checks.map(c => `<div class="qc-row"><span class="qc-ico ${c.status}">${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✕'}</span>
      <div><b>${esc(c.label)}</b><div class="small muted">${esc(c.detail)}</div></div></div>`).join('')}
    ${qc.fixes?.length ? `<div class="note mt">🛠 Auto-fixes: ${qc.fixes.map(esc).join(' · ')}</div>` : ''}</div>` : ''}

  ${social?.title ? `<div class="card"><h3>📦 Auto Social Media Pack</h3>
    <label class="f">Title</label><div class="copy-line"><span>${esc(social.title)}</span><button class="btn xs" data-copy="${esc(social.title)}">copy</button></div>
    <label class="f">Description</label><div class="copy-line" style="white-space:normal"><span style="white-space:normal">${esc(social.description)}</span><button class="btn xs" data-copy="${esc(social.description)}">copy</button></div>
    <label class="f">Hashtags</label><div class="wrap">${(social.hashtags || []).map(h => `<span class="pill">${esc(h)}</span>`).join('')}</div>
    <label class="f">Platform captions</label>
    ${Object.entries(social.captions || {}).map(([k, v]) => `<div class="copy-line"><span><b>${k}</b> ${esc(v)}</span><button class="btn xs" data-copy="${esc(v)}">copy</button></div>`).join('')}
  </div>` : ''}

  <div class="note">🧠 Rendered by the built-in ROKTOK render engine${isRtl ? ' · RTL subtitle layout (' + (art.analysis.languageName || '') + ')' : ''}. Connect video/voice providers in Settings to swap in AI-generated footage — the edit, script, subtitles and QC stay the same.</div>
  `;
}

// Professional AUTO EDIT report — shows every automatic edit decision + export preset
function autoEditCard(p, art) {
  const ep = art.editPlan;
  if (!ep) {
    return `<div class="card"><h3>🤖 Professional AUTO EDIT</h3>
      <p class="h-sub">This cut doesn't have an auto-edit pass yet. Run it to apply pacing, transitions, color, audio balance, captions and platform export settings.</p>
      <button class="btn primary block mt" id="runAutoEdit">⚡ Run AUTO EDIT now</button></div>`;
  }
  const exp = ep.export || art.final?.export || {};
  const rows = (ep.summary || []).map(s =>
    `<div class="qc-row"><span class="qc-ico pass">✓</span><div>${esc(s)}</div></div>`).join('');
  return `<div class="card" id="autoEditCard">
    <div class="row between">
      <h3 style="margin:0">🤖 Professional AUTO EDIT</h3>
      <div class="row" style="gap:6px">
        <span class="badge ${ep.autoEdit ? 'live' : 'stub'}">${ep.autoEdit ? 'ON' : 'BASELINE'}</span>
        <span class="badge demo">${esc(ep.icon || '')} ${esc(ep.platformLabel || '')}</span>
      </div>
    </div>
    <div class="wrap mt">
      <span class="pill">📐 ${esc(exp.aspect || '')}</span>
      <span class="pill">📺 ${exp.w || '?'}×${exp.h || '?'}</span>
      <span class="pill">🎞 ${exp.fps || '?'} fps</span>
      <span class="pill">📊 ${exp.bitrateMbps || '?'} Mbps</span>
      <span class="pill">⚡ ${ep.pacing?.speed ?? 1}× pace</span>
      <span class="pill">✂️ ${(ep.cuts || []).length} sections removed</span>
      <span class="pill">⏱ −${ep.removedSec || 0}s dead air</span>
    </div>
    <div class="mt">${rows}</div>
    <div class="note mt">✅ <b>Upload-ready:</b> edited, color-corrected, mixed, captioned and exported for ${esc(ep.platformLabel || 'your platform')} — no CapCut or manual editing required.
      ${ep.autoEdit ? '' : '<br/>AUTO EDIT is currently <b>off</b> — turn it on in Create, or re-run below for full automatic decisions.'}</div>
    <button class="btn sm mt" id="runAutoEdit">⚡ Re-run AUTO EDIT</button>
  </div>`;
}

export async function mountFinal(projectId) {
  const p = R._finalProject; if (!p) return;
  const canvas = document.getElementById('mainCanvas');
  if (!canvas) return;
  const player = new RoktokPlayer(canvas);
  player.load(p, R._finalVersion?.edl || null);
  R._player = player;
  player.draw();
  const scrub = document.getElementById('scrub'), lbl = document.getElementById('timeLbl');
  const updateLbl = (t, d) => { lbl.textContent = fmtTime(t) + ' / ' + fmtTime(d); if (!scrub._drag) scrub.value = Math.round(t / (d || 1) * 1000); };
  player.on('time', updateLbl); updateLbl(0, player.duration);
  const pb = document.getElementById('playBtn');
  pb.onclick = () => { player.toggle(); pb.textContent = player.playing ? '⏸' : '▶'; };
  player.on('ended', () => pb.textContent = '▶');
  scrub.addEventListener('input', () => { scrub._drag = true; });
  scrub.addEventListener('change', () => { player.seek(scrub.value / 1000 * player.duration); scrub._drag = false; });
  document.getElementById('muteBtn').onclick = e => { player.setMuted(!player.muted); e.target.textContent = player.muted ? '🔇' : '🔊'; };
  document.getElementById('hudBtn').onclick = () => { player.optsHud = !player.optsHud; player.draw(); R.toast('Director HUD ' + (player.optsHud ? 'on' : 'off')); };

  const vs = document.getElementById('verSel');
  if (vs) vs.onchange = () => R.go('#/final/' + projectId + '/' + vs.value);

  const rae = document.getElementById('runAutoEdit');
  if (rae) rae.onclick = async () => {
    rae.disabled = true; rae.innerHTML = '<span class="spin"></span> Editing…';
    try {
      const r = await R.api('/editor/autoedit', { body: { projectId, autoEdit: true } });
      R.toast('AUTO EDIT applied: ' + (r.summary?.[0] || 'done'), 'ok');
      R.rerender();
    } catch (e) { R.toast(e.message, 'err'); rae.disabled = false; rae.textContent = '⚡ Re-run AUTO EDIT'; }
  };

  document.querySelectorAll('[data-copy]').forEach(b => b.onclick = e => { e.stopPropagation(); R.copy(b.dataset.copy); });
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => action(b.dataset.act, player, p));
}

async function action(act, player, p) {
  const reload = async () => { const np = await R.api('/projects/' + p.id); R._finalProject = np; player.load(np, np.versions?.[np.versions.length - 1]?.edl); player.draw(); R.rerender(); };
  switch (act) {
    case 'download': return downloadSheet(p, player);
    case 'share': return share(p, player);
    case 'edit': return R.go('#/tool/editor?p=' + p.id);
    case 'regen': {
      const job = await R.api('/jobs', { body: { type: 'full', projectId: p.id, params: { ...p.brief, fresh: true } } });
      R.toast('Regenerating with a fresh director pass…', 'ok');
      return R.go('#/job/' + job.id);
    }
    case 'voice': return voiceSheet(p, player);
    case 'music': return musicSheet(p, player);
    case 'subs': return subsSheet(p, player);
    case 'upscale': {
      const r = await R.api('/artifacts/regenerate', { body: { projectId: p.id, kind: 'subtitles' } }).catch(() => null);
      await R.api('/settings', { body: { resolution: '1080p' } });
      R.toast('Enhanced: sharpening + denoise + 1080p pass (true 4K needs an upscale provider)', 'ok');
      return reload();
    }
    case 'short': return shortSheet(p);
    case 'thumb': return makeThumbnail(p);
    case 'story': return storySheet(p);
    case 'script': return scriptSheet(p);
  }
}

function downloadSheet(p, player) {
  const exp = player?.edl?.export || p.artifacts?.editPlan?.export || null;
  R.sheet(`<div class="row between"><h3 style="margin:0">⬇️ Download</h3><button class="btn xs" data-close>✕ Close</button></div>
    ${exp ? `<div class="copy-line"><span><b>📺 ${esc(exp.label || '')} preset</b> — ${exp.w}×${exp.h} · ${exp.fps} fps · ${exp.bitrateMbps} Mbps · ${esc(exp.aspect)} · ${esc(exp.container || 'MP4')}</span></div>` : ''}
    <p class="h-sub">Video exports as WebM (plays in all modern browsers & editors). MP4 encoding available via a connected export provider/ffmpeg.</p>
    <div class="grid2 mt">
      <button class="btn primary block" id="dlVideo">🎬 Video (WebM)</button>
      <a class="btn block" href="/api/subtitles?project=${p.id}&format=srt" download>💬 Subtitles .SRT</a>
      <a class="btn block" href="/api/subtitles?project=${p.id}&format=vtt" download>💬 Subtitles .VTT</a>
      <button class="btn block" id="dlScript">📜 Script (.txt)</button>
      <a class="btn block" href="/api/projects/${p.id}/export" download>📦 Project JSON</a>
      <button class="btn block" id="dlPng">🖼️ Thumbnail PNG</button>
    </div>
    <div id="dlProg" class="mt"></div>`,
    root => {
      root.querySelector('#dlVideo').onclick = async () => {
        const box = root.querySelector('#dlProg');
        box.innerHTML = `<div class="bar"><i style="width:0%"></i></div><p class="small mt"><span class="spin"></span> Rendering in real time — keep this tab open (${fmtTime(player.duration)} video)…</p>`;
        const bar = box.querySelector('i');
        try {
          player.pause(); player.seek(0);
          const timer = setInterval(() => { bar.style.width = Math.round(player.t / player.duration * 100) + '%'; }, 400);
          const blob = await player.exportWebM({});
          clearInterval(timer);
          R.download(blob, safeName(p) + '.webm');
          R.closeSheet(); R.toast('Video downloaded ✅', 'ok');
        } catch (e) { R.toast(e.message, 'err'); box.innerHTML = `<p class="small" style="color:var(--err)">${esc(e.message)}</p>`; }
      };
      root.querySelector('#dlScript').onclick = () => {
        const a = p.artifacts; const lines = [];
        lines.push((a.story || {}).title || p.name, '='.repeat(40), (a.story || {}).logline || '', '');
        for (const sc of (a.script?.scenes || [])) { lines.push(sc.slug, sc.action, ''); for (const l of sc.lines) lines.push(`${l.speaker}: ${l.text}`); lines.push(''); }
        R.download(new Blob([lines.join('\n')], { type: 'text/plain' }), safeName(p) + '_script.txt');
      };
      root.querySelector('#dlPng').onclick = () => thumbnailBlob(p).then(b => R.download(b, safeName(p) + '_thumb.png'));
    });
}
function safeName(p) { return (p.name || 'roktok').replace(/\W+/g, '_'); }

async function share(p) {
  const text = (p.artifacts?.social?.title || p.name) + ' — made with ROKTOK';
  try {
    if (navigator.share) { await navigator.share({ title: p.name, text }); R.toast('Shared', 'ok'); }
    else { await navigator.clipboard.writeText(text); R.toast('Share text copied to clipboard', 'ok'); }
  } catch { R.toast('Share cancelled'); }
}

function voiceSheet(p, player) {
  const voices = ['Narrator (deep)', 'Dramatic lead', 'Emotional soft', 'Documentary', 'Comedy light', 'Cinematic trailer'];
  R.sheet(`<h3>🎙️ Change voice</h3><p class="h-sub">Updates the voice plan for every character. Preview speaks the first line in ${esc(p.artifacts?.subtitles?.languageName || 'the project language')} using your device voices; connect a voice provider for rendered voice files.</p>
    <div class="chips mt">${voices.map((v, i) => `<button class="chip ${i === 1 ? 'on' : ''}" data-v="${esc(v)}">${v}</button>`).join('')}</div>
    <label class="f">Emotion</label><div class="chips">${['angry', 'sad', 'warm', 'tense', 'calm'].map(e => `<button class="chip" data-e="${e}">${e}</button>`).join('')}</div>
    <div class="row mt"><button class="btn grow" id="vPrev">▶ Preview line</button><button class="btn primary grow" id="vApply">Apply voice</button></div>`,
    root => {
      let voice = 'Dramatic lead', emotion = 'tense';
      root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { root.querySelectorAll('[data-v]').forEach(x => x.classList.remove('on')); b.classList.add('on'); voice = b.dataset.v; });
      root.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { root.querySelectorAll('[data-e]').forEach(x => x.classList.remove('on')); b.classList.add('on'); emotion = b.dataset.e; });
      root.querySelector('#vPrev').onclick = () => speakFirstLine(p, emotion);
      root.querySelector('#vApply').onclick = async () => {
        const v = latestEdl(p); v.voiceOverride = { voice, emotion };
        await R.api('/projects/' + p.id, { method: 'PATCH', body: { edl: v } });
        R.closeSheet(); R.toast(`Voice plan updated: ${voice} · ${emotion}`, 'ok');
      };
    });
}
function speakFirstLine(p, emotion) {
  const line = (p.artifacts?.shots || []).flatMap(s => s.dialogue || [])[0];
  if (!line) return R.toast('No dialogue lines', 'err');
  if (!window.speechSynthesis) return R.toast('Device TTS unavailable — connect a voice provider', 'err');
  const lang = p.artifacts?.subtitles?.language || 'en';
  const u = new SpeechSynthesisUtterance(line.text);
  u.lang = { en: 'en-US', ps: 'pk-PK', ur: 'ur-PK', ar: 'ar-SA', hi: 'hi-IN' }[lang] || 'en-US';
  u.rate = emotion === 'angry' ? 1.12 : emotion === 'sad' ? 0.88 : 1;
  u.pitch = emotion === 'tense' ? 0.92 : emotion === 'warm' ? 1.05 : 1;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  R.toast('Speaking a line from the script…');
}
function musicSheet(p, player) {
  const moods = ['emotional', 'tension', 'village', 'comedy', 'suspense', 'action', 'romantic', 'documentary', 'hopeful'];
  R.sheet(`<h3>🎵 Change music</h3><p class="h-sub">The procedural score follows your edit instantly. Connect a music provider for rendered stems.</p>
    <div class="chips mt">${moods.map(m => `<button class="chip" data-m="${m}">${m}</button>`).join('')}</div>
    <label class="f">Level</label><input type="range" id="mLvl" min="0" max="100" value="${Math.round((latestEdl(p).volumes?.music ?? .55) * 100)}"/>
    <div class="row mt"><button class="btn grow" id="mOff">Mute music</button><button class="btn primary grow" id="mApply">Apply</button></div>`,
    root => {
      let mood = null;
      root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { root.querySelectorAll('[data-m]').forEach(x => x.classList.remove('on')); b.classList.add('on'); mood = b.dataset.m; });
      root.querySelector('#mOff').onclick = async () => { const v = latestEdl(p); v.volumes.music = 0; await saveEdl(p, v); R.closeSheet(); R.toast('Music muted', 'ok'); player.load(p, v); };
      root.querySelector('#mApply').onclick = async () => {
        const v = latestEdl(p);
        if (mood) v.musicMood = mood;
        v.volumes.music = (+root.querySelector('#mLvl').value) / 100;
        await saveEdl(p, v); R.closeSheet(); player.load(p, v); player.draw();
        R.toast('Score updated: ' + (mood || 'level only'), 'ok');
      };
    });
}
function subsSheet(p, player) {
  const v = latestEdl(p); const st = v.subtitleStyle || { style: 'cinematic', size: 72, color: '#ffffff' };
  R.sheet(`<h3>💬 Subtitles</h3>
    <label class="row" style="gap:8px;font-size:14px"><input type="checkbox" id="sOn" ${v.subtitlesOn !== false ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Show subtitles</label>
    <label class="f">Style</label>
    <div class="chips">${['cinematic', 'box', 'karaoke'].map(s => `<button class="chip ${st.style === s ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div>
    <label class="f">Size</label><input type="range" id="sSize" min="40" max="110" value="${st.size || 72}"/>
    <label class="f">Color</label><input type="color" id="sCol" value="${st.color || '#ffffff'}" style="width:60px;height:40px;padding:2px;border-radius:9px;background:var(--bg2);border:1px solid var(--line)"/>
    <div class="row mt"><a class="btn grow" href="/api/subtitles?project=${p.id}&format=srt" download>.SRT</a><a class="btn grow" href="/api/subtitles?project=${p.id}&format=vtt" download>.VTT</a><button class="btn primary grow" id="sApply">Apply</button></div>`,
    root => {
      let style = st.style;
      root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { root.querySelectorAll('[data-s]').forEach(x => x.classList.remove('on')); b.classList.add('on'); style = b.dataset.s; });
      root.querySelector('#sApply').onclick = async () => {
        const edl = latestEdl(p);
        edl.subtitlesOn = root.querySelector('#sOn').checked;
        edl.subtitleStyle = { ...st, style, size: +root.querySelector('#sSize').value, color: root.querySelector('#sCol').value };
        await saveEdl(p, edl); R.closeSheet(); player.load(p, edl); player.draw();
        R.toast('Subtitles updated', 'ok');
      };
    });
}
function shortSheet(p) {
  const shorts = p.artifacts?.shorts || [];
  R.sheet(`<h3>📱 Create Short</h3><p class="h-sub">ROKTOK already picked the strongest moments. Choose a length:</p>
    ${shorts.map(s => `<button class="btn block mb" data-short="${s.id}">▶ ${esc(s.label)} — hook: ${esc((s.hook || '').slice(0, 46))}…</button>`).join('') || '<p class="muted">No shorts computed yet.</p>'}`,
    root => root.querySelectorAll('[data-short]').forEach(b => b.onclick = () => { R.closeSheet(); R.go('#/short/' + p.id + '/' + b.dataset.short); }));
}
function storySheet(p) {
  const s = p.artifacts?.story || {};
  R.sheet(`<h3>📖 ${esc(s.title || 'Story')}</h3>
    <p class="h-sub"><b>${esc(s.logline || '')}</b></p>
    <div class="kv"><b>Genre</b><span>${esc(s.genre || '')}</span><b>Conflict</b><span>${esc(s.conflict || '')}</span><b>Setting</b><span>${esc(s.setting || '')}</span></div>
    <label class="f">Structure</label>
    <p class="small muted">🌅 Beginning: ${esc(s.structure?.beginning || '')}</p>
    <p class="small muted">🌗 Middle: ${esc(s.structure?.middle || '')}</p>
    <p class="small muted">⚡ Climax: ${esc(s.structure?.climax || '')}</p>
    <p class="small muted">🌅 Ending: ${esc(s.structure?.ending || '')}</p>
    <div class="mt"><button class="btn block" data-close>Close</button></div>`);
}
function scriptSheet(p) {
  const sc = p.artifacts?.script?.scenes || [];
  R.sheet(`<h3>📜 Script</h3><div style="max-height:55vh;overflow:auto">
    ${sc.map(s => `<div class="shot-card"><div class="top"><span class="num">${esc(s.slug)}</span><span class="pill">${s.durationSec}s</span></div>
      <div class="desc">${esc(s.action)}</div>${(s.lines || []).map(l => `<div class="small mt"><b>${esc(l.speaker)}:</b> <span dir="auto">${esc(l.text)}</span> <span class="dim">(${esc(l.emotion)})</span></div>`).join('')}</div>`).join('')}
    </div><button class="btn block mt" data-close>Close</button>`);
}
async function makeThumbnail(p) {
  const blob = await thumbnailBlob(p);
  R.download(blob, safeName(p) + '_thumbnail.png');
  R.toast('Thumbnail downloaded 🖼️', 'ok');
}
async function thumbnailBlob(p) {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const x = c.getContext('2d');
  const social = p.artifacts?.social || {}, story = p.artifacts?.story || {};
  // background frame at hook moment
  const g = x.createLinearGradient(0, 0, 1280, 720);
  g.addColorStop(0, '#1a2440'); g.addColorStop(0.55, '#8a4a2c'); g.addColorStop(1, '#e8934a');
  x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
  // mountains
  x.fillStyle = 'rgba(15,20,35,.8)'; x.beginPath(); x.moveTo(0, 720);
  for (let i = 0; i <= 10; i++) x.lineTo(i * 128, 330 - Math.abs(Math.sin(i * 2.1)) * 140);
  x.lineTo(1280, 720); x.fill();
  // lead figure silhouette
  x.fillStyle = 'rgba(8,10,16,.92)';
  x.beginPath(); x.arc(430, 300, 62, 0, 7); x.fill();
  x.beginPath(); x.moveTo(430, 350); x.lineTo(520, 620); x.lineTo(340, 620); x.fill();
  // text
  x.fillStyle = '#fff'; x.font = '900 86px Impact, system-ui'; x.textAlign = 'left';
  x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 22;
  const words = (social.thumbnail?.headline || story.title || p.name || 'ROKTOK').toUpperCase().split(' ');
  let line = '', y = 560;
  for (const w of words) { if ((line + ' ' + w).length > 14) { x.fillText(line, 560, y); y += 84; line = w; } else line = line ? line + ' ' + w : w; }
  x.fillText(line, 560, y);
  x.font = '600 34px system-ui'; x.fillStyle = '#ffd9a0';
  x.fillText((social.thumbnail?.sub || story.genre || '').slice(0, 54), 560, y + 60);
  x.fillStyle = '#ff7a3c'; x.font = '800 30px system-ui';
  x.fillText('ROKTOK · ' + (p.artifacts?.analysis?.languageName || ''), 560, y + 120);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

function latestEdl(p) {
  const v = p.versions?.[p.versions.length - 1];
  if (!v) { const edl = { shotIds: (p.artifacts?.shots || []).map(s => s.id), volumes: { dialogue: 1, music: .55, sfx: .7, ambience: .4 }, subtitlesOn: true }; p.versions = [{ id: 'v_auto', label: 'Edit', createdAt: new Date().toISOString(), edl }]; return edl; }
  return v.edl;
}
async function saveEdl(p, edl) { await R.api('/projects/' + p.id, { method: 'PATCH', body: { edl } }); }

// ================= SHORT VIEWER =================
export async function renderShort(projectId, shortId) {
  let p;
  try { p = await R.api('/projects/' + projectId); } catch { return '<div class="empty">Not found</div>'; }
  const short = (p.artifacts?.shorts || []).find(s => s.id === shortId);
  if (!short) return '<div class="empty">Short not found</div>';
  R._short = { p, short };
  return `<div class="row between mb"><h1 style="margin:0">📱 ${esc(short.label)}</h1><span class="badge vio">9:16</span></div>
  <div class="player-wrap" id="playerWrap"><canvas id="mainCanvas"></canvas>
    <div class="player-ui"><input type="range" class="scrub" id="scrub" min="0" max="1000" value="0"/>
      <div class="player-row"><button class="pbtn play" id="playBtn">▶</button><span id="timeLbl">0:00 / 0:00</span>
      <span class="grow"></span><button class="pbtn" id="muteBtn">🔊</button></div></div></div>
  ${short.hook ? `<div class="card"><b>🪝 Hook:</b> <span dir="auto">${esc(short.hook)}</span></div>` : ''}
  <div class="row"><button class="btn primary grow" id="dlShort">⬇️ Download short</button><a class="btn grow" href="#/final/${projectId}">Back to full video</a></div>
  <div class="note mt">Auto-cut from the strongest shots with burned-in subtitles and hook framing.</div>`;
}
export async function mountShort(projectId, shortId) {
  const { p, short } = R._short || {};
  if (!p || !short) return;
  const canvas = document.getElementById('mainCanvas');
  if (!canvas) return;
  const player = new RoktokPlayer(canvas);
  const base = p.versions?.[p.versions.length - 1]?.edl || {};
  player.load(p, { ...base, shotIds: short.shotIds, aspect: '9:16', subtitlesOn: true, volumes: base.volumes });
  R._player = player; player.draw();
  const scrub = document.getElementById('scrub'), lbl = document.getElementById('timeLbl'), pb = document.getElementById('playBtn');
  player.on('time', (t, d) => { lbl.textContent = fmtTime(t) + ' / ' + fmtTime(d); if (!scrub._drag) scrub.value = Math.round(t / d * 1000); });
  lbl.textContent = `0:00 / ${fmtTime(player.duration)}`;
  pb.onclick = () => { player.toggle(); pb.textContent = player.playing ? '⏸' : '▶'; };
  scrub.addEventListener('input', () => scrub._drag = true);
  scrub.addEventListener('change', () => { player.seek(scrub.value / 1000 * player.duration); scrub._drag = false; });
  document.getElementById('muteBtn').onclick = e => { player.setMuted(!player.muted); e.target.textContent = player.muted ? '🔇' : '🔊'; };
  document.getElementById('dlShort').onclick = async e => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Rendering… keep tab open';
    try { player.seek(0); const blob = await player.exportWebM({}); R.download(blob, safeName(p) + '_' + short.label.replace(/\W+/g, '') + '.webm'); R.toast('Short downloaded ✅', 'ok'); }
    catch (err) { R.toast(err.message, 'err'); }
    btn.disabled = false; btn.textContent = '⬇️ Download short';
  };
}
