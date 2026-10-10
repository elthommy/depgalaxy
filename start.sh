#!/usr/bin/env bash
# Start the DepGalaxy dev stack: backend on :8000, frontend on :5173.
# Seeds the demo galaxy if no graph is loaded yet. Ctrl-C stops everything.
set -euo pipefail

cd "$(dirname "$0")"

(cd backend && uv run uvicorn depgalaxy.api:app --reload --port 8000) &

# on exit, take the whole process group down (uvicorn reloader included)
trap 'trap - EXIT INT TERM; kill 0 2>/dev/null' EXIT INT TERM

# wait for the backend to come up
for _ in $(seq 1 30); do
    curl -s -o /dev/null http://127.0.0.1:8000/graph && break
    sleep 0.5
done

# seed the demo galaxy unless a graph is already loaded
if curl -s http://127.0.0.1:8000/graph | grep -q "no graph imported"; then
    (cd backend && uv run python scripts/seed_demo.py)
fi

echo
echo "DepGalaxy: http://localhost:5173"
echo
(cd frontend && npm run dev)
