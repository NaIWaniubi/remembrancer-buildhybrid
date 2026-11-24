# Extension documentation

## Screenshot status

The previous popup screenshot was removed because it predates the current Firebase AI Logic,
App Check, and degradation-policy behavior. A replacement screenshot must be recaptured from the
updated extension before submission; no stale image is referenced here.

## Runtime behavior

- The popup imports the bundled Firebase AI Logic SDK client from
  `src/lib/firebase-ai-logic.bundle.js`, produced by `npm run build:ai`.
- The explicit local action uses the deterministic extractive engine and works offline.
- The Firebase AI Logic action uses `getAI` → `getGenerativeModel` with
  `InferenceMode.PREFER_ON_DEVICE` and displays the SDK-reported `on_device` / `in_cloud`
  provenance when a real Firebase app is configured.
- App Check production mode requires an HTTPS token endpoint configured in Options. Local
  development may enable debug mode; the Firebase SDK prints the debug token that must be
  registered in Firebase Console.
- `graceful` is the only degradation policy that converts a cloud failure into a visible local
  result. `fail-loudly` (legacy value `none`) surfaces the error, while `local_only` and `offline`
  reject cloud requests.
