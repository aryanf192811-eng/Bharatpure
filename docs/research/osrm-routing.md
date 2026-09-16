# Research: real road-distance routing (OSRM)

Date: 2026-09-16
Task context: SIH innovation build, Feature 5 of the sequential plan — swap the routing optimizer's
Haversine (straight-line) distance matrix for real road distances, closing a scope-cut documented
earlier this session (`docs/research/ai-service-scope.md`: "no OSRM road-distance API call — that
needs an external service/key not available here").

## Question

Is a real OSRM integration actually feasible without a self-hosted OSRM instance or an API key?

## Findings

- OSRM's public demo server (`router.project-osrm.org`) is free, requires no API key, and its
  Table API (`GET /table/v1/driving/{coords}?annotations=distance`) returns exactly the shape
  needed: an n×n matrix of road distances in metres. Verified live with real coordinates
  (Mumbai/Sangli/Kolhapur) before writing any code.
- `route_optimizer.py`'s `solve()` already isolated the distance matrix behind a single function
  call (`haversine_matrix(locations)`), so swapping in a real API call needed no changes to the
  OR-Tools setup itself — only the one line that builds `dist_matrix`, wrapped in a try/except.
- `BHARATPURE-AI.md`'s documented `osrm_matrix()` pseudocode uses attribute access (`loc.lat`,
  `loc.lng`) that doesn't match this codebase's actual convention — every location here is a plain
  dict (`loc["lat"]`, `loc["lng"]`), confirmed by reading `route_optimizer.py` and
  `ai/utils/db.py`'s `fetch_orders`. The real implementation follows the codebase's dict
  convention, not the doc's mismatched pseudocode.
- OSRM's coordinate order is `lng,lat` (GeoJSON convention) in the URL, the reverse of this
  codebase's `lat,lng` dict convention everywhere else — swapped only at the point of building the
  URL string, not by changing the location-dict shape used throughout the rest of the service.
- `httpx` had been explicitly trimmed from `requirements.txt` during the original AI-service
  scope-cut specifically because no HTTP client was needed at the time. Re-added at `0.28.1`
  (verified this installs cleanly in the same Python 3.14 venv the rest of the service already
  runs in).

## Decision

Implemented `osrm_matrix()` calling the public demo server, with the exact try/except-fallback-to-
Haversine pattern `BHARATPURE-AI.md` already specified (the one part of its OSRM pseudocode worth
following literally — the fallback design itself is sound, only the coordinate-access style
needed correcting). No other change to the CVRP solver.

**Known limitation, not a bug**: the public demo server has no published SLA or rate-limit
guarantee. This is acceptable for a prototype/demo — a production deployment would need a
self-hosted OSRM instance (Docker image + a regional `.osm.pbf` extract) instead of pointing at
the shared public server indefinitely.

## Verification

- Compared `haversine_matrix()` vs `osrm_matrix()` output directly for the same 3 coordinates:
  OSRM consistently returned larger distances (e.g. Mumbai↔Sangli: 306.0km Haversine vs 391.7km
  OSRM), confirming real road distances are being used, not a coincidental match.
- Forced OSRM unreachable (pointed the base URL at a closed local port) and confirmed
  `RouteOptimizer.solve()` logged the fallback warning and produced Haversine-based output instead
  of crashing.
- Ran the real end-to-end path: created a live order with a Sangli delivery address, called the
  actual `POST /api/admin/routes/optimize` (the real Node → AI service path, no test doubles), and
  confirmed the persisted `delivery_routes.total_distance_km` (785.83km round trip) matches
  2× OSRM's one-way Mumbai↔Sangli distance (392.9km), not 2× the Haversine figure (306.0km) — proof
  the real end-to-end stack uses OSRM, not just the isolated unit-level test.
- Full Postman regression: 189/189 assertions passing after this change.

## Sources

- `BHARATPURE-AI.md` (`utils/distance.py`'s documented `osrm_matrix()`, `route_optimizer.py`'s
  documented try/except pattern)
- `ai/models/route_optimizer.py`, `ai/utils/distance.py`, `ai/utils/db.py` (the real, tested
  dict-based location convention)
- `docs/research/ai-service-scope.md` (the original scope-cut this feature closes)
