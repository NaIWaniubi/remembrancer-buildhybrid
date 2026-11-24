# Privacy Narrative — Remembrancer Grand Prize Submission

> Hackathon: Google Firebase x Devpost #BuildHybridAI 2026
> Categories: **Potential Impact** + **Quality of Idea**
> Architecture: **hybrid edge/cloud on Firebase AI Logic** (Gemini Developer API backend,
> `InferenceMode.PREFER_ON_DEVICE`) with a deterministic local engine as the offline floor

---

## Why Family Voice Memory Demands Privacy-First Design

Family voice is not generic audio data. It contains:

- **Biometric identifiers** — voiceprints that uniquely identify each family member
- **Emotional states** — stress, joy, grief patterns that reveal mental health trajectories
- **Intergenerational knowledge** — recipes, stories, cultural practices spoken by aging relatives
- **Legal and medical disclosures** — casually mentioned diagnoses, financial situations, estate plans

When a cloud-first app processes this audio, it creates an attack surface that no family consent form
can adequately mitigate. The data is valuable enough to attract breaches, broad enough to enable
profiling, and intimate enough that a single exposure causes irreversible harm.

**The question is not "can we build this?" — the answer is yes. The question is "should family voice
leave the home?" Our answer is: by default it doesn't leave the browser at all.**

---

## Why Hybrid End-to-Cloud Is the Only Honest Solution

### The False Binary

Most voice apps force users into one of two modes:

1. **Full cloud**: send everything, get full-featured results. Privacy cost: total.
2. **Full local**: nothing leaves device. Capability cost: minimal AI features.

Neither serves families well. Full cloud makes family members reluctant to record private moments.
Full local can't handle the long conversations where the most meaningful memories live — weekend
dinners, holiday gatherings, bedside chats with grandparents.

### The Hybrid Approach

Remembrancer's architecture treats the boundary as a **policy decision, not a technical limitation**:

| Layer | What Happens | Where |
|-------|-------------|-------|
| **On-device transcription** | Real-time transcription via the browser Web Speech API (no model, no quota) | Browser |
| **Local summary + sentiment** | Deterministic extractive summarizer + lexicon sentiment engine, always available as fallback | Browser |
| **Remote Config / strategy** | Family decides: cloud on/off, threshold, degradation mode | Local settings or Firebase console |
| **Firebase AI Logic (cloud channel)** | Text-only summary through the sponsor SDK hybrid mode; SDK reports each response as on-device or in-cloud (`response.inferenceSource`) | Enabled with a real Firebase project (App Check included) |
| **Firestore (optional sync)** | Memory index with member-scoped permissions when a project is configured | Google Cloud |

This is "honest" because:
1. The privacy boundary is **visible** — badges in both platforms show which engine processed the memory.
2. The boundary is **controllable** — strategy switches and an explicit settings panel change behavior instantly.
3. The boundary is **enforced by architecture** — only text ever travels upward, audio bytes are never
   captured for transmission, and every cloud call has a deterministic local fallback.

---

## Offline-First Architecture (the offline floor beneath every channel)

The production-grade decision behind this submission: **the full chain must work with the network cable unplugged.**

```
┌───────────────────────────── Browser ──────────────────────────────┐
│                                                                     │
│  Capture ──► Web Speech API ──► transcript (text only)               │
│              (typed/paste fallback                                  │
│               when unsupported)                                     │
│                    │                                                │
│                    ▼                                                │
│  Sentiment lexicon ─► tags [#warm #nostalgic]   ◄── always local    │
│                    │                                                │
│                    ▼                                                │
│  Summary: prefer on-device, then in-cloud — Firebase AI Logic       │
│           (getAI + getGenerativeModel(ai, { mode:                   │
│            InferenceMode.PREFER_ON_DEVICE })); SDK-reported          │
│           inference source lands in the badges. Fails? Local floor.  │
│           │   fails or unconfigured?                               │
│           └──► extractive-local engine  ◄── guaranteed channel     │
│                    │                                                │
│                    ▼                                                │
│  Memory entry ──► timeline + retrieval corpus (localStorage       │
│                    mirror, demo-seeded, member-scoped visibility)   │
└───────────────────────────────────────────────────────────────────┘
```

Four design rules make offline-first real rather than aspirational:

