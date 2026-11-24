# Firebase Project Setup Guide — Remembrancer

> Hackathon: Google Firebase x Devpost #BuildHybridAI 2026  
> Deadline: **December 1, 2026, 06:00 Beijing time** (corrected — previously mis-transcribed as
> November 30, 22:00). Official judging runs Dec 10–16; winners announced around Dec 21.

---

## Prerequisites

- Google account with billing enabled (Firebase Spark plan is free; AI Logic requires Blaze plan for quota requests)
- Chrome browser (for extension testing)
- Node.js >= 20, npm >= 10
- Git Bash or WSL terminal

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Name it `remembrancer-hackathon` (or your own).
3. Disable Google Analytics (optional for hackathon).
4. Click **Create Project**.

## Step 2: Enable Required Services

In your new project dashboard:

| Service | How to Enable |
|---------|--------------|
| **Authentication** | Build > Authentication > Get Started > Sign-in method > Enable **Google** provider |
| **Firestore Database** | Build > Firestore Database > Create Database > Start in **test mode** |
| **Remote Config** | Release > Remote Config > Get Started (no default keys yet — we add them in code) |
| **AI Logic** | Build > AI Logic > Connect to Google Cloud project (requires linking a GCP project) |
| **Hosting** | Build > Hosting > Get Started (for web deployment) |

## Step 3: Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login          # Opens browser — this is the ONLY browser login step.
firebase init hosting   # Follow prompts in the project root of hybrid-web/
```

After `firebase init`, update the generated `.firebaserc` to point at your project:

```json
{
  "projects": {
    "default": "PROJECT_ID"
  }
}
```

## Step 4: Create a GCP Project for AI Logic

AI Logic requires a linked Google Cloud Platform project.

1. Go to [GCP Console](https://console.cloud.google.com/).
2. Create a new project (or link existing).
3. In Firebase console, go to Project Settings > Integrations > Link GCP project.
4. Enable the **Vertex AI API**: `https://console.cloud.google.com/apis/library/aiplatform.googleapis.com`

## Step 4b: App Check debug provider for local development

App Check has been enforced for Firebase AI Logic in all projects since November 2, 2026 —
without an attestation the Gemini API rejects requests. The debug-provider arming differs per
surface; both are automatic, but their registrations do not:

1. Register one debug token UUID in Firebase Console → Security → App Check → Apps →
   Remembrancer Web → Manage debug tokens.
2. **Web app**: add the UUID to `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` in `hybrid-web/.env.local`
   (git-ignored), enable the Settings debug switch (`remembrancer.appcheck-debug = '1'`), and rebuild.
3. **Extension**: enable debug mode in Options and paste the same UUID into the App Check
   debug-token field; the value is kept in `chrome.storage.local`.
4. Run the surface once from localhost and confirm the App Check debug provider is armed.

Never commit or ship any debug token. Register a production attestation provider before release.

---

## Step 5: Request AI Logic Quota (CRITICAL — Time-Sensitive)

The AI Logic quota application window has **three sprint windows**, each open for limited time and grants only **4-day validity**, with limited slots:

| Sprint | Application Deadline | Grant Issued | Valid For |
|--------|------------|---------------|-----------|
| Sprint 1 | 2026-11-11 → 11-14 window | — | expired |
| Sprint 2 | 2026-11-18 → 11-21 window | — | expired / closed |
| Sprint 3 (last viable) | **2026-11-25 10:00 PT** | ~2026-11-27 | 4 days (~11-27 → ~12-01), spans the deadline |

### Steps to Claim Quota:

1. Navigate to **Firebase Console > Build > AI Logic > Quota & Limits**.
2. Find the **"Request Access"** button for the current sprint window.
3. Fill in:
   - **Project ID**: your Firebase project ID
   - **Use Case**: "On-device hybrid transcription + cloud summary for family memory app (hackathon demo)"
   - **Estimated Requests/Day**: 50-200
   - **Model Preference**: Gemini Nano 4 (on-device) as primary; newer cloud models for long-text fallback
4. Submit before the sprint window closes.
5. Check your email within 24 hours for approval confirmation.
6. Once approved, the quota activates immediately and lasts exactly 4 calendar days.

### Important Notes:

- **Sprint applications close 11-25 10:00 PT.** Grants are issued ~11-27 and valid exactly 4 days,
  which covers the submission deadline (12-01 06:00 Beijing).
- If earlier sprints failed, **Sprint 3 is the last viable option** for the corrected deadline.
- The 4-day validity (~11-27 → ~12-01) spans the 12-01 06:00 Beijing submission deadline; record
the live-Nano proof inside it and finish the Devpost entry before it expires.


## Step 6: Update Your Config

Replace all placeholder values in these files with your actual Firebase values:

| File | Placeholder | Replace With |
|------|------------|-------------|
| `hybrid-web/src/config/firebase.config.ts` | `PROJECT_ID` | Your project ID string |
| `hybrid-web/src/config/firebase.config.ts` | `YOUR_API_KEY` | Web API key from Project Settings |
| `hybrid-ext/src/lib/firebase-ai-logic.js` | `PLACEHOLDER_CONFIG` | Same values |
| `hybrid-ext/src/options/options.html` | `PROJECT_ID` etc. | Same values |

## Step 7: Deploy the Web App

```bash
cd hybrid-web/
npm install
npm run build
firebase deploy --only hosting
```

## Step 8: Load the Extension

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `hybrid-ext/` directory.
5. Pin the extension to your toolbar.

## Step 9: Set Up Firestore Security Rules

For the hackathon, use these test-mode rules (replace before production):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Family-scoped access: users can read/write their own family's memories
    match /families/{familyId} {
      allow read, write: if request.auth != null;
    }
    match /members/{memberId} {
      allow read: if request.auth != null;
      allow write: if false;  // Only via Admin SDK or secure rules
    }
    match /memories/{memoryId} {
      allow read: if request.auth != null &&
        resource.data.familyId in get(/databases/$(database)/documents/families/$(request.auth.uid)).data.memberIds;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        resource.data.createdBy == request.auth.uid;
      allow delete: if false;
    }
  }
}
```

## Step 10: Configure Remote Parameters

In Firebase Console > Remote Config, add these parameters so the defaults in our code get overridden at runtime:

| Key | Value Type | Default Value |
|-----|-----------|---------------|
| `cloud_summary_enabled` | Boolean | true |
| `nano_transcription_enabled` | Boolean | true |
| `transcript_max_duration_cloud_sec` | Number | 600 |
| `degradation_policy` | String | graceful |
| `max_audio_seconds_per_request` | Number | 300 |
| `emotion_tag_model` | String | gemini-nano-4-ondevice |

---

## Troubleshooting

**Q: AI Logic shows "not enabled" or quota error?**
A: You may have missed the sprint window. Contact Google Firebase support or wait for the next sprint.

**Q: Chrome extension shows "API key not valid"?**
A: Ensure you replaced ALL placeholders, including in the options page saved config in `chrome.storage.local`.

**Q: Remote Config fetch fails in the extension?**
A: MV3 service workers have limited background lifetime. Use `chrome.storage.local` cache + periodic re-fetch.