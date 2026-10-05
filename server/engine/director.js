// ROKTOK — AI Director Agent: scene list -> shot list with full camera language
import { uid } from '../store.js';

export const CAMERA_VOCAB = ['wide shot','medium shot','close-up','extreme close-up','over-the-shoulder','POV',
  'drone shot','aerial shot','tracking shot','dolly-in','dolly-out','crane shot','handheld','steadycam',
  'cinematic pan','cinematic tilt','orbit shot','slow push-in','fast push-in','rack focus','low angle',
  'high angle','Dutch angle'];

const LENSES = { 'extreme close-up': '85mm T1.4', 'close-up': '85mm T1.8', 'over-the-shoulder': '50mm T2.0',
  'POV': '35mm T2.0', 'medium shot': '40mm T2.2', 'wide shot': '24mm T2.8', 'drone shot': '20mm T3.5',
  'aerial shot': '20mm T3.5', 'crane shot': '28mm T3.0', 'Dutch angle': '32mm T2.5' };

const TRANSITIONS = ['cut','cut','cut','cross dissolve','dip to warm black','whip cut'];

// Phase-based camera plan (hook -> setup -> tension -> climax -> resolution)
function planForPhase(frac, analysis) {
  if (frac < 0.12) return analysis.reqs.drone
    ? [['drone shot','slow push-in'], ['wide shot','cinematic pan'], ['close-up','slow push-in']]
    : [['wide shot','cinematic pan'], ['close-up','slow push-in'], ['medium shot','steadycam']];
  if (frac < 0.40) return [['medium shot','tracking shot'], ['close-up','dolly-in'], ['wide shot','cinematic tilt'], ['over-the-shoulder','steadycam']];
  if (frac < 0.72) return [['over-the-shoulder','handheld'], ['Dutch angle','slow push-in'], ['close-up','fast push-in'], ['medium shot','handheld'], ['rack focus','static']];
  if (frac < 0.86) return [['extreme close-up','fast push-in'], ['close-up','rack focus'], ['medium shot','handheld'], ['POV','handheld']];
  return [['wide shot','dolly-out'], ['drone shot','crane shot'], ['medium shot','cinematic pan'], ['wide shot','slow push-in']];
}

export function generateStoryboard(analysis, script, characters, locations, story) {
  const total = analysis.durationSec;
  const targetShot = analysis.intensity === 'high' ? 5.5 : analysis.intensity === 'low' ? 8.5 : 6.5;
  const shotCount = Math.max(6, Math.min(48, Math.round(total / targetShot)));

  const shots = [];
  let t = 0;
  for (let i = 0; i < shotCount; i++) {
    const frac = i / shotCount;
    const scene = pickScene(script, frac);
    const phase = planForPhase(frac, analysis);
    const [camera, movement] = phase[i % phase.length];
    const location = locations.find(l => l.id === scene.locationId) || locations[0];
    const dur = i === shotCount - 1 ? Math.max(3, total - t) : Math.max(3, Math.min(10, Math.round((total / shotCount) * (0.75 + ((i * 37) % 45) / 100))));
    const tod = scene.timeOfDay;
    const intensity = { hook: 0.9, conflict: 0.8, climax: 1.0, reconcile: 0.5, emotion: 0.6, setup: 0.4, resolve: 0.35, narration: 0.3 }[scene.arc] || 0.5;

    // cast: rotate but keep lead present most of the time
    const castIds = scene.arc === 'conflict' || scene.arc === 'climax'
      ? characters.slice(0, 2).map(c => c.id)
      : [characters[i % Math.min(2, characters.length)]?.id].filter(Boolean);

    const animation = camera.includes('close-up') ? 'closeup'
      : movement.includes('tracking') || movement.includes('dolly') ? 'walk'
      : intensity > 0.6 ? 'gesture' : 'static';

    const shot = {
      id: uid('sh'), idx: i, sceneId: scene.id, start: t, dur,
      size: camera, movement, lens: LENSES[camera] || '35mm T2.0',
      angle: camera.includes('drone') || camera.includes('aerial') ? 'high' :
        camera.includes('low') ? 'low' : camera.includes('Dutch') ? 'dutch' : 'eye',
      locationId: location.id, locationName: location.name, tod,
      castIds, sceneArc: scene.arc, action: scene.action,
      expression: expressionFor(scene.arc), bodyLanguage: bodyFor(scene.arc),
      transition: TRANSITIONS[i % TRANSITIONS.length],
      lighting: lightingFor(tod, analysis), intensity, animation,
      backgroundActivity: frac < 0.4 ? 'villagers passing, chickens, distant chatter' : 'wind-blown dust, swaying cloth, birds',
      soundDesign: sfxFor(scene.arc, location),
      musicIntensity: Math.round(intensity * 10) / 10,
      pacing: intensity > 0.8 ? 'fast cuts' : intensity > 0.5 ? 'measured' : 'patient',
      dialogue: [],
      cameraPrompt: `${camera}, ${movement}, ${LENSES[camera] || '35mm T2.0'}, ${lightingFor(tod, analysis)}, ${location.name}`,
      providerPrompt: '' // filled after prompt kit expansion
    };
    shots.push(shot);
    t += dur;
  }

  // normalize exact total
  const drift = total - t;
  if (shots.length) shots[shots.length - 1].dur = Math.max(2, shots[shots.length - 1].dur + drift);
  recomputeStarts(shots);

  attachDialogue(shots, script, analysis);
  return shots;
}
function pickScene(script, frac) {
  const scenes = script.scenes;
  let acc = 0;
  const total = scenes.reduce((s, x) => s + x.durationSec, 0) || 1;
  for (const sc of scenes) { acc += sc.durationSec / total; if (frac <= acc) return sc; }
  return scenes[scenes.length - 1];
}
function expressionFor(arc) {
  return { hook: 'guarded, jaw set', conflict: 'anger breaking through', emotion: 'vulnerable, eyes glistening',
    climax: 'raw confrontation, nostrils flared', reconcile: 'relief, tears held back', setup: 'cautious normalcy',
    resolve: 'quiet hope', narration: 'observational calm' }[arc] || 'neutral';
}
function bodyFor(arc) {
  return { hook: 'still, shoulders squared', conflict: 'leaning in, fists opening and closing',
    emotion: 'withdrawn, arms crossed', climax: 'forward, finger pointed then dropped',
    reconcile: 'open palms, head bowed', setup: 'settling, small tasks', resolve: 'working hands' }[arc] || 'relaxed';
}
function lightingFor(tod, analysis) {
  const map = {
    'Dawn': 'cool blue dawn with warm horizon rim', 'Morning': 'crisp side sunlight, long soft shadows',
    'Midday': 'high key natural light, hard shadows', 'Afternoon': 'warm descending sun, gentle contrast',
    'Golden hour': 'golden hour backlight, amber haze, lens breathing', 'Dusk': 'deep amber-to-blue gradient, practical lights'
  };
  return map[tod] || 'natural sunlight';
}
function sfxFor(arc, location) {
  const base = ['wind bed', 'distant birds'];
  const arcSfx = { hook: ['footsteps on dirt', 'rooster crow'], conflict: ['raised voices', 'door slam', 'cloth rustle'],
    emotion: ['breath', 'fabric movement'], climax: ['heart pulse low', 'dust gust'], reconcile: ['hand on shoulder', 'soft exhale'],
    setup: ['village chatter', 'clay cup set down'], resolve: ['tools working', 'birds returning'] }[arc] || [];
  return [...arcSfx, ...base];
}

