# SUBMIT-DEVPOST.md — Devpost Submission Ready Draft

> Field-by-field copy-paste material for the #BuildHybridAI 2026 Devpost entry.
> Repository URL is final; replace the demo video and hosting URLs after deployment/upload.

---

## Title

**Remembrancer — A Privacy-First Hybrid Family Memory Engine on Firebase AI Logic: On-Device Summarization by Default with SDK-Reported Edge/Cloud Provenance**

## Tagline (short form, if the form allows a separate one-liner)

Record the family's voice memories on your device; Firebase AI Logic serves every summary with `PREFER_ON_DEVICE` — and the SDK itself reports whether it ran on-device or in-cloud.

## Summary (paste into the Description/Summary field)

**The problem.** Every "smart memory" app funnels raw family audio to a cloud model before anything useful appears. The most precious voices in a family — grandma explaining a recipe, a child's first recital, grandfather's orchard wisdom — are handed to servers by default. We asked a different question: can a hybrid architecture make privacy the *default state*, while still letting the cloud do what only the cloud can?

**Our answer is Remembrancer**, built end-to-end on the Firebase AI Logic hybrid SDK as its cloud channel. Transcription uses the browser Web Speech API after explicit microphone opt-in; depending on the browser and its settings, speech audio may be processed locally or by the browser vendor's speech service. Sentiment tags come from a deterministic lexicon engine running in-page. Summaries route through **Firebase AI Logic** — `getAI(app, { backend: new GoogleAIBackend() })`, then `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE })` — so the SDK prefers on-device inference when available and can fall back to the cloud-hosted model, and **the SDK tells us which one served each response**: `response.inferenceSource` ("on_device" / "in_cloud") lands directly in our pipeline badges. That is provenance, not a guess. Beneath the whole stack sits our offline floor: a deterministic local extractive summarizer that keeps the chain alive with zero accounts, zero keys, and zero network.

**Technological implementation (Grand Prize dimension 1).** This is not a skeleton with mockups. The web app (`Vue 3 + TypeScript`) wires the official hybrid quickstart exactly as documented: after a user click — satisfying the Chrome Prompt API's user-interaction requirement — `model.initializeDeviceModel(onProgress)` warms the on-device model with a live UI progress meter, then `await model.generateContent(prompt)` returns `result.response.text()` plus the SDK-reported inference source, all rendered in the outcome card. The extension ships the same SDK bundled by esbuild into a single MV3 module (`src/lib/firebase-ai-logic.bundle.js`) so the service worker and popup pages resolve it without bare-specifier imports; its options page exposes App Check configuration alongside the channel-status table. A retrieval Q&A engine scores candidate memories with IDF weighting, phrase boosting, and cited excerpts with per-hit match percentages; member chips scope memory visibility (mirrored by Firestore security rules when a project is configured); lazy Firebase init means placeholders never trigger outbound calls; Firebase Remote Config overlays the hard-coded degradation-strategy mirror at runtime.

**Design (dimension 2).** One dark UI grammar across both surfaces of the single Web platform — the same channel badges, the same degradation semantics, the same text-only boundary note — so the interface changes between toolbar capture and long-form dashboard review while the privacy model does not. Home leads with a three-step first-run flow (paste/speak → instant summary + tags → Settings → enable Firebase AI Logic), the dashboard shows a Live Capture card with mic meter, SDK-provenance path badge, and on-device download progress, and Settings groups Firebase project config, App Check status, degradation policy, probe, and data reset into clearly labeled sections.

**Potential impact (dimension 3).** Families gain a keepsake pipeline that respects the people inside it: hybrid inference that follows the device's capability instead of forcing every family onto a paid cloud tier, graceful offline behavior as a first-class state rather than an error screen, member-scoped sharing, and no vendor lock-in beyond the sponsor SDK the hackathon asks us to build on. Aging-in-place oral histories, small-clinic family communication, and community archives all benefit from the same pattern.

**Quality of idea (dimension 4).** "End-to-cloud hybrid is not a technical flex — it is a privacy necessity." Our differentiator is honest capability reporting: every badge states what actually ran today — `⚙ local engine · offline floor`, `☁ Firebase AI Logic · on-device`, `☁ Firebase AI Logic · in-cloud`, or `degraded → local` — sourced from real SDK evidence rather than UI decoration.

Platform note for judges: per the rules, the web app and the Chrome extension count as one platform entry; together they are product completeness within the Web platform (instant toolbar capture + long-form review sharing one engine core), not two separate platform claims.

## How We Used Firebase AI Logic (paste into the required sponsor-section field)

