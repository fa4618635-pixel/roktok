// ROKTOK — Prompt Engineering Agent + Negative Prompt Engine
import { detectLanguage, langById } from '../i18n.js';

export const GENRES = ['comedy','drama','emotional','romance','action','thriller','horror','mystery',
  'documentary','educational','village drama','family story','children story','cartoon','animation',
  'advertisement','business','social media','cinematic short film'];

export const STYLES = [
  { id: 'cinematic', name: 'Cinematic' }, { id: 'ultra-realistic', name: 'Ultra Realistic' },
  { id: 'village', name: 'Village Realism' }, { id: 'dramatic', name: 'Dramatic' },
  { id: 'documentary', name: 'Documentary' }, { id: 'cartoon', name: 'Cartoon' },
  { id: 'anime', name: 'Anime' }, { id: 'commercial', name: 'Commercial' },
  { id: 'social', name: 'Social Media Pop' }, { id: 'noir', name: 'Film Noir' }
];

export const DURATIONS = [10, 20, 30, 60, 90, 120, 180, 240, 300];

const CAMERA_MOVES = ['wide shot','medium shot','close-up','extreme close-up','over-the-shoulder','POV',
  'drone shot','aerial shot','tracking shot','dolly-in','dolly-out','crane shot','handheld','steadycam',
  'cinematic pan','cinematic tilt','orbit shot','slow push-in','fast push-in','rack focus','low angle',
  'high angle','Dutch angle'];

