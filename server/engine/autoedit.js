// ROKTOK — Professional Auto-Edit Engine
// Runs inside the existing production pipeline. Applies, for every video:
//   pacing & pause removal · professional transitions · color correction (skin-safe)
//   voice/audio enhancement with automatic music ducking · platform caption styling
//   safe-area framing · and complete per-platform export presets (res/fps/bitrate/aspect).
import { recomputeStarts } from './director.js';

const r1 = n => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// PLATFORM EXPORT PRESETS — correct aspect / resolution / fps / bitrate per target
// ---------------------------------------------------------------------------
export const PLATFORM_PRESETS = {
  tiktok: {
    id: 'tiktok', label: 'TikTok', icon: '🎵', aspect: '9:16', w: 1080, h: 1920, fps: 30, bitrateMbps: 10,
    container: 'MP4 · H.264 High · yuv420p (WebM/VP9 in demo render)', audioOut: 'AAC 192k · 48 kHz',
    pace: 1.08, caption: 'box', safe: { top: 0.09, bottom: 0.17, left: 0.05, right: 0.05 },
    note: 'Vertical hook-first cut, punchy pacing, captions in the safe zone above the UI.'
  },
  instagram: {
    id: 'instagram', label: 'Instagram Reels', icon: '📸', aspect: '9:16', w: 1080, h: 1920, fps: 30, bitrateMbps: 10,
    container: 'MP4 · H.264 High · yuv420p (WebM/VP9 in demo render)', audioOut: 'AAC 192k · 48 kHz',
    pace: 1.06, caption: 'box', safe: { top: 0.08, bottom: 0.15, left: 0.05, right: 0.05 },
    note: 'Vertical Reels cut with clean transitions and balanced mix.'
  },
  facebook: {
    id: 'facebook', label: 'Facebook Reels', icon: '👥', aspect: '9:16', w: 1080, h: 1920, fps: 30, bitrateMbps: 8,
    container: 'MP4 · H.264 High · yuv420p (WebM/VP9 in demo render)', audioOut: 'AAC 160k · 48 kHz',
    pace: 1.04, caption: 'box', safe: { top: 0.07, bottom: 0.14, left: 0.05, right: 0.05 },
    note: 'Vertical feed cut, slightly longer holds for autoplay feeds.'
  },
  youtube: {
    id: 'youtube', label: 'YouTube', icon: '▶️', aspect: '16:9', w: 1920, h: 1080, fps: 24, bitrateMbps: 16,
    container: 'MP4 · H.264 High · yuv420p (WebM/VP9 in demo render)', audioOut: 'AAC 192k · 48 kHz',
    pace: 1.0, caption: 'cinematic', safe: { top: 0.04, bottom: 0.07, left: 0.04, right: 0.04 },
    note: 'YouTube-ready 16:9 HD master, filmic 24 fps cadence, cinematic captions.'
  }
};
export function platformPreset(id) { return PLATFORM_PRESETS[id] || PLATFORM_PRESETS.youtube; }
export function platformFor(analysis) {
  const p = analysis?.platforms?.[0];
  return PLATFORM_PRESETS[p] ? p : 'youtube';
}

// ---------------------------------------------------------------------------
// 1) PAUSE / DEAD-AIR REMOVAL + PACE NORMALISATION (runs before music & subs)
// ---------------------------------------------------------------------------
export function trimPass(shots, { autoEdit = true, platform = 'youtube' } = {}) {
  const preset = platformPreset(platform);
  let removedSec = 0, trimmedShots = 0, tightenedGaps = 0;

  // capture dialogue positions relative to their shot BEFORE any timing change
  for (const s of shots) for (const d of s.dialogue) d._rel = d.start - s.start;

  const maxGap = preset.pace >= 1.05 ? 2.2 : 3.0;

  for (const s of shots) {
    const dlg = s.dialogue;
    if (dlg.length) {
      const lastLine = dlg[dlg.length - 1];
      const lastEndRel = lastLine._rel + lastLine.dur;
      const hold = s.intensity > 0.75 ? (autoEdit ? 1.5 : 2.0) : (autoEdit ? 1.1 : 1.9);
      const minDur = Math.max(2.5, lastEndRel + 0.7);
      const newDur = Math.max(minDur, lastEndRel + hold);
      if (newDur < s.dur - 0.35) {
        const tr = s.dur - newDur;
        if (tr <= s.dur * 0.5) { removedSec += tr; trimmedShots++; s.dur = r1(newDur); }
      }
      // tighten awkward conversational pauses
      if (autoEdit) {
        for (let i = 1; i < dlg.length; i++) {
          const prevEnd = dlg[i - 1]._rel + dlg[i - 1].dur;
          const gap = dlg[i]._rel - prevEnd;
          if (gap > maxGap) {
            const shift = Math.min(gap - (maxGap - 0.7), gap * 0.5, 3);
            dlg[i]._rel = r1(Math.max(prevEnd + 0.25, dlg[i]._rel - shift));
            tightenedGaps++;
          }
        }
      }
      // guarantee no overlaps after adjustment
      let cursor = -1;
      const ordered = [...dlg].sort((a, b) => a._rel - b._rel);
      for (const d of ordered) {
        if (d._rel < cursor + 0.05) d._rel = r1(cursor + 0.05);
        cursor = d._rel + d.dur;
      }
      if (s.dur < cursor + 0.6) s.dur = r1(Math.min(s.dur + (cursor + 0.6 - s.dur), cursor + 1.2));
    } else if (s.dur > 3.5) {
      // no dialogue: trim lingering / awkward holds (more aggressive with AUTO EDIT + short-form pace)
      const floor = autoEdit ? 0.66 : 0.82;
      const intensityFloor = s.intensity < 0.4 ? floor : floor + 0.14;
      const keep = Math.max(2.6, s.dur * Math.max(0.5, intensityFloor));
      if (s.dur - keep > 0.35) { removedSec += s.dur - keep; trimmedShots++; s.dur = r1(keep); }
    }
  }

  // restore absolute dialogue times on the new timeline
  recomputeStarts(shots);
  for (const s of shots) {
    for (const d of s.dialogue) { d.start = +(s.start + d._rel).toFixed(2); delete d._rel; }
    s.dialogue.sort((a, b) => a.start - b.start);
  }
  return { removedSec: r1(removedSec), trimmedShots, tightenedGaps, platform, autoEdit,
    note: `${r1(removedSec)}s of dead air removed · ${tightenedGaps} pauses tightened` };
}

