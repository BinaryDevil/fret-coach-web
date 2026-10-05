# Development and verification

Use the Node version required by package.json. Install dependencies, copy .env.example to .env.local and run npm run dev.

The web usually runs on http://localhost:3000. The API client defaults to http://localhost:3001/api/v1. NEXT_PUBLIC_API_URL overrides the base URL; include /api/v1 and restart the web process after changing it.

Starting web does not start API. Consult the companion repository's README and environment requirements when running it locally; its usual command is npm run start:dev. Keep secrets out of source control.

Current scripts use Next.js. Vite/vinext/Cloudflare dependencies and configs remain but are not the active dev/build/start commands.

## Simulation

In development, select Development simulator in Performance input. Real input is the default. Choose a scenario, check input, then start a supported single-note Attempt.

Simulation emits deterministic numeric readings from passage timing/BPM; it creates no sound and requests no microphone permission. Scenarios cover perfect, wrong pitch, early/late, missed event and low confidence. Low-confidence input earns no rating.

NODE_ENV must differ from production to expose simulation. Players record source identity at Attempt start and block simulated saving before savePracticeAttempt. Reviews identify simulated results as not saved.

## Checks

```sh
npm run lint
npx tsc --noEmit --incremental false
npm test
```

npm test builds before running its listed tests. For focused checks:

```sh
node --test tests/attempt-evaluation.test.mjs tests/note-attack.test.mjs tests/practice-controls.test.mjs
```

HTML/manifest tests require a successful build. Source-text assertions check wiring, not runtime lifecycle correctness.

Earlier sessions observed Next builds hanging at “Creating an optimized production build.” This is historical evidence, not a confirmed current root cause. Report actual fresh outcomes, retain useful diagnostics and stop only owned processes.

