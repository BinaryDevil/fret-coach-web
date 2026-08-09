# FretCoach — Project Handoff Context

Last updated: 2026-08-09

## Product scope

FretCoach is a web app for focused guitar practice. The current implemented scope is the **practice library**:

1. A user creates an account or signs in.
2. They choose a practice exercise from the library.
3. They view guitar tablature, select a loop region, set BPM, and practice with a metronome.

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
| `/library` | Authenticated exercise list from the API |
| `/practice?slug=chromatic-1-2-3-4` | API-driven practice player |

### Main files

```text
app/login/page.tsx                    # login and registration UI
app/library/page.tsx                  # exercise library UI
app/practice/page.tsx                 # practice route entry point
components/practice-studio.tsx        # alphaTab player, metronome, BPM, loops
components/practice-studio.module.css # minimal tab + metronome UI
lib/fretcoach-api.ts                  # API client, types, local auth session helpers
```

### Authentication

- `POST /auth/register` with `{ email, password, displayName }`
- `POST /auth/login` with `{ email, password }`
- Responses are stored as `fretcoach.session` in browser local storage during local development.
- The access token is passed as `Authorization: Bearer <token>` for exercise calls.
- There is no refresh-token retry logic or logout UI yet.

## Exercise API contract currently consumed

```text
GET /exercises
GET /exercises/slug/chromatic-1-2-3-4
Authorization: Bearer <accessToken>
```

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
- For `ALPHA_TEX`, the client passes **the API's `score.content` unchanged** to `api.tex(content)`.
- alphaTab renders the six-line tablature and receives `highlightPlaybackRange()` calls for the current note/beat.
- The browser Web Audio `AudioContext` is the metronome time source when playing. No backing audio exists for the seeded exercise yet.
- The current seed uses eighth notes, so the temporary timeline uses `30000 / bpm` milliseconds per rendered note.
- Loop boundaries are resolved from `loopRegions.startMeasure/endMeasure` against alphaTab's parsed bars and beat list.

Important future work: when a backing track is supplied, its `<audio>` / Web Audio playback position must become the one and only time axis. alphaTab should then operate in external-media synchronization mode. Do not use `setInterval` as a musical clock.

## Current UI intent

The practice screen was intentionally simplified after feedback. Keep it visually focused:

- real six-line tablature;
- current-note highlight;
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

1. Add a logout action and refresh-token flow.
2. Add loading/empty state polish to the library.
3. Support backing-track playback and external-media synchronization for alphaTab.
4. Support `GUITAR_PRO` and `MUSIC_XML` files via `storageKey`/signed URLs.
5. Define a backend-provided playback event timeline so non-eighth-note rhythms, rests, tuplets, tempo changes, and repeats are timed exactly.
6. Only after the playback timeline is stable, add microphone capture and pitch/rhythm evaluation.