Firebase AI Logic is the cloud channel of Remembrancer's architecture, consumed exactly per its official hybrid quickstart — this is the primary technical subject of the project, not an optional add-on. On the web app (`hybrid-web/src/lib/cloudClient.ts`) we import `{ getAI, getGenerativeModel, GoogleAIBackend, InferenceMode }` from `"firebase/ai"`, construct `getAI(firebaseApp, { backend: new GoogleAIBackend() })`, and create the model with `mode: InferenceMode.PREFER_ON_DEVICE`. On every capture click we run `initializeDeviceModel()` (after the user interaction, before any query, per the Chrome Prompt API requirement) and drive its download-progress callback into the UI meter, then call `generateContent(prompt)` and read `result.response.text()` plus `result.response.inferenceSource`. The SDK's own report — "on_device" or "in_cloud" — is what our badges display, so judges can see the hybrid decision made in real time rather than asserted by us. The MV3 extension carries the identical wiring through an esbuild bundle of the same SDK. App Check initialization is implemented on both surfaces. The Web app reads its debug token from `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` and the extension from its Options storage; neither token is committed to the repository. The token is registered in Firebase Console, and the live `generateContent` probe has now succeeded against the real project: the SDK returned `inferenceSource: "in_cloud"` and the Settings probe reads `ready (AI Logic responded · in_cloud)`. Evidence is captured in `hybrid-web/docs/screens/settings-live-incloud.png`. Production App Check is configured with reCAPTCHA Enterprise and verified against the live Hosting site; the hosted Settings probe also returns `ready (AI Logic responded · in_cloud)`. Two deliberate design decisions: PREFER_ON_DEVICE is *our* architectural stance — the edge is preferred precisely because family data should prefer the device — and the deterministic local engine (lexicon sentiment + extractive summarizer) is kept as the floor beneath every channel, so nothing about quota windows or connectivity can break the pipeline. The rules forbid calling other model APIs directly; Remembrancer contains no third-party chat-completions client anywhere.

## Demo Video

Local master (not committed): 170s / 1280×720 / H.264+AAC; black-frame, frame-sample and audio-peak QA passed.
YouTube URL: https://youtu.be/sqCHVr_Pc1w (Unlisted, final cut with live `in_cloud` proof).
Hosting URL: https://remembrancer-hybrid-2026b.web.app (Firebase Hosting, production App Check via reCAPTCHA Enterprise).

Runtime: 2:50, five scenes per `DEMO-STORYBOARD.md` (guest entry → live transcription/degradation strategy → timeline growth + grounded Q&A → extension popup vs web dashboard split).
Live-proof asset: `hybrid-web/docs/screens/settings-live-incloud.png` captures the real Settings probe reading `ready (AI Logic responded · in_cloud)`. The final cut must insert this shot immediately after the Firebase AI Logic architecture slide.

## Repository

URL: `https://github.com/NaIWaniubi/remembrancer-buildhybrid` (root contains `hybrid-web/`, `hybrid-ext/`,
README, STATUS, PRIVACY-NARRATIVE, DEMO-STORYBOARD, RECORD-RUNBOOK, SUBMIT-DEVPOST, LICENSE).

Recommended README banner path for judges: root README "Execution Plan (countdown)" table.

## Technologies

TypeScript, Vue 3 (Composition API), Pinia, Vue Router, Vite, **Firebase AI Logic (`firebase/ai` hybrid SDK: Gemini Developer API backend, InferenceMode.PREFER_ON_DEVICE)**, Firebase App Check, Firebase Auth/Firestore/Remote Config (lazy), Chrome Extension Manifest V3, esbuild (SDK bundling), Web Speech API.

## Category & Award Selections (recommended picks)

| Form choice | Pick | Rationale |
|-------------|------|-----------|
| Hackathon theme | **#BuildHybridAI** (the submission's primary context) | The entire architecture is the sponsor SDK's hybrid pattern: PREFER_ON_DEVICE + offline floor |
| Best use of **Firebase AI Logic** | **Nominate** | Real SDK integration on both surfaces; live `generateContent` succeeded and the SDK reported `in_cloud` (`settings-live-incloud.png`) |
| **Best Overall** (if offered) | **Nominate** | Grand Prize criteria are met head-on: implementation depth, cohesive design, impact, idea quality |
| Platform-specific awards | **Best Web App (Web/Chrome)** — nominate this ONE entry | Per the rules, the web app and extension are a single platform item; they add product completeness inside the Web platform, not two separate platform claims |
| Best use of Gemini | **Do not nominate** unless a valid quota grant is obtained | Sprint 3 window closed on 2026-11-25 10:00 PT; no grant evidence exists |
| Best Mobile (iOS/Android) | Do **not** select | No mobile build exists; selecting it would misrepresent scope |

Where sponsor-SDK usage is emphasized in this draft: the Summary paragraphs "Our answer", "Technological implementation", and the dedicated "How We Used Firebase AI Logic" sponsor section; the repo carries the same emphasis in README ("Hybrid Channels") and PRIVACY-NARRATIVE.

## Pre-submit checklist

- [x] Replace the demo video and hosting URL placeholders; confirm repo is public
- [x] Upload the final demo video with a real `inferenceSource` badge shot; link matches the final cut
- [ ] Screenshots gallery order: home → dashboard → qa-grounded → settings → popup
- [x] No real credentials anywhere (`.env.example` only; grep for `sk-`, `AIza`); no App Check debug token committed
- [ ] Entry submitted **before 2026-12-01 06:00 Beijing**
- [ ] Add judges' link to RECORD-RUNBOOK in the repo description