# FretCoach contributor instructions

## Project goal

Help returning self-taught guitarists master difficult passages of private, player-owned arrangements through measured Attempts, useful reviews and focused next actions.

Before project work, read [project status](docs/project-status.md) and [project context](docs/project-context.md). Use [CONTEXT.md](CONTEXT.md) for vocabulary. Read relevant [ADRs](docs/adr/) when changing privacy, assessment or product claims. For setup and verification, read [development notes](docs/development.md).

CLAUDE.md is a relative symlink to this file. Keep instructions here as the single source of truth.

## Product rules

- Keep player-owned arrangements private. Public discovery or publishing requires a separate product decision.
- Preserve on-device microphone/direct-input analysis; raw audio is not uploaded or retained by default.
- Keep evaluateAttempt authoritative for final Performance diagnosis. Practice assist affects live guidance only; failed input quality yields no Accuracy rating.
- Assessment currently supports single-note events. Chord support is unresolved: removing rejection or treating one detected pitch as a correctly played chord is insufficient.
- The imported-player 32-event limit is a current implementation constraint, not a detector ceiling or proof of mastery.
- Keep simulation development-only, default to real input, block simulated Attempts before savePracticeAttempt, and label simulated reviews as not saved.
- Keep Technique exercise progress separate from Song mastery. One high Accuracy rating does not establish mastery.
- Keep active practice free of ads and collect structured telemetry only with consent.

## Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State material assumptions explicitly. If uncertain, ask.
- Present multiple interpretations rather than choosing silently.
- Say when a simpler approach exists; push back when warranted.
- Name unclear requirements and resolve them before dependent implementation.

These guidelines favor caution over speed. For trivial tasks, use judgment.

## Simplicity first

Minimum code that solves the problem. Nothing speculative.

- Add no features beyond the request.
- Add abstractions only when requested work needs them; avoid abstractions for single-use code.
- Add flexibility or configurability only when requested.
- Handle plausible failures without machinery for impossible scenarios.
- If 200 lines could be 50, simplify.

Ask whether a senior engineer would consider the result overcomplicated.

## Surgical changes

Touch only what the task requires. Clean up changes you introduced.

- Preserve unrelated user work; match existing style.
- Avoid adjacent code, comment or formatting improvements and unrelated refactors.
- Mention unrelated dead code rather than deleting it.
- Remove imports, variables and functions made unused by your changes.
- Every changed line should trace to the request.

## Goal-driven execution

Define success criteria and continue until verified.

For multi-step tasks, state a brief plan with a verification check for each step:
1. Establish the required behavior → verify the expected outcome.
2. Implement the scoped change → verify appropriate behavior checks.
3. Complete and hand off → verify the diff and required checks.

Translate validation requests into invalid-input tests, bug fixes into a reproduction and regression check, and refactors into behavior verification before and after.

- Prefer meaningful behavior tests through the same interface callers use. Source-text assertions alone do not prove lifecycle, cancellation or persistence safety.
- Run appropriate checks and report exactly what passed, failed or remains unverified.
- A hanging build or missing generated HTML is a verification gap, not a passing test.
- Verify both players when changing shared input or assessment.
- Update status documentation when capabilities, limitations or remaining work change.

These guidelines succeed when diffs contain fewer unnecessary changes, simpler implementations need fewer rewrites, and material clarification happens before implementation.

## Workflow

Use the configured Git remote and package.json scripts as tooling authority. Start servers only when needed, track ownership and stop your servers when finished. Preserve other sessions' servers. Keep credentials and raw personal data out of commits and tool output.

For ticket work, read [issue-tracker conventions](docs/agents/issue-tracker.md); for triage, use [canonical labels](docs/agents/triage-labels.md). Issue #1 is the open specification, not evidence that every story is implemented. Commit/push when requested; verify the branch and preserve unrelated changes.
