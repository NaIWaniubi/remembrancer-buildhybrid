# RECORD-RUNBOOK.md — Record & Submit Runbook

Click-level procedures for everything between "code works on my machine" and "Devpost entry submitted".
The base submission ships the hybrid architecture: Firebase AI Logic is wired in as the real cloud
channel (SDK import verified in both platforms), with a deterministic local engine as the offline
floor. The steps below activate that channel against a live Firebase project.

---

## 0. Prerequisites (verified present)

| Tool | Version | Check |
|------|---------|-------|
| Node.js | v24.22.1 | `node --version` |
| npm | 11.19.1 | `npm --version` |
| Chrome | 158.x (desktop, ≥139 for on-device inference) | for extension loading |
| Git for Windows | any | `git --version` |

Registry note (China network): `npm install --registry=https://registry.npmmirror.com`.

---

## 1. Firebase project configuration (activates the Firebase AI Logic channel)

Full guide: `firebase-project-setup.md`. Minimum click-path:

1. Firebase Console → Add project → name it (e.g. `remembrancer-<you>`) → create.
2. Build → **AI Logic** → Get started → guided workflow:
   - when asked for a Gemini API provider, pick the **Gemini Developer API** (no billing needed);
   - complete the workflow so the required APIs + services are provisioned;
   - the workflow **auto-enforces App Check for AI Logic** — keep it enforced
     (Security > App Check > APIs tab → row "Firebase AI Logic" must read *Enforced*).
3. Build → Firestore Database → Create database → production mode, region closest to you.
4. Project Settings → "Add Firebase to your web app" → copy `apiKey`, `authDomain`, `projectId`,
   `storageBucket`.
5. Configure the **App Check debug provider for local development**:
   - **Web**: put the registered UUID in `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` inside
     `hybrid-web/.env.local` (git-ignored), then set `localStorage.remembrancer.appcheck-debug = '1'`.
   - **Extension**: enable debug mode in Options and paste the same registered UUID into the
     App Check debug-token field; it is stored in `chrome.storage.local`.
   - Register the UUID once in Firebase Console → Security → App Check → Apps → Remembrancer Web
     → Manage debug tokens.
   - Never commit the token or ship it in source.
   - **Never commit or ship any debug token.** Production releases register a real attestation
     provider instead.
6. Wire the config into the app — two equivalent paths:
   - **Web**: Settings → Firebase project section → API key + Project ID (+ optional auth domain)
     → Save. This stores the runtime override under `remembrancer.firebase` (no rebuild needed);
     or copy `.env.example` to `.env` and fill `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_PROJECT_ID`.
   - **Extension**: options page → API key + Project ID (+ optional App ID) → Save & Activate AI
     Logic (stored in `chrome.storage.local` under `firebase_project`); regenerate the SDK bundle
     after any SDK-side edit: `cd hybrid-ext && npm run build:ai`.
7. Billing upgrade (Blaze plan) is required **only** if you request an AI Logic quota grant
   (§4). Firestore itself stays free-tier.

Behavior contract when placeholders remain (do nothing): the app boots guest-first, never calls
the Gemini endpoints, uses the local mirror, and badges channels as "not configured". That is the
shipped default and needs no action.

8. Firestore rules (optional, member-scoped sharing):

```
match /families/{familyId}/memories/{memoryId} {
  allow read: if request.auth != null
    && resource.data.visibleTo.hasAny([request.auth.uid]);
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null && request.auth.uid == resource.data.createdBy;
}
```

9. Deploy (optional): `cd hybrid-web && npm run build && firebase deploy --only hosting`.

### Verifying the channel is live

- Web dashboard badges: the header probe flips to `Firebase AI Logic: SDK wired · ready`.
- One capture → outcome badge reads `☁ Firebase AI Logic · on-device` or `· in-cloud` —
  that provenance comes straight from the SDK's `response.inferenceSource`, not from a guess.
- Settings → **Probe Firebase AI Logic** now initializes the device model after the click and allows
  up to 180 seconds for a cold download before sending the minimal real request. A successful local
  evaluation run is captured in `hybrid-web/docs/screens/settings-live-incloud.png` as
  `ready (AI Logic responded · in_cloud)`.
- Extension popup: "Firebase AI Logic" button produces the same provenance line in the result meta;
  options page channel table flips the row to READY.
- On-device downloads take minutes the first time; the dashboard shows a progress meter during
  `initializeDeviceModel()` (fired by the capture click per the Chrome Prompt API requirement).

---

## 2. git init → first commit (click-level)

Run in the submission root (`buildhybrid-remembrancer/`):

