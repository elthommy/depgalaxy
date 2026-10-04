.PHONY: dev-backend dev-frontend seed seed-ldd test fmt

dev-backend: ## FastAPI dev server on :8000
	cd backend && uv run uvicorn stellardeps.api:app --reload

dev-frontend: ## Vite dev server on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

seed: ## Load the ~2000-node demo galaxy into the running backend
	cd backend && uv run python scripts/seed_demo.py

seed-ldd: ## Import a real example: dynamic deps of BIN (default: /usr/bin/curl)
	cd backend && uv run python scripts/import_ldd.py $(or $(BIN),/usr/bin/curl)

test: ## Backend lint+tests, frontend typecheck+tests
	cd backend && uv run ruff format --check . && uv run ruff check . && uv run pytest
	cd frontend && npm run typecheck && npm test

fmt: ## Format and autofix the backend
	cd backend && uv run ruff format . && uv run ruff check --fix .
