// ROKTOK — Render Engine: plays one continuous final video on canvas from the shot list.
// Draws cinematic scenes (camera language, characters, lighting, weather), burns subtitles,
// mixes procedural audio, and exports a real WebM file via MediaRecorder.

const PALETTES = {
  Dawn:      { sky: ['#2b3a67', '#7f6a9e', '#e8a87c'], ground: '#3d4a3f', sun: '#ffd9a0', amb: 'rgba(40,60,110,0.18)' },
  Morning:   { sky: ['#5b9bd5', '#9fc7ea', '#e7f0f7'], ground: '#5a6b45', sun: '#fff6d8', amb: 'rgba(120,160,220,0.10)' },
  Midday:    { sky: ['#3f8fd0', '#8fc0e8', '#dcecf7'], ground: '#6b7a4a', sun: '#ffffff', amb: 'rgba(255,240,200,0.06)' },
  Afternoon: { sky: ['#4f92c9', '#a8c8e4', '#f0e2c4'], ground: '#77743f', sun: '#ffedc0', amb: 'rgba(255,190,110,0.10)' },
  'Golden hour': { sky: ['#3a5a8c', '#d98a4e', '#ffcf87'], ground: '#7a6238', sun: '#ffe1a0', amb: 'rgba(255,150,60,0.16)' },
  Dusk:      { sky: ['#1c2447', '#5c3d63', '#e0784a'], ground: '#33342c', sun: '#ffbf8a', amb: 'rgba(30,30,80,0.24)' }
};

