// ROKTOK — Hooks, Auto Shorts, Social Media Pack, Thumbnail spec
export function generateHooks(story, analysis) {
  const title = story.title;
  return [
    { type: 'shocking', text: hookLine('shocking', story, analysis) },
    { type: 'emotional', text: hookLine('emotional', story, analysis) },
    { type: 'curiosity', text: hookLine('curiosity', story, analysis) },
    { type: 'question', text: hookLine('question', story, analysis) },
    { type: 'comedy', text: hookLine('comedy', story, analysis) },
    { type: 'story', text: hookLine('story', story, analysis) }
  ].filter(h => h.text && !h.text.startsWith('null'));
}
function hookLine(type, story, a) {
  const t = story.title;
  const map = {
    shocking: a.theme === 'land_conflict' ? '“Our father divided the land — but one brother took it all.”' : '“One decision changed everything before sunrise.”',
    emotional: a.theme === 'land_conflict' ? '“Two brothers. One field. A promise broken.”' : `“${t} — a story that will stay with you.”`,
    curiosity: `“What really happened in ${a.setting.replace(/^a(n)? /, '')} that morning?”`,
    question: a.theme === 'land_conflict' ? '“Should blood be thicker than land?”' : '“What would you do in their place?”',
    comedy: a.genre === 'comedy' ? '“Wait for what the younger brother does next…”' : null,
    story: `“${story.logline}”`
  };
  return map[type];
}

export function generateSocialPack(project) {
  const { story, analysis, shots = [], subtitles = {} } = project.artifacts;
  const lang = analysis.language;
  const title = story.title;
  const kw = ['villagestory', 'cinematic', 'shortfilm', analysis.language === 'ps' ? 'pashto' : analysis.language === 'ur' ? 'urdu' : analysis.language === 'ar' ? 'arabic' : 'drama',
    'ai filmmaking', 'roktok', analysis.theme === 'land_conflict' ? 'inheritance' : analysis.genre.replace(/\s/g, '')];
  const hashtags = kw.map(k => '#' + k.replace(/\s+/g, ''));
  const hashtags2 = hashtags.slice(0, 6);
  return {
    title,
    description: `${story.logline}\n\n${story.logline} Directed entirely by ROKTOK — ${analysis.durationSec}s · ${analysis.lang.name} · ${analysis.style} · ${shots.length} shots.\n\n` + hashtags.join(' '),
    hashtags,
    shortCaption: `${title} — ${analysis.genre} · ${analysis.durationSec}s ${analysis.lang.name}`,
    captions: {
      tiktok: `${story.logline.slice(0, 70)}… ${hashtags.slice(0, 4).join(' ')}`,
      instagram: `${title} 🎬 ${story.logline} ${hashtags.slice(0, 5).join(' ')}`,
      youtube: `${title}\n\n${story.logline}\n\n"${story.structure.beginning.slice(0, 120)}…"\n\nChapters & credits below. ${hashtags.slice(0, 4).join(' ')}\n\n#shortfilm #${analysis.language === 'ps' ? 'pashto' : 'cinematic'}`,
      facebook: `${title}\n${story.logline}\n\nWatch the full film → ${hashtags.slice(0, 3).join(' ')}`
    },
    hook: (generateHooks(story, analysis)[0] || {}).text,
    thumbnail: {
      headline: title.toUpperCase().split(' ').slice(0, 3).join(' '),
      sub: story.logline.split(' — ')[0].slice(0, 48),
      composition: 'lead face left-third, high contrast rim light, dark vignette, bold slab-serif title, warm/teal grade',
      expression: shots[0]?.expression || 'intense'
    }
  };
}

// Auto Shorts: pick the strongest contiguous runs for 15/30/45/60s
export function generateShorts(project) {
  const shots = project.artifacts.shots || [];
  const wants = [15, 30, 45, 60].filter(s => s < (project.brief.durationSec || 60));
  const scored = shots.map(s => ({ s, score: s.intensity * 2 + (s.dialogue?.length || 0) * 0.3 + (s.size.includes('close-up') ? 0.4 : 0) }));
  const out = [];
  for (const target of wants) {
    // sliding window with best total score
    let best = null;
    for (let i = 0; i < shots.length; i++) {
      let dur = 0, score = 0, ids = [];
      for (let j = i; j < shots.length && dur < target; j++) {
        dur += shots[j].dur; score += scored[j].score; ids.push(shots[j].id);
      }
      if (dur >= target * 0.7 && (!best || score / dur > best.score / best.dur)) best = { dur, score, ids };
    }
    if (best) {
      out.push({
        id: 'short_' + target, label: `${target}s Short`, targetSec: target, shotIds: best.ids,
        hook: (generateHooks(project.artifacts.story, project.artifacts.analysis) || [])[0]?.text || '',
        format: '9:16', burnSubtitles: true, aspect: '9:16'
      });
    }
  }
  return out;
}

export function thumbnailSpec(project) {
  const pack = project.artifacts.social;
  return pack.thumbnail;
}
