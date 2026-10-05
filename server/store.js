// ROKTOK — JSON persistence layer (no external dependencies)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');
export const DATA = path.join(ROOT, 'data');
export const PUBLIC = path.join(ROOT, 'public');

const DB_FILE = path.join(DATA, 'db.json');

const DEFAULT_SETTINGS = {
  theme: 'dark',
  uiLang: 'en',
  budget: 'balanced',           // free | balanced | high | maximum
  safety: true,
  demoMode: true,               // demo engine always available as fallback
  confirmPaidCalls: true,
  fps: 30,
  resolution: '1080p',
  subtitleStyle: { style: 'cinematic', size: 72, color: '#ffffff', outline: '#000000', position: 'bottom', animated: true, font: 'Inter' },
  providers: {}                 // id -> { key, connected, connectedAt }  (keys NEVER leave the server)
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { console.error('[roktok] db load failed, starting fresh:', e.message); }
  return { settings: { ...DEFAULT_SETTINGS }, projects: {}, seq: 0 };
}

let db = loadDb();
mkdirp(DATA);
mkdirp(path.join(DATA, 'projects'));
mkdirp(path.join(PUBLIC));

export function mkdirp(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }

let saveTimer = null;
export function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirp(DATA);
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) { console.error('[roktok] db save failed:', e.message); }
  }, 50);
}
export function saveNow() { if (saveTimer) clearTimeout(saveTimer); saveTimer = null;
  try { mkdirp(DATA); const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE);} catch(e){ console.error(e);} }

export function uid(prefix = 'id') { return prefix + '_' + crypto.randomBytes(6).toString('hex'); }

// ---------- settings ----------
export function getSettings() { return db.settings; }
export function updateSettings(patch) {
  db.settings = { ...db.settings, ...patch };
  // never allow keys through settings patch from client payload
  delete db.settings.__proto__;
  save();
  return db.settings;
}
export function sanitizedSettings() {
  const s = JSON.parse(JSON.stringify(db.settings));
  for (const id of Object.keys(s.providers || {})) {
    const p = s.providers[id];
    s.providers[id] = { connected: !!p.connected, connectedAt: p.connectedAt || null, hasKey: !!(p.key) };
  }
  return s;
}
export function providerKey(id) { return db.settings.providers?.[id]?.key || ''; }

// ---------- projects ----------
export function listProjects() {
  return Object.values(db.projects)
    .map(p => ({ id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt,
      hasVideo: !!p.artifacts?.final, duration: p.brief?.durationSec || 0, language: p.brief?.language || 'en',
      shots: p.artifacts?.shots?.length || 0 }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
export function getProject(id) { return db.projects[id] || null; }
export function putProject(p) { db.projects[p.id] = p; save(); return p; }
export function deleteProject(id) {
  delete db.projects[id]; save();
  try { fs.rmSync(path.join(DATA, 'projects', id), { recursive: true, force: true }); } catch {}
}
export function createProject(patch = {}) {
  db.seq = (db.seq || 0) + 1;
  const now = new Date().toISOString();
  const p = {
    id: uid('p'),
    name: patch.name || 'Untitled Project',
    createdAt: now, updatedAt: now,
    brief: { idea: '', durationSec: 60, language: 'en', style: 'cinematic', aspect: '16:9',
      platform: 'youtube', budget: db.settings.budget, mode: 'auto', ...patch.brief },
    assets: { images: [], audio: [], video: [], uploads: [] },
    artifacts: null,
    versions: [],
    history: [{ at: now, note: 'Project created' }]
  };
  db.projects[p.id] = p; save();
  mkdirp(path.join(DATA, 'projects', p.id));
  return p;
}
export function touchProject(p, note) {
  p.updatedAt = new Date().toISOString();
  if (note) p.history = [...(p.history || []), { at: p.updatedAt, note }].slice(-80);
  save();
  return p;
}
export function duplicateProject(id) {
  const src = getProject(id); if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid('p');
  copy.name = src.name + ' (copy)';
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  copy.history = [{ at: copy.createdAt, note: 'Duplicated from ' + src.name }];
  db.projects[copy.id] = copy; save();
  mkdirp(path.join(DATA, 'projects', copy.id));
  return copy;
}

// ---------- assets ----------
export function projectDir(id) { const d = path.join(DATA, 'projects', id); mkdirp(d); return d; }
export function saveAsset(projectId, filename, buf) {
  const dir = projectDir(projectId);
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const full = path.join(dir, safe);
  fs.writeFileSync(full, buf);
  return `/files/projects/${projectId}/${safe}`;
}
export function readAsset(rel) {
  const clean = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(DATA, clean);
  if (!full.startsWith(DATA)) return null;
  try { return fs.readFileSync(full); } catch { return null; }
}
