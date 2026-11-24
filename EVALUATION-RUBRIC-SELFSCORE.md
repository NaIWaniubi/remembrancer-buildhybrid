# Evaluation Rubric — Self-Score (Remembrancer · #BuildHybridAI 2026)

> Written: 2026-11-23 (cluster upgrade round). Policy: **honest scoring, prefer low over high**.
> Every claim carries a file:line or artifact pointer; anything that cannot be proven from this
> repo alone is listed under **Awaiting live-fire (user action)** and never scored as done.

## Official judging criteria (source: [firebasehybridaihackathon.devpost.com](https://firebasehybridaihackathon.devpost.com))

| # | Criterion | Official wording |
|---|-----------|------------------|
| 1 | Technological Implementation | "How well is the project built, and how effectively does it use Firebase AI Logic hybrid inference as part of the solution?" |
| 2 | Design | "Does the project deliver a complete, coherent product experience, not just a technical proof of concept?" |
| 3 | Potential Impact | "Does the project make a credible, specific case for solving a real problem for a real audience?" |
| 4 | Quality of the Idea | "Is this a creative, non-obvious use of Firebase AI Logic, and does the team show genuine understanding of the problem space?" |

Scale: 0–5 per criterion, **total /20**. No weights are published; equal weights assumed.

---

## 1 · Technological Implementation — **4.5 / 5**

### 1a. Firebase AI Logic integration depth (the Stage Two TI dimension)

| Check | Verdict | Evidence |
|-------|---------|----------|
| Real `firebase/ai` import (not a shim) | PASS | `hybrid-web/src/lib/cloudClient.ts:20-28` (`getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode` imported); live call sites `cloudClient.ts:80-81` |
| Documented hybrid wiring: Gemini Developer API backend + `PREFER_ON_DEVICE` | PASS | `cloudClient.ts:79-82`; ext mirror `hybrid-ext/src/lib/firebase-ai-logic.js:99-100`; official quickstart URL cited at `cloudClient.ts:2-3` |
| `initializeDeviceModel()` after a user click, with UI progress | PASS | `cloudClient.ts:96-101`; progress card `hybrid-web/src/components/VoiceRecorder.vue:54-60` |
| SDK-reported provenance (`response.inferenceSource`) driving badges | PASS (code + live) | pipeline store `hybrid-web/src/stores/memoryStore.ts:92-106`; badge `memoryStore.ts:155-158`; live evidence `hybrid-web/docs/screens/settings-live-incloud.png` reads `ready (AI Logic responded · in_cloud)` |
| App Check (enforced for AI Logic since 2026-11-02) | PASS (code+docs) | literal debug token + flag-before-init pattern `hybrid-web/src/config/firebase.init.ts:122-151, 181-213`; ext `true`-pattern `hybrid-ext/src/lib/firebase-ai-logic.js`; registration doc `firebase-project-setup.md §4b`; debug token never committed |
| Extension bundle carries the real SDK | PASS | `hybrid-ext/src/lib/firebase-ai-logic.bundle.js` (grep: `prefer_on_device` line 2565, `firebasevertexai.googleapis.com` line 2431); STATUS.md build evidence |
| No third-party model APIs anywhere | PASS | Yunwu/OpenAI-compatible client deleted; rules comment `cloudClient.ts:14-16`; zero grep hits per STATUS.md #B1 gate |
| Degradation semantics: unconfigured ≠ degraded | PASS | `cloudClient.ts:147-205` (`AiNotConfiguredError` split from real failures); no-key graceful UI `hybrid-web/src/components/CloudSetupGuide.vue` (this round) |
| **A live Gemini request was ever sent** | **YES** | Real Firebase AI Logic `generateContent('Reply with OK.')` succeeded on 2026-11-27; Settings probe returned `ready (AI Logic responded · in_cloud)`; evidence `hybrid-web/docs/screens/settings-live-incloud.png` |
| `inferenceSource === 'on_device'` observed on a real Chrome ≥139 | **NO** | The live run reported `in_cloud`; on-device remains architecture-supported but was not observed in this environment |

### 1b. Build/工程

