"""Faithful port of BHARATPURE-AI.md's models/price_model.py -- fully deterministic, no
training involved, so no scope cut was needed here (see docs/research/ai-service-scope.md)."""
import json
import math
import os

ENAM_MOCK_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "backend", "mocks", "enam-prices.json")

FALLBACK_PRICES_PAISE = {
    "TURMERIC": 14000,
    "MUSTARD": 10500,
    "HONEY": 28000,
    "GROUNDNUT": 8500,
    "GHEE": 55000,
    "SPICES": 18000,
}

MULTIPLIERS = {
    "PREMIUM": {"base": 1.32, "demand_boost": 0.04},
    "STANDARD": {"base": 1.12, "demand_boost": 0.02},
    "ECONOMY": {"base": 0.95, "demand_boost": 0.01},
}


class PriceModel:
    def __init__(self):
        self.enam_data = {}
        try:
            with open(ENAM_MOCK_PATH) as f:
                mock = json.load(f)
                self.enam_data = {crop: info["baseline_price_paise"] for crop, info in mock.get("crops", {}).items()}
        except (FileNotFoundError, KeyError):
            pass  # falls back to FALLBACK_PRICES_PAISE below -- same eNAM mock the Node backend itself reads

    def _get_commodity_price(self, crop_type: str) -> int:
        crop = crop_type.upper()
        return self.enam_data.get(crop, FALLBACK_PRICES_PAISE.get(crop, 12000))

    def _get_band(self, score: float) -> str:
        if score >= 90:
            return "PREMIUM"
        if score >= 70:
            return "STANDARD"
        return "ECONOMY"

    def recommend(self, crop_type: str, quality_score: float, city: str, demand_delta_pct: float = 0) -> dict:
        commodity = self._get_commodity_price(crop_type)
        band = self._get_band(quality_score)
        mult = MULTIPLIERS[band]

        demand_factor = 1 + (demand_delta_pct / 10) * mult["demand_boost"]

        low = int(commodity * mult["base"] * demand_factor * 0.95)
        high = int(commodity * mult["base"] * demand_factor * 1.05)
        premium_pct = round((((low + high) / 2) - commodity) / commodity * 100, 1)

        acceptance = round(100 / (1 + math.exp(0.08 * (premium_pct - 35))), 1)

        return {
            "crop_type": crop_type,
            "quality_score_band": band,
            "destination_city": city,
            "commodity_price_paise": commodity,
            "recommended_low_paise": low,
            "recommended_high_paise": high,
            "premium_pct": premium_pct,
            "buyer_acceptance_prob": acceptance,
            "data_source": "eNAM_mock_feed",
        }
