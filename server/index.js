// ROKTOK — Server entry: static hosting + REST API (zero dependencies)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  PUBLIC, DATA, getSettings, sanitizedSettings, updateSettings, providerKey,
  listProjects, getProject, putProject, deleteProject, createProject, duplicateProject,
  touchProject, saveAsset, readAsset, uid
} from './store.js';
import { providerState, route, costFor, runText, runImage, runVoice } from './providers.js';
import { startJob, getJob, applyEditorCommand, runAutoEdit } from './engine/pipeline.js';
import { generateSubtitles, toSRT, toVTT } from './engine/media.js';
import { generateCharacters, generateLocations } from './engine/bible.js';
import { generateStory } from './engine/story.js';
import { generateScript } from './engine/script.js';
import { analyzeBrief, expandPrompt, productionPrompt, DURATIONS, STYLES, GENRES } from './engine/promptkit.js';
import { cinematicSVG, characterSheetSVG } from './engine/svggen.js';
import { LANGUAGES, setUiLang } from './i18n.js';

const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webm': 'video/webm', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.srt': 'application/x-subrip', '.ico': 'image/x-icon' };

const json = (res, code, data) => { const b = JSON.stringify(data); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); };
const readBody = (req, limit = 40e6) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { const raw = Buffer.concat(chunks).toString('utf8'); if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); } });
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p.startsWith('/api/')) return await api(req, res, url);
    if (p.startsWith('/files/')) return serveFile(res, path.join(DATA, decodeURIComponent(p.slice(7))));
    return serveStatic(res, p);
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
});

