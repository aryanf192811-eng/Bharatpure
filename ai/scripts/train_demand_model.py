"""
Trains real demand-forecasting models for Turmeric and Mustard from historical AGMARKNET data
(pulled+cleaned by a separate task, see chatbot.md Phase 7 -- expects
ai/data/turmeric_historical.csv and ai/data/mustard_historical.csv, columns: date, state,
district, market, crop_type, arrivals_quintals, min_price_rs_quintal, max_price_rs_quintal,
modal_price_rs_quintal).

Deliberately calendar-only features (day-of-week, month, day-of-year, festival proximity) --
NOT lag/rolling-mean features on recent arrivals, despite that being the original plan in
docs/research/demand-training-pipeline.md. Reason: DemandModel.predict(crop_type, city,
forecast_days) has no live data feed at inference time (no recent-arrivals lookup wired into the
running service, and adding one would mean a network call to a third-party government API on
every forecast request, with its own key/outage risk -- exactly the kind of fragile dependency
this service's whole design otherwise avoids). A model trained on lag features couldn't be fed
real recent values in production. Calendar-only features mean the model learns "what does this
crop's demand actually look like on this day-of-year, festival-adjusted" from real historical
AGMARKNET patterns -- a genuine improvement over the heuristic's hand-tuned multipliers, and
deployable with the exact same (crop_type, city, forecast_days) -> prediction signature the
heuristic already has, no architecture change needed elsewhere.

Target variable: national daily arrivals (quintals -> kg) as a demand proxy, same interpretation
already documented in demand-training-pipeline.md -- arrivals are a supply-side signal standing
in for consumer demand, not ground truth.

Run manually: python train_demand_model.py (from this directory). Not wired into any server
startup path -- this is an offline training step, same as price_model.py's mock file being a
static asset rather than part of a live pipeline.
"""
import os
import sys

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from models.demand_model import _days_to_next_festival  # noqa: E402 -- reuses the exact same festival-proximity logic the heuristic (and the trained-path predictor) use, rather than a second copy

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "artifacts")
QUANTILES = {"p10": 0.1, "p50": 0.5, "p90": 0.9}
MIN_ROWS_REQUIRED = 100  # below this, a trained model isn't a meaningfully better signal than the heuristic


def build_features(dates: pd.Series) -> pd.DataFrame:
    """Calendar-only feature set -- must exactly match what demand_model.py's trained-path
    predict() computes for a single target_date at inference time. Any change here needs the
    same change there, or predictions will be fed features the model wasn't trained on."""
    dates = pd.to_datetime(dates)
    return pd.DataFrame({
        "day_of_week": dates.dt.dayofweek,
        "month": dates.dt.month,
        "day_of_year": dates.dt.dayofyear,
        "is_weekend": (dates.dt.dayofweek >= 5).astype(int),
        "days_to_festival": [_days_to_next_festival(d.date()) for d in dates],
    })


def train_crop(crop_key: str, csv_filename: str) -> None:
    csv_path = os.path.join(DATA_DIR, csv_filename)
    if not os.path.exists(csv_path):
        print(f"[{crop_key}] SKIPPED -- {csv_path} does not exist yet.")
        return

    df = pd.read_csv(csv_path)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "arrivals_quintals"])
    df["arrivals_kg"] = df["arrivals_quintals"].astype(float) * 100  # 1 quintal = 100kg

    # Aggregate to one national-total row per date -- the trained path predicts a single
    # national demand figure per day, matching the heuristic's own scope (it doesn't
    # meaningfully vary by city either; city mainly seeds the heuristic's wobble term).
    daily = df.groupby("date", as_index=False)["arrivals_kg"].sum()

    if len(daily) < MIN_ROWS_REQUIRED:
        print(f"[{crop_key}] SKIPPED -- only {len(daily)} distinct dates, need at least {MIN_ROWS_REQUIRED} for a meaningful fit.")
        return

    # .values, not the DataFrame itself -- demand_model.py's inference path passes a plain
    # list-of-lists (no column names, a single row doesn't need pandas), so training must fit on
    # the same unnamed-array shape or sklearn warns on every prediction about a feature-name
    # mismatch between fit and predict.
    X = build_features(daily["date"]).values
    y = daily["arrivals_kg"].values

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    for label, alpha in QUANTILES.items():
        model = HistGradientBoostingRegressor(loss="quantile", quantile=alpha, random_state=42)
        model.fit(X, y)
        out_path = os.path.join(ARTIFACTS_DIR, f"{crop_key}_{label}.joblib")
        joblib.dump(model, out_path)
        print(f"[{crop_key}] wrote {out_path} (trained on {len(daily)} dates, {df.shape[0]} raw rows)")


if __name__ == "__main__":
    train_crop("turmeric", "turmeric_historical.csv")
    train_crop("mustard", "mustard_historical.csv")
