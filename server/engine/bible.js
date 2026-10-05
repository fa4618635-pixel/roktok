// ROKTOK — Character Bible + Location Consistency Engine
import { uid } from '../store.js';

const SURNAMES = { ps: ['Khan', 'Afridi', 'Hotak', 'Niazi', 'Khpalwar'], ur: ['Khan', 'Qureshi', 'Ahmed', 'Raza'],
  ar: ['Al-Hassan', 'Al-Saleh', 'Nasser'], en: ['Miller', 'Walker', 'Hayes'], hi: ['Sharma', 'Verma', 'Singh'],
  fa: ['Hosseini', 'Karimi'], tr: ['Yilmaz', 'Demir'], bn: ['Rahman', 'Hossain'], default: ['Rehman', 'Khan', 'Ali'] };

const FACES = [
  'strong jaw, deep-set dark eyes, weathered brow', 'oval face, warm eyes, faint scar over left brow',
  'broad forehead, calm eyes, light stubble', 'high cheekbones, attentive eyes, sun-darkened skin'
];
const HAIR = ['short black hair, neatly combed', 'thick wavy black hair under a prayer cap', 'close-cropped hair, greying at temples', 'long hair tied back'];
const SKIN = ['sun-tanned olive skin', 'warm wheatish complexion', 'deep bronze skin', 'light olive skin'];
const BODY = ['tall, lean, work-hardened frame', 'stocky, broad-shouldered build', 'medium build, upright posture'];
const CLOTHES_M = ['traditional perahan tunban in muted earth tones, waistcoat, leather sandals',
  'shalwar kameez with a folded shawl, worn pakol hat, leather sandals',
  'dark waistcoat over cream kameez, prayer cap, dusty boots'];
const CLOTHES_F = ['modest embroidered dress with headscarf, simple flats'];
const SHOES = ['worn leather sandals', 'dust-covered boots', 'simple leather chappal'];
const ACC = ['wooden prayer beads in pocket', 'wristwatch with leather strap', 'old brass ring', 'none'];
const VOICES = ['deep, warm baritone with a rural accent', 'light tenor, quick to rise', 'steady bass, slow and deliberate', 'soft alto, careful phrasing'];

const PALETTES = [
  { cloth: '#6b4a2f', cloth2: '#8a6b45', accent: '#c9a227', skin: '#b07b4f', hair: '#1b1310' },
  { cloth: '#3f4f5c', cloth2: '#5c7180', accent: '#d8d3c5', skin: '#9a6a42', hair: '#12100e' },
  { cloth: '#5a3d4a', cloth2: '#7d5a68', accent: '#e0c9a6', skin: '#8d5f3d', hair: '#191919' },
  { cloth: '#41503c', cloth2: '#5f7357', accent: '#d9b44a', skin: '#a9764c', hair: '#211a14' }
];

