# FretCoach Web

The browser application for FretCoach: guided guitar practice, real-time feedback, and progress reports.

## Stack

- Next.js-compatible React with TypeScript
- Vite / vinext for local development and Cloudflare-compatible builds
- Tailwind CSS

## Start developing

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the deployed or local URL of the companion `fretcoach-api` service.

## Planned application areas

- `/practice`: real-time exercise player, audio input and pitch feedback
- `/library`: technique exercise catalogue
- `/songs`: full-song upload and assessment workflow
- `/progress`: session reports and improvement trends

## Quality checks

```bash
npm run build
npm run lint
npm test
```
