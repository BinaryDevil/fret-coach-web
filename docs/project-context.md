# FretCoach — Project Handoff Context

Last updated: 2026-08-09

## Product scope

FretCoach is a web app for focused guitar practice. The current implemented scope is the **practice library**:

1. A visitor chooses a practice exercise from the public library; sign-in remains available but optional.
2. They view guitar tablature, select a loop region, set BPM, and practice with a metronome.
3. The active note is highlighted and tracked by an orange vertical playhead.

The first exercise is **1-2-3-4 chromatic / spider**. This phase deliberately does **not** include recording, microphone input, pitch recognition, AI evaluation, or practice-session persistence.

## Repositories and branches

| Project | Local directory | Remote | Branch |
| --- | --- | --- | --- |
| Web app | `/Users/binarydevil/Workspace/fret-coach-web` | `git@github.com:BinaryDevil/fret-coach-web.git` | `main` |
| API | `/Users/binarydevil/Workspace/fret-coach-api` | See that repository's `origin` | `main` |

The web repository's latest completed feature commit is `6b72c07 First practice`.

## Start locally

```bash
# Terminal 1 — API
cd /Users/binarydevil/Workspace/fret-coach-api
npm install
npm run start:dev

# Terminal 2 — Web
cd /Users/binarydevil/Workspace/fret-coach-web
npm install
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`
- The API `.env` must use `PORT=3001`.
- The API already enables CORS.

Do not copy database URLs, JWT secrets, or API tokens into source control or this document.

## Current web implementation

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page; CTA links to `/library` |
| `/login` | Sign in and registration against the API |
| `/library` | Public exercise list from the API (login currently optional) |
| `/practice?slug=chromatic-1-2-3-4` | Public API-driven practice player (login currently optional) |

### Main files

```text
app/login/page.tsx                    # login and registration UI
app/library/page.tsx                  # exercise library UI
app/practice/page.tsx                 # practice route entry point
components/practice-studio.tsx        # alphaTab player, metronome, BPM, loops
components/practice-studio.module.css # minimal tab + metronome UI
public/font/                          # bundled Bravura fonts required by alphaTab
lib/fretcoach-api.ts                  # API client, types, local auth session helpers
```

### Authentication

- `POST /auth/register` with `{ email, password, displayName }`
- `POST /auth/login` with `{ email, password }`
- Responses are stored as `fretcoach.session` in browser local storage during local development.
- When a saved session exists, its access token is passed as `Authorization: Bearer <token>` for exercise calls; guest reads work without it.
- There is no refresh-token retry logic or logout UI yet.

## Exercise API contract currently consumed

```text
GET /exercises
GET /exercises/slug/chromatic-1-2-3-4
```

For the current guest-practice phase, these read endpoints must accept requests without an `Authorization` header. When a saved session exists, the web app still sends its access token.

The player relies on:

```ts
type Exercise = {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructions: string;
  configuration: {
    targetBpm: number;
    bpmRange: [number, number];
  };
  score: {
    format: 'ALPHA_TEX' | 'GUITAR_PRO' | 'MUSIC_XML';
    content?: string; // required today for ALPHA_TEX
    defaultBpm: number;
    timeSignature: string;
    totalMeasures: number;
    backingTrackUrl?: string;
    backingTrackOffsetMs: number;
  };
  loopRegions: Array<{
    id: string;
    title: string;
    startMeasure: number;
    endMeasure: number;
    defaultBpm?: number;
  }>;
};
```

## alphaTab and timing design

- Dependency: `@coderline/alphatab`.
- For `ALPHA_TEX`, the client passes the API score content to `api.tex()`. The seeded spider exercise title is replaced with English before rendering.
- The bundled Bravura font assets are published from `public/font/`; the player sets `core.fontDirectory` to that path before rendering. Rendering currently runs with `core.useWorkers: false` because vinext does not yet use alphaTab's bundler integration.
- alphaTab renders the six-line tablature; the browser metronome provides its playback time axis.
- During metronome playback, the web player marks alphaTab's current beat group with `fretcoach-current-beat`, giving the next required note an orange visual cue.
- A vertical orange playhead spans the active notation-and-tab row, moving with the current beat to make the required note easier to follow.
- User-facing copy in the web app is English-only for the current phase.
- The browser Web Audio `AudioContext` is the metronome time source when playing. No backing audio exists for the seeded exercise yet.
- The current seed uses eighth notes, so the temporary timeline uses `30000 / bpm` milliseconds per rendered note.
- Loop boundaries are resolved from `loopRegions.startMeasure/endMeasure` against alphaTab's parsed bars and beat list.

Important future work: when a backing track is supplied, its `<audio>` / Web Audio playback position must become the one and only time axis. alphaTab should then operate in external-media synchronization mode. Do not use `setInterval` as a musical clock.

## Current UI intent

The practice screen was intentionally simplified after feedback. Keep it visually focused:

- real six-line tablature;
- current-note highlight and a vertical orange playhead across the active notation-and-tab row;
- four-beat metronome indicator;
- play/pause;
- BPM control constrained by the API's `bpmRange`;
- a loop-region selector;
- reset button.

Avoid reintroducing a large coaching sidebar, scorecards, or per-note navigation until the product calls for them.

## Verification commands

```bash
cd /Users/binarydevil/Workspace/fret-coach-web
npm run build
npm run lint
npm test
```

The project currently builds and lints successfully. alphaTab makes a client bundle larger than 500 kB; this is a known build warning, not a failed build. Later, optimize it via route-level/dynamic loading if needed.

## Suggested next tasks

1. Start guitar sound-input work: request microphone access, capture a local input stream, show input/permission states, and keep all audio on-device. Do not add recording persistence or scoring yet.
2. Define a backend-provided playback event timeline so non-eighth-note rhythms, rests, tuplets, tempo changes, and repeats are timed exactly.
3. Once the playback timeline is stable, compare live input with the target note and add pitch/rhythm evaluation.
4. Support backing-track playback and external-media synchronization for alphaTab.
5. Support `GUITAR_PRO` and `MUSIC_XML` files via `storageKey`/signed URLs.
6. Add a logout action, refresh-token flow, and loading/empty-state polish.