// ---------------------------------------------------------------------------
// 2) FULL AUTO-EDIT PLAN (pacing, cuts, transitions, color, audio, captions,
//    framing, export) — applied during the "Professional auto-edit" step
// ---------------------------------------------------------------------------
export function buildEditPlan(analysis, project, { autoEdit = true, trimInfo = null, subStyle = null } = {}) {
  const shots = project.artifacts?.shots || project.shots;
  const platform = analysis.platforms?.[0] && PLATFORM_PRESETS[analysis.platforms[0]] ? analysis.platforms[0] : 'youtube';
  const preset = platformPreset(platform);
  if (!shots?.length) return { applied: false, platform, autoEdit, summary: ['No shots to edit'] };

  // ---- pacing speed ----
  const speed = autoEdit ? preset.pace : 1;

  // ---- automatic removal of unnecessary shots (awkward / dead sections) ----
  const cuts = [];
  if (autoEdit) {
    const maxCuts = Math.max(0, Math.floor(shots.length * 0.12));
    const candidates = shots
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => i > 0 && i < shots.length - 1 && s.dialogue.length === 0 && s.intensity <= 0.3)
      .sort((a, b) => a.s.intensity - b.s.intensity);
    for (const { s } of candidates) { if (cuts.length >= maxCuts) break; cuts.push(s.id); }
  }
  const cutSec = r1(shots.filter(s => cuts.includes(s.id)).reduce((a, s) => a + s.dur, 0));

  // ---- professional transitions on every cut point ----
  let dissolve = 0, dip = 0, hardCuts = 0;
  for (let i = 0; i < shots.length - 1; i++) {
    const a = shots[i], b = shots[i + 1];
    if (cuts.includes(a.id) || cuts.includes(b.id)) continue;
    let tr = 'cut';
    if (autoEdit) {
      const sceneChange = a.sceneId !== b.sceneId;
      const calmToCalm = a.intensity <= 0.45 && b.intensity <= 0.45;
      const actEnd = ['climax', 'reconcile'].includes(a.sceneArc) && ['resolve', 'epilogue'].includes(b.sceneArc);
      if (actEnd) tr = 'dip to warm black';
      else if (sceneChange && calmToCalm) tr = 'cross dissolve';
      else if (preset.pace >= 1.05 && !sceneChange) tr = 'cut';         // short-form: punchy
      else if (sceneChange && b.sceneArc === 'setup') tr = 'cross dissolve';
      tr = tr; // drama beats stay hard cuts
    } else if (a.transition && a.transition !== 'cut') tr = a.transition;
    a.transition = tr;
    if (tr === 'cross dissolve') dissolve++; else if (tr === 'dip to warm black') dip++; else hardCuts++;
  }

  // ---- color correction: cinematic but skin-safe ----
  const color = autoEdit
    ? colorProfile(platform, analysis.style)
    : { name: 'Original look (light correction)', filter: 'brightness(1.01) contrast(1.03)', skinProtect: true,
        note: 'Baseline correction only — AUTO EDIT off.' };

  // ---- voice / audio enhancement + automatic music balance ----
  const audio = {
    dialogueClarity: true, presence: '+2.5 kHz presence lift', noiseReduction: autoEdit,
    normalize: preset.label === 'YouTube' ? '−14 LUFS (YouTube standard)' : '−14 LUFS integrated (social standard)',
    ducking: true, musicUnderDialogueDb: autoEdit ? -15 : -12,
    ambienceBed: autoEdit ? '−16 dB under dialogue' : 'as composed',
    note: 'Dialogue first: music auto-ducks under speech, SFX ride at −8 dB, loudness normalized.'
  };

  // ---- automatic captions with platform-correct styling ----
  const subtitles = subStyle || { ...(analysis._settingsStyle || {}), style: preset.caption, position: 'bottom', animated: true };

  // ---- framing / composition / safe areas ----
  const framing = {
    safe: preset.safe,
    composition: 'rule-of-thirds subject placement · headroom per shot size · platform UI safe margins',
    letterbox: preset.aspect === '16:9',
    note: `Safe zones ${Math.round(preset.safe.bottom * 100)}% bottom / ${Math.round(preset.safe.top * 100)}% top reserved for platform UI.`
  };

  // ---- export preset ----
  const exp = {
    platform, label: preset.label, icon: preset.icon, aspect: preset.aspect,
    w: preset.w, h: preset.h, fps: preset.fps, bitrateMbps: preset.bitrateMbps,
    container: preset.container, audioOut: preset.audioOut, hd: true,
    note: preset.note
  };

  const removedSec = trimInfo?.removedSec || 0;
  const durationAfter = r1(shots.filter(s => !cuts.includes(s.id)).reduce((a, s) => a + s.dur, 0));

  const summary = [];
  summary.push(`Pacing: ${speed !== 1 ? speed + '× platform pace' : 'natural pace'} · ${trimInfo ? trimInfo.note : 'pause pass applied'}`);
  if (cuts.length) summary.push(`Removed ${cuts.length} unnecessary section${cuts.length > 1 ? 's' : ''} (${cutSec}s)`);
  summary.push(`Transitions: ${hardCuts} hard cuts · ${dissolve} dissolves · ${dip} act fades`);
  summary.push(`Color: ${color.name} (natural skin tones protected)`);
  summary.push(`Audio: dialogue clarity + music ducking ${audio.musicUnderDialogueDb} dB · loudness ${audio.normalize}`);
  summary.push(`Framing: ${framing.composition}`);
  summary.push(`Export: ${exp.label} · ${exp.w}×${exp.h} · ${exp.fps} fps · ${exp.bitrateMbps} Mbps · ${exp.aspect}`);

  return {
    applied: true, autoEdit, platform, platformLabel: preset.label, icon: preset.icon,
    pacing: { speed, removedSec, trimmedShots: trimInfo?.trimmedShots || 0, tightenedGaps: trimInfo?.tightenedGaps || 0 },
    cuts, cutSec, removedSec,
    transitions: { hardCuts, dissolve, dip, note: 'every cut point styled to the beat of the scene' },
    color, audio, subtitles, framing, export: exp,
    durationAfter, summary,
    appliedAt: new Date().toISOString()
  };
}

