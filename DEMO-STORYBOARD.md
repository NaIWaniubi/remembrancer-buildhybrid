# Demo Storyboard — Remembrancer (Final Hybrid Route)

> Target runtime: **2 minutes 45 seconds** (hard limit: 3:00)
> Language: English voiceover with synchronized English subtitles
> Format: live screen recording of the real web app and Chrome extension
> Final route: typed/paste + local engine **and** a real Firebase AI Logic `generateContent` call with SDK-reported provenance.

---

## Scene 1 — Hook and product promise (0:00–0:15)

**Visual:** Warm family-photo opener, then the Remembrancer home page. The channel grid shows local transcription, local summary, Firebase AI Logic, and guest mode.

**Narration:**
"Every family has voices that matter. Remembrancer turns those voices into a private, searchable memory vault — and shows exactly which engine handled every summary."

**On-screen proof:** Home page heading and the four channel cards.

---

## Scene 2 — Local floor, live (0:15–0:45)

**Visual:** Dashboard with three seeded demo memories. Click **Type / Paste instead**, paste a short family memory, and process it. The local extractive summary and sentiment tags appear; the timeline badge reads `demo-local` or `extractive-local`, never a cloud badge.

**Narration:**
"Start with typed or pasted text. The deterministic local engine summarizes it instantly, tags the emotion, and stores it in the family timeline. This floor works with no account, no key, and no network."

**On-screen proof:** New memory appended; local badge; sentiment chips; offline-ready status.

---

## Scene 3 — Real Firebase AI Logic hybrid inference (0:45–1:25)

**Visual:** Open **Settings → Firebase AI Logic & strategy**. Show the App Check debug provider enabled. Click **Probe Firebase AI Logic** after the device model is warm; the probe returns `ready (AI Logic responded · in_cloud)`. Use the captured evidence frame `hybrid-web/docs/screens/settings-live-incloud.png` as the clean insert if the live click is too slow for the edit. Then process one memory with **Prefer Firebase AI Logic for new memories** enabled and show the outcome badge from the SDK response.

**Narration:**
"Enable Firebase AI Logic and the same pipeline uses the sponsor hybrid SDK. It prefers on-device inference when the device supports it and can fall back to the cloud. The badge is not our guess — it is the SDK's own `inferenceSource`, captured live from a real `generateContent` response."

**On-screen proof:**
- App Check debug provider armed.
- Probe success `ready (AI Logic responded · in_cloud)`.
- Captured evidence: `hybrid-web/docs/screens/settings-live-incloud.png`.
- One real cloud/on-device outcome badge.
- No third-party model endpoint anywhere.

**Fallback if the live call cannot be captured:** do not fake the badge. Use the captured real `in_cloud` evidence frame and state plainly that it was recorded from the live project on 2026-11-27.

---

## Scene 4 — Timeline, citations, and member scope (1:25–2:05)

**Visual:** Dashboard timeline with the new memory. Ask **"what did grandma say about dumplings?"** in Archive Q&A. The answer shows the quoted source, matched terms, and citations. Toggle a member chip and show the timeline filter update immediately.

**Narration:**
"Every memory becomes searchable. Archive Q&A answers from what was actually recorded, quotes the source, and shows its citations. Member chips scope what each person sees, and the same visibility model maps onto Firestore rules when sync is enabled."

**On-screen proof:** Grounded answer + citations; member filter changes the visible memories.

---

## Scene 5 — Chrome extension and close (2:05–2:45)

**Visual:** Split screen: Chrome extension popup on the left, web dashboard on the right. Paste the same text into the extension and run the local summary; show the extension's policy badge. End on the Remembrancer logo and the line "Your family's voice belongs to your family."

**Narration:**
"Remembrancer runs as a web dashboard and a Chrome extension. Two surfaces, one engine core, one honest provenance model. Local when it can, cloud when you choose, and always clear about what actually ran."

**Final frame:**
```
◉ Remembrancer
Your family's voice belongs to your family.
Local floor · Firebase AI Logic hybrid channel · SDK-reported provenance
```

---

## Recording and edit notes

- Record at 1280×720 or higher, 30fps; keep the final file under 180 seconds.
- Use typed/paste for the deterministic demo. Microphone capture is explicit opt-in; Web Speech API networking behavior depends on the browser and must not be described as "never leaves the device."
- The Firebase scene must show a real successful `generateContent` response. A configured project or an initialized SDK object is not enough.
- Register the App Check debug token before recording. Do not show API keys, tokens, or personal data on screen.
- Replace 10–15 seconds of architecture/b-roll with the live provenance shot; do not exceed 3:00.
- Upload the final cut to YouTube as Unlisted and put the URL in `SUBMIT-DEVPOST.md`.
