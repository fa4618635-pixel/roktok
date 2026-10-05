# ROKTOK 🎬

**ONE IDEA. ONE PROMPT. YOUR COMPLETE VIDEO.**

ROKTOK is a personal, mobile-first AI creative studio and AI video production app. Type one sentence — get one finished video: story, script, characters, locations, storyboard, camera direction, dialogue, voices, music, sound effects, subtitles, quality control, social pack, shorts and a final render.

> **I give ROKTOK an idea. ROKTOK does the filmmaking.**

---

## Run it

```bash
cd roktok
npm start          # → http://localhost:3000  (zero dependencies, Node 18+)
```

Open it on your phone's browser (same network) — the UI is Android-first: large touch targets, bottom navigation, dark/light mode, live progress. Add it to your home screen for an app-like experience; it can later be wrapped (e.g. Capacitor/WebView) into an Android APK.

---

## The 60-second flow

```
OPEN ROKTOK → CREATE VIDEO (or QUICK CREATE / MAKE EVERYTHING)
→ write idea → choose duration · language · style · format
→ GENERATE → AI Director works (live step-by-step progress)
→ ONE final video + QC report + social pack + shorts
```

**Built-in test command** (try it on the Create screen):

> Create a 3-minute ultra-realistic cinematic Pashto village drama about two brothers who argue about their father's land… consistent characters, natural Pashto dialogue, lip-sync, drone shots, wind, dust, birds, emotional music, reconciliation ending, Pashto subtitles, 9:16 for TikTok and 16:9 for YouTube.

---

## 🤖 Professional AUTO EDIT (built into every video)

Every production automatically runs a professional edit pass — no CapCut, no manual timeline work:

- **HD/high-quality export** — 1080p HD canvas render with platform-correct fps & bitrate
- **Smooth professional cuts & transitions** — hard cuts, cross-dissolves and act fades assigned per cut point
- **Automatic pacing & scene timing** — platform-aware speed (TikTok 1.08×, Reels 1.06×, YouTube natural)
- **Dead-air & pause removal** — lingering shot tails trimmed, awkward conversational gaps tightened (timed *before* music & subtitles so everything stays in sync)
- **Unnecessary section removal** — low-value shots automatically cut from the EDL
- **Cinematic color correction with natural skin tones** — per-platform skin-safe grade applied as a single-pass filter
- **Voice/audio enhancement** — dialogue-first mix, noise reduction on ambience, −14 LUFS loudness normalization
- **Background music, auto-balanced** — music auto-ducks ~15 dB under dialogue and rises in the gaps
- **Sound effects** — SFX cues auto-placed to action and rebased when cuts change the timeline
- **Automatic subtitles** — generated with correct timing + platform caption style (box captions on vertical, cinematic on YouTube)
- **Professional framing & composition** — rule-of-thirds placement, headroom, platform UI safe areas (captions stay above TikTok/Reels UI)
- **Platform-perfect export presets** — chosen automatically:

| Platform | Aspect | Resolution | FPS | Bitrate |
|---|---|---|---|---|
| 🎵 TikTok | 9:16 | 1080×1920 | 30 | 10 Mbps |
| 📸 Instagram Reels | 9:16 | 1080×1920 | 30 | 10 Mbps |
| 👥 Facebook Reels | 9:16 | 1080×1920 | 30 | 8 Mbps |
| ▶️ YouTube | 16:9 | 1920×1080 | 24 | 16 Mbps |

**How to use it:** on the Create screen pick **Publish to → TikTok / Instagram / Facebook / YouTube** and keep **AUTO EDIT = ON** (default). Type your script or idea → MAKE EVERYTHING → the video is generated *and* completely edited: pacing, color, audio, captions and export settings are decided automatically from your script and platform. The Final page shows the full AUTO EDIT report; the Editor tab lets you re-run it or layer manual AI commands on top. AUTO EDIT off still applies a baseline professional edit.

---

## 📲 Install on Android as a web app (PWA)

ROKTOK is a full Progressive Web App — install it from the browser, no Play Store needed:

1. Open ROKTOK on your phone's browser (HTTPS or localhost required)
2. Tap the **📲 Install** button (top bar, home screen, or Settings → *Install as an app*)
3. Accept Chrome's **"Install app"** prompt — or follow the in-app instructions (Chrome ⋮ → *Install app*; iPhone Safari → Share → *Add to Home Screen*)

What's included:

- **Web App Manifest** (`manifest.webmanifest`) — name, standalone display, theme, splash colors, home-screen **shortcuts** (Quick Create / Projects)
- **Generated brand icons** — 192 / 384 / 512 px + maskable 512 + Apple touch icon (`public/icons/`)
- **Service worker** (`/sw.js`) — precached app shell, offline browsing of cached projects (`state`/`projects` API cached with network-first), generated media cached, stale-while-revalidate for assets, versioned cache updates with automatic refresh
- **Install button** — uses the native `beforeinstallprompt` one-tap flow on Android; falls back to step-by-step instructions elsewhere; hides itself once installed
- Verified by the automated PWA test: manifest MIME + fields, icon pixel sizes, SW activation, install flow, and a **true offline reload**

---

## What actually works (not a mockup)

