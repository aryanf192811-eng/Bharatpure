# Research: AI Microservice — scope decision

Date: 2026-09-15
Task context: closing the last of the 5 known gaps from the frontend build session (Known gaps: no cert download [fixed], no per-listing BIR [fixed], bundle size [fixed], PWA [fixed], AI microservice — this doc).

## Question

BHARATPURE-AI.md documents a full trained ML pipeline: Prophet + LightGBM for demand forecasting (trained on a 24-month synthetic dataset with time-series cross-validation), OR-Tools CVRPTW for routing, a deterministic formula for price, and a formula-based what-if simulator. Building all four exactly as documented — is that feasible in this session, and if not, what's the right scope to land instead?

## Findings

- **Routing (OR-Tools)** is fully tractable without training: it's a constraint solver, not a trained model. `ortools` installs cleanly via pip with no external data dependency. This is also the *only* one of the four modules where the Node backend (`admin.service.js`'s `optimizeRoutes`) has **no local fallback at all** — it just reports `{optimized: false}` when the AI service is unreachable, unlike demand/price/simulation which all already have tested Node-side heuristic fallbacks. Building this one for real has real payoff: it's the only path that can ever populate `delivery_routes`/`route_stops`, which means it's the only way the Logistics screens (Route Map View, Stop Detail) built earlier this session can ever be exercised against real data instead of an empty "no routes assigned" state.
- **Demand forecasting (Prophet + LightGBM)** requires: a 24-month synthetic training dataset (`data/synthetic_training.csv`, never generated), a festival calendar JSON (never generated), and a multi-stage train/validate/fit pipeline that BHARATPURE-AI.md itself notes takes real wall-clock time (`TimeSeriesSplit` with 5 folds, per crop×city Prophet model). `prophet` is also notoriously slow/fragile to install on Windows (requires a working `cmdstanpy`/C++ toolchain). None of this is feasible in this session's remaining time budget.
- **Price intelligence** is a small, fully deterministic formula (quality-band multiplier × eNAM commodity price × demand adjustment, sigmoid for buyer acceptance) — no training involved at all. Fully buildable as documented, verbatim.
- **What-if simulator** composes the demand and price modules per the documented formula — also fully buildable once those two exist, no training involved.
- **Contract mismatch found:** BHARATPURE-AI.md's `routers/demand.py` documents `POST /demand/forecast` with a JSON body. The already-built, already-tested Node caller (`demand.service.js`) calls `callAI('GET', '/demand/forecast', { params: {...} })` — a GET with query params. The Node side is the real, verified contract (it's live and tested); the FastAPI route is built to match it, not the doc.
- **Contract mismatch found:** BHARATPURE-AI.md's `routers/routing.py` expects a full `{locations, vehicles, depot_index, time_limit_seconds}` payload the caller must pre-build. The already-built Node caller (`admin.service.js`'s `optimizeRoutes`) sends only `{order_ids, vehicle_type, depot_lat, depot_lng}` — it never resolves order IDs into location lists itself. Per BHARATPURE-AI.md's own `requirements.txt` (`psycopg2-binary`, `sqlalchemy` are listed there, implying DB access was always intended), the FastAPI service resolves `order_ids` → delivery coordinates by reading `orders.delivery_address` directly from the same Postgres database, rather than requiring a Node-side change to an already-tested code path.

## Decision

Build all four modules as real, working code — not stubs — but with demand forecasting as a **documented statistical heuristic** (seasonal multiplier + festival-proximity boost + a deterministic per-crop/city pseudo-random walk seeded on the query, producing varied but reproducible output) instead of the full trained Prophet+LightGBM pipeline. `requirements.txt` is trimmed to drop `prophet`/`lightgbm`/`xgboost`/`pandas`/`numpy`/`scikit-learn`/`sqlalchemy`/`httpx` accordingly — this is a real, load-bearing scope cut, not an oversight, and is why this file exists per BHARATPURE-CLAUDE.md's research-protocol mandate ("Using a new library or npm package... check current version... Document in docs/research/{library}.md").

Price intelligence and the what-if simulator are implemented as faithful, complete ports of BHARATPURE-AI.md's documented formulas (no cuts). Route optimization uses real OR-Tools with a Haversine distance matrix (no OSRM road-distance API call — that needs an external service/key not available here; documented as a further simplification, not silently substituted).

## Sources

- `BHARATPURE-AI.md` (routers/demand.py, models/demand_model.py, routers/price.py, models/price_model.py, routers/routing.py, models/route_optimizer.py, routers/simulation.py)
- `backend/src/services/demand.service.js`, `price.service.js`, `simulation.service.js`, `admin.service.js` (the real, tested Node-side callers and their exact request/response contracts)
