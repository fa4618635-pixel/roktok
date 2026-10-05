// ROKTOK — Story Engine: idea -> title, logline, structure, beats
import { uid } from '../store.js';

const TITLES = {
  land_conflict: ['Land of Our Father', 'The Divided Field', 'Two Brothers, One Land', 'The Inheritance'],
  love: ['A Quiet Yes', 'Letters in the Wind', 'Between Two Hearts'],
  school: ['The Last Bell', 'Chalk and Dreams'],
  generic: ['The Unfinished Road', 'Before the Storm', 'One More Day', 'The Long Way Home']
};

export function generateStory(analysis) {
  const theme = analysis.theme;
  const title = TITLES[theme]?.[Math.floor(Math.random() * TITLES[theme].length)] || TITLES.generic[0];
  const L = analysis.lang.name;

  const templates = {
    land_conflict: {
      logline: `Two brothers in a mountain village must choose between their father's land and their bond before anger destroys what their family built.`,
      conflict: 'Inheritance: elder brother claims the whole field, younger brother demands his share.',
      setting: `${analysis.setting}, terraced fields, mud-brick homes, dawn to dusk cycle`,
      beginning: 'A strong emotional hook — the elder brother stands alone in the disputed field at sunrise while the village wakes. Old pain resurfaces over their father\'s divided land.',
      middle: 'Tension escalates: a public argument, a broken door, neighbours taking sides. Flashbacks of their father dividing the land. Both brothers refuse to yield.',
      climax: 'At the boundary stone, hands raised, the younger brother\'s words break through — the memory of their father\'s last wish. Wind, dust, silence.',
      ending: analysis.reqs.hook !== false ? 'Reconciliation: they replace the boundary stone together. Wide warm shot, birds, emotional score, professional ending card.' : 'The brothers part ways, leaving the land question open.',
      beats: [
        'Sunrise over the village — drone wide, wind and birds',
        'Elder brother walks the field boundary, jaw tight',
        'Younger brother arrives — first confrontation, medium shots',
        'Village reaction — neighbours watch from rooftops',
        'Inside the house — father\'s photo, suppressed emotion',
        'Public argument at the doorstep — handheld, Dutch angles',
        'The broken door — consequences of anger',
        'Boundary stone — climax, extreme close-ups',
        'Silence and wind — reconciliation begins',
        'Both brothers lift the stone together — warm golden light'
      ]
    },
    love: {
      logline: 'Two people from different worlds keep finding their way back to the same place.',
      conflict: 'Duty versus feeling; family expectation versus personal choice.',
      setting: analysis.setting, beginning: 'A chance meeting establishes instant chemistry.',
      middle: 'Misunderstandings, a near-confession, outside pressure builds.',
      climax: 'A public choice made at the worst possible moment.',
      ending: 'An honest conversation at golden hour resolves the arc.',
      beats: ['First glance', 'Shared moment', 'Obstacle arrives', 'Silence between them', 'Grand gesture', 'Resolution']
    },
    generic: {
      logline: `A grounded ${analysis.genre} about people facing a choice they can't take back — set in ${analysis.setting}.`,
      conflict: 'A personal decision collides with family duty and community expectation.',
      setting: analysis.setting,
      beginning: 'Hook: drop us into the moment just before everything changes.',
      middle: 'Pressure mounts; alliances shift; small details become evidence.',
      climax: 'The truth comes out in one irreversible moment.',
      ending: 'Quiet resolution — a new normal, earned and human.',
      beats: ['Cold open hook', 'Introduce lead', 'Establish world', 'First turn', 'Rising pressure', 'All is lost', 'Choice', 'Aftermath']
    }
  };

  const t = templates[theme] || templates.generic;
  // Adjust beats count roughly to duration
  const wantBeats = Math.max(5, Math.min(14, Math.round(analysis.durationSec / 18)));
  const beats = [];
  for (let i = 0; i < wantBeats; i++) beats.push(t.beats[i % t.beats.length]);

  return {
    id: uid('story'),
    title, genre: analysis.genre, theme,
    logline: t.logline, conflict: t.conflict, setting: t.setting,
    language: analysis.language, languageName: L,
    structure: { beginning: t.beginning, middle: t.middle, climax: t.climax, ending: t.ending },
    beats,
    narrationStyle: analysis.style === 'documentary' ? 'observational narration' : 'visual storytelling with sparse narration',
    soundDesign: analysis.reqs.sfx === false ? 'dialogue-led mix' : 'layered ambience: wind, birds, footsteps, door creaks, cloth movement',
    cameraNotes: analysis.reqs.drone
      ? 'Open on drone establishing shot; intercut close-ups; end on rising crane shot'
      : 'Slow push-ins for tension; handheld for conflict; locked wide for reconciliation',
    hookType: analysis.intensity === 'high' ? 'emotional' : 'curiosity'
  };
}
