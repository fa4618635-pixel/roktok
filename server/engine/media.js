// ROKTOK — Audio engine (music + SFX plans) & Subtitle engine (SRT/VTT, styles)
import { uid } from '../store.js';

// ---------------- MUSIC & SOUND ----------------
export function generateAudioPlan(analysis, shots, story) {
  const moodsByArc = {
    hook: ['tension', 'curiosity'], setup: ['calm', 'village'],
    conflict: ['drama', 'suspense'], emotion: ['emotional', 'sad'],
    climax: ['drama', 'intense'], reconcile: ['emotional', 'hopeful'],
    resolve: ['hopeful', 'warm'], narration: ['documentary', 'calm']
  };
  const segments = [];
  let last = null;
  for (const s of shots) {
    const mood = (moodsByArc[s.sceneArc] || ['calm'])[s.idx % 2];
    if (!last || last.mood !== mood || s.start - (last.start + last.dur) > 0.1) {
      last = { start: s.start, dur: s.dur, mood, intensity: s.musicIntensity, genre: musicGenre(analysis) };
      segments.push(last);
    } else { last.dur = +(last.start + last.dur - last.start + s.dur).toFixed(2); last.dur = +(s.start + s.dur - last.start).toFixed(2); last.intensity = Math.max(last.intensity, s.musicIntensity); }
  }
  const sfx = [];
  for (const s of shots) {
    s.soundDesign.forEach((name, i) => {
      const t = s.start + (i === 0 ? 0.3 : Math.min(s.dur - 0.5, 1 + i * 1.4));
      sfx.push({ id: uid('fx'), t: +t.toFixed(2), name, shotId: s.id, vol: name.includes('wind') ? 0.25 : name.includes('voices') ? 0.7 : 0.5 });
    });
    (s.dialogue || []).forEach(d => {
      sfx.push({ id: uid('fx'), t: d.start, name: 'cloth & breath', shotId: s.id, vol: 0.2 });
    });
  }
  return {
    music: {
      title: `${story.title} — Original Score`,
      genre: musicGenre(analysis),
      modes: [analysis.style === 'village' ? 'village' : analysis.genre === 'comedy' ? 'comedy' : 'cinematic', analysis.intensity === 'high' ? 'emotional' : 'dramatic'],
      segments,
      autoFit: `score auto-fits ${analysis.durationSec}s timeline`,
      providerStatus: 'demo-procedural' // procedural preview engine; connect a music provider for rendered stems
    },
    ambience: ambienceFor(analysis, shots),
    sfx,
    levels: { dialogue: 0, music: -12, sfx: -8, ambience: -14 } // dB targets
  };
}
function musicGenre(a) {
  if (a.style === 'village' || a.theme === 'land_conflict') return 'village-cinematic';
  if (a.genre === 'comedy') return 'light-comedy';
  if (a.genre === 'action') return 'percussive-action';
  if (a.genre === 'documentary') return 'ambient-documentary';
  return 'emotional-cinematic';
}
function ambienceFor(a, shots) {
  const set = new Set();
  for (const s of shots) {
    if (/village|mountain/.test(s.locationName.toLowerCase()) || s.locationName.includes('Field')) {
      set.add('village ambience'); set.add('wind'); set.add('birds');
    } else set.add('room tone');
    if (s.tod === 'Dawn' || s.tod === 'Morning') set.add('morning birds');
    if (s.tod === 'Dusk') set.add('crickets');
  }
  return [...set];
}

// ---------------- SUBTITLES ----------------
export function generateSubtitles(analysis, shots, style) {
  const subs = [];
  for (const s of shots) {
    for (const d of s.dialogue || []) {
      // chunk long lines into readable subtitle units
      const chunks = chunkText(d.text, 42);
      const per = d.dur / chunks.length;
      chunks.forEach((c, i) => {
        subs.push({
          id: uid('sub'),
          start: +(d.start + i * per).toFixed(2),
          end: +(d.start + (i + 1) * per - 0.05).toFixed(2),
          text: c, speaker: d.speaker, charId: d.charId, shotId: s.id, emotion: d.emotion
        });
      });
    }
  }
  subs.sort((a, b) => a.start - b.start);
  return {
    language: analysis.language, languageName: analysis.lang.name, direction: analysis.lang.dir,
    items: subs,
    style: style || { style: 'cinematic', size: 72, color: '#ffffff', outline: '#000000', position: 'bottom', animated: true, font: 'Inter' },
    speakerDetection: true, wordTiming: 'approximate (demo engine)', providerStatus: 'demo'
  };
}
function chunkText(text, max) {
  if (text.length <= max) return [text];
  const words = text.split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { out.push(cur.trim()); cur = w; }
    else cur += ' ' + w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export function toSRT(subs) {
  const ts = s => {
    const ms = Math.max(0, Math.round(s * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0');
    const sec = String(Math.floor(ms % 60000 / 1000)).padStart(2, '0');
    const mil = String(ms % 1000).padStart(3, '0');
    return `${h}:${m}:${sec},${mil}`;
  };
  return subs.map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.speaker && s.speaker !== 'Narrator' ? s.speaker + ': ' : ''}${s.text}\n`).join('\n');
}
export function toVTT(subs) {
  const ts = s => {
    const ms = Math.max(0, Math.round(s * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0');
    const sec = String(Math.floor(ms % 60000 / 1000)).padStart(2, '0');
    const mil = String(ms % 1000).padStart(3, '0');
    return `${h}:${m}:${sec}.${mil}`;
  };
  return `WEBVTT\n\n` + subs.map(s => `${ts(s.start)} --> ${ts(s.end)}\n${s.speaker && s.speaker !== 'Narrator' ? '<v ' + s.speaker + '>' : ''}${s.text}\n`).join('\n');
}
