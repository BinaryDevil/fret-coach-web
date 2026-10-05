# Project context and architecture

FretCoach serves returning self-taught guitarists improving difficult passages of meaningful songs. The intended loop is: import a Private arrangement, select a part and Target passage, check input quality, perform an Attempt, review measured evidence, practice one Focused intervention and compare later Attempts with a Baseline.

[CONTEXT.md](../CONTEXT.md) defines product vocabulary. [Project status](project-status.md) records implementation and unfinished work.

## Ownership and scope

The web app presents notation, captures audio locally, assesses supported passages and displays API-backed history. The companion API owns authentication, imports, stored timelines and persistence contracts. Check both repositories for contract changes.

[ADR 0001](adr/0001-private-player-owned-arrangements.md) defines privacy. [ADR 0002](adr/0002-evidence-first-assessment.md) limits initial assessment claims. Song mastery remains the ambition; current pitch/onset ratings cover a subset.

## Routes

| Route | Purpose |
| --- | --- |
| / | Landing page |
| /login | Authentication |
| /library | Signed-in Technique library |
| /practice?slug=… | Technique practice |
| /my-songs | Private arrangements |
| /my-songs/upload | Private import and lawful-source guidance |
| /my-songs/[importId] | Track selection, notation, passage practice and review |
| /history | Stored Attempts |

## Implementation map

| Area | Main files |
| --- | --- |
| API/session contracts | lib/fretcoach-api.ts |
| Technique player | components/practice-studio.tsx |
| Imported player | components/imported-song-practice.tsx |
| Input selection/lifecycle | components/performance-input.tsx |
| Source interface | lib/performance-input-types.ts |
| Microphone capture/detection | components/microphone-performance-source.ts; lib/pitch-detection.ts |
| Real-input panel | components/audio-input.tsx |
| Simulation/time conversion | lib/performance-input.mjs |
| Final assessment/attacks | lib/attempt-evaluation.mjs; lib/note-attack.mjs |
| Passage/save payloads | lib/private-passage-attempt.mjs |
| Baseline/intervention/correction/telemetry | lib/private-attempt-review.mjs; lib/private-intervention.mjs |

## Input and assessment flow

Both players consume pitch readings with MIDI, confidence, RMS, onset and monotonic capture timestamp. Sources support start/stop, state and simulation identity. Microphone detection runs locally; the panel retains device selection, meter, pitch comparison and open-low-E checks.

The development simulator emits numeric readings from selected timeline events and BPM. It generates no audio and reads no score DOM. Shared capture-time conversion maps readings to transport ticks; each player still owns its transport.

Each player records simulation identity at Attempt start and checks canSavePracticeAttempt before calling savePracticeAttempt. Production exposes only real input.

evaluateAttempt is the final assessment authority. Current criteria are 45 cents, 260 ms onset tolerance and minimum confidence 0.65; consult the implementation for authoritative values. Repeated events require a new attack and octave-wrong notes are incorrect.

Private history drives Baseline comparisons and rule-based interventions. Correction feedback is separate from historical evidence. Technique recommendations preserve a return path to the selected song passage.
