import math

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.route_optimizer import RouteOptimizer
from utils.db import fetch_orders

router = APIRouter()
optimizer = RouteOptimizer()

VEHICLE_CAPACITY_KG = {"DRY_VAN": 1000, "COLD_VAN": 800, "MOTORCYCLE": 80}


# Matches the REAL Node caller (admin.service.js's optimizeRoutes), not BHARATPURE-AI.md's
# documented RouteRequest shape -- see docs/research/ai-service-scope.md. The Node side never
# builds a locations/vehicles list itself; it only ever sends order_ids + one vehicle_type.
class RouteRequest(BaseModel):
    order_ids: list[str]
    vehicle_type: str
    depot_lat: float
    depot_lng: float


@router.post("/optimize")
def optimize_routes(req: RouteRequest):
    try:
        orders = fetch_orders(req.order_ids)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not resolve order locations: {e}")

    locations = [{"name": "Depot", "lat": req.depot_lat, "lng": req.depot_lng, "demand_kg": 0, "order_id": None, "stop_type": "HUB"}]
    for order in orders:
        addr = order["delivery_address"] or {}
        lat, lng = addr.get("lat"), addr.get("lng")
        if lat is None or lng is None:
            continue  # can't route to an address with no coordinates -- skipped, not fabricated
        locations.append({
            "name": addr.get("line1", "Delivery"),
            "lat": lat,
            "lng": lng,
            "demand_kg": float(order["total_kg"] or 0),
            "order_id": str(order["order_id"]),
            "stop_type": "DELIVERY",
        })

    if len(locations) <= 1:
        return {
            "routes": [], "total_distance_km": 0, "total_vehicles_used": 0,
            "baseline_distance_km": 0, "savings_pct": 0, "cost_estimate_paise": 0,
            "baseline_cost_paise": 0, "solver_status": "NO_ROUTABLE_ORDERS",
        }

    capacity = VEHICLE_CAPACITY_KG.get(req.vehicle_type, 500)
    total_demand = sum(loc["demand_kg"] for loc in locations)
    num_vehicles = min(5, max(1, math.ceil(total_demand / capacity) + 1))

    return optimizer.solve(locations, req.vehicle_type, num_vehicles, capacity, depot_index=0)
