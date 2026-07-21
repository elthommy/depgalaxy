# Stellardeps

Explore arbitrary dependency graphs as an interactive 3D galaxy.

## Layout

- `backend/` — Python 3.12 + FastAPI + networkx. Stateless graph engine
  (collapse views, depth slicing) exposed over a small HTTP API.
- `frontend/` — React + Vite + TypeScript, `react-force-graph-3d` canvas
  with a glassmorphic UI overlay.
- `design/` — Claude Design export used as the visual target for the UI.

## Dev

Backend (requires [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
uv sync
uv run pytest                                   # tests
uv run uvicorn stellardeps.api:app --reload     # dev server on :8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev        # vite dev server on :5173, proxies /api to :8000
```

## License

MIT — see [LICENSE](LICENSE).
