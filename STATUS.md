# Remembrancer — Public Project Status

Last updated: **2026-11-29**

## What is implemented

- **Web app** (`hybrid-web/`): Vue 3 + TypeScript + Vite, Firebase Auth/Firestore/Remote Config, real `firebase/ai` hybrid inference, deterministic local fallback, explicit microphone opt-in, and SDK-reported `on_device` / `in_cloud` provenance badges.
- **Chrome extension** (`hybrid-ext/`): Manifest V3 service worker, bundled Firebase AI Logic module, App Check initialization, degradation-policy enforcement, and the same deterministic offline floor.
- **Shared behavior**: no third-party model APIs; guest/auth-missing Firestore writes fall back to local storage; demo seeds are labeled `demo-local` and never pretend to be cloud results.

## Verification

- Web: `npm test` — **19/19 passing**; `npm run build` — passing.
- Extension: `npm test` — **30/30 passing**; `npm run build:ai` — passing.
- Production bundles are included under `hybrid-web/dist/` and `hybrid-ext/src/lib/firebase-ai-logic.bundle.js`.
- Live Firebase AI Logic: the Gemini Developer API guided setup is complete; production App Check uses reCAPTCHA Enterprise; both the local evaluation build and the hosted site perform real `generateContent('Reply with OK.')` requests and the SDK reports `in_cloud`. Evidence: `hybrid-web/docs/screens/settings-live-incloud.png`.

## Submission links

- Repository: https://github.com/NaIWaniubi/remembrancer-buildhybrid
- Demo video: https://youtu.be/sqCHVr_Pc1w (Unlisted; final cut includes the live `in_cloud` proof frame).
- Hosting URL: https://remembrancer-hybrid-2026b.web.app (Firebase Hosting, production App Check verified).

## Current boundary

A real Firebase project (`remembrancer-hybrid-2026b`) and Web app are configured. The Gemini Developer API guided setup, API enablement, production App Check via reCAPTCHA Enterprise, and Hosting deployment are complete. The hosted site performs a real Firebase AI Logic request and records the SDK-reported `in_cloud` provenance. Remaining work: complete the Devpost submission form.
