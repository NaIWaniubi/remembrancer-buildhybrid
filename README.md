# Remembrancer — Hybrid Privacy-First Family Memory Engine

> Google Firebase x Devpost Hackathon #BuildHybridAI 2026 · Cluster B production build
>
> **Architecture: hybrid edge/cloud with Firebase AI Logic as the cloud channel.** The web app
> and the MV3 extension both import the real `firebase/ai` SDK (Gemini Developer API backend,
> `InferenceMode.PREFER_ON_DEVICE`) and show the SDK-reported on-device/in-cloud provenance in
> every pipeline badge. The deterministic local engine remains the offline floor beneath every
> channel. No third-party model APIs are called anywhere in this repository.

---

## ⏰ Execution Plan (countdown)

Deadline: **2026-12-01 06:00 (Beijing)** — corrected from the previously mis-transcribed
"11-30 22:00"; the plan spans 18 calendar days (11-14 → 12-01); **10 days remain from
today (11-21)**. Rows are checked off as landed; the full audit trail lives in `STATUS.md`.

| Date | Milestone | Status |
|------|-----------|--------|
| 12-01 (D-0) | Devpost entry submitted before 06:00 Beijing — repo public, video linked, all §6 checklist green | ○ |
| 11-29 | Submission assets final check: recapture gallery if anything moved; replace `<PLACEHOLDER>` URLs | ○ |
| 11-28 | Sprint 3 quota window decision — strong route (see RECORD-RUNBOOK §4) | ○ |
| 11-27 | Demo video final cut — 2:50, five storyboard scenes, incl. human-driven live-mic Scene 2 | ○ |
| 11-26 | README / PRIVACY-NARRATIVE / DEMO-STORYBOARD judge-facing pass | ○ |
| 11-25 | Dual-platform regression — unpacked ext reload, `npm run build` green, screenshots refreshed | ○ |
| 11-24 | Privacy narrative facts check against shipped code | ○ |
| 11-23 | Credential audit — grep `sk-` / `AIza`, confirm `.env` ignored, scrub history if ever needed | ○ |
| 11-22 | STATUS / storyboard sync with code reality | ○ |
| 11-21 | Sprint 2 window closes — last fallback attempt for an AI Logic grant if not yet claimed | ○ |
| 11-20 | Visual walkthrough of the 4 web shots + popup shot; fix anything ugly | ✓ |
| **11-19 (today)** | Firebase AI Logic real integration (web + MV3 bundle), App Check, LICENSE, first-run onboarding, 5 real screenshots, `SUBMIT-DEVPOST.md`, `RECORD-RUNBOOK.md`, rollup repair + seed-race fix, build green | ✓ |
| 11-18 | Production build both platforms (verified: dev server, headless chain proof, typecheck+build) | ✓ |
| 11-14 … 11-17 | Earlier build-phase milestones — see `STATUS.md` change log | ✓ |

Official judging runs **2026-12-10 … 12-16** and winners are announced around
**2026-12-21** — both dates noted here so the submission tail is planned against the real
calendar, not a mis-transcribed deadline.

---

## The Core Idea

**"End-to-cloud hybrid is not a technical flex — it is a privacy necessity."**

Family memories are sacred. Your mother's voice saying your name at bedtime. Your grandfather's
last recipe explanation on a Sunday afternoon. These are not data points for cloud processing.

Remembrancer starts with typed/paste input or explicitly opted-in microphone capture through the
browser Web Speech API. Depending on the browser and its settings, speech audio may be processed
locally or by the browser vendor's speech service. Sentiment tags use a deterministic lexicon
engine, and summaries run locally by default. When enabled, **Firebase AI Logic** provides the
sponsor SDK's hybrid mode (`InferenceMode.PREFER_ON_DEVICE`, Gemini Developer API backend), whose
responses report real on-device or in-cloud provenance straight into the pipeline badge. A
deterministic local extractive engine remains the offline floor, and the degradation strategy
decides what happens if the cloud channel fails.

---

## Dual-Platform Architecture

Remembrancer ships on **two platforms simultaneously**, making it a strong differentiator:

1. **Chrome Extension (MV3)** — instant capture from the toolbar. Popup offers the dual-channel
   hybrid demo (local engine / Firebase AI Logic); options page visualizes live channel
   status and the degradation strategy, with a bundled `firebase/ai` SDK serving the AI Logic
   channel (`npm run build:ai` regenerates the bundle).

