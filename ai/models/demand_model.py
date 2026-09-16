"""
Hybrid demand model: a real trained model for Turmeric/Mustard (real AGMARKNET history exists,
see docs/research/demand-training-pipeline.md), a statistical heuristic for everything else
(Honey has zero AGMARKNET records -- confirmed, not a temporary gap -- and any other/unknown crop
has no training data at all). The heuristic below originally stood in for BHARATPURE-AI.md's
documented Prophet + LightGBM pipeline -- see docs/research/ai-service-scope.md for why (that
pipeline needed a 24-month synthetic dataset that was never generated, plus `prophet` is
slow/fragile to install on Windows). It produces varied, input-dependent (not hardcoded) output
using a deterministic seed per (crop, city, date) so repeated calls for the same inputs are
stable, which matters since the Node caller upserts results into a cache keyed on (crop_type,
city, forecast_date). It remains the permanent fallback: the trained path only activates when its
artifact files actually loaded successfully.
"""
import hashlib
import math
import os
from datetime import date, timedelta

try:
    import joblib
except ImportError:
    joblib = None  # trained path simply never activates; heuristic-only is still a fully valid mode

HEURISTIC_MODEL_VERSION = "heuristic-v1"
TRAINED_MODEL_VERSION = "agmarknet-hgbr-v1"
MODEL_VERSION = HEURISTIC_MODEL_VERSION  # kept for any external reference to the old single constant

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
# Only crops with real, confirmed AGMARKNET data get a trained-model attempt -- see the training
# pipeline research doc's supervisor addendum. Honey is deliberately absent: it has zero AGMARKNET
# records (not a mandi-traded commodity), so there is nothing to train it on, ever.
TRAINED_CROPS = ("TURMERIC", "MUSTARD")

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


def _build_inference_features(target_date: date):
    """Must exactly match scripts/train_demand_model.py's build_features() for a single date --
    same feature set, same order-independent dict keys (sklearn takes a DataFrame at train time
    and here a plain list matching the same column order, since a single-row inference doesn't
    need pandas)."""
    return [[
        target_date.weekday(),
        target_date.month,
        target_date.timetuple().tm_yday,
        1 if target_date.weekday() >= 5 else 0,
        _days_to_next_festival(target_date),
    ]]


class DemandModel:
    def __init__(self):
        self._trained = {}  # crop -> {"p10": model, "p50": model, "p90": model}
        if joblib is None:
            return
        for crop in TRAINED_CROPS:
            crop_key = crop.lower()
            try:
                self._trained[crop] = {
                    label: joblib.load(os.path.join(ARTIFACTS_DIR, f"{crop_key}_{label}.joblib"))
                    for label in ("p10", "p50", "p90")
                }
            except (FileNotFoundError, OSError, EOFError):
                # No artifact yet (or a corrupt one) -- this crop simply falls through to the
                # heuristic in predict() below, exactly like price_model.py's missing-mock-file
                # fallback. Never a startup failure.
                self._trained.pop(crop, None)

    def _predict_trained(self, crop: str, crop_type: str, city: str, target_date: date) -> dict:
        models = self._trained[crop]
        features = _build_inference_features(target_date)
        p10 = float(models["p10"].predict(features)[0])
        p50 = float(models["p50"].predict(features)[0])
        p90 = float(models["p90"].predict(features)[0])
        # Quantile models aren't guaranteed monotonic on a single point -- clamp so the range
        # is never inverted before it reaches the API contract.
        range_low, predicted_kg, range_high = sorted([max(0.0, p10), max(0.0, p50), max(0.0, p90)])

        spread_ratio = (range_high - range_low) / predicted_kg if predicted_kg > 0 else 1.0
        confidence = max(40.0, min(95.0, 90 - spread_ratio * 100))

        days_to_festival = _days_to_next_festival(target_date)
        drivers = [{"factor": "trained_seasonal_pattern", "contribution_pct": 55}]
        if days_to_festival <= 7:
            drivers.insert(0, {"factor": "festival_within_7d", "contribution_pct": 25})
        elif days_to_festival <= 14:
            drivers.insert(0, {"factor": "festival_within_14d", "contribution_pct": 15})
        drivers.append({"factor": "day_of_week_pattern", "contribution_pct": 20})
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
            "model_version": TRAINED_MODEL_VERSION,
            "cold_start": False,
        }

    def predict(self, crop_type: str, city: str, forecast_days: int) -> dict:
        crop = crop_type.upper()
        target_date = date.today() + timedelta(days=forecast_days)

        if crop in self._trained:
            return self._predict_trained(crop, crop_type, city, target_date)

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
