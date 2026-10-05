// ROKTOK — Multi-model provider architecture, Smart Router, fallback chain, cost control
import { estimateCost } from './engine/promptkit.js';
import { getSettings, providerKey, saveAsset } from './store.js';

// Provider catalog. status: demo (works now), stub (official API adapter placeholder), openai-compat (live when keyed)
export const PROVIDERS = [
  { id: 'roktok-demo', name: 'ROKTOK Demo Engine', categories: ['text','image','video','voice','dubbing','music','upscale','transcription','translation','lipsync','effects'],
    status: 'demo', cost: 'free', note: 'Built-in deterministic engines + procedural media. Always available offline.' },
  { id: 'openai', name: 'OpenAI-compatible API', categories: ['text','image','voice'],
    status: 'openai-compat', cost: 'paid', endpoint: 'https://api.openai.com/v1',
    keyHint: 'Uses official /v1/chat/completions, /v1/images/generations, /v1/audio/speech. Key stored server-side only.',
    note: 'Connect an API key to upgrade scripts, images and voices to live generation.' },
  { id: 'runway', name: 'Runway', categories: ['video'], status: 'stub', cost: 'paid', note: 'Official API adapter slot — add key to enable (adapter ships disabled in prototype).' },
  { id: 'kling', name: 'Kling / MiniMax-class', categories: ['video'], status: 'stub', cost: 'paid', note: 'Official API adapter slot for long-sequence video.' },
  { id: 'veo', name: 'Google Veo-class', categories: ['video'], status: 'stub', cost: 'paid', note: 'Official API adapter slot for cinematic realism.' },
  { id: 'luma', name: 'Luma', categories: ['video'], status: 'stub', cost: 'paid', note: 'Official API adapter slot for image-to-video.' },
  { id: 'pika', name: 'Pika', categories: ['video'], status: 'stub', cost: 'paid', note: 'Official API adapter slot.' },
  { id: 'firefly', name: 'Adobe Firefly-class', categories: ['image'], status: 'stub', cost: 'paid', note: 'Official API adapter slot.' },
  { id: 'elevenlabs', name: 'ElevenLabs-class', categories: ['voice'], status: 'stub', cost: 'paid', note: 'Official API adapter slot for expressive multilingual voices.' },
  { id: 'heygen', name: 'HeyGen-class', categories: ['dubbing','lipsync'], status: 'stub', cost: 'paid', note: 'Official API adapter slot for dubbing + lip sync.' },
  { id: 'whisper', name: 'Transcription (Whisper-class)', categories: ['transcription'], status: 'stub', cost: 'paid', note: 'Official API adapter slot.' },
  { id: 'translate', name: 'Translation API', categories: ['translation'], status: 'stub', cost: 'paid', note: 'Official API adapter slot.' },
  { id: 'upscale', name: 'Upscale / Enhance API', categories: ['upscale'], status: 'stub', cost: 'paid', note: 'Official API adapter slot for true 2K/4K restoration.' },
  { id: 'music', name: 'Music Generation API', categories: ['music'], status: 'stub', cost: 'paid', note: 'Official API adapter slot for rendered stems.' }
];

export function providerState() {
  const s = getSettings();
  return PROVIDERS.map(p => {
    const cfg = s.providers?.[p.id];
    const connected = !!cfg?.connected && !!cfg?.key;
    let status = p.status;
    if (p.status === 'stub') status = connected ? 'stub-keyed' : 'stub';
    if (p.status === 'openai-compat') status = connected ? 'live' : 'unkeyed';
    return { ...p, connected, status, available: p.status === 'demo' || (p.status !== 'demo' && connected) };
  });
}

// Smart router: capability + budget + fallback chain
export function route(category, { budget = 'balanced', prefer = null } = {}) {
  const state = providerState();
  const enabled = state.filter(p => p.categories.includes(category) && p.available);
  const live = enabled.filter(p => p.status === 'live');
  const demo = enabled.filter(p => p.status === 'demo');
  // budget rule: free mode never spends; paid modes prefer live providers when connected
  const order = [];
  if (prefer) { const p = enabled.find(x => x.id === prefer); if (p) order.push(p); }
  if (budget !== 'free') for (const p of live) if (!order.includes(p)) order.push(p);
  for (const p of demo) if (!order.includes(p)) order.push(p);
  // stub-keyed entries advertise capability but cannot execute yet
  for (const p of enabled) if (p.status === 'stub-keyed' && !order.includes(p)) order.push(p);
  return {
    primary: order[0] || null,
    fallbacks: order.slice(1),
    category, budget,
    note: order.length ? '' : `No provider available for ${category}`
  };
}

// Execute text generation with automatic fallback (live -> demo)
export async function runText(category, prompt, opts = {}) {
  const r = route(category, opts);
  const attempts = [];
  for (const p of [r.primary, ...r.fallbacks].filter(Boolean)) {
    if (p.status === 'live' && p.id === 'openai') {
      try {
        const out = await openaiChat(prompt, opts);
        attempts.push({ provider: p.id, ok: true, mode: 'live' });
        return { text: out, provider: p.id, mode: 'live', attempts };
      } catch (e) {
        attempts.push({ provider: p.id, ok: false, error: String(e.message || e).slice(0, 160) });
        continue; // fallback system kicks in
      }
    }
    if (p.status === 'demo') {
      attempts.push({ provider: p.id, ok: true, mode: 'demo' });
      return { text: null, provider: p.id, mode: 'demo', attempts }; // caller uses built-in engine
    }
  }
  return { text: null, provider: null, mode: 'unavailable', attempts };
}

async function openaiChat(prompt, opts = {}) {
  const key = providerKey('openai');
  if (!key) throw new Error('No API key');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: opts.model || 'gpt-4o-mini', temperature: opts.temperature ?? 0.8,
      messages: [{ role: 'system', content: opts.system || 'You are a professional film scriptwriter.' }, { role: 'user', content: prompt }] })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

// Live image generation (OpenAI-compatible). Falls back to demo SVG engine.
export async function runImage(prompt, { projectId, filename = 'image', size = '1024x1024' } = {}) {
  const r = route('image', {});
  const live = [r.primary, ...r.fallbacks].filter(p => p && p.status === 'live' && p.id === 'openai');
  if (live.length) {
    try {
      const key = providerKey('openai');
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: size === '1792x1024' || size === '1024x1792' ? size : '1024x1024', response_format: 'b64_json' })
      });
      if (!res.ok) throw new Error(`images ${res.status}`);
      const j = await res.json();
      const buf = Buffer.from(j.data[0].b64_json, 'base64');
      const url = saveAsset(projectId, filename + '.png', buf);
      return { url, provider: 'openai', mode: 'live' };
    } catch (e) {
      return { error: String(e.message || e), fallback: 'demo' };
    }
  }
  return { provider: 'roktok-demo', mode: 'demo' };
}

// Live TTS (OpenAI-compatible)
export async function runVoice(text, { projectId, voice = 'alloy', model = 'tts-1' } = {}) {
  const key = providerKey('openai');
  if (!key) return { provider: 'roktok-demo', mode: 'demo' };
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, voice, input: text.slice(0, 4000) })
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const url = saveAsset(projectId, 'voice_' + Date.now() + '.mp3', buf);
    return { url, provider: 'openai', mode: 'live' };
  } catch (e) { return { error: String(e.message || e), fallback: 'demo' }; }
}

export function costFor(type, durationSec, budget) { return estimateCost(type, durationSec, budget); }