| Area | Status |
|---|---|
| Project system | ✅ create / rename / duplicate / delete / JSON export / per-project asset folders |
| Story Engine | ✅ title, logline, genre, conflict, structure, beats, sound & camera notes |
| Script Engine | ✅ scenes, natural dialogue in 17 languages (native Pashto/Urdu/Arabic banks), Natural Language Performance Mode |
| Character Bible | ✅ full identity records + consistency keys injected into every shot prompt + downloadable reference sheets |
| Location profiles | ✅ architecture, weather, lighting, objects, atmosphere — kept consistent |
| AI Director | ✅ full camera vocabulary (drone, OTS, Dutch, rack focus, push-ins…), lens, lighting, time-of-day, blocking, pacing, transitions |
| Long Video Engine | ✅ 10 s–5 min → intelligent shot splitting → **one continuous final video** |
| Subtitles | ✅ auto cues, editable, burned-in player rendering, SRT + VTT export, RTL layouts |
| Quality Control agent | ✅ 12 automated checks + auto-fixes + shot regeneration, shown on the Final page |
| AI Editor | ✅ real edit-decision list: “remove boring parts”, “make this cinematic”, “create a TikTok version”… all change the render |
| Audio | ✅ procedural score (mood-based), ambience beds, SFX cues synced to action, mix levels, Web Audio previews |
| Image Generator | ✅ prompt → real downloadable artwork (SVG engine) + character sheets |
| Image → Video | ✅ upload photo, camera moves + environmental motion, identity preserved (canvas animator) |
| Prompt Engineer | ✅ simple sentence → structured production prompt + negative prompt engine |
| Auto Shorts | ✅ 15/30/45/60 s best-moment cuts, 9:16, hooks, subtitles |
| Social pack | ✅ title, description, hashtags, per-platform captions, hooks |
| Thumbnails | ✅ generated PNG, downloadable |
| Voice Studio | ✅ device-TTS preview with emotion/speed/pitch (offline), voice files via connected provider |
| Dubbing | ✅ speech-timing pass, translated subtitle track, SRT export; full re-voice = provider slot |
| Lip sync | ✅ phoneme timing maps drive mouth shapes in the player; generative lip-sync = provider slot |
| Video export | ✅ real WebM rendering in-browser via MediaRecorder (MP4/4K = provider/ffmpeg slot) |
| Cost control | ✅ FREE/BALANCED/HIGH/MAXIMUM modes, pre-flight estimates, paid-call confirmation |
| Safety | ✅ content checks, no voice cloning without permission, keys server-side only |

Everything not runnable locally is **clearly labelled** (`DEMO`, `API SLOT`, “Provider/API required”) — no fake buttons.

---

## Architecture

```
roktok/
├── server/                     # zero-dependency Node HTTP + REST API
│   ├── index.js                # routes: projects, jobs, providers, subtitles, estimates…
│   ├── store.js                # JSON persistence (data/), settings, assets
│   ├── providers.js            # provider catalog, Smart Router, fallback chain, OpenAI-compatible live adapters
│   ├── i18n.js                 # 17 languages, RTL, performance-mode phrase banks
│   └── engine/
│       ├── promptkit.js        # prompt engineering + negative prompts + cost estimates
│       ├── story.js            # story engine
│       ├── script.js           # script engine + dialogue
│       ├── bible.js            # character bible + location consistency
│       ├── director.js         # AI director: scenes → shots with camera language
│       ├── media.js            # music/SFX plans + subtitle engine (SRT/VTT)
│       ├── qc.js               # quality control agent + auto-fixes
│       ├── social.js           # hooks, shorts, social pack, thumbnail spec
│       ├── svggen.js           # procedural image engine (demo provider)
│       └── pipeline.js         # job orchestration ("MAKE EVERYTHING") + editor agent
├── public/                     # mobile-first SPA
│   ├── index.html · app.css
│   ├── app.js                  # router, shell, home, settings/providers/budget
│   ├── views-create.js         # universal creator wizard
│   ├── views-final.js          # job progress, final video page, shorts
│   ├── views-project.js        # projects + 9-tab workspace + AI editor
│   ├── views-tools.js          # 14 studio tools
│   └── renderer.js             # cinematic render engine + procedural audio + WebM export
└── data/                       # projects, assets, settings (server-side keys only)
```

### Multi-model by design

Providers are **not hard-coded**. Each capability (text, image, video, voice, dubbing, music, upscale, transcription, translation, lip-sync) routes through a Smart Router:

1. pick the best **connected** provider for budget + capability,
2. on failure → automatic fallback (next provider → built-in demo engine),
3. project state is never lost.

A **OpenAI-compatible** adapter (official REST APIs for text, images, TTS) goes live the moment you paste a key in *Settings → Providers* (stored server-side, never sent to the browser). Runway-class, Kling-class, Veo-class, Luma, Pika, Firefly-class, ElevenLabs-class, HeyGen-class, Whisper-class, music and upscale providers ship as reserved official-API adapter slots.

### Render engine

The final video is drawn live on canvas by `renderer.js`: per-shot camera language (push-in, drone, handheld, Dutch, pan/orbit), time-of-day lighting palettes, stylized characters straight from the Character Bible, weather/dust/birds, cinematic grade + letterbox + film grain, RTL burned-in subtitles, cross-dissolves, and a Web Audio score/ambience/SFX mix — then exported to a real `.webm` file.

---

## Android packaging notes

- The UI is touch-first and offline-capable (demo engines run locally).
- Wrap with Capacitor / a WebView shell and point it at the bundled server (or host the API on-device) to produce an APK.
- Keep API keys in the server-side environment / settings store — never in the bundled frontend.

## License / rights

Personal-use prototype. Uses only official public APIs you connect yourself, open demo engines, and your own assets. No proprietary model weights or third-party source code. Content safety on by default; no unauthorized impersonation or voice cloning.