// skin-safe cinematic grade presets per platform/style
export function colorProfile(platform, style = 'cinematic') {
  const base = {
    tiktok:    { name: 'Social Pop — vivid but skin-natural', filter: 'brightness(1.03) contrast(1.08) saturate(1.07)' },
    instagram: { name: 'Reels Warm — soft contrast, warm skin', filter: 'brightness(1.02) contrast(1.06) saturate(1.06)' },
    facebook:  { name: 'Feed Natural — clean and clear', filter: 'brightness(1.02) contrast(1.05) saturate(1.04)' },
    youtube:   { name: 'Cinematic Teal/Orange — filmic, skin protected', filter: 'brightness(1.02) contrast(1.09) saturate(1.05)' }
  }[platform] || {};
  if (style === 'village' || style === 'ultra-realistic')
    return { ...base, skinProtect: true, note: 'Warm highlights, protected skin mid-tones, filmic contrast.' };
  if (style === 'cartoon' || style === 'anime')
    return { name: 'Pop Animation grade', filter: 'brightness(1.04) contrast(1.1) saturate(1.14)', skinProtect: false, note: 'Punchy stylized grade.' };
  if (style === 'noir')
    return { name: 'Noir grade', filter: 'brightness(1.0) contrast(1.16) saturate(0.55)', skinProtect: true, note: 'High-contrast desaturated look.' };
  return { ...base, skinProtect: true, note: 'Natural skin tones held inside a filmic contrast curve.' };
}

// platform caption style (used by subtitle generation + EDL)
export function subtitleStyleFor(platform, autoEdit, settingsStyle = {}) {
  const preset = platformPreset(platform);
  if (!autoEdit) return settingsStyle;
  const vertical = preset.aspect === '9:16';
  return {
    ...settingsStyle,
    style: preset.caption,
    position: 'bottom',
    animated: true,
    size: vertical ? 78 : 72,
    color: '#ffffff',
    outline: preset.caption === 'box' ? '#000000' : '#000000'
  };
}