export function generateCharacters(analysis, story) {
  const names = pickNames(analysis);
  const count = analysis.people.includes('two brothers') || analysis.theme === 'land_conflict' ? 2
    : analysis.people.includes('brothers') ? 2 : Math.max(2, Math.min(4, analysis.people.length + 1));
  const chars = [];
  for (let i = 0; i < count; i++) {
    const male = true;
    chars.push({
      id: uid('c'),
      name: names[i], age: i === 0 ? 38 + Math.floor(Math.random() * 6) : 30 + Math.floor(Math.random() * 6),
      gender: male ? 'male' : 'female',
      role: i === 0 ? 'elder brother / lead' : i === 1 ? 'younger brother / co-lead' : 'supporting',
      face: FACES[i % FACES.length], hairstyle: HAIR[i % HAIR.length],
      skinTone: SKIN[i % SKIN.length], bodyType: BODY[i % BODY.length],
      clothing: (CLOTHES_M[i % CLOTHES_M.length]),
      shoes: SHOES[i % SHOES.length], accessories: i === 0 ? ACC[1] : ACC[i % ACC.length],
      personality: i === 0 ? 'proud, duty-bound, hides worry behind stern silence'
        : 'impulsive, honest, carries a quieter grief',
      voice: VOICES[i % VOICES.length], accent: analysis.lang.name + ' native accent',
      emotionalTraits: i === 0 ? 'clenched jaw when hurt, softened eyes when ashamed'
        : 'raised voice when cornered, sudden stillness before apology',
      palette: PALETTES[i % PALETTES.length],
      refImage: null,
      consistencyKey: `cb_${analysis.theme}_${i}`   // stable identity token injected into every prompt
    });
  }
  if (analysis.people.includes('father')) {
    chars.push({ ...baseExtra(names[count] || 'Father', 62, 'father / in memory', analysis),
      clothing: 'old waistcoat and prayer cap', personality: 'wise, patient, present through memory',
      voice: 'aged, gentle baritone', palette: PALETTES[3], consistencyKey: 'cb_father' });
  }
  return chars;
}
function baseExtra(name, age, role, analysis) {
  return { id: uid('c'), name, age, gender: 'male', role, face: 'lined face, kind deep-set eyes',
    hairstyle: 'white hair under cap', skinTone: 'aged weathered skin', bodyType: 'slightly stooped, lean',
    clothing: 'traditional worn clothing', shoes: 'leather sandals', accessories: 'prayer beads',
    personality: 'quiet dignity', voice: 'aged baritone', accent: analysis.lang.name + ' native accent',
    emotionalTraits: 'gentle frown, warm gaze' };
}
function pickNames(analysis) {
  const pools = {
    ps: ['Karim Khan', 'Gul Jan', 'Zarin', 'Shir Agha'], ur: ['Ahmed Raza', 'Hassan Ali', 'Usman', 'Faizan'],
    ar: ['Yusuf', 'Omar', 'Karim', 'Hassan'], en: ['Daniel', 'Michael', 'Sarah', 'Elias'],
    hi: ['Arjun', 'Rohan', 'Vikram', 'Suresh'], fa: ['Reza', 'Amir', 'Sina'], tr: ['Emre', 'Kaan', 'Ali'],
    bn: ['Rafi', 'Karim', 'Jahid'], default: ['Adam', 'Sami', 'Noor', 'Zakir']
  };
  return pools[analysis.language] || pools.default;
}

export function generateLocations(analysis, story) {
  const isVillage = /village|mountain|rural|countryside/.test(analysis.setting + ' ' + analysis.style);
  const isCity = /city|urban/.test(analysis.setting);
  const base = isVillage ? {
    name: 'Mountain Village Courtyard',
    architecture: 'hand-built mud and stone houses, flat roofs, carved wooden doors',
    colors: 'ochre, clay brown, whitewash, faded indigo',
    weather: 'dry breeze, fine dust in the light shafts',
    lighting: 'strong directional sunlight, deep natural shadows, golden-hour bounce',
    furniture: 'woven rugs, low wooden charpai, clay water pots, brass tray',
    objects: 'farming tools, stacked firewood, boundary stones, chickens',
    geography: 'terraced fields below snow-dusted ridges',
    period: 'contemporary rural', atmosphere: 'lived-in, warm, tense under the surface'
  } : isCity ? {
    name: 'City Street & Apartment',
    architecture: 'concrete apartments, shop signs, balconies',
    colors: 'grey, glass blue, neon accents',
    weather: 'hazy sky, light traffic dust',
    lighting: 'overcast key with practical lights',
    furniture: 'simple sofa, kitchen counter, desk', objects: 'phone, mugs, keys, scooter',
    geography: 'dense low-rise district', period: 'present day', atmosphere: 'busy, restless'
  } : {
    name: analysis.setting.replace(/^a /, '').replace(/^an /, ''),
    architecture: 'authentic regional construction', colors: 'natural earth palette',
    weather: 'soft ambient air', lighting: 'natural key with motivated practicals',
    furniture: 'functional local furniture', objects: 'everyday household items',
    geography: 'regional terrain', period: 'contemporary', atmosphere: 'believable and grounded'
  };
  const locs = [{ id: uid('loc'), ...base, timeOfDayPlan: 'Dawn → Golden hour arc' }];
  if (analysis.durationSec >= 90) {
    locs.push({ ...(base), id: uid('loc'), name: isVillage ? 'Inside the Family Home' : 'Interior Room',
      lighting: 'window shafts, soft interior contrast', atmosphere: 'quiet, heavy with memory',
      objects: base.objects + ', framed photograph, old cupboard' });
  }
  if (analysis.durationSec >= 180) {
    locs.push({ ...(base), id: uid('loc'), name: isVillage ? 'The Disputed Field Boundary' : 'The Meeting Place',
      lighting: 'open sky key, long shadows', atmosphere: 'exposed, confrontational',
      geography: 'boundary stones dividing two plots' });
  }
  return locs;
}
