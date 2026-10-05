# Project status

Reviewed against web code and GitHub issues on 2026-10-04. This is a status review, not a fresh production or real-guitar acceptance test.

## Delivered

- Private imports, track selection and player-selected notation.
- Shared single-note assessment, input-quality states and local microphone/direct-input analysis.
- Private Attempt persistence, reviews, Baseline comparisons, weak-point interventions, corrections and consented telemetry.
- Technique recommendations with return navigation.
- Development simulation and blocked simulated persistence.
- Labelled practice controls, reversible assessment opt-out and removal of review diagnostics downloads.
- Imported range budget display, disabled over-limit end measures and automatic shortening of existing over-limit ranges.

Tickets #2–#6 are closed. [Issue #1](https://github.com/BinaryDevil/fret-coach-web/issues/1), the broad private evidence-first loop specification, remains open. Closed slice tickets do not establish completion of every story in #1.

## Current challenge: real-song practicality

Real arrangements contain simultaneous notes, including lead-guitar dyads. The detector emits one pitch per reading. Passage selection and final assessment reject simultaneous pitches even when the passage fits the size limit.

The imported player permits at most 32 timeline performance events. Measures and chord tones are different counts. The current “notes” label can mislead for chords. This limit is local to passage selection; the evaluator has no equivalent length ceiling.

The chord-support request remains unresolved. Two approaches were discussed; neither was chosen or implemented:

- Full chord assessment: on-device polyphonic detection, pitch-set readings, chord criteria, simulation updates, real-audio validation and compatible persistence.
- Rhythm-only chord practice: onset assessment with pitch explicitly unrated.

ADR 0002 records the single-note claim. Any assessment expansion needs an explicit decision update and validated evidence. Removing the rejection alone does not establish chord correctness.

## Unfulfilled work

| Work | Evidence / next step |
| --- | --- |
| Chord and strumming support | Resolve full pitch assessment versus rhythm-only scope. |
| Longer passages | Define useful section-level reviews before expanding the rating claim. |
| Browser acceptance tests | Pure fixtures and source-text checks exist; both-player perfect simulation, cancellation and no-save behavior still need runtime coverage. |
| Input calibration | Real-guitar/noisy-input testing, latency and bleed checks remain unverified. Confidence alone is not a complete quality check. |
| Input lifecycle | Verify source changes during Attempts, pause/resume, tempo changes and pending permission requests on unmount. |
| Player consistency | Transport, quality UI and review logic remain duplicated; restart/passage cancellation needs behavior coverage. |
| Musical timing | Validate repeats, tempo changes, tuplets, ties, bends and overlapping notes before claiming support. |
| Mastery | Current ratings do not establish repeatability/tempo mastery or a whole-song Mastery map. |
| Pilot acceptance | Verify #1's usability, deletion/privacy acceptance and research continue/revise/stop gates. |
| Full build/tests | Earlier Next optimized builds hung; HTML tests require artifacts. Resolve with current-environment evidence before declaring the full suite green. |

## Historical anchors

- 4ea14ae: input sources and simulator.
- cc4d32a: reversible opt-out and review cleanup.
- 71a4d1e: note-budget range controls.

Use Git and GitHub for live revision/ticket state.