export function analyzeBrief(brief = {}) {
  const idea = (brief.idea || '').trim();
  const t = idea.toLowerCase();
  const language = brief.language && brief.language !== 'auto' ? brief.language : (detectLanguage(idea) || 'en');

  let genre = 'drama';
  const genreMap = [
    [/village (drama|story)|pashto village|گرام|rural drama/, 'village drama'],
    [/comedy|funny|laugh|joke|humor|comedy/, 'comedy'],
    [/romance|love story|romantic/, 'romance'],
    [/action|fight|chase|battle/, 'action'],
    [/thriller|suspense|tension/, 'thriller'],
    [/horror|ghost|scary|haunted/, 'horror'],
    [/mystery|detective|investigat/, 'mystery'],
    [/documentary|docu/, 'documentary'],
    [/educational|tutorial|explain|lesson/, 'educational'],
    [/children|kids|fairy/, 'children story'],
    [/cartoon|animated|animation/, 'cartoon'],
    [/ad[vertisement]*\b|promo|product/, 'advertisement'],
    [/business|corporate|startup/, 'business'],
    [/tiktok|reels?|shorts?|social media/, 'social media'],
    [/emotional|tearjerk|sad story/, 'emotional'],
    [/family|brothers?|sisters?|parents?/, 'family story'],
    [/short film|cinematic short/, 'cinematic short film']
  ];
  for (const [re, g] of genreMap) if (re.test(t)) { genre = g; break; }

  // theme detection (drives dialogue banks & story templates)
  let theme = 'generic';
  if (/(land|field|farm|property|inherit|brothers?|sons?|ځمکه|زمین)/.test(t) && /(argu|fight|disput|conflict|estre|نزاع|لډ)|brothers?/.test(t)) theme = 'land_conflict';
  else if (/(wedding|marriage|love|rose|پیار)/.test(t)) theme = 'love';
  else if (/(school|teacher|student|exam|study)/.test(t)) theme = 'school';

  let style = brief.style && brief.style !== 'auto' ? brief.style : 'cinematic';
  for (const s of STYLES) if (t.includes(s.id) || t.includes(s.name.toLowerCase())) { style = s.id; break; }
  if (/village|pashtun|countryside|mountain village/.test(t) && style === 'cinematic') style = 'village';

  const reqs = {
    lipSync: /lip[- ]?sync|lip movement/.test(t),
    subtitles: /subtitle|subtitles|زیرنویس/.test(t) || brief.subtitles !== false,
    drone: /drone|aerial/.test(t),
    consistent: /consistent|consistency/.test(t),
    music: /music|soundtrack/.test(t) || brief.music !== false,
    sfx: /sound effect|ambience|footstep|birds/.test(t) || brief.sfx !== false,
    naturalDialogue: /natural (dialogue|pashto|urdu|arabic)|conversational/.test(t),
    reconcile: /reconcil|forgive|forgiving|پورتنول/.test(t),
    hook: /hook|strong (opening|start)/.test(t) || brief.hook !== false
  };

  const platforms = [];
  if (/tiktok/i.test(t)) platforms.push('tiktok');
  if (/youtube/i.test(t)) platforms.push('youtube');
  if (/instagram|reels/i.test(t)) platforms.push('instagram');
  if (/facebook/i.test(t)) platforms.push('facebook');
  // explicit platform chosen by the user in the picker always wins (drives format + export preset)
  const explicitPlatform = brief.platform && ['tiktok', 'instagram', 'facebook', 'youtube'].includes(brief.platform)
    ? brief.platform : null;
  if (explicitPlatform) platforms.unshift(explicitPlatform);
  const seen = new Set(); const platformsDedup = platforms.filter(p => !seen.has(p) && seen.add(p));
  platforms.length = 0; platforms.push(...platformsDedup);
  if (!platforms.length) platforms.push('youtube');

  const platformAspect = p => (['tiktok', 'instagram', 'facebook'].includes(p) ? '9:16' : '16:9');
  let aspect = brief.aspect || platformAspect(platforms[0]);
  if (/9:16|vertical|tiktok/i.test(t) && /16:9|horizontal|youtube/i.test(t)) aspect = brief.aspect || '16:9'; // both produced
  const dualFormat = /9:16/.test(t) && /16:9/.test(t);

  // extract duration if user mentioned it ("3-minute", "2 minutes")
  let durationSec = brief.durationSec || 60;
  const dm = t.match(/(\d+(?:\.\d+)?)\s*(?:-|\s)?\s*(minute|min|minutes)\b/);
  if (dm) durationSec = Math.min(300, Math.round(parseFloat(dm[1]) * 60));
  else if (!brief.durationSec) {
    const ds = t.match(/(\d+)\s*second/); if (ds) durationSec = Math.min(300, parseInt(ds[1]));
  }

  const people = [];
  if (/two brothers|2 brothers|دو زوی|two.*brothers/.test(t)) people.push('two brothers');
  else if (/brother/.test(t)) people.push('brothers');
  if (/father|dad|پلار|baap/.test(t)) people.push('father');
  if (/mother|mom|mother/.test(t)) people.push('mother');
  if (/child|kid|baby/.test(t)) people.push('child');
  if (!people.length) people.push('protagonist');

  let setting = 'a realistic contemporary village';
  if (/mountain|کوه/.test(t)) setting = 'a mountain village';
  if (/city|urban/.test(t)) setting = 'a modern city';
  if (/school/.test(t)) setting = 'a school';
  if (/forest|jungle/.test(t)) setting = 'a forest';
  if (/desert|صحراء/.test(t)) setting = 'a desert settlement';
  if (/home|house|indoor|کور/.test(t) && !/mountain|village/.test(t)) setting = 'a family home';

  return {
    idea, language, lang: langById(language), genre, theme, style, durationSec,
    aspect, dualFormat, platforms, reqs, people, setting,
    realism: /realistic|ultra-realistic|hyperreal/.test(t) ? 'ultra' : (/cartoon|anime/.test(t) ? 'stylized' : 'natural'),
    intensity: /emotional|heavy|intense/.test(t) ? 'high' : (/comedy|funny/.test(t) ? 'low' : 'medium'),
    title: null
  };
}