function hashNum(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export class RoktokPlayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0; this.playing = false; this.speed = 1; this.muted = false;
    this.shots = []; this.subs = []; this.listeners = {};
    this._raf = null; this._last = 0;
    this.grain = null; this.images = {};
    this.audio = null;
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach(f => f(...a)); }

  load(project, edl = null) {
    const art = project.artifacts;
    this.project = project;
    this.edl = edl || project.versions?.[project.versions.length - 1]?.edl || {
      shotIds: (art?.shots || []).map(s => s.id), speed: 1, subtitlesOn: true, aspect: '16:9',
      volumes: { dialogue: 1, music: 0.55, sfx: 0.7, ambience: 0.4 }, cuts: [], grade: art?.analysis?.style, cinematic: true, burnSubtitles: true
    };
    const all = art?.shots || [];
    const cutSet = new Set(this.edl.cuts || []);
    const ids = (this.edl.shotIds?.length ? this.edl.shotIds : all.map(s => s.id)).filter(id => !cutSet.has(id));
    const kept = ids.map(id => all.find(s => s.id === id)).filter(Boolean);
    // rebase onto a fresh continuous timeline (auto-edits + cuts collapse into ONE video)
    let t = 0; this.shots = kept.map(s => {
      const orig = s.start;
      const n = { ...s, start: t, dialogue: s.dialogue.map(d => ({ ...d, _rel: d.start - orig })) };
      for (const d of n.dialogue) { d.start = +(t + d._rel).toFixed(2); delete d._rel; }
      n.dialogue.sort((a, b) => a.start - b.start);
      t += s.dur; return n;
    });
    this.duration = t;
    const offsetOf = id => { const orig = all.find(s => s.id === id); const k = this.shots.find(s => s.id === id);
      return (k && orig) ? k.start - orig.start : 0; };
    const keptIds = new Set(kept.map(s => s.id));
    // rebase subtitles, SFX and music cues onto the edited timeline
    this.subs = (art?.subtitles?.items || [])
      .filter(s => keptIds.has(s.shotId))
      .map(s => ({ ...s, start: s.start + offsetOf(s.shotId), end: s.end + offsetOf(s.shotId) }));
    this.sfxList = (art?.audio?.sfx || [])
      .filter(f => !f.shotId || keptIds.has(f.shotId))
      .map(f => ({ ...f, t: f.t + (f.shotId ? offsetOf(f.shotId) : 0) }));
    this.musicSegments = (art?.audio?.music?.segments || []).map(seg => {
      const host = all.find(s => seg.start >= s.start && seg.start < s.start + s.dur);
      return { ...seg, start: seg.start + (host ? offsetOf(host.id) : 0) };
    });
    this.speed = this.edl.speed || 1;
    this.setAspect(this.edl.aspect || '16:9');
    this.t = Math.min(this.t, this.duration);
    this._makeGrain();
    this.emit('loaded', this);
  }
  setAspect(aspect) {
    const exp = this.edl?.export;
    let w, h;
    if (exp?.w && exp?.h && (!exp.aspect || exp.aspect === aspect)) { w = exp.w; h = exp.h; }
    else if (aspect === '9:16') { w = 1080; h = 1920; }          // HD vertical (TikTok / Reels)
    else if (aspect === '1:1') { w = 1080; h = 1080; }
    else if (aspect === '4:3') { w = 1440; h = 1080; }
    else { w = 1920; h = 1080; }                                  // HD 16:9 (YouTube)
    this.canvas.width = w; this.canvas.height = h;
    this.aspect = aspect;
    this.canvas.style.aspectRatio = w + '/' + h;
  }
  _makeGrain() {
    const c = document.createElement('canvas'); c.width = 220; c.height = 220;
    const x = c.getContext('2d'); const img = x.createImageData(220, 220);
    for (let i = 0; i < img.data.length; i += 4) { const v = 110 + Math.random() * 90; img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 26; }
    x.putImageData(img, 0, 0); this.grain = c;
  }
  play() {
    if (this.playing) return; this.playing = true; this._last = performance.now();
    this.ensureAudio();
    const loop = now => {
      if (!this.playing) return;
      const dt = Math.min(0.25, (now - this._last) / 1000); this._last = now;
      this.t += dt * this.speed;
      if (this.t >= this.duration) { this.t = this.duration; this.pause(); this.draw(); this.emit('ended'); return; }
      this.draw(); this.emit('time', this.t, this.duration);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
    this.emit('play');
  }
  pause() { this.playing = false; if (this._raf) cancelAnimationFrame(this._raf); this.emit('pause'); }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t) { this.t = Math.max(0, Math.min(this.duration, t)); this.draw(); this.emit('time', this.t, this.duration); if (this.audio) this.audio.sync(this.t, this); }
  destroy() { this.pause(); if (this.audio) { try { this.audio.close(); } catch {} this.audio = null; } }

  shotAt(t) {
    for (let i = this.shots.length - 1; i >= 0; i--) if (t >= this.shots[i].start) return { shot: this.shots[i], idx: i, u: (t - this.shots[i].start) / this.shots[i].dur };
    return this.shots.length ? { shot: this.shots[0], idx: 0, u: 0 } : null;
  }

  draw() {
    const { ctx, canvas } = this;
    const info = this.shotAt(this.t);
    ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!info) { this._empty(); ctx.restore(); return; }
    const { shot, idx, u } = info;
    const next = this.shots[idx + 1];
    const T = shot.transition || 'cut';
    const dissolveT = (T === 'cross dissolve' || T === 'dip to warm black') && u > 0.88 && next;
    if (dissolveT) {
      this._drawShot(shot, u, 1);
      const a = (u - 0.88) / 0.12;
      if (T === 'dip to warm black') { ctx.fillStyle = `rgba(20,10,6,${Math.sin(a * Math.PI) * 0.9})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      else { ctx.globalAlpha = a; this._drawShot(next, 0, a); ctx.globalAlpha = 1; }
    } else this._drawShot(shot, u, 1);

    // cinematic color correction (single-pass, skin-safe)
    this._applyColorGrade();
    // grade + letterbox + grain + subtitles
    this._grade(shot);
    if (this.edl?.cinematic !== false) this._letterbox();
    if (this.grain) { ctx.globalAlpha = 0.5; const ox = (Math.random() * 60) | 0, oy = (Math.random() * 60) | 0;
      for (let x = -ox; x < canvas.width; x += 220) for (let y = -oy; y < canvas.height; y += 220) ctx.drawImage(this.grain, x, y);
      ctx.globalAlpha = 1; }
    if (this.edl?.subtitlesOn !== false) this._subtitles();
    this._hud(shot);
    ctx.restore();
    if (this.audio) this.audio.sync(this.t, this);
  }
  _empty() { const { ctx, canvas } = this; ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#5c6b8a'; ctx.font = `${canvas.width / 40}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText('No video yet — run MAKE EVERYTHING', canvas.width / 2, canvas.height / 2); }

  _drawShot(shot, u, alpha) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.save(); ctx.globalAlpha = alpha;
    this._applyCamera(shot, u, W, H);
    this._scene(shot, u, W, H);
    ctx.restore();
  }
  // one-pass color correction (skin-safe grade chosen by AUTO EDIT) — composited
  // in a single filtered drawImage instead of per-shape for fast HD rendering
  _applyColorGrade() {
    const gf = this.edl?.colorGrade?.filter;
    if (!gf) return;
    try {
      const ctx = this.ctx;
      ctx.save(); ctx.filter = gf; ctx.drawImage(this.canvas, 0, 0); ctx.restore();
    } catch {}
  }

  _applyCamera(shot, u, W, H) {
    const ctx = this.ctx; const m = shot.movement || '';
    const cx = W / 2, cy = H / 2;
    ctx.translate(cx, cy);
    let sc = 1, dx = 0, dy = 0, rot = 0;
    const ease = t => t * t * (3 - 2 * t);
    if (/push-in|dolly-in/.test(m)) sc = 1 + (/fast/.test(m) ? 0.28 : 0.14) * ease(u);
    else if (/dolly-out|crane shot/.test(m)) sc = 1 + (/crane/.test(m) ? 0.18 : 0.12) * (1 - ease(u));
    else if (/drone|aerial/.test(m)) { sc = 1.16 - 0.2 * ease(u); dy = -H * 0.03 * ease(u); }
    else if (/pan/.test(m)) dx = (u - 0.5) * W * 0.22;
    else if (/tilt/.test(m)) dy = (u - 0.5) * H * 0.14;
    else if (/orbit/.test(m)) { dx = Math.sin(u * Math.PI * 2) * W * 0.05; sc = 1 + Math.sin(u * Math.PI) * 0.06; }
    else if (/tracking|steadycam/.test(m)) { dx = (u - 0.5) * W * 0.1; sc = 1.03; }
    if (/handheld/.test(m)) { dx += Math.sin(this.t * 9.1) * 3.2 + Math.sin(this.t * 23.7) * 1.4; dy += Math.cos(this.t * 11.3) * 2.6; rot += Math.sin(this.t * 7.7) * 0.006; }
    if (shot.angle === 'dutch') rot += 0.07;
    if (shot.angle === 'high') dy += H * 0.02;
    if (shot.angle === 'low') dy -= H * 0.02;
    ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-cx + dx, -cy + dy);
  }

  _scene(shot, u, W, H) {
    const ctx = this.ctx;
    const pal = PALETTES[shot.tod] || PALETTES.Morning;
    const loc = (shot.locationName || '').toLowerCase();
    const seed = (shot.idx || 0) + 1;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.sky[0]); g.addColorStop(0.55, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    // sun / moon
    const sx = W * (0.22 + hashNum(seed) * 0.5), sy = H * (shot.tod === 'Dawn' ? 0.4 : shot.tod === 'Dusk' ? 0.5 : 0.24);
    ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(sx, sy, H * 0.045, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(sx, sy, H * 0.12, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    // mountains (village/hills)
    if (/mountain|village|field|courtyard|boundary/.test(loc) || shot.locationName?.includes('Village')) {
      for (let L = 0; L < 3; L++) {
        const baseY = H * (0.46 + L * 0.1);
        ctx.fillStyle = ['rgba(70,88,110,.75)', 'rgba(52,66,84,.85)', 'rgba(38,50,64,.95)'][L];
        ctx.beginPath(); ctx.moveTo(-W, H);
        for (let i = -1; i <= 8; i++) { const x = -W + (i / 8) * W * 3; const y = baseY - hashNum(seed * 7 + L * 13 + i) * H * 0.16; ctx.lineTo(x, y); }
        ctx.lineTo(W * 2, H); ctx.closePath(); ctx.fill();
      }
    }
    // ground
    const gy = H * 0.62;
    ctx.fillStyle = pal.ground; ctx.fillRect(-W, gy, W * 3, H * 2);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-W, gy + H * 0.22, W * 3, H * 2);
    // houses
    if (/village|courtyard|field|street|home|interior/.test(loc) || /Village|Home|Field/.test(shot.locationName || '')) {
      const interior = /interior|home/.test(loc);
      const n = interior ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const hw = W * 0.09, hh = H * (interior ? 0.34 : 0.16) * (0.8 + hashNum(seed + i) * 0.5);
        const x = -W * 0.1 + i * W * 0.17 + hashNum(seed * 3 + i) * 20;
        const y = interior ? H * 0.72 : gy + H * 0.02;
        ctx.fillStyle = ['rgba(150,110,76,1)', 'rgba(122,88,62,1)', 'rgba(168,128,92,1)'][i % 3];
        ctx.fillRect(x, y - hh, hw, hh);
        ctx.fillStyle = 'rgba(74,52,38,1)'; ctx.fillRect(x - 4, y - hh - 8, hw + 8, 10);
        ctx.fillStyle = (shot.tod === 'Dusk' || shot.tod === 'Dawn') ? 'rgba(255,205,110,.95)' : 'rgba(40,28,20,.9)';
        ctx.fillRect(x + hw * 0.36, y - hh * 0.62, hw * 0.24, hh * 0.3);
      }
      if (interior) { // window light shaft
        ctx.fillStyle = 'rgba(255,236,180,.14)'; ctx.beginPath();
        ctx.moveTo(W * 0.1, H * 0.12); ctx.lineTo(W * 0.34, H * 0.12); ctx.lineTo(W * 0.5, H); ctx.lineTo(W * 0.08, H); ctx.fill();
      }
    }
    // boundary stone prop for land-dispute scenes
    if (/field|boundary/.test(shot.locationName || '')) {
      ctx.fillStyle = '#8d8577'; ctx.fillRect(W * 0.62, gy + H * 0.04, W * 0.035, H * 0.1);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(W * 0.62, gy + H * 0.04, W * 0.035, H * 0.02);
    }
    // wind-blown dust / weather
    ctx.strokeStyle = 'rgba(255,240,210,.28)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const px = ((hashNum(seed * 11 + i) * W * 1.6 + this.t * (40 + i * 9)) % (W * 1.4)) - W * 0.2;
      const py = H * (0.35 + hashNum(seed + i * 5) * 0.5) + Math.sin(this.t * 2 + i) * 8;
      ctx.globalAlpha = 0.12 + hashNum(i + seed) * 0.2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 26 + hashNum(i) * 30, py + 3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // birds
    if (/Dawn|Morning|Golden/.test(shot.tod)) {
      ctx.strokeStyle = 'rgba(20,20,30,.6)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const bx = (W * 0.15 + i * W * 0.16 + this.t * 14) % W; const by = H * 0.16 + Math.sin(this.t * 1.6 + i * 2) * 10 + i * 9;
        ctx.beginPath(); ctx.moveTo(bx - 7, by); ctx.quadraticCurveTo(bx, by - 5, bx + 7, by); ctx.stroke();
      }
    }
    // characters
    const cast = (shot.castIds || []).map(id => (this.project?.artifacts?.characters || []).find(c => c.id === id)).filter(Boolean);
    const closeup = (shot.size || '').includes('close-up') || (shot.size || '').includes('POV');
    if (closeup) {
      const c = cast[0] || defaultChar();
      // professional framing: rule-of-thirds subject placement (alternating screen side)
      const bias = ((shot.idx || 0) % 2 ? -1 : 1) * W * 0.03;
      this._drawFace(W / 2 + bias + (cast[1] ? -W * 0.06 : 0), H * 0.52, Math.min(W, H) * 0.34, c, shot, u);
      if (cast[1] && (shot.size || '').includes('over-the-shoulder')) {
        ctx.save(); ctx.globalAlpha = 0.9; this._drawOTS(W, H, cast[1], shot); ctx.restore();
      }
    } else {
      const spots = cast.length > 1 ? [W * 0.38, W * 0.58, W * 0.7] : [W * 0.5];
      cast.slice(0, 3).forEach((c, i) => this._drawFigure(spots[i], gy + H * 0.06, H * 0.24, c, shot, u, i));
    }
    // atmosphere
    ctx.fillStyle = pal.amb; ctx.fillRect(-W, -H, W * 3, H * 3);
    if (/wind|dust/.test((shot.soundDesign || []).join(' '))) {
      ctx.fillStyle = 'rgba(230,200,150,.10)';
      for (let i = 0; i < 5; i++) { const x = ((this.t * 60 + i * 240) % (W + 200)) - 100; ctx.beginPath(); ctx.ellipse(x, H * (0.5 + i * 0.07), 90, 8, 0.1, 0, 7); ctx.fill(); }
    }
  }

  _figBase(x, y, s, c, u, i) { return { x, y, s, c }; }
  _drawFigure(x, y, s, c, shot, u, i) {
    const ctx = this.ctx; const p = c.palette || { cloth: '#6b4a2f', skin: '#b07b4f', hair: '#1b1310' };
    const anim = shot.animation || 'static';
    const phase = this.t * 2.4 + i * 1.7;
    const walk = anim === 'walk' ? 1 : 0;
    const drift = walk ? ((u - 0.5) * 60) : 0;
    const bob = walk ? Math.abs(Math.sin(phase * 2)) * 5 : Math.sin(phase) * 2;
    const sway = anim === 'gesture' ? Math.sin(phase * 1.3) * 0.09 : 0;
    const X = x + drift + (i ? i * 8 : 0), Y = y - bob;
    ctx.save(); ctx.translate(X, Y); ctx.rotate(sway * 0.15);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 4, s * 0.34, s * 0.06, 0, 0, 7); ctx.fill();
    // legs
    const legSpread = walk ? Math.sin(phase * 2) * s * 0.1 : s * 0.05;
    ctx.strokeStyle = '#2c2620'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.lineTo(-legSpread, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.lineTo(legSpread, 0); ctx.stroke();
    // body (traditional loose clothing)
    ctx.fillStyle = p.cloth;
    ctx.beginPath(); ctx.moveTo(0, -s * 1.02); ctx.lineTo(s * 0.24, -s * 0.36); ctx.lineTo(-s * 0.24, -s * 0.36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = p.cloth2 || p.cloth; ctx.fillRect(-s * 0.19, -s * 0.86, s * 0.38, s * 0.3); // waistcoat
    // arms
    const armSw = anim === 'gesture' ? Math.sin(phase * 2) * 0.5 : walk ? -Math.sin(phase * 2) * 0.35 : 0;
    ctx.strokeStyle = p.cloth; ctx.lineWidth = s * 0.09;
    ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.84); ctx.lineTo(-s * 0.3 - armSw * s * 0.1, -s * 0.44 + armSw * s * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.16, -s * 0.84); ctx.lineTo(s * 0.3 + armSw * s * 0.1, -s * 0.44 - armSw * s * 0.1); ctx.stroke();
    // head
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(0, -s * 1.14, s * 0.15, 0, 7); ctx.fill();
    ctx.fillStyle = p.hair || '#1b1310'; ctx.beginPath(); ctx.arc(0, -s * 1.17, s * 0.15, Math.PI, 0); ctx.fill();
    // shawl / cap accent
    if (i === 0) { ctx.fillStyle = p.accent || '#c9a227'; ctx.fillRect(-s * 0.1, -s * 1.26, s * 0.2, s * 0.04); }
    ctx.restore();
  }
  _drawFace(cx, cy, r, c, shot, u) {
    const ctx = this.ctx; const p = c.palette || { cloth: '#6b4a2f', skin: '#b07b4f', hair: '#1b1310' };
    const breathe = Math.sin(this.t * 1.8) * r * 0.008;
    ctx.save(); ctx.translate(cx, cy + breathe);
    // shoulders
    ctx.fillStyle = p.cloth; ctx.beginPath(); ctx.ellipse(0, r * 1.05, r * 0.95, r * 0.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = p.cloth2 || p.cloth; ctx.beginPath(); ctx.ellipse(0, r * 1.12, r * 0.5, r * 0.4, 0, Math.PI, 0); ctx.fill();
    // neck
    ctx.fillStyle = p.skin; ctx.fillRect(-r * 0.16, r * 0.3, r * 0.32, r * 0.5);
    // head
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.56, r * 0.72, 0, 0, 7); ctx.fill();
    // hair / cap
    ctx.fillStyle = p.hair || '#1b1310'; ctx.beginPath(); ctx.ellipse(0, -r * 0.32, r * 0.58, r * 0.46, 0, Math.PI, 0); ctx.fill();
    if (/waistcoat|pakol|cap/.test(c.clothing || '')) { ctx.fillStyle = p.accent || '#8a6b45'; ctx.fillRect(-r * 0.55, -r * 0.78, r * 1.1, r * 0.16); }
    // eyes + blink
    const blink = (Math.sin(this.t * 3.1 + r) > 0.985) ? 0.15 : 1;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.05, r * 0.12, r * 0.07 * blink, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.22, -r * 0.05, r * 0.12, r * 0.07 * blink, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#241a14'; ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.05, r * 0.045 * blink, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.05, r * 0.045 * blink, 0, 7); ctx.fill();
    // brows by emotion
    const em = shot.expression || '';
    ctx.strokeStyle = p.hair || '#1b1310'; ctx.lineWidth = r * 0.045; ctx.lineCap = 'round';
    const tiltIn = /anger|angry|raw|confrontation|guarded|tense/.test(em) ? 0.09 : /hurt|vulnerable|relief/.test(em) ? -0.07 : 0.02;
    ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.18 - tiltIn * r); ctx.lineTo(-r * 0.1, -r * 0.2 + tiltIn * r * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.34, -r * 0.18 - tiltIn * r); ctx.lineTo(r * 0.1, -r * 0.2 + tiltIn * r * 1.4); ctx.stroke();
    // mouth (speaks when dialogue active in this shot)
    const speaking = this._activeSub() != null;
    ctx.strokeStyle = '#5a3226'; ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    if (speaking) { const open = r * 0.05 + Math.abs(Math.sin(this.t * 11)) * r * 0.07; ctx.ellipse(0, r * 0.3, r * 0.14, open, 0, 0, 7); ctx.stroke(); }
    else if (/soft|relief|calm|hope|shame/.test(em)) ctx.quadraticCurveTo(0, r * 0.34, r * 0.14, r * 0.27);
    else if (/anger|angry|raw/.test(em)) ctx.quadraticCurveTo(0, r * 0.22, r * 0.14, r * 0.32);
    else ctx.moveTo(-r * 0.14, r * 0.29), ctx.lineTo(r * 0.14, r * 0.29);
    ctx.stroke();
    // stubble / beard hint
    ctx.fillStyle = 'rgba(30,20,15,.22)'; ctx.beginPath(); ctx.ellipse(0, r * 0.42, r * 0.3, r * 0.16, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  _drawOTS(W, H, c, shot) {
    const ctx = this.ctx; const p = c.palette || {};
    ctx.fillStyle = p.cloth || '#40342a';
    ctx.beginPath(); ctx.ellipse(W * 0.82, H * 1.05, W * 0.3, H * 0.5, -0.2, 0, 7); ctx.fill();
    ctx.fillStyle = p.skin || '#b07b4f'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.6, H * 0.14, 0, 7); ctx.fill();
    ctx.fillStyle = p.hair || '#1b1310'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.57, H * 0.14, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  }

  _grade(shot) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const grade = this.edl?.grade || this.project?.artifacts?.analysis?.style;
    if (grade === 'cinematic' || grade === 'ultra-realistic' || this.edl?.cinematic) {
      ctx.save(); ctx.globalCompositeOperation = 'overlay';
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, 'rgba(20,80,120,.30)'); g.addColorStop(1, 'rgba(220,120,40,.26)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(255,245,235,.06)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    } else if (grade === 'noir') { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#20242c'; ctx.globalCompositeOperation = 'saturation'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    else if (grade === 'village' || grade === 'dramatic') {
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,170,60,.18)'); g.addColorStop(1, 'rgba(60,40,20,.20)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  _letterbox() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, b = H * 0.06;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b);
  }
  _activeSub() { return this.subs.find(s => this.t >= s.start && this.t <= s.end) || null; }
  _subtitles() {
    const s = this._activeSub(); if (!s) return;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const st = this.edl?.subtitleStyle || { size: 0.05, color: '#fff', outline: '#000', position: 'bottom', animated: true };
    const vertical = this.aspect === '9:16';
    const fontPx = Math.round(H * (vertical ? 0.042 : 0.052) * ((st.size || 72) / 72));
    const age = this.t - s.start;
    const anim = st.animated !== false ? Math.min(1, age / 0.18) : 1;
    // platform safe areas: keep captions clear of TikTok/Reels/YouTube UI
    const safe = this.edl?.safe;
    const yBase = st.position === 'top'
      ? H * (0.12 + (safe?.top || 0))
      : H * (1 - (safe?.bottom != null ? safe.bottom : 0.13) - 0.045);
    const y = yBase + (st.animated !== false ? (1 - anim) * 14 : 0);
    ctx.save();
    ctx.globalAlpha = anim;
    ctx.font = `700 ${fontPx}px ${st.font || 'system-ui'}, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rtl = ['ur', 'ar', 'ps', 'fa'].includes(this.project?.artifacts?.subtitles?.language);
    if (rtl) { ctx.direction = 'rtl'; }
    const lines = wrap(ctx, s.text, W * 0.86, 2);
    ctx.lineWidth = Math.max(3, fontPx * 0.16); ctx.strokeStyle = st.outline || '#000'; ctx.lineJoin = 'round';
    if (st.style === 'box' || st.style === 'karaoke') { ctx.fillStyle = 'rgba(0,0,0,.62)';
      const w = Math.min(W * 0.9, Math.max(...lines.map(l => ctx.measureText(l).width)) + 40);
      ctx.fillRect(W / 2 - w / 2, y - lines.length * fontPx * 0.72 - 8, w, lines.length * fontPx * 1.45 + 16); }
    lines.forEach((l, i) => {
      const yy = y + (i - (lines.length - 1) / 2) * fontPx * 1.3;
      if (st.style === 'karaoke') { ctx.fillStyle = st.color || '#ffe08a'; ctx.strokeStyle = '#000'; }
      else ctx.fillStyle = st.color || '#fff';
      ctx.strokeText(l, W / 2, yy); ctx.fillText(l, W / 2, yy);
    });
    ctx.restore();
  }
  _hud(shot) {
    // subtle director HUD — shot info (toggleable via opts.hud)
    if (!this.optsHud) return;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.save(); ctx.font = `600 ${Math.round(H * 0.026)}px monospace`; ctx.fillStyle = 'rgba(120,255,170,.85)'; ctx.textAlign = 'left';
    ctx.fillText(`#${shot.idx + 1} ${shot.size} · ${shot.movement} · ${shot.lens} · ${shot.tod}`, 18, H * 0.5 + 0 + (H * 0.09));
    ctx.restore();
  }

  // ---- procedural audio (music + ambience + sfx) ----
  ensureAudio() {
    if (this.audio || this.muted) return;
    try { this.audio = new RoktokAudio(this); this.audio.build(); } catch (e) { console.warn('audio unavailable', e); }
  }
  setMuted(m) { this.muted = m; if (m && this.audio) { this.audio.close(); this.audio = null; } else if (!m) { this.audio = new RoktokAudio(this); this.audio.build(); this.audio.sync(this.t, this); } }

  // ---- export ----
  async exportWebM({ fps = null, onProgress, onStatus } = {}) {
    if (!window.MediaRecorder) throw new Error('MediaRecorder unsupported in this browser');
    if (this.shots.length === 0) throw new Error('Nothing to render');
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) throw new Error('WebM recording unsupported');
    const preset = this.edl?.export || {};
    const outFps = fps || Math.min(60, preset.fps || 30);                  // platform fps (24/30…)
    const bitrate = Math.round((preset.bitrateMbps || 8) * 1_000_000);      // platform bitrate
    this.seek(0);
    const stream = this.canvas.captureStream(outFps);
    this.ensureAudio();
    if (this.audio?.dest) { try { stream.addTrack(this.audio.dest.stream.getAudioTracks()[0]); } catch {} }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve, reject) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      rec.onerror = e => reject(e.error || new Error('recording failed'));
    });
    onStatus?.('Rendering… (real-time export)');
    rec.start(500);
    await new Promise(res => { this.play(); this.on('ended', res); });
    // wait a beat for final frames
    await new Promise(r => setTimeout(r, 300));
    rec.stop();
    this.pause();
    const blob = await done;
    onProgress?.(1);
    return blob;
  }
  async grabFrame(t = null) {
    if (t != null) { const was = this.t; this.seek(t); const b = await new Promise(r => this.canvas.toBlob(r, 'image/png')); this.t = was; this.draw(); return b; }
    return new Promise(r => this.canvas.toBlob(r, 'image/png'));
  }
}