```
┌──────────────────────────────────────────────────────────────────┐
│                     Remembrancer System                          │
├─────────────────────┬──────────────────────┬───────────────────┤
│   Chrome Ext (MV3)   │      Web App         │   Optional Sync    │
│   popup + options    │   (Vue3 SPA)         │   (Firebase)       │
├─────────────────────┼──────────────────────┼───────────────────┤
│ • Paste text →       │ • Live capture via   │ • Auth (Google)    │
│   On-device Summary  │   Web Speech API     │ • Firestore        │
│ • Firebase AI Logic  │ • Timeline w/ emo    │ • Remote Config    │
│   (with fallback)    │   tags + per-member  │   overlay          │
│ • Channel status &   │   visibility         │                   │
│   degradation table  │ • Archive Q&A w/     │                   │
│   in options         │   citations          │                   │
│ • Local icons only   │ • Dark theme UI      │                   │
└─────────────────────┴──────────────────────┴───────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │            Local Engine Layer (always available)             │
   │  Opt-in Web Speech API · extractive summarizer · lexicon      │
   │  lexicon sentiment tags · retrieval QA over the timeline    │
   └─────────────────────────────────────────────────────────────┘
         │
         ▼  [When a Firebase project is configured]
   ┌───────────────────────────────────────────────────────────────────┐
   │   Firebase AI Logic Cloud Layer (sponsor SDK, text-only input)     │
   │   getAI(app, { backend: new GoogleAIBackend() })                   │
   │   getGenerativeModel(ai, { mode:                                │
   │     InferenceMode.PREFER_ON_DEVICE })                              │
   │   initializeDeviceModel() after a click (UI progress state)       │
   │   model.generateContent(prompt) → response.text()                │
   │   response.inferenceSource → real on-device / in-cloud badge      │
   │   Unconfigured or failed? Falls back to the local engine with a    │
   │   visible badge. Never breaks the pipeline.                         │
   └───────────────────────────────────────────────────────────────────────────────┘
   └─────────────────────────────────────────────────────────────┘
```

---

## Value Proposition

| Pain Point | Remembrancer Solution |
|-----------|----------------------|
| Cloud apps send raw voice to servers | Microphone capture is explicit opt-in; Web Speech API networking is browser-controlled, and Remembrancer does not persist raw audio |
| "Smart" features need paid model quotas | Local engine runs the full chain with zero quota |
| No family permission control | Member chips scope memory visibility (Firestore rules when a project is configured) |
| Demo fails when network drops | Offline-first architecture: guest mode + local mirror storage work fully unplugged |
| Vendor lock-in to one AI provider | Firebase AI Logic is the single cloud channel; the offline floor needs no provider at all |

---

## Quick Start — live page in 5 steps

> Demo data (a pre-seeded family timeline + grounded Q&A corpus) and captured screenshots are
> already in the repo — **no Firebase project, no API key, no account is needed at any point**.

1. `git clone <this repo> && cd buildhybrid-remembrancer`
2. `cd hybrid-web && npm install`
3. `npm run dev` → open **http://localhost:5173**
4. Click **“Continue as guest (offline-ready)”** → the dashboard is live with seeded demo data:
   paste a family memory into Live Capture (or speak it in Chrome) and watch the local chain run.
