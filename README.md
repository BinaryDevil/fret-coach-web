# FretCoach Web

FretCoach helps returning self-taught guitarists improve difficult passages of their own songs through private, evidence-based practice.

This is the Next.js/React browser app. The companion fret-coach-api repository owns backend contracts and persistence. alphaTab renders notation; browser audio analysis stays on-device.

## Documentation

- [Project status](docs/project-status.md): capabilities, current challenge, unfinished work and verification gaps.
- [Project context](docs/project-context.md): product scope and architecture.
- [Domain vocabulary](CONTEXT.md): durable product terms.
- [Development](docs/development.md): local setup, simulation and checks.
- [Decisions](docs/adr/): privacy and assessment.
- [Agent instructions](AGENTS.md): contribution rules; CLAUDE.md links to the same file.

## Start locally

Use the Node version required by package.json (currently 22.13 or later).

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set NEXT_PUBLIC_API_URL to the companion API base URL including /api/v1. Without an override it uses http://localhost:3001/api/v1. Starting the web app does not start the API.

## Validation

```sh
npm run lint
npx tsc --noEmit --incremental false
npm test
```

The test command builds first. See development notes for focused checks and the previously observed build hang.
