# AVE Node Agent (avevisor)

Drag-and-drop **Supervisor → subagents → Trader/Wallet** flow for [AVE.ai](https://ave.ai/) delegate APIs, with optional **Hermes** reasoning and **MCP-ready** tool nodes.

## Quick start

```bash
cp .env.example .env.local
# Edit .env.local — see docs/DEMO_CHECKLIST.md

npm install
npm run dev
```

- Home: [http://localhost:3000](http://localhost:3000)
- Canvas: [http://localhost:3000/canvas](http://localhost:3000/canvas)

## Features (MVP)

- React Flow canvas with palette, settings panel, validate/run/save.
- Server orchestration: Monitor (Data API) → Researcher/Strategist/Supervisor (Hermes or mock) → Trader/Wallet (delegate API, guarded). Canvas defaults to one Supervisor; you drag other nodes from the palette.
- `botswap` WebSocket wait for order status after a live swap (see [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md)).

## Hermes local terminal setup

1. Start Hermes Agent API Server in your local terminal profile.
2. Set avevisor `.env.local`:
   - `HERMES_API_URL=http://127.0.0.1:8642/v1` (or host/port used by your Hermes profile)
   - `HERMES_API_KEY=<API_SERVER_KEY>`
   - Optional: `HERMES_USE_RESPONSES=true` to use `/v1/responses` stateful supervisor calls.
3. Verify with `GET /api/health` (it now reports Hermes reachability probes).

Hermes API server details: [Hermes API Server guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server).

## AVE tool-node baseline

For future MCP/tool-node expansion, use [AveCloud/ave-cloud-skill](https://github.com/AveCloud/ave-cloud-skill) as the baseline for AVE data/trade script behavior before writing custom wrappers.

## Scripts

| Command        | Description        |
| -------------- | ------------------ |
| `npm run dev`  | Development server |
| `npm run build`| Production build   |
| `npm run lint` | ESLint             |

This project uses [Next.js](https://nextjs.org) (see [AGENTS.md](./AGENTS.md) for repo-specific Next notes).