```bash
# 1) initialize
git init                                  # default branch will be master/main per your git config

# 2) ignore noise BEFORE the first add (create this file first!)
cat > .gitignore <<'EOF'
node_modules/
.env
*.log
.DS_Store
EOF
# NOTE: dist/ is deliberately NOT ignored — hybrid-web/dist/ (built & verified output)
# ships in the repo so judges can preview without npm install. Keep it committed.

# 3) stage
git add .

# 4) review what is about to be committed — confirm NO real keys AND no App Check debug token:
git status --short
grep -rn "sk-[A-Za-z0-9]\{20,\}\|AIza[AIza-]\{30,\}" --include="*.ts" --include="*.js" --include="*.json" . || echo "no hard-coded key material"

# 5) commit
git commit -m "Remembrancer: hybrid privacy-first family memory engine (web + MV3 extension)

- Real Firebase AI Logic integration on both platforms (firebase/ai, Gemini Developer API backend,
  InferenceMode.PREFER_ON_DEVICE) with SDK-reported on-device/in-cloud provenance badges
- Deterministic local sentiment + extractive summarizer engine as the offline floor
- Firebase App Check enforcement support with debug-provider local-dev path
- MV3 extension: bundled firebase/ai SDK via esbuild, dual-channel popup, options page
- Apache-2.0 licensed; README, DEMO-STORYBOARD, PRIVACY-NARRATIVE, STATUS, SUBMIT-DEVPOST docs"

# 6) remote + push (only if a repo was created on the dev host of your choice)
git branch -M main                        # if the form expects 'main'
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

Repo hygiene rules baked in above: `.env` ignored, `dist/` not ignored (ships built output),
icons committed (generated by `hybrid-ext/tools/make-icons.mjs`, reproducible), the esbuild bundle
output committed alongside its source module.

---

## 3. Load the extension unpacked (Chrome)

1. Open `chrome://extensions/`.
2. Toggle **Developer mode** (top-right) ON.
3. Click **"Load unpacked"** → select the `hybrid-ext/` directory (the one containing `manifest.json`,
   `icons/`, `src/`).
4. The Remembrancer card appears; pin the icon via the puzzle-piece menu → Extensions.
5. Toolbar click → paste a family conversation → **⚙ On-Device Summary** (instant, offline) and/or
   **☁ Firebase AI Logic** (needs §1; shows real on-device/in-cloud provenance, local fallback).
6. Options page (`chrome://extensions` → Details → Extension options): verify the Channel Status table
   renders (on-device READY, local engine READY, Firebase AI Logic OPTIONAL/READY/DEGRADED);
   optionally save your Firebase project there.
7. After code edits: remove the extension card → **Load unpacked** again (reload does not pick up
   changed module files reliably on MV3). After `src/lib/firebase-ai-logic.js` edits rerun
   `npm run build:ai`.

---

## 4. Strong-route supplementary record (Gemini Nano on-device quota grant)

The PREFER_ON_DEVICE architecture is already the shipping design; what a quota grant adds is
measured live on-device inference inside the evaluation window. Sprint windows are time-boxed.
Apply for the last viable window — **Sprint applications close 2026-11-25 10:00 PT**; grants are
issued ~2026-11-27 and stay valid 4 days (~11-27 → ~12-01), which spans the corrected submission
deadline (2026-12-01 06:00 Beijing). Official judging runs 12-10 … 12-16 and winners are announced
~12-21, so the post-deadline work happens outside the grant window either way.

| Sprint | Window | Viable for the 12-01 deadline? |
|--------|--------|--------------------------------|
| Sprint 1 | 2026-11-11 → 11-14 | expired |
| Sprint 2 | 2026-11-18 → 11-21 | expired / window closed — do not chase |
| **Sprint 3 (last viable)** | apply by **11-25 10:00 PT**; grant issued ~11-27, valid 4 days (~11-27 → ~12-01) | **apply here** — covers the deadline |

Steps during the window:

1. GCP Console → IAM & Admin → Quotas → search **Generative AI → Request increase** (region: global /
   us-central1 as the console allows).
2. Model preference: **Gemini Nano 4** primary; newer cloud models as fallback for long text.
3. Fill the sprint claim form (link in the console); approval activates immediately, valid exactly 4 days.
4. Complete §1 (config + App Check debug token registration).
5. Verification pass before claiming it live:
   - web app: Settings shows an enabled AI Logic channel; run one pipeline and confirm the badge reads
     `☁ Firebase AI Logic · on-device` (or in-cloud) with no "degraded" flag;
   - extension: options page channel table flips Firebase AI Logic from OPTIONAL to READY;
   - record the elapsed ms and screenshot both states into `hybrid-ext/docs/`.
6. Only then change SUBMIT-DEVPOST.md's "Best use of Gemini" row from *nominate only if exercised* to
   **nominate**, and add one sentence to the Summary citing measured Nano timings.
7. If no grant lands, submit as-is: every claim in SUBMIT-DEVPOST.md is scoped to the verified chain.

---

## 5. Screenshot & video capture reference

- Headless recipe used for this repo's shots: puppeteer-core against Chrome, dev server at `:5173`,
  popup harness running real `popup.js` under a `chrome.*` stand-in at `:8123`
  (`?demo=&caption=&banner=` query params render the caption banner — see
  `hybrid-web/docs/screens/SCREENSHOTS.md`).
- Gallery order for Devpost: home → dashboard → qa-grounded → settings → popup.
- Scene 2 of DEMO-STORYBOARD (live mic) still requires a human-driven GUI recording pass.

---

## 6. Submission-day checklist (final)

- [ ] `git status` clean; `grep` audit printed "no hard-coded key material"; no App Check debug token anywhere
- [ ] Public repo URL pasted into SUBMIT-DEVPOST.md
- [ ] Demo video uploaded (≤ length limit), linked
- [ ] Category picks per SUBMIT-DEVPOST §Category table
- [ ] No real credentials anywhere: only `.env.example`, `PROJECT_ID`, `YOUR_API_KEY`, demo markers
- [ ] Screenshots re-captured after any last edit (they are current as of 2026-11-19)
- [ ] Firebase grant decision (§4) reflected honestly in the form
- [ ] Deadline sanity: entry submitted **before 2026-12-01 06:00 Beijing**