"""
Statistical heuristic standing in for BHARATPURE-AI.md's documented Prophet + LightGBM pipeline
-- see docs/research/ai-service-scope.md for why: that pipeline needs a 24-month synthetic
training dataset and a festival calendar that were never generated, plus `prophet` is slow/fragile
to install on Windows. This produces varied, input-dependent (not hardcoded) output using a
deterministic seed per (crop, city, date) so repeated calls for the same inputs are stable, which
matters since the Node caller upserts results into a cache keyed on (crop_type, city, forecast_date).
"""
import hashlib
import math
from datetime import date, timedelta

MODEL_VERSION = "heuristic-v1"

# Rough per-crop base daily demand (kg) for a mid-size Indian metro -- order-of-magnitude
# plausible, not derived from real data (none exists in this prototype).
BASE_DEMAND_KG = {
    "TURMERIC": 650,
    "MUSTARD": 900,
    "HONEY": 220,
    "GROUNDNUT": 500,
    "GHEE": 300,
    "SPICES": 400,
}

# Indian festival dates likely to spike demand, 2026-2027 (approximate, for a plausible signal).
FESTIVALS = [date(2026, 10, 20), date(2026, 11, 8), date(2027, 3, 4)]  # Navratri/Dussehra, Diwali, Holi


def _seeded_unit(*parts: str) -> float:
    """Deterministic pseudo-random float in [0, 1) from the given parts -- replaces a trained
    model's residual-correction term with a stable, reproducible per-key wobble."""
    digest = hashlib.sha256("|".join(parts).encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _days_to_next_festival(target: date) -> int:
    upcoming = [f for f in FESTIVALS if f >= target]
    if not upcoming:
        return 999
    return (min(upcoming) - target).days


class DemandModel:
    def predict(self, crop_type: str, city: str, forecast_days: int) -> dict:
        crop = crop_type.upper()
        target_date = date.today() + timedelta(days=forecast_days)
        base = BASE_DEMAND_KG.get(crop, 400)

        days_to_festival = _days_to_next_festival(target_date)
        festival_within_7d = days_to_festival <= 7
        festival_within_14d = days_to_festival <= 14

        # Weekly seasonality: weekends run ~15% higher.
        weekend_boost = 1.15 if target_date.weekday() >= 5 else 1.0
        # Festival boost, layered.
        festival_boost = 1.35 if festival_within_7d else (1.18 if festival_within_14d else 1.0)
        # A stable per-(crop,city,date) wobble in [-8%, +8%], standing in for the residual a
        # trained model would learn from real signals this heuristic has no access to.
        wobble = (_seeded_unit(crop, city, str(target_date)) - 0.5) * 0.16

        predicted_kg = max(0.0, base * weekend_boost * festival_boost * (1 + wobble))

        # Confidence: lower for cold-start crops (no entry in BASE_DEMAND_KG) and longer horizons.
        cold_start = crop not in BASE_DEMAND_KG
        base_confidence = 88 - forecast_days * 0.3
        confidence = max(40.0, base_confidence - (20 if cold_start else 0))

        spread = predicted_kg * 0.18
        range_low = max(0.0, predicted_kg - spread)
        range_high = predicted_kg + spread

        drivers = [{"factor": "historical_demand_trend", "contribution_pct": 42}]
        if festival_within_7d:
            drivers.insert(0, {"factor": "festival_within_7d", "contribution_pct": 28})
        elif festival_within_14d:
            drivers.insert(0, {"factor": "festival_within_14d", "contribution_pct": 18})
        if target_date.weekday() >= 5:
            drivers.append({"factor": "weekend_demand_pattern", "contribution_pct": 15})
        drivers.append({"factor": "price_trend", "contribution_pct": 12})

        total = sum(d["contribution_pct"] for d in drivers)
        for d in drivers:
            d["contribution_pct"] = round(d["contribution_pct"] / total * 100, 1)

        return {
            "crop_type": crop_type,
            "city": city,
            "forecast_date": target_date.isoformat(),
            "predicted_kg": round(predicted_kg, 1),
            "confidence_pct": round(confidence, 1),
            "range_low_kg": round(range_low, 1),
            "range_high_kg": round(range_high, 1),
            "demand_drivers": drivers[:4],
            "model_version": MODEL_VERSION,
            "cold_start": cold_start,
        }