// Expand a simple user sentence into a structured production prompt
export function expandPrompt(analysis, characters = [], location = null) {
  const c = characters[0];
  const locName = location?.name || analysis.setting;
  const langName = analysis.lang.name;
  const cast = characters.length
    ? characters.map(x => `${x.name} (${x.age}, ${x.clothing})`).join('; ')
    : 'authentic local cast in traditional clothing';
  return {
    subject: c ? `${c.name}, ${c.face}` : 'lead character, photorealistic face, expressive eyes',
    action: analysis.idea || 'a natural slice-of-life moment that reveals the central conflict',
    environment: `${locName} — ${location?.architecture || 'hand-built stone and mud houses'}, ${location?.weather || 'dry breeze and dust in the air'}, ${location?.geography || 'mountains on the horizon'}`,
    characters: cast,
    camera: analysis.reqs.drone ? 'drone establishing shot, slow push-ins, close-ups, tracking shots' : 'slow dolly-in, medium shots, intimate close-ups, cinematic pans',
    lens: '35mm & 85mm anamorphic, T1.8–T2.8, shallow depth of field on faces',
    lighting: 'natural sunlight with realistic shadows, golden-hour rim light, soft bounce fill',
    composition: 'rule of thirds, layered foreground/midground/background, filmic depth',
    motion: 'natural human motion, subtle micro-expressions, cloth and hair movement in the wind',
    emotion: `${analysis.intensity} emotional intensity, ${analysis.theme === 'land_conflict' ? 'suppressed anger turning to reconciliation' : 'grounded, believable acting'}`,
    style: `${analysis.style} look, ultra-detailed textures, cinematic color grading, 24fps film cadence`,
    audio: `${langName} dialogue with native pronunciation, village ambience, wind, birds, footsteps, emotional score`,
    continuity: `identical character identity, face, hair, clothing and location across every shot; consistent time-of-day lighting`,
    quality: '8K detail, sharp focus on eyes, physically accurate shadows, professional color science',
    negativePrompt: NEGATIVE_PROMPT.join(', ')
  };
}

export const NEGATIVE_PROMPT = [
  'blurry faces','extra fingers','deformed hands','duplicate people','floating objects',
  'warped buildings','incorrect shadows','flickering faces','changing clothes','changing identity',
  'broken lip-sync','unwanted text','watermark','random logos','artifacts','unnatural motion',
  'out of character clothing','inconsistent hairstyle','morphing faces','bad anatomy','low resolution'
];

// Map analysis to a concrete production-ready single-line prompt (used by providers)
export function productionPrompt(analysis, kit) {
  return [
    `${kit.subject}.`, kit.action + '.', `Setting: ${kit.environment}.`,
    `Camera: ${kit.camera}, ${kit.lens}. Lighting: ${kit.lighting}.`,
    `Performance: ${kit.emotion}. Style: ${kit.style}.`,
    `Audio: ${kit.audio}. Continuity: ${kit.continuity}.`,
    `Quality: ${kit.quality}.`
  ].join(' ');
}

export function estimateCost(type, durationSec, budget) {
  // Transparent pre-flight estimates (USD). Demo providers cost $0.
  const perMin = { video: 0.90, voice: 0.12, music: 0.05, image: 0.04, text: 0.01 };
  const mult = { free: 0, balanced: 1, high: 1.8, maximum: 3.2 }[budget] ?? 1;
  const mins = Math.max(durationSec, 10) / 60;
  const base = {
    full: perMin.video * mins + perMin.voice * mins + perMin.music * mins + perMin.text * 4 + perMin.image * 6,
    video: perMin.video * mins, voice: perMin.voice * mins, music: perMin.music * mins,
    image: perMin.image * 2, text: perMin.text * 2, upscale: 0.25 * mins, dub: (perMin.voice + perMin.text) * mins
  }[type] ?? 0.05;
  const total = +(base * mult).toFixed(3);
  return { usd: total, budget, note: total === 0 ? 'FREE tier — demo providers only' : `Estimate for ${budget} mode. Paid API calls always require your confirmation.` };
}
