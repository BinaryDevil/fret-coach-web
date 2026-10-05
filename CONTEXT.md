# FretCoach

This file is the durable domain glossary. For current capabilities, challenges and unfinished work, read [project status](docs/project-status.md). For implementation relationships, read [project context](docs/project-context.md).

FretCoach helps returning self-taught guitarists re-establish a focused, effective practice habit and overcome specific playing weak points.

## Audience

**Returning self-taught guitarist**:
A guitarist who has learned independently before, knows fundamental playing skills, and is returning after a lapse or has plateaued without a clear practice structure.
_Avoid_: beginner, all guitarist, casual visitor

## Practice

**Target passage**:
A bounded excerpt of music the returning self-taught guitarist has chosen to master, usually the specific part that repeatedly fails during a song or exercise.
_Avoid_: lesson, course, content item

**Practice diagnosis**:
An evidence-based identification of the factor preventing reliable performance of a target passage, such as note accuracy, timing, tempo, or a transition.
_Avoid_: score, generic feedback

**Measurable improvement**:
A demonstrable change in a guitarist's reliable performance of a target passage against a defined baseline, rather than time spent or an opaque points total.
_Avoid_: engagement, streak, progress

**Player-selected notation**:
Notation for a target passage supplied by the guitarist in a supported file format, rather than drawn from a FretCoach song catalogue.
_Avoid_: user-uploaded song catalogue, FretCoach library

**Technique library**:
A small, intentionally curated set of FretCoach exercises used when a guitarist has no suitable target passage or needs to address a diagnosed technique gap.
_Avoid_: song catalogue, course

**Technique exercise**:
An assessable passage from the technique library that isolates a technique gap and can be used as a focused intervention.
_Avoid_: lesson, daily assignment

**Single-note passage**:
A target passage whose expected musical events are individual notes rather than simultaneous chord events; it is the initial boundary for FretCoach performance diagnosis.
_Avoid_: full song, chord progression, strumming pattern

**Assessable passage**:
A single-note passage whose score timing and expected events FretCoach can map deterministically, and whose input conditions meet the input-quality check.
_Avoid_: supported import, playable tab

**Performance event**:
One expected note in a target passage, defined by its pitch, intended onset time, and intended duration.
_Avoid_: note hit, beat

**Performance diagnosis**:
A comparison of an attempt with the performance events of an assessable passage that identifies pitch and onset-timing errors.
_Avoid_: opaque point score, generic feedback

**Accuracy rating**:
A compact per-attempt summary of correct expected events under the assessment criteria, shown with separate pitch, onset-timing, and input-confidence evidence; it is not shown for an unassessable attempt.
_Avoid_: mastery score, opaque point score

**Practice assist strictness**:
A player-selected tolerance for live practice guidance that does not change the product-defined mastery threshold.
_Avoid_: mastery setting, difficulty setting

**Attempt**:
One uninterrupted performance of the selected loop of a target passage, which is assessed after it finishes.
_Avoid_: session, note hit

**Live status**:
Minimal, non-disruptive during-attempt feedback that confirms FretCoach is listening and the player remains broadly aligned with the passage.
_Avoid_: live coaching, note-by-note correction

**Attempt review**:
The detailed post-attempt presentation of performance diagnosis and a recommended next practice action.
_Avoid_: results screen, scorecard

**Mastery threshold**:
The explicit product-defined pitch, onset-timing, and repeatability criteria an attempt must meet at a given tempo for a target passage to be considered mastered.
_Avoid_: high score, completion

**Baseline**:
The first reliable performance measurement for a target passage, retained for comparison once later attempts make change meaningful.
_Avoid_: personal best, starting score

**Focused intervention**:
One rule-based next practice action derived from an attempt review, designed to improve the most limiting performance event or transition.
_Avoid_: daily curriculum, generic tip, AI advice

**Intervention hypothesis**:
A clearly labelled proposed focused intervention selected from an observed weak point; it is not a claim about the physical cause of the performance error.
_Avoid_: technique diagnosis, proven cause

**Weak point**:
The performance event or adjacent-event transition that most limits a guitarist's ability to meet a target passage's mastery threshold.
_Avoid_: worst score, failure

**Song mastery**:
Reliable performance of a player-selected arrangement, achieved by mastering its constituent target passages and progressively larger sections against their explicit mastery thresholds.
_Avoid_: full-song score, course completion

**Mastery map**:
The representation of an arrangement's passages and sections, showing their current mastery state and the path toward song mastery.
_Avoid_: song score, progress bar

**Hybrid segmentation**:
The creation of proposed target passages from score structure and difficulty signals, with the guitarist able to select, split, merge, or replace those boundaries.
_Avoid_: automatic chunking, manual looping

## Input

**Microphone setup**:
A guitar performance captured through an ordinary device microphone, including when backing audio is present; it prioritizes access and requires an input-quality check.
_Avoid_: studio setup, clean input

**Direct-input setup**:
A guitar performance captured through a browser-available audio interface or direct instrument input; it is an optional higher-signal-quality setup.
_Avoid_: required equipment

**Input-quality check**:
A pre-attempt assessment that determines whether FretCoach can hear the guitar distinctly enough to provide trustworthy performance diagnosis and prompts the guitarist to adjust when it cannot.
_Avoid_: microphone permission, calibration

**On-device analysis**:
Performance analysis performed in the guitarist's browser without retaining raw audio on FretCoach servers.
_Avoid_: private audio storage, cloud analysis

**Premium performance recording**:
A raw attempt recording a guitarist explicitly elects to store for later playback or optional deeper review.
_Avoid_: default recording, microphone data

**Assistant coach**:
An optional AI layer that explains structured measured performance evidence and offers clearly labelled, non-authoritative coaching observations; it does not replace performance diagnosis.
_Avoid_: primary reviewer, automated judge

## Product promise

**Flawless playing**:
The guitarist's aspiration to perform a player-owned arrangement reliably; FretCoach treats it as a north star reached through song mastery, not a claim made from one accuracy rating.
_Avoid_: perfect score, instant mastery

**Player-owned arrangement**:
An arrangement the guitarist brings to FretCoach because it is personally meaningful, rather than one selected from a FretCoach-curated song catalogue.
_Avoid_: custom content, user-generated catalogue

**Private arrangement**:
A player-owned arrangement stored for its uploader's practice and not made discoverable or available to other FretCoach users.
_Avoid_: public tab, community tab, shared catalogue

**Practice loop**:
The end-to-end cycle in which FretCoach turns a player-owned arrangement into target passages, diagnoses an attempt, prescribes a focused intervention, and demonstrates progress toward song mastery.
_Avoid_: practice session, lesson flow

**Trustworthy coaching**:
Coaching whose claims are grounded in visible performance evidence, whose advice is specific to the weak point, and whose success can be verified against a mastery threshold.
_Avoid_: accurate AI, generic feedback