5. *(Optional, cloud channel)* **Dashboard → Settings → save your Firebase project**, or
   copy `hybrid-web/.env.example` to `hybrid-web/.env` and fill `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and (for production App Check)
   `VITE_FIREBASE_RECAPTCHA_SITE_KEY`.
   Until then the app shows a friendly “Configure Firebase to enable cloud inference” guide card
   and keeps running fully offline. Step-by-step: `firebase-project-setup.md`.

**Judge shortcut — see the product without running anything:**

- Web screenshots (real UI, with captions + reproduction URLs): `hybrid-web/docs/screens/SCREENSHOTS.md`
  → `home-badge-v2.png`, `dashboard-badge-v2.png`, `qa-grounded.png`, `settings-badge-v2.png`
- Extension popup screenshot: `hybrid-ext/docs/popup.png`
- Self-scored rubric with evidence pointers: `EVALUATION-RUBRIC-SELFSCORE.md`

Production build (verified): `npm run build` → typecheck (vue-tsc strict) + bundle into `dist/`
(committed as evidence). Chrome extension quickstart lives in `hybrid-ext/docs/README.md`:
`npm install && npm run build:ai`, then load `hybrid-ext/` as an unpacked extension.

---

## Hybrid Channels

| Channel | Requirement | Status |
|---------|-------------|--------|
| **Firebase AI Logic — Gemini hybrid (cloud channel)** | A Firebase project with the AI Logic guided setup completed (App Check included) | Real `firebase/ai` import in `hybrid-web/src/lib/cloudClient.ts` and in the extension bundle (`hybrid-ext/src/lib/firebase-ai-logic.js` → `firebase-ai-logic.bundle.js`); each response reports `inferenceSource` ("on_device" \| "in_cloud") straight into the pipeline badges |
| **Firebase Auth / Firestore / Remote Config** | Your own Firebase project | Lazy-initialized only when real credentials exist; guest mode otherwise |
| **On-device model download** | Chrome 139+ desktop, flag `prompt-api-for-gemini-nano-multimodal-input` enabled | `initializeDeviceModel()` fires after a user click with UI progress state (per the official quickstart's user-interaction requirement) |

All placeholders remain `PROJECT_ID` / `YOUR_API_KEY`. No real credentials ship in this repository.

---

## Demo Concept

A 2:50 live demo built entirely on the degraded route (see `DEMO-STORYBOARD.md`):
1. Guest entry into the dashboard — no account needed
2. Live transcription via Web Speech API → outcome card with tags
3. Degradation strategy visualization in Settings + honest cloud probe
4. Timeline growth + Archive Q&A with citations
5. Extension popup dual-buttons side-by-side with the web dashboard

Captured flow screenshots (headless, real UI) live in `hybrid-web/docs/screens/`
(`home`, `dashboard`, `qa-grounded`, `settings` + `hybrid-ext/docs/popup.png`), each with an English
caption and its reproduction URL (see `hybrid-web/docs/screens/SCREENSHOTS.md`).

---

## Repository Structure

```
buildhybrid-remembrancer/
├── hybrid-web/                    Vue 3 + TypeScript web app (Firebase Hosting-ready)
│   ├── index.html                 meta + entry (privacy-first copy)
│   ├── package.json / vite.config.ts / tsconfig.json
│   ├── src/
│   │   ├── components/            VoiceRecorder, MemoryTimeline, MemberSelector,
│   │   │                          SettingsPanel, RetrievalQA, CloudSetupGuide
│   │   │                          (no-key/invalid-config setup guide card)
│   │   ├── composables/           useFirebaseAuth, useFirestoreMemory,
│   │   │                          useRemoteConfig (local-first triple layer)
│   │   ├── config/                firebase.config.ts (placeholders),
│   │   │                          firebase.init.ts (lazy init + App Check),
│   │   │                          remote-config.strategy.ts
│   │   ├── lib/                   speechRecognition, sentiment, localSummarizer,
│   │   │                          cloudClient (Firebase AI Logic + local floor)
│   │   ├── layouts/ stores/ router/ views/ styles/
│   ├── docs/screens/              4 web screenshots + SCREENSHOTS.md catalog
│   ├── docs/                      legacy single shots (pre-v2)
│   └── dist/                      production build output (committed as evidence)
├── hybrid-ext/                    Chrome MV3 extension (hybrid SDK bundle + local floor)
│   ├── manifest.json              MV3 manifest
│   ├── src/
│   │   ├── background/            service-worker.js (message routing)
│   │   ├── shared/                localEngine.js, cloudClient.js (ext-side engines)
│   │   ├── lib/                   firebase-ai-logic.js (real firebase/ai import)
│   │   │                          + firebase-ai-logic.bundle.js (esbuild output)
│   │   ├── popup/                 paste → on-device/cloud dual buttons
│   │   └── options/               Firebase project config + channel table + strategy
│   ├── icons/                     icon16/48/128.png (locally generated)
│   ├── docs/                      popup screenshot + ext README
│   ├── tools/                     bundle-ai.mjs (esbuild), make-icons.mjs
│   └── package.json
├── firebase-project-setup.md      Step-by-step project creation guide (optional sync layer)
├── README.md                      This file
├── SUBMIT-DEVPOST.md              Devpost form-ready draft (title, summary, categories)
├── EVALUATION-RUBRIC-SELFSCORE.md Judge-view self-score per official criterion (evidence-linked)
├── RECORD-RUNBOOK.md              Record & submit runbook (Firebase/git/extension/quota)
├── DEMO-STORYBOARD.md             ≤3min storyboard on the hybrid route
├── PRIVACY-NARRATIVE.md           Grand Prize narrative incl. offline-first architecture
├── LICENSE                        Apache-2.0 (canonical text)
└── STATUS.md                      Completion checklist + change log + verification evidence
```

---

## One Product, Two Surfaces (both inside the Web platform)

Per the rules, the web app and the Chrome extension count as a **single platform entry**; we do
not claim two platform prizes. What the two surfaces genuinely add is *product completeness*
within that one platform — instant toolbar capture when you are mid-tab, long-form review and
family sharing when you sit down at the dashboard:

- **Extension popup** — paste a family conversation from any tab, Firebase AI Logic serves it
  with real on-device/in-cloud provenance badges
- **Web dashboard** — live capture, timeline, member visibility, Archive Q&A with citations
- **Both** share one engine core: the same channel badges, the same degradation semantics, the
  same text-only boundary, the same Firebase AI Logic wiring

The interface changes between surfaces; the privacy model does not.

---

## License & Disclaimer

Licensed under **Apache-2.0** — see the root `LICENSE` file (canonical text).

Hackathon submission on the hybrid route. All Firebase configurations use placeholder values
(`PROJECT_ID`, `YOUR_API_KEY`). Replace them with your own credentials before any deployment.
Do not commit real API keys or App Check debug tokens.