1. **Guest mode is the default.** No sign-in wall. Firebase Auth appears only after a real project is
   configured; signed-out visitors record, summarize, tag, review and ask questions about their archive.
2. **The hard-coded strategy mirror never disappears.** Remote Config values are an overlay on top
   of built-in defaults; if Firebase is absent or unreachable, the app silently keeps the mirror values.
3. **Every channel has a named fallback state.** `graceful`, `local_only`, `offline` — each degrades
   visibly (badges) rather than failing opaquely. The options page shows the live channel table:
   on-device READY, local engine READY, cloud OPTIONAL/DEGRADED, Firebase AI Logic marked as an
   optional enhancement rather than a dependency.
4. **Only text crosses any boundary.** Transcription happens on-device; summaries travel as text;
   no audio blob is ever created for the network path. When cloud is disabled or unreachable, the
   same pipeline runs locally with zero loss of the timeline, tags, or Q&A capability.

For a family archiving grandmother's voice, offline-first is not a convenience feature — it means
the archive survives the demo laptop losing WiFi, survives the power outage, survives the hackathon
floor being crowded and congested. A privacy claim you cannot demonstrate without connectivity
is a slogan; a privacy claim you can demo on airplane mode is architecture.

---

## Potential Impact

### Direct Impact

- **Aging-in-place support**: Families can record daily check-ins without worrying about data
  exploitation. Grandparents can narrate recipes, stories, and values while they are still here.
- **Post-loss healing**: Preserved voice patterns help families remember not just what was said,
  but how it felt. Emotion tags surface joyful moments during grief.
- **Cultural preservation**: Diaspora families can archive minority-language home conversations
  without corporate servers ever seeing them — even fully offline, the degraded pipeline
  transcribes, summarizes, tags and retrieves.

### Systemic Impact

- **Quota-independent AI for sensitive data**: Proves that on-device-first pipelines (Web Speech API
  + deterministic local engines) deliver a complete product experience without consuming any
  metered model quota — an argument for accessibility of privacy tech beyond well-resourced teams.
- **Degradation as governance**: Shows that strategy switches can be reframed from "engineering
  kill switches" into "family privacy governance instruments", visible per household.
- **Dual-platform proof**: Demonstrates that privacy architecture survives interface changes —
  same model on extension and web.

---

## Quality of Idea

### Novelty

We invert the typical hackathon pattern. Instead of "what can we do with all this cloud AI?", we ask:
**"what must we NOT send to the cloud?"** The hybrid model is not a fallback — it is the primary
design, and the entire chain works when the cloud is entirely absent.

### Technical Depth

- Vue 3 + Pinia store with dual-backend memory collection (Firestore subscription when configured,
  localStorage mirror with demo seeding otherwise)
- Deterministic extractive summarizer (term-frequency scoring with position priors) and lexicon
  sentiment classifier — fully client-side, unit-exercisable
- In-p
age retrieval QA over the timeline corpus with IDF weighting, phrase boosting and citations
- MV3 service worker with structured message routing between popup and background
- Strategy constants mapping to runtime degradation behavior (graceful/local_only/offline/none)

### Completeness

Both platforms run end-to-end today:
- The web app boots guest-first, renders the dark-themed dashboard, seeds a demo archive, and
  executes the full chain with a working dev server (verified by HTTP checks against /, /login,
  /dashboard and every transformed module). The Firebase AI Logic SDK is imported and wired per
  the official quickstart; badges show real SDK-reported provenance.
- The extension popup offers the dual-channel hybrid demo (local engine / Firebase AI Logic) with
  the same SDK bundled for MV3, and the options page visualizes live channel status + App Check +
  degradation strategy.
- Documentation covers setup, demo storyboard (rewritten on the hybrid route), and this narrative.

### Risk Awareness

See `STATUS.md` for the single highest risk item: **live on-device inference availability in the
demo network environment remains unverified** (it needs Chrome 139+ desktop flags and, for
measured timings, a Sprint quota grant). Rather than blocking on it, PREFER_ON_DEVICE degrades to
in-cloud per the SDK's own design, and the deterministic local engine keeps the chain fully usable
either way.

---

## One-Sentence Positioning

> Remembrancer proves that hybrid edge-cloud AI isn't about squeezing more capability out of the
> cloud — it's about building trustworthy systems whose privacy promise survives being unplugged.