function serveStatic(res, p) {
  let rel = p === '/' ? '/index.html' : p;
  rel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(PUBLIC, rel);
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(full, (err, buf) => {
    if (err) { // SPA fallback
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, b2) => {
        if (e2) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(b2);
      }); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}
function serveFile(res, full) {
  if (!path.resolve(full).startsWith(path.resolve(DATA))) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
}

async function api(req, res, url) {
  const p = url.pathname;
  const method = req.method;
  const seg = p.split('/').filter(Boolean); // ['api', ...]

  // ---------- state / settings ----------
  if (p === '/api/state' && method === 'GET') {
    return json(res, 200, {
      settings: sanitizedSettings(), providers: providerState(), languages: LANGUAGES,
      durations: DURATIONS, styles: STYLES, genres: GENRES, router: route('video', { budget: getSettings().budget }),
      app: { name: 'ROKTOK', tagline: 'ONE IDEA. ONE PROMPT. YOUR COMPLETE VIDEO.', version: '1.0.0' }
    });
  }
  if (p === '/api/settings' && method === 'POST') {
    const body = await readBody(req);
    delete body.providers; // keys go through /api/providers only
    const s = updateSettings(body);
    if (s.uiLang) setUiLang(s.uiLang);
    return json(res, 200, sanitizedSettings());
  }

  // ---------- providers ----------
  if (p === '/api/providers' && method === 'GET') return json(res, 200, providerState());
  let m = p.match(/^\/api\/providers\/([\w-]+)\/(connect|disconnect|test)$/);
  if (m && method === 'POST') {
    const [, id, action] = m;
    const body = await readBody(req);
    const settings = getSettings();
    settings.providers = settings.providers || {};
    if (action === 'connect') {
      const key = (body.key || '').trim();
      if (!key) return json(res, 400, { error: 'API key required' });
      updateSettings({ providers: { ...settings.providers, [id]: { key, connected: true, connectedAt: new Date().toISOString() } } });
      return json(res, 200, { ok: true, id, connected: true });
    }
    if (action === 'disconnect') {
      updateSettings({ providers: { ...settings.providers, [id]: { key: '', connected: false } } });
      return json(res, 200, { ok: true, id, connected: false });
    }
    if (action === 'test') {
      if (id === 'openai') {
        const key = providerKey('openai');
        if (!key) return json(res, 200, { ok: false, message: 'No key connected' });
        try {
          const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
          return json(res, 200, { ok: r.ok, message: r.ok ? 'Connected — official API reachable' : `API returned ${r.status}` });
        } catch (e) { return json(res, 200, { ok: false, message: 'Network error: ' + e.message }); }
      }
      return json(res, 200, { ok: false, message: 'Official API adapter not enabled in prototype — slot reserved.' });
    }
  }

  // ---------- projects ----------
  if (p === '/api/projects' && method === 'GET') return json(res, 200, listProjects());
  if (p === '/api/projects' && method === 'POST') {
    const body = await readBody(req);
    const proj = createProject(body || {});
    return json(res, 201, proj);
  }
  m = p.match(/^\/api\/projects\/([\w-]+)(\/(duplicate|export))?$/);
  if (m && method === 'GET' && !m[2]) {
    const proj = getProject(m[1]); if (!proj) return json(res, 404, { error: 'not found' });
    return json(res, 200, proj);
  }
  if (m && method === 'GET' && m[3] === 'export') {
    const proj = getProject(m[1]); if (!proj) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${proj.name.replace(/[^\w-]+/g, '_')}.roktok.json"` });
    return res.end(JSON.stringify({ format: 'roktok-project', v: 1, project: proj }, null, 2));
  }
  if (m && method === 'POST' && m[3] === 'duplicate') {
    const copy = duplicateProject(m[1]); if (!copy) return json(res, 404, { error: 'not found' });
    return json(res, 201, copy);
  }
  if (m && method === 'PATCH') {
    const proj = getProject(m[1]); if (!proj) return json(res, 404, { error: 'not found' });
    const body = await readBody(req);
    if (body.name) proj.name = String(body.name).slice(0, 80);
    if (body.brief) proj.brief = { ...proj.brief, ...body.brief };
    if (body.edl) {
      if (!proj.versions?.length) proj.versions = [{ id: uid('v'), label: 'Edit', createdAt: new Date().toISOString(), edl: body.edl }];
      else proj.versions[proj.versions.length - 1].edl = body.edl;
    }
    touchProject(proj, 'Project updated');
    return json(res, 200, proj);
  }
  if (m && method === 'DELETE') { deleteProject(m[1]); return json(res, 200, { ok: true }); }

  // assets upload (data URL) : POST /api/projects/:id/assets
  m = p.match(/^\/api\/projects\/([\w-]+)\/assets$/);
  if (m && method === 'POST') {
    const proj = getProject(m[1]); if (!proj) return json(res, 404, { error: 'not found' });
    const body = await readBody(req);
    const match = /^data:(image|audio|video)\/(\w+);base64,(.+)$/.exec(body.dataUrl || '');
    if (!match) return json(res, 400, { error: 'Send { dataUrl, kind } — data URL required' });
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
    const buf = Buffer.from(match[3], 'base64');
    const name = (body.name || uid('upload')) + '.' + ext;
    const url = saveAsset(m[1], name, buf);
    const rec = { id: uid('a'), name, url, kind: match[1], at: new Date().toISOString(), size: buf.length };
    proj.assets = proj.assets || { images: [], audio: [], video: [], uploads: [] };
    (proj.assets[match[1] === 'image' ? 'images' : match[1] === 'audio' ? 'audio' : 'video'] || proj.assets.uploads).push(rec);
    proj.assets.uploads.push(rec);
    touchProject(proj, 'Uploaded ' + name);
    return json(res, 201, rec);
  }

  // ---------- jobs ----------
  if (p === '/api/jobs' && method === 'POST') {
    const body = await readBody(req);
    const { type = 'full', projectId, params = {} } = body;
    if (projectId && !getProject(projectId)) return json(res, 404, { error: 'project not found' });
    const job = startJob(type, projectId, params);
    return json(res, 202, { id: job.id, status: job.status });
  }
  m = p.match(/^\/api\/jobs\/([\w-]+)$/);
  if (m && method === 'GET') {
    const job = getJob(m[1]); if (!job) return json(res, 404, { error: 'job not found' });
    const { id, type, status, progress, steps, current, log, result, error, projectId } = job;
    return json(res, 200, { id, type, status, progress, steps, current, log: log.slice(-30), result, error, projectId });
  }

  // ---------- generation helpers ----------
  if (p === '/api/estimate' && method === 'POST') {
    const b = await readBody(req);
    return json(res, 200, costFor(b.type || 'full', b.durationSec || 60, b.budget || getSettings().budget));
  }
  if (p === '/api/images/generate' && method === 'POST') {
    const b = await readBody(req);
    const projectId = b.projectId || createProject({ name: 'Image scratchpad' }).id;
    const live = await runImage(b.prompt || 'cinematic scene', { projectId, filename: 'img_' + Date.now() });
    if (live.url) return json(res, 200, { ...live });
    const svg = cinematicSVG(b.prompt, { aspect: b.aspect || '16:9', seed: b.seed || String(Date.now()), label: b.label || '' });
    const url = saveAsset(projectId, 'img_' + Date.now().toString(36) + '.svg', Buffer.from(svg));
    const proj = getProject(projectId); if (proj) { proj.assets.images.push({ id: uid('a'), name: b.prompt?.slice(0, 40) || 'image', url, at: new Date().toISOString() }); touchProject(proj); }
    return json(res, 200, { url, provider: live.provider || 'roktok-demo', mode: 'demo', projectId });
  }
  if (p === '/api/characters/sheet' && method === 'POST') {
    const b = await readBody(req);
    const proj = getProject(b.projectId);
    const c = b.character || (proj?.artifacts?.characters || [])[0];
    if (!c) return json(res, 400, { error: 'no character' });
    const svg = characterSheetSVG(c);
    const projectId = proj?.id || createProject({ name: 'Sheets' }).id;
    const url = saveAsset(projectId, 'sheet_' + (c.name || 'c').replace(/\W+/g, '') + '.svg', Buffer.from(svg));
    return json(res, 200, { url, provider: 'roktok-demo', mode: 'demo' });
  }
  if (p === '/api/voice/speak' && method === 'POST') {
    const b = await readBody(req);
    const out = await runVoice(b.text || 'Hello', { projectId: b.projectId || createProject({ name: 'Voice scratchpad' }).id, voice: b.voice });
    return json(res, 200, out);
  }
  if (p === '/api/prompt/expand' && method === 'POST') {
    const b = await readBody(req);
    const analysis = analyzeBrief(b);
    const chars = [{ name: 'Lead', face: 'photorealistic', clothing: 'wardrobe consistent' }];
    const kit = expandPrompt(analysis, chars, null);
    return json(res, 200, { analysis: { language: analysis.language, genre: analysis.genre, durationSec: analysis.durationSec, theme: analysis.theme, style: analysis.style, reqs: analysis.reqs }, kit, production: productionPrompt(analysis, kit) });
  }
  if (p === '/api/editor/command' && method === 'POST') {
    const b = await readBody(req);
    const proj = getProject(b.projectId); if (!proj) return json(res, 404, { error: 'project not found' });
    try { return json(res, 200, applyEditorCommand(proj, b.command)); }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/editor/autoedit' && method === 'POST') {
    const b = await readBody(req);
    const proj = getProject(b.projectId); if (!proj) return json(res, 404, { error: 'project not found' });
    try {
      const plan = runAutoEdit(proj, { autoEdit: b.autoEdit !== false });
      return json(res, 200, { ok: true, summary: plan.summary, plan: { platformLabel: plan.platformLabel, speed: plan.pacing?.speed, cuts: plan.cuts?.length, export: plan.export } });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/subtitles' && method === 'GET') {
    const id = url.searchParams.get('project'); const fmt = url.searchParams.get('format') || 'srt';
    const proj = getProject(id); if (!proj?.artifacts?.subtitles) return json(res, 404, { error: 'no subtitles — run production first' });
    const items = proj.artifacts.subtitles.items;
    const body = fmt === 'vtt' ? toVTT(items) : toSRT(items);
    res.writeHead(200, { 'Content-Type': fmt === 'vtt' ? 'text/vtt' : 'application/x-subrip', 'Content-Disposition': `attachment; filename="${proj.name.replace(/\W+/g, '_')}.${fmt}"` });
    return res.end(body);
  }
  // regenerate a single artifact type (non-destructive partial jobs)
  if (p === '/api/artifacts/regenerate' && method === 'POST') {
    const b = await readBody(req);
    const proj = getProject(b.projectId); if (!proj?.artifacts) return json(res, 400, { error: 'no artifacts' });
    const analysis = analyzeBrief({ ...proj.brief, ...b.brief });
    if (b.kind === 'story') { proj.artifacts.story = generateStory(analysis); }
    if (b.kind === 'characters') { proj.artifacts.characters = generateCharacters(analysis, proj.artifacts.story); }
    if (b.kind === 'subtitles') { proj.artifacts.subtitles = generateSubtitles(analysis, proj.artifacts.shots, getSettings().subtitleStyle); }
    touchProject(proj, 'Regenerated ' + b.kind);
    return json(res, 200, { ok: true, kind: b.kind });
  }
  if (p === '/api/artifacts/subtitles' && method === 'POST') {
    const b = await readBody(req);
    const proj = getProject(b.projectId); if (!proj?.artifacts?.subtitles) return json(res, 400, { error: 'no subtitles' });
    if (Array.isArray(b.items)) proj.artifacts.subtitles.items = b.items;
    touchProject(proj, 'Subtitles edited');
    return json(res, 200, { ok: true, count: proj.artifacts.subtitles.items.length });
  }
  if (p === '/api/artifacts/patch' && method === 'POST') {
    const b = await readBody(req);
    const proj = getProject(b.projectId); if (!proj?.artifacts) return json(res, 400, { error: 'no artifacts' });
    if (b.characters) proj.artifacts.characters = b.characters;
    touchProject(proj, 'Artifacts patched');
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: 'unknown endpoint ' + p });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ROKTOK server → http://0.0.0.0:${PORT}`);
  console.log('ONE IDEA. ONE PROMPT. YOUR COMPLETE VIDEO.');
});