function defaultChar() { return { palette: { cloth: '#6b4a2f', cloth2: '#8a6b45', skin: '#b07b4f', hair: '#1b1310', accent: '#c9a227' }, clothing: 'traditional', name: 'Lead' }; }
function wrap(ctx, text, maxW, maxLines = 2) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxW / (ctx.measureText('a').width || 8)) { lines.push(cur.trim()); cur = w; if (lines.length === maxLines) break; } else cur += ' ' + w; }
  if (cur.trim() && lines.length < maxLines) lines.push(cur.trim());
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length + 2) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1,3}$/, '…');
  }
  return lines.length ? lines : [String(text).slice(0, 40)];
}

// Procedural score / ambience / SFX using Web Audio API
export class RoktokAudio {
  constructor(player) { this.p = player; this.ctx = null; }
  build() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.dest = this.ctx.createMediaStreamDestination(); this.master.connect(this.dest);
    // ambience: filtered noise (wind)
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 480;
    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.10;
    src.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.master); src.start();
    // music pad
    this.padGain = this.ctx.createGain(); this.padGain.gain.value = 0; this.padGain.connect(this.master);
    this.oscs = [];
    [0, 1, 2].forEach(i => { const o = this.ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle';
      const g = this.ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.22; o.connect(g); g.connect(this.padGain); o.start(); this.oscs.push({ o, g }); });
    this._nextSfx = 0; this._chordIdx = 0;
  }
  _moodFreqs(mood) {
    const M = { tension: [110, 130.8, 164.8], suspense: [98, 116.5, 146.8], drama: [130.8, 164.8, 196],
      emotional: [146.8, 174.6, 220], sad: [110, 130.8, 155.6], calm: [130.8, 164.8, 196],
      hopeful: [164.8, 207.7, 246.9], warm: [146.8, 185, 220], intense: [110, 138.6, 164.8],
      village: [130.8, 155.6, 196], comedy: [164.8, 196, 246.9], documentary: [110, 146.8, 174.6],
      suspense: [98, 116.5, 146.8], curiosity: [123.5, 155.6, 185] };
    return M[mood] || M.calm;
  }
  sync(t, player) {
    if (!this.ctx) return; if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const v = player.edl?.volumes || {};
    // current music segment (rebased onto the edited timeline)
    const seg = (player.musicSegments || player.project?.artifacts?.audio?.music?.segments || []).find(s => t >= s.start && t < s.start + s.dur);
    const mood = player.edl?.musicMood || seg?.mood || 'calm';
    // AUTO EDIT: automatic music ducking whenever dialogue/subtitles are on screen
    const enhance = player.edl?.audioEnhance;
    const speaking = (player.subs || []).some(s => t >= s.start && t <= s.end);
    const duck = enhance?.ducking === false ? 1 : (speaking ? 0.42 : 1);
    const targetPad = player.muted ? 0 : (v.music ?? 0.55) * 0.14 * ((seg?.intensity ?? 0.5) + 0.35) * duck;
    this.padGain.gain.setTargetAtTime(targetPad, this.ctx.currentTime, 0.25);
    const f = this._moodFreqs(mood);
    this.oscs.forEach((x, i) => x.o.frequency.setTargetAtTime(f[i] * (i === 2 ? 2 : 1), this.ctx.currentTime, 0.5));
    this.windGain.gain.setTargetAtTime((v.ambience ?? 0.4) * 0.14 * (enhance?.noiseReduction ? 0.8 : 1), this.ctx.currentTime, 0.5);
    // fire sfx whose time has passed (rebased list when cuts/auto-edit applied)
    const sfx = player.sfxList || player.project?.artifacts?.audio?.sfx || [];
    if (t < this._lastT) this._nextSfx = 0;
    this._lastT = t;
    for (const fx of sfx) {
      if (fx.t >= t - 0.05 && fx.t < t + 0.2 && fx.t >= this._nextSfx - 0.001) {
        this._nextSfx = fx.t + 0.4; this._burst(fx.name, (v.sfx ?? 0.7) * (fx.vol ?? 0.5));
      }
    }
  }
  _burst(name, vol) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const g = this.ctx.createGain(); g.connect(this.master);
    if (/bird|rooster|crow/.test(name)) {
      const o = this.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(1800, now); o.frequency.exponentialRampToValueAtTime(2600, now + 0.08);
      o.frequency.exponentialRampToValueAtTime(2000, now + 0.16);
      g.gain.setValueAtTime(vol * 0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      o.connect(g); o.start(now); o.stop(now + 0.22);
    } else if (/footstep|step|walking|tools/.test(name)) {
      for (let i = 0; i < 3; i++) {
        const t0 = now + i * 0.28; const o = this.ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(160 + Math.random() * 60, t0);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol * 0.10, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1); o.connect(g); o.start(t0); o.stop(t0 + 0.12);
      }
    } else if (/door|slam|creak/.test(name)) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, now);
      o.frequency.exponentialRampToValueAtTime(90, now + 0.3);
      g.gain.setValueAtTime(vol * 0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      o.connect(g); o.start(now); o.stop(now + 0.36);
    } else if (/wind|gust|dust/.test(name)) {
      const o = this.ctx.createBufferSource(); const len = this.ctx.sampleRate * 0.7;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const dd = b.getChannelData(0);
      for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
      o.buffer = b; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700;
      g.gain.value = vol * 0.10; o.connect(f); f.connect(g); o.start(now);
    } else if (/voice|shout|argu/.test(name)) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, now);
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol * 0.05, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5); o.connect(g); o.start(now); o.stop(now + 0.55);
    } else { // generic soft tick
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 600;
      g.gain.setValueAtTime(vol * 0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      o.connect(g); o.start(now); o.stop(now + 0.14);
    }
  }
  close() { try { this.ctx?.close(); } catch {} this.ctx = null; }
}
