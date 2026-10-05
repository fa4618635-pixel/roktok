// ROKTOK — Script Engine: scenes + natural conversational dialogue (multi-language)
import { uid } from '../store.js';
import { bankFor } from '../i18n.js';

// Build scene list sized to the target duration, with dialogue lines attached.
export function generateScript(analysis, story, characters, locations) {
  const total = analysis.durationSec;
  const sceneCount = Math.max(3, Math.min(12, Math.round(total / 24)));
  const bank = bankFor(analysis.language, analysis.theme);
  const loc = locations[0];
  const cast = characters;
  const speakers = cast.length ? cast : [{ id: 'c_unknown', name: 'Lead' }];

  // Distribute duration across scenes (hook scene slightly shorter, climax longer)
  const weights = [];
  for (let i = 0; i < sceneCount; i++) weights.push(i === 0 ? 0.8 : i === sceneCount - 1 ? 1.25 : 1);
  const wsum = weights.reduce((a, b) => a + b, 0);

  const arcs = ['hook', 'setup', 'conflict', 'conflict', 'emotion', 'emotion', 'pressure', 'climax', 'reconcile', 'resolve', 'resolve', 'epilogue'];
  const arcFor = i => {
    const frac = i / Math.max(1, sceneCount - 1);
    if (frac < 0.15) return 'hook';
    if (frac < 0.45) return i % 2 ? 'conflict' : 'emotion';
    if (frac < 0.75) return 'climax';
    return analysis.theme === 'land_conflict' || analysis.reqs.reconcile ? 'reconcile' : 'resolve';
  };

  const scenes = [];
  let cursor = 0;
  for (let i = 0; i < sceneCount; i++) {
    const dur = Math.round(total * weights[i] / wsum);
    const arc = arcFor(i);
    const location = locations[i % locations.length] || loc;
    const tod = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Golden hour', 'Dusk'][Math.min(5, Math.floor(i / sceneCount * 6))];

    const lines = [];
    const beats = story.beats[i % story.beats.length];
    const nLines = Math.max(2, Math.min(6, Math.round(dur / 7)));
    for (let j = 0; j < nLines; j++) {
      const speaker = speakers[(i + j) % speakers.length];
      const pool = bank[arc] || bank.neutral;
      const text = pool[(i * 3 + j) % pool.length];
      const emotion = { hook: 'tense', conflict: 'angry', emotion: 'hurt', climax: 'raw', reconcile: 'soft', resolve: 'calm', setup: 'neutral' }[arc] || 'neutral';
      // occasionally give the other brother a reply from the opposing pool
      const altPool = arc === 'conflict' ? bank.emotion : arc === 'climax' ? bank.reconcile : null;
      const finalText = (j % 3 === 2 && altPool) ? altPool[(i + j) % altPool.length] : text;
      lines.push({
        id: uid('ln'), charId: speaker.id, speaker: speaker.name,
        text: finalText, emotion, arc,
        weight: j % 2 === 0 ? 1.1 : 0.9
      });
    }
    // Narration opener for documentary / long-form
    if (i === 0 && analysis.genre !== 'comedy') {
      lines.unshift({ id: uid('ln'), charId: 'narrator', speaker: 'Narrator',
        text: bank.narrator[0], emotion: 'calm', arc: 'narration', weight: 1.3 });
    }

    scenes.push({
      id: uid('sc'), number: i + 1,
      slug: `SCENE ${i + 1} — ${location?.name || 'EXT. VILLAGE'} — ${tod}`,
      locationId: location?.id, timeOfDay: tod, arc,
      durationSec: dur, summary: beats,
      action: buildAction(arc, location, analysis, speakers),
      lines
    });
    cursor += dur;
  }

  return {
    id: uid('script'), language: analysis.language,
    languageName: analysis.lang.name, direction: analysis.lang.dir,
    title: story.title, totalDurationSec: total,
    tone: `${analysis.genre} · ${analysis.style} · intensity ${analysis.intensity}`,
    performanceMode: !!analysis.lang.performanceMode
      ? { label: 'Natural Language Performance Mode',
          notes: ['natural pronunciation and native pacing','realistic pauses between clauses','emotion-first delivery','culturally appropriate phrasing','conversational (not theatrical) speech','phoneme-accurate lip movement targets'] }
      : null,
    scenes
  };
}

function buildAction(arc, location, analysis, cast) {
  const names = cast.map(c => c.name.split(' ')[0]);
  const a = names[0] || 'Lead', b = names[1] || 'companion';
  const env = location?.name || analysis.setting;
  const table = {
    hook: `${a} stands alone at the edge of ${env}. Wind moves cloth and dust. Camera: slow push-in, ${b} approaches from behind.`,
    setup: `${a} and ${b} settle into the space — small natural gestures, checking the ground, avoiding eye contact.`,
    conflict: `Voices rise. ${a} steps into ${b}'s space; ${b} holds position. Handheld, OTS coverage, fists clench then relax.`,
    emotion: `Close-ups. ${a}'s jaw tightens; ${b} looks away. A pause long enough to feel. Background activity continues softly.`,
    climax: `The decisive exchange. Fast push-ins, rack focus between faces. Dust crosses frame. Everything stops for one breath.`,
    reconcile: `Shoulders drop. ${b} extends a hand / helps ${a}. Slow dolly-out as the space between them closes.`,
    resolve: `They work side by side in ${env}. Warm light. Wide framing, breathing room in the composition.`,
    narration: `Establishing coverage of ${env} under narration — patient wides, detail inserts.`
  };
  return table[arc] || table.setup;
}
