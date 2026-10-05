// ROKTOK — AI Orchestration Pipeline ("MAKE EVERYTHING") + job system + editor agent
import { analyzeBrief, expandPrompt, productionPrompt } from './promptkit.js';
import { generateStory } from './story.js';
import { generateScript } from './script.js';
import { generateCharacters, generateLocations } from './bible.js';
import { generateStoryboard, buildShotPrompt, recomputeStarts } from './director.js';
import { generateAudioPlan, generateSubtitles } from './media.js';
import { runQC } from './qc.js';
import { generateHooks, generateSocialPack, generateShorts } from './social.js';
import { getProject, putProject, touchProject, uid, getSettings } from '../store.js';
import { runText, route } from '../providers.js';
import { bankFor, langById } from '../i18n.js';
import { trimPass, buildEditPlan, platformPreset, platformFor, subtitleStyleFor } from './autoedit.js';

const jobs = new Map();
export const getJob = id => jobs.get(id) || null;

const STEP_DEFS = {
  full: [
    ['analyze', 'Analyzing story...'], ['script', 'Writing script...'], ['characters', 'Creating characters...'],
    ['locations', 'Creating locations...'], ['storyboard', 'Creating storyboard...'], ['prompts', 'Engineering prompts...'],
    ['scenes', 'Generating scenes...'], ['voices', 'Generating dialogue & voices...'],
    ['pauses', 'Removing pauses & dead air...'], ['music', 'Composing music...'],
    ['sfx', 'Creating sound effects...'], ['lipsync', 'Synchronizing dialogue...'], ['subtitles', 'Creating subtitles...'],
    ['edit', 'Professional auto-edit: cuts, color, audio...'], ['qc', 'Checking quality...'],
    ['regen', 'Regenerating weak shots...'], ['render', 'Rendering final video...']
  ],
  quick: null, // same production path as full
  text: [['analyze', 'Analyzing brief...'], ['script', 'Writing...'], ['qc', 'Reviewing output...']],
  images: [['analyze', 'Reading prompt...'], ['scenes', 'Generating image...'], ['render', 'Saving to project...']],
  short: [['analyze', 'Finding strongest moments...'], ['edit', 'Cutting short...'], ['render', 'Rendering short...']]
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function startJob(type, projectId, params = {}) {
  const id = uid('job');
  const defs = STEP_DEFS[type] || STEP_DEFS.full;
  const steps = defs.map(([key, label]) => ({ key, label, state: 'pending' }));
  const job = { id, type, projectId, params, status: 'queued', progress: 0, steps, current: null,
    createdAt: Date.now(), result: null, error: null, log: [] };
  jobs.set(id, job);
  runJob(job).catch(e => { job.status = 'error'; job.error = String(e.message || e); job.log.push('ERROR: ' + job.error); });
  return job;
}

async function runJob(job) {
  job.status = 'running';
  const fast = job.params.fast === true;
  const per = fast ? 5 : 110;
  const project = getProject(job.projectId);
  if (!project && !['images'].includes(job.type)) throw new Error('Project not found');

  const advance = async (i, work) => {
    if (job.steps[i]) { job.steps[i].state = 'active'; job.current = job.steps[i].label; }
    job.progress = Math.round((i / job.steps.length) * 100);
    try { if (work) await work(); }
    finally {
      if (job.steps[i]) job.steps[i].state = 'done';
      job.progress = Math.round(((i + 1) / job.steps.length) * 100);
      job.log.push(job.steps[i]?.label || '');
      await sleep(per);
    }
  };

  const analysis = analyzeBrief({ ...project.brief, ...job.params });
  job.analysis = { language: analysis.language, genre: analysis.genre, durationSec: analysis.durationSec };

  // --- Professional auto-edit context (platform-aware, applies to every production) ---
  const autoEdit = (job.params.autoEdit ?? project?.brief?.autoEdit) !== false;
  const platform = analysis.platforms?.[0] || project?.brief?.platform || 'youtube';
  const preset = platformPreset(platform);
  const subStyle = subtitleStyleFor(platform, autoEdit, getSettings().subtitleStyle);
  let trimInfo = null, editPlan = null;

  if (job.type === 'images') {
    await advance(0); await advance(1); await advance(2, async () => { job.result = job.params.result || null; });
    job.status = 'done'; job.progress = 100; return;
  }

  if (job.type === 'short') {
    for (let i = 0; i < job.steps.length; i++) await advance(i, i === 1 ? async () => {
      job.result = { shortId: job.params.shortId };
    } : null);
    job.status = 'done'; job.progress = 100; return;
  }

  // ---------- TEXT-DRIVEN STAGES ----------
  const art = project.artifacts && job.params.fresh !== false ? null : project.artifacts;
  project.brief = { ...project.brief, ...pick(job.params, ['idea','durationSec','language','style','aspect','platform','budget','mode','autoEdit','subtitles','music','hook']) };

  let story, characters, locations, script, shots, audio, subtitles, qc, kit;

  const textRun = job.type === 'text' || job.type === 'full' || job.type === 'quick';

  await advance(0, async () => {
    // analysis already computed; safety check
    if (getSettings().safety) assertSafe(analysis.idea);
    const live = await runText('text', `Analyze this film brief in one paragraph: ${analysis.idea || project.brief.idea}`, { budget: analysis.budget || 'free' });
    job.log.push(`router: text -> ${live.provider} (${live.mode})`);
  });

  if (job.type === 'text') {
    await advance(1, async () => {
      story = generateStory(analysis);
      script = generateScript(analysis, story, [{ id: 'c_1', name: 'Lead' }], [{ id: 'l_1', name: analysis.setting }]);
      project.artifacts = { ...(project.artifacts||{}), analysis: serialize(analysis), story: serialize(story), script: serialize(script) };
      touchProject(project, 'Script generated');
      job.result = { storyId: story.id };
    });
    await advance(2);
    job.status = 'done'; job.progress = 100; return;
  }

  // ---------- FULL PRODUCTION ----------
  await advance(1, async () => { story = generateStory(analysis); });
  await advance(2, async () => { characters = generateCharacters(analysis, story); });
  await advance(3, async () => { locations = generateLocations(analysis, story); });
  await advance(4, async () => { script = generateScript(analysis, story, characters, locations); });
  await advance(5, async () => {
    kit = expandPrompt(analysis, characters, locations[0]);
    shots = generateStoryboard(analysis, script, characters, locations, story);
    for (const s of shots) s.providerPrompt = buildShotPrompt(s, kit, analysis, characters);
    job.log.push(`router: video -> ${route('video', { budget: project.brief.budget || 'balanced' }).primary?.id || 'none'}`);
  });
  await advance(6, async () => { /* scenes covered by storyboard */ });
  await advance(7, async () => {
    // dialogue is attached; voice plan = per-character voice mapping
    job.voicePlan = characters.map(c => ({ charId: c.id, name: c.name, voice: c.voice, accent: c.accent, lang: analysis.language }));
  });
  // ————— professional edit pass 1: remove dead air & tighten pauses (before music/subs so everything syncs) —————
  await advance(8, async () => {
    trimInfo = trimPass(shots, { autoEdit, platform });
    job.log.push(`autoedit: ${trimInfo.note}`);
  });
  await advance(9, async () => { audio = generateAudioPlan(analysis, shots, story); });
  await advance(10, async () => { /* sfx inside audio plan */ });
  await advance(11, async () => {
    job.lipSync = { mode: analysis.lang.performanceMode ? 'Natural Language Performance Mode' : 'standard phoneme pass',
      lines: shots.flatMap(s => s.dialogue).length, lang: analysis.lang.name, provider: route('lipsync', {}).primary?.id || 'demo' };
  });
  await advance(12, async () => { subtitles = generateSubtitles(analysis, shots, subStyle); });
  // ————— professional edit pass 2: pacing, cuts, transitions, color, audio, framing, export preset —————
  await advance(13, async () => {
    editPlan = buildEditPlan(analysis, { artifacts: { shots }, brief: project.brief }, { autoEdit, trimInfo, subStyle });
    job.edit = { pacing: editPlan.pacing?.speed ?? 1, transitions: shots.length, grade: analysis.style,
      colorTreatment: true, autoEdit, platform: preset.label };
    job.log.push(...(editPlan.summary || []).map(s => 'autoedit: ' + s));
  });
  await advance(14, async () => {
    project.artifacts = {
      analysis: serialize(analysis), promptKit: serialize(kit), story: serialize(story),
      characters: serialize(characters), locations: serialize(locations), script: serialize(script),
      shots: serialize(shots), audio: serialize(audio), subtitles: serialize(subtitles),
      voicePlan: serialize(job.voicePlan), lipSync: job.lipSync, edit: job.edit,
      trimPass: trimInfo ? serialize(trimInfo) : null,
      editPlan: editPlan ? serialize(editPlan) : null
    };
    qc = runQC(analysis, project);
    project.artifacts.qc = serialize(qc);
  });
  await advance(15, async () => {
    if (qc.fixes?.length) { project.artifacts.shots = serialize(shots); }
    job.log.push(...(qc.fixes || []).map(f => 'fix: ' + f));
  });
  await advance(16, async () => {
    const hooks = generateHooks(story, analysis);
    const social = generateSocialPack({ ...project, artifacts: { ...project.artifacts, analysis: serialize(analysis), story: serialize(story), shots: serialize(shots) } });
    const shorts = generateShorts({ ...project, brief: project.brief, artifacts: { ...project.artifacts, analysis: serialize(analysis), story: serialize(story), shots: serialize(shots) } });
    project.artifacts.hooks = serialize(hooks);
    project.artifacts.social = serialize(social);
    project.artifacts.shorts = serialize(shorts);
    const edl = defaultEdl(shots, analysis, project, editPlan, subStyle);
    project.versions = [{ id: uid('v'), label: 'Final cut v1 (auto-edited)', createdAt: new Date().toISOString(), edl: serialize(edl) }];
    project.artifacts.final = {
      durationSec: analysis.durationSec, aspect: editPlan?.export?.aspect || analysis.aspect, dualFormat: analysis.dualFormat,
      fps: editPlan?.export?.fps ?? getSettings().fps,
      resolution: editPlan?.export ? `${editPlan.export.w}x${editPlan.export.h}` : getSettings().resolution,
      export: editPlan?.export || null, platform: preset.label, platformId: platform, autoEdit,
      shotCount: shots.length,
      renderedAt: new Date().toISOString(), formats: ['9:16', '16:9'],
      note: `Upload-ready ${preset.label} master · HD export via ROKTOK render engine. Connect video providers for AI-generated footage.`
    };
    touchProject(project, `Auto-edited & rendered for ${preset.label}`);
    putProject(project);
    job.result = { projectId: project.id, qc: qc.pass, title: story.title, autoEdit, platform: preset.label };
  });
  job.status = 'done'; job.progress = 100; job.current = 'Complete';
}

function defaultEdl(shots, analysis, project, plan = null, subStyle = null) {
  const p = plan?.export || null;
  return {
    shotIds: shots.filter(s => !plan?.cuts?.includes(s.id)).map(s => s.id),
    speed: plan?.pacing?.speed ?? 1,
    grade: analysis.style, cinematic: plan ? plan.framing?.letterbox !== false : true,
    subtitlesOn: analysis.reqs.subtitles !== false,
    subtitleStyle: subStyle || getSettings().subtitleStyle,
    volumes: { dialogue: 1, music: plan ? 0.45 : 0.55, sfx: 0.7, ambience: 0.4 },
    aspect: plan?.export?.aspect || analysis.aspect,
    cuts: plan?.cuts || [], trims: {}, musicMood: null, voiceOverride: null,
    burnSubtitles: true, color: analysis.style,
    // professional auto-edit layer
    colorGrade: plan?.color || null,
    audioEnhance: plan?.audio || null,
    safe: plan?.framing?.safe || null,
    export: p,
    autoEdit: plan?.autoEdit ?? (project?.brief?.autoEdit !== false)
  };
}
const serialize = x => JSON.parse(JSON.stringify(x));
function pick(o, keys) { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; }

// ---------------------------------------------------------------------------
// Standalone AUTO EDIT pass — re-runs the professional edit on an existing project
// (used by the "Re-run AUTO EDIT" button; safe to run repeatedly)
// ---------------------------------------------------------------------------
export function runAutoEdit(project, { autoEdit = true } = {}) {
  const art = project.artifacts;
  if (!art?.shots?.length) throw new Error('No video in this project yet — run MAKE EVERYTHING first.');
  const analysis = analyzeBrief(project.brief);
  const platform = analysis.platforms?.[0] || project.brief.platform || 'youtube';
  const preset = platformPreset(platform);
  const subStyle = subtitleStyleFor(platform, autoEdit, getSettings().subtitleStyle);

  const trimInfo = trimPass(art.shots, { autoEdit, platform });
  const plan = buildEditPlan(analysis, { artifacts: art, brief: project.brief }, { autoEdit, trimInfo, subStyle });

  // regenerate dependent artifacts so timing stays perfectly in sync
  art.subtitles = generateSubtitles(analysis, art.shots, subStyle);
  try { art.audio = generateAudioPlan(analysis, art.shots, art.story); } catch {}
  art.editPlan = plan;
  art.trimPass = trimInfo;
  art.edit = { ...(art.edit || {}), pacing: plan.pacing?.speed ?? 1, autoEdit, platform: preset.label, colorTreatment: true };
  art.subtitles.style = subStyle;
  if (art.final) {
    art.final.platform = preset.label; art.final.platformId = platform; art.final.autoEdit = autoEdit;
    art.final.export = plan.export; art.final.aspect = plan.export.aspect;
    art.final.fps = plan.export.fps; art.final.resolution = `${plan.export.w}x${plan.export.h}`;
    art.final.note = `Upload-ready ${preset.label} master · HD export via ROKTOK render engine.`;
  }
  // merge plan into the active EDL (preserves user's music/voice choices)
  if (!project.versions?.length) {
    project.versions = [{ id: uid('v'), label: 'Auto-edit', createdAt: new Date().toISOString(),
      edl: defaultEdl(art.shots, analysis, project, plan, subStyle) }];
  } else {
    const edl = project.versions[project.versions.length - 1].edl;
    edl.cuts = [...new Set([...(edl.cuts || []), ...(plan.cuts || [])])];
    edl.shotIds = art.shots.filter(s => !edl.cuts.includes(s.id)).map(s => s.id);
    edl.speed = plan.pacing?.speed ?? edl.speed;
    edl.aspect = plan.export.aspect;
    edl.colorGrade = plan.color;
    edl.audioEnhance = plan.audio;
    edl.safe = plan.framing.safe;
    edl.export = plan.export;
    edl.autoEdit = autoEdit;
    edl.subtitleStyle = subStyle;
    edl.subtitlesOn = true;
    edl.volumes.music = edl.volumes?.music != null ? Math.min(edl.volumes.music, 0.5) : 0.45;
    project.versions[project.versions.length - 1].label = autoEdit ? 'Auto-edited cut' : 'Baseline edit cut';
  }
  touchProject(project, `AUTO EDIT ${autoEdit ? 'applied' : 'baselined'} for ${preset.label}`);
  putProject(project);
  return plan;
}

function assertSafe(idea) {
  if (!idea) return;
  const blocked = [/\bchild\s*porn/i, /\bmake a bomb\b/i, /\bkill (a|the) (real )?person\b/i, /\bexplicit sexual/i];
  for (const re of blocked) if (re.test(idea)) throw new Error('Content safety: this brief was blocked. ROKTOK does not generate harmful or illegal content.');
}

// ---------------------------------------------------------------------------
// AI EDITOR AGENT — natural language editing commands (real EDL operations)
// ---------------------------------------------------------------------------
export function applyEditorCommand(project, command) {
  const cmd = (command || '').toLowerCase().trim();
  const art = project.artifacts;
  if (!art?.shots?.length) throw new Error('No video in this project yet — run MAKE EVERYTHING first.');
  const v = project.versions[project.versions.length - 1];
  const edl = v?.edl || defaultEdl(art.shots, art.analysis, project);
  const log = [];
  const apply = () => { v.edl = edl; touchProject(project, 'Edit: ' + command); putProject(project); };

  if (!v) { project.versions = [{ id: uid('v'), label: 'Edit', createdAt: new Date().toISOString(), edl }]; }

  if (/(remove|cut|trim).*(boring|slow|silence|filler)|boring parts/.test(cmd)) {
    const before = edl.shotIds.length;
    edl.cuts = edl.cuts || [];
    for (const s of art.shots) if (edl.shotIds.includes(s.id) && s.intensity < 0.4 && s.dialogue.length === 0 && !edl.cuts.includes(s.id)) edl.cuts.push(s.id);
    edl.shotIds = edl.shotIds.filter(id => !edl.cuts.includes(id));
    log.push(`Removed ${before - edl.shotIds.length} low-intensity shot(s)`);
  } else if (/cinematic/.test(cmd)) {
    edl.cinematic = true; edl.grade = 'cinematic'; edl.speed = 0.94; log.push('Cinematic mode: teal-orange grade, filmic pacing (0.94x), letterbox on');
  } else if (/(faster|speed up|quick)/.test(cmd)) { edl.speed = Math.min(2, (edl.speed || 1) + 0.25); log.push('Playback speed → ' + edl.speed + 'x'); }
  else if (/(slower|slow down)/.test(cmd)) { edl.speed = Math.max(0.5, (edl.speed || 1) - 0.25); log.push('Playback speed → ' + edl.speed + 'x'); }
  else if (/(dialogue|voice).*(louder|up)|make.*dialogue/.test(cmd)) { edl.volumes.dialogue = Math.min(1.5, (edl.volumes.dialogue || 1) + 0.25); log.push('Dialogue level → ' + edl.volumes.dialogue); }
  else if (/(music).*(louder|up)/.test(cmd)) { edl.volumes.music = Math.min(1.2, (edl.volumes.music || 0.55) + 0.2); log.push('Music level → ' + edl.volumes.music); }
  else if (/(remove|reduce).*(background )?noise|clean audio/.test(cmd)) { edl.denoise = true; log.push('Audio cleaner: noise gate + dialogue clarity enabled'); }
  else if (/(add|emotional).*(music|score)/.test(cmd)) { edl.musicMood = 'emotional'; log.push('Score mood → emotional (procedural preview / provider stem)'); }
  else if (/subtitle/.test(cmd) && /remove|off/.test(cmd)) { edl.subtitlesOn = false; log.push('Subtitles off'); }
  else if (/subtitle/.test(cmd)) { edl.subtitlesOn = true; edl.burnSubtitles = true; log.push('Subtitles on (burned-in)'); }
  else if (/(color|grade).*(cinematic|film)/.test(cmd)) { edl.grade = 'cinematic'; log.push('Color: cinematic grade applied'); }
  else if (/tiktok|reels?|shorts? version|vertical/.test(cmd)) { edl.aspect = '9:16'; edl.speed = Math.max(1.1, edl.speed || 1); log.push('TikTok version: 9:16, punchier pacing, subtitles on'); edl.subtitlesOn = true; }
  else if (/youtube|horizontal|16:9/.test(cmd)) { edl.aspect = '16:9'; log.push('YouTube version: 16:9'); }
  else if (/remove (background )?(music|score)/.test(cmd)) { edl.volumes.music = 0; log.push('Music muted'); }
  else if (/(remove|delete).*(shot|clip)/.test(cmd)) { const n = art.shots.find(s => cmd.includes(String(s.idx + 1))); if (n) { edl.cuts.push(n.id); edl.shotIds = edl.shotIds.filter(i => i !== n.id); log.push('Removed shot #' + (n.idx + 1)); } else log.push('No matching shot number found — try "remove shot 3"'); }
  else log.push('Command not recognised. Try: "remove boring parts", "make this cinematic", "make the video faster", "make the dialogue louder", "remove background noise", "add emotional music", "add subtitles", "create a TikTok version".');

  apply();
  return { ok: true, log, edl };
}
