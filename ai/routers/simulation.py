"""Ports BHARATPURE-AI.md's routers/simulation.py formula exactly, with one deliberate
deviation: the documented version nests the request echo under an "input" key, but the
already-tested Node fallback (simulation.service.js's computeLocalSimulation) returns everything
flat with no "input" wrapper, and the frontend was built and verified against that flat shape.
Keeping this response flat too, so the AI-present and AI-absent paths are shape-consistent."""
import time

from fastapi import APIRouter
from pydantic import BaseModel

from models.demand_model import DemandModel
from models.price_model import PriceModel

router = APIRouter()
demand_model = DemandModel()
price_model = PriceModel()


class SimRequest(BaseModel):
    crop_type: str
    city: str
    demand_spike_pct: float
    supply_disruption_pct: float


@router.post("/run")
def run_simulation(req: SimRequest):
    start = time.time()

    base = demand_model.predict(req.crop_type, req.city, 30)
    base_demand = base["predicted_kg"]

    simulated_demand = base_demand * (1 + req.demand_spike_pct / 100)
    simulated_supply = base_demand * (1 - req.supply_disruption_pct / 100)

    shortage_kg = max(0.0, simulated_demand - simulated_supply)
    surplus_kg = max(0.0, simulated_supply - simulated_demand)

    price_rec = price_model.recommend(req.crop_type, 90, req.city, req.demand_spike_pct)
    base_price = price_model.recommend(req.crop_type, 90, req.city, 0)
    price_change_pct = round(
        (price_rec["recommended_low_paise"] - base_price["recommended_low_paise"])
        / base_price["recommended_low_paise"] * 100,
        2,
    )

    actions = []
    if shortage_kg > 0:
        actions.append({
            "action": "SOURCE_ALTERNATE_FPO",
            "description": f"Source ~{round(shortage_kg)} kg from the nearest alternate FPO cluster (~120 km away)",
            "estimated_distance_km": 120,
            "available_kg": round(shortage_kg * 1.2),
        })
        actions.append({
            "action": "ADJUST_PRICE_CEILING",
            "description": f"Raise the price ceiling by ~₹{(base_price['recommended_low_paise'] * 0.015 / 100):.2f}/kg",
            "adjustment_paise": int(base_price["recommended_low_paise"] * 0.015),
        })
        actions.append({
            "action": "REROUTE_VEHICLE",
            "description": "Add one additional pickup stop to the nearest active route",
            "additional_stops": 1,
        })

    run_ms = int((time.time() - start) * 1000)

    return {
        "crop_type": req.crop_type,
        "city": req.city,
        "demand_spike_pct": req.demand_spike_pct,
        "supply_disruption_pct": req.supply_disruption_pct,
        "base_demand_kg": round(base_demand, 1),
        "simulated_demand_kg": round(simulated_demand, 1),
        "simulated_supply_kg": round(simulated_supply, 1),
        "shortage_kg": round(shortage_kg, 1),
        "surplus_kg": round(surplus_kg, 1),
        "recommended_actions": actions,
        "farmer_realization_change_pct": round(price_change_pct * 0.7, 2),
        "logistics_cost_change_pct": round(-8.5 - (req.demand_spike_pct * 0.1), 2),
        "price_change_pct": price_change_pct,
        "model_version": "heuristic-v1",
        "data_source": "ai_service_heuristic",
        "run_duration_ms": run_ms,
    }
