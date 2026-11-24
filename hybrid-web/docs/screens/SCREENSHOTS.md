# Demo Screenshots — Remembrancer

Captured headless (Chrome 158, 1440×900 @2×) against the running app — real UI, real engines, no staging tricks.

| File | Dimensions | Caption |
|------|-----------|---------|
| `home.png` | 2880×1800 | "Get started in three steps — guest mode needs no API key at all." |
| `dashboard.png` | 2880×1800 | "Guest mode · zero quota — transcript, sentiment tags and summary all run on-device." |
| `qa-grounded.png` | 2880×1800 | "Every answer is grounded in the archive — cited excerpts with match scores." |
| `settings.png` | 2880×1800 | "Cloud endpoint, degradation policy and reachability probe — saved locally as the Remote Config fallback." |

The extension counterpart lives in `hybrid-ext/docs/`: [`hybrid-ext/docs/popup.png`](../../../hybrid-ext/docs/popup.png) (738×1102)
— "Paste a family conversation, then choose On-device Summary or Firebase AI Logic."

## Reproduce a shot

The caption banner is driven by query parameters, so every shot is reproducible without editing code:

```
http://localhost:5173/?demo=Home&caption=Get started in three steps — guest mode needs no API key at all&banner=flow
http://localhost:5173/dashboard?demo=Dashboard&caption=Guest mode · zero quota — transcript, sentiment tags and summary all run on-device&banner=fixed
http://localhost:5173/dashboard?demo=Q%26A+Grounded&caption=Every answer is grounded in the archive — cited excerpts with match scores&banner=fixed
```

- `demo` — label chip on the banner.
- `caption` — one-line English copy under the chip.
- `banner=fixed` pins the card to the viewport bottom; omit it to render it in flow.

The banner is presentation-only (`src/composables/useDemoBanner.ts`); it never runs unless those
parameters exist, so users never see it.

## What each shot actually shows

- **home** — hero with guest-mode default note + the 3-step onboarding card (paste/speak → instant local
  tags & summary → Settings cloud-model upgrade) + live channel status grid.
- **dashboard** — Live Capture typed/paste fallback chain: outcome card with `#nostalgic #tender`
  style tags, `⚙ local engine` path badge, `full chain ok` status (local engine is the designed
  default — the degraded badge appears only when a configured cloud call actually fails).
- **qa-grounded** — Archive Q&A over the seeded demo family archive: cited excerpt blocks with
  per-hit match percentages and matched terms; badge reads `grounded in archive`.
- **settings** — restructured panel in four labeled sections: Channels & status / Cloud endpoint /
  Degradation strategy / Data & reset, with probe verdict visible.
- **popup** (extension) — dual buttons; the On-device button produced tags + summary +
  the "no audio ever captured or sent — text only" privacy line.

## v2 gallery — after the Firebase AI Logic integration (2026-11-19)

The Yunwu/OpenAI-compatible channel was removed; Firebase AI Logic is now the cloud channel and every
badge shows SDK-reported provenance.

| File | Dimensions | Caption |
|------|-----------|---------|
| `home-badge-v2.png` | 1440×960 | "Processing channels: Web Speech API · local engine floor · Firebase AI Logic (Gemini, sponsor SDK) · guest mode." |
| `dashboard-badge-v2.png` | 1418×902 | "Live typed/paste chain through the real store pipeline: outcome badge `⚙ local engine · offline floor` + `full chain ok`, header probes show `Firebase AI Logic: guest mode · local floor` and the PREFER_ON_DEVICE hybrid-mode badge." |
| `settings-badge-v2.png` | 1440×1600 | "Settings restructured for the sponsor SDK: Firebase project form, App Check debug-provider status, Firebase AI Logic probe, degradation strategy." |

The extension counterpart was recaptured against the new code — [`hybrid-ext/docs/popup.png`](../../../hybrid-ext/docs/popup.png)
(738×1102): the ☁ button is now **Firebase AI Logic** ("Gemini Developer API backend · PREFER_ON_DEVICE ·
local fallback"), and with a saved project its result meta adds the SDK-reported `provenance: on-device`
/ `in-cloud` line.

Capture method (v2): headless Chrome against the Vite dev server; the dashboard shot is click-driven —
the typed/paste fallback was forced by removing the `SpeechRecognition` globals before page load (same
technique recorded in STATUS bug #7), then clicking **⌨ Type / Paste Text** so the *real* store pipeline
ran end-to-end in-page. The popup shot runs the **real** `popup.js` under a `chrome.*` stand-in.

## v3 live Firebase AI Logic proof (2026-11-27)

| File | Dimensions | Caption |
|------|-----------|---------|
| `settings-live-incloud.png` | 1194×806 | "Real `generateContent` response from Firebase AI Logic after the Gemini Developer API guided setup; the SDK reported `in_cloud` and the Settings probe reads `ready (AI Logic responded · in_cloud)`." |

Capture method: visible Microsoft Edge against the production Vite preview on `127.0.0.1:4186`, with the
registered App Check debug provider enabled for local evaluation. The screenshot contains no API key,
App Check token, or personal data; the form fields are intentionally showing their placeholders.