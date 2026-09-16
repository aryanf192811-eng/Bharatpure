"""Real road distances via OSRM's public demo Table API, with a Haversine fallback when OSRM is
unreachable or errors. The public demo server (router.project-osrm.org) has no SLA/rate-limit
guarantee -- fine for this scope, a production deployment would want a self-hosted OSRM instance
instead (see docs/research/osrm-routing.md)."""
import logging
import math

import httpx

logger = logging.getLogger(__name__)

OSRM_BASE_URL = "http://router.project-osrm.org/table/v1/driving"
OSRM_TIMEOUT_SECONDS = 10


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def haversine_matrix(locations: list[dict]) -> list[list[float]]:
    n = len(locations)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                matrix[i][j] = haversine_km(locations[i]["lat"], locations[i]["lng"], locations[j]["lat"], locations[j]["lng"])
    return matrix


def osrm_matrix(locations: list[dict]) -> list[list[float]]:
    """Calls OSRM's Table API for real road distances. Raises on any failure (bad response,
    timeout, network error) -- the caller (route_optimizer.py) is responsible for catching and
    falling back to haversine_matrix, this function doesn't degrade silently itself.

    Coordinate order matters: OSRM's own URL format is "lng,lat" (GeoJSON convention), the
    reverse of this codebase's location dicts, which follow lat/lng like every other place in
    this repo -- swapped only at the point of building the URL, not by changing the dict
    convention itself.
    """
    coords = ";".join(f"{loc['lng']},{loc['lat']}" for loc in locations)
    url = f"{OSRM_BASE_URL}/{coords}"
    response = httpx.get(url, params={"annotations": "distance"}, timeout=OSRM_TIMEOUT_SECONDS)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != "Ok":
        raise ValueError(f"OSRM returned non-Ok status: {data.get('code')}")
    # OSRM distances are in metres; haversine_matrix's contract is km, so convert to match.
    return [[metres / 1000 for metres in row] for row in data["distances"]]