- `npm run build` (vue-tsc strict + vite) green, rebuilt this round: `BUILD_EXIT=0` (see STATUS.md §2026-11-23).
- Shipped `dist/` committed as reviewable evidence; SDK call sites grep-provable inside chunks (STATUS.md evidence blocks).
- Deductions: bundle >500 kB warning (firebase included) with no manualChunks split; **no unit tests / no CI** (STATUS.md "Remaining Gaps" #5–#6).

**Score rationale:** the real `firebase/ai` wiring, call order, bundle integrity, App Check path, and a live SDK-reported `in_cloud` response are all proven. The only missing live proof is an `on_device` run, which depends on the local Chrome model download and is not required for the cloud-channel claim. 4.5 is the honest score today.

---

## 2 · Design — **4.5 / 5**

- Complete product surface, not a PoC: dashboard with live capture, timeline with sentiment tags, Archive Q&A with citations (`RetrievalQA.vue:23` role="status"), member visibility chips (`MemberSelector.vue`), settings with degradation strategy + channel table (`SettingsPanel.vue`), guest-first entry (`src/router/index.ts` — no auth wall).
- Dual surfaces inside the Web platform: web dashboard + MV3 popup (`hybrid-ext/docs/popup.png`), one engine core (README §One Product, Two Surfaces).
- **No-key graceful degradation (this round):** missing/invalid Firebase config renders the in-app setup guide card with setup links — verified live on dev server (home + dashboard guest path), zero console errors. `CloudSetupGuide.vue`, `firebase.init.ts` (`'invalid'` status + never-throw `ensureFirebase`), `main.ts` global error handler.
- Accessibility quick pass (this round): nav `aria-label="Primary"` (`DefaultLayout.vue:8`), transcript textarea label/for association (`VoiceRecorder.vue:32-33`), `--text-dim` contrast token ≥4.5:1 (`theme.css:12`), global `:focus-visible` outline (`theme.css:60-66`), decorative dots `aria-hidden` (`HomeView.vue` channel cards).
- Evidence gallery: `hybrid-web/docs/screens/SCREENSHOTS.md` (v2 set: home/dashboard/settings + `hybrid-ext/docs/popup.png`), each with reproduction URL.

Deductions: English-only UI (no i18n); no loading skeletons/spinner states on timeline; the main gallery still emphasizes the local-floor path, though the new live `in_cloud` evidence closes the cloud-badge gap. **4.5/5.**

---

## 3 · Potential Impact — **3.5 / 5**

- Credible, specific problem + audience: family voice memories, privacy-protective defaults, zero-quota access for families that cannot pay for model APIs (`README.md` §Value Proposition table; `PRIVACY-NARRATIVE.md`).
- Architecture backs the claim: no audio bytes leave the device (`VoiceRecorder.vue` engine notes line 67; Web Speech API transcription), deterministic local floor means the product works fully unplugged.
- Impact still argued, not measured: no user validation, no pilot family, family-sharing layer documented (Firestore rules in `firebase-project-setup.md` §9) but unverified against a live project. **3.5/5.**

---

## 4 · Quality of the Idea — **4 / 5**

- Non-obvious framing: "end-to-cloud hybrid is not a technical flex — it is a privacy necessity" (`README.md` §The Core Idea); on-device preferred *by architecture*, not by fallback luck.
- The provenance badge as an honesty mechanism (SDK's own `inferenceSource` in the UI, never a guessed label) and degradation strategy as a first-class settings surface are genuinely unusual for hackathon entries.
- Category risk: AI memory journals are a crowded space; the differentiator is the privacy/hybrid architecture, and judges may weight novelty of the *idea* lower than the architecture. **4/5.**

---

## Total — **16 / 20** (honest score today)

| Criterion | Score |
|-----------|-------|
| Technological Implementation | 4.5 |
| Design | 4.5 |
| Potential Impact | 3.5 |
| Quality of the Idea | 4.0 |
| **Total** | **16.0 / 20** |

The live Firebase AI Logic request and SDK-reported `in_cloud` badge are proven. Production App Check via reCAPTCHA Enterprise and Firebase Hosting are also verified. Remaining upside is an observed `on_device` run.

## Awaiting live-fire (remaining)

1. **`inferenceSource === 'on_device'`** — architecture supports it, but the observed live runs reported `in_cloud`.
2. **`chrome://extensions` unpacked load test** — GUI step, not automatable here (`STATUS.md` gap #2).
3. **Human-driven live-mic recording** — demo Scene 2 footage (`DEMO-STORYBOARD.md`).
4. **Devpost submission before 2026-12-01 06:00 Beijing** (`RECORD-RUNBOOK.md` §6 checklist).