function attachDialogue(shots, script, analysis) {
  // Distribute each scene's lines across that scene's shots with real timing
  const byScene = {};
  for (const s of shots) (byScene[s.sceneId] ||= []).push(s);
  for (const sc of script.scenes) {
    const scShots = byScene[sc.id] || [];
    if (!scShots.length) continue;
    const lines = sc.lines;
    const totalW = lines.reduce((a, l) => a + l.weight, 0) || 1;
    const scDur = scShots.reduce((a, s) => a + s.dur, 0);
    let li = 0, consumed = 0;
    // spread lines over scene duration proportional to weight
    let acc = 0;
    for (const line of lines) {
      const share = (line.weight / totalW) * scDur;
      const lineStart = sc.startOffset = acc; acc += share;
      // find shot containing this offset
      let off = acc - share, placed = false;
      for (const s of scShots) {
        const sEnd = s.start + s.dur;
        const relStart = Math.max(s.start, Math.min(sEnd - 1, s.start + off));
        if (off >= s.start - 0.01 && off < sEnd) {
          const start = relStart;
          const maxDur = sEnd - start;
          const dur = Math.max(1.5, Math.min(maxDur, Math.max(1.8, line.text.split(/\s+/).length * 0.45)));
          s.dialogue.push({ ...line, start: +start.toFixed(2), dur: +Math.min(dur, maxDur).toFixed(2) });
          placed = true; break;
        }
      }
      if (!placed) { const s = scShots[scShots.length - 1]; s.dialogue.push({ ...line, start: s.start, dur: Math.min(s.dur, 3) }); }
      li++;
    }
    delete sc.startOffset;
  }
  // safety: no overlaps within a shot
  for (const s of shots) {
    let lastEnd = s.start;
    for (const d of s.dialogue) {
      if (d.start < lastEnd + 0.05) d.start = +(lastEnd + 0.05).toFixed(2);
      if (d.start + d.dur > s.start + s.dur) d.dur = Math.max(1, +(s.start + s.dur - d.start).toFixed(2));
      lastEnd = d.start + d.dur;
    }
  }
}

export function recomputeStarts(shots) {
  let t = 0;
  for (const s of shots) { s.start = +t.toFixed(2); t += s.dur; }
  return t;
}

export function buildShotPrompt(shot, kit, analysis, characters) {
  const cast = shot.castIds.map(id => characters.find(c => c.id === id)).filter(Boolean);
  const castDesc = cast.map(c => `${c.name}: ${c.face}, ${c.hairstyle}, ${c.clothing} [${c.consistencyKey}]`).join('; ');
  return [
    `${shot.size} of ${castDesc || 'lead character'}.`,
    `${shot.action}`,
    `Location: ${shot.locationName} (${kit.environment}).`,
    `Camera: ${shot.cameraPrompt}; ${shot.movement}. Expression: ${shot.expression}. Body: ${shot.bodyLanguage}.`,
    `Time: ${shot.tod} — ${shot.lighting}. Background: ${shot.backgroundActivity}.`,
    `Audio: ${shot.soundDesign.join(', ')}; dialogue in ${analysis.lang.name}.`,
    `CONTINUITY: identical identity/clothing/hair/lighting as previous shot. Style: ${kit.style}. Quality: ${kit.quality}.`
  ].join(' ');
}
