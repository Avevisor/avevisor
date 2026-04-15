# AVE Node Agent MVP — Demo checklist

## Prerequisites

1. Copy `.env.example` to `.env.local` and set:
   - `AVE_ACCESS_KEY` / `AVE_SECRET_KEY` — delegate wallet API (Level 1+ on [cloud.ave.ai](https://cloud.ave.ai/)).
   - `AVE_DATA_API_KEY` — Cloud Data API for Monitor REST snapshots.
2. Optional: run Hermes Agent API Server in a local terminal, then set:
   - `HERMES_API_URL=http://127.0.0.1:8642/v1` (or your profile port)
   - `HERMES_API_KEY` to match Hermes `API_SERVER_KEY`
   - Optional `HERMES_USE_RESPONSES=true` for stateful supervisor calls via `/v1/responses`
   - Otherwise responses are **mock JSON** for demos.

## Smoke tests

- [ ] `GET /api/health` returns `hasDelegateKeys` / `hasDataApiKey` booleans and Hermes probe details matching your env/runtime.
- [ ] Open `/canvas` — canvas starts with one **Supervisor** node only (empty edges).
- [ ] **Validate** — shows “Graph OK” when exactly one Supervisor exists.
- [ ] **Run** with **Dry run** checked — Trader logs `dryRun: true` and no chain submission.
- [ ] Uncheck Dry run, check **Confirm live trade**, fill Trader `assetsId` and token addresses — live path calls delegate swap API (real funds risk).
- [ ] **Save template** — refresh page; graph persists from `localStorage`.
- [ ] **Reset canvas** — clears to a single Supervisor again.

## Notes

- Delegate swap path defaults to `AVE_DELEGATE_TX_SWAP_PATH` (see `.env.example`). Confirm the exact path in your AVE Bot API docs if requests fail.
- `botswap` WebSocket runs on the server during a live trade; short serverless timeouts may stop waiting early — use logs for order id and AVE console if needed.
- For AVE tool-node behavior reference (future MCP integration), see [AveCloud/ave-cloud-skill](https://github.com/AveCloud/ave-cloud-skill).
