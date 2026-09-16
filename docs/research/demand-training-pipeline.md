# Demand-Forecasting Training-Data Pipeline: AGMARKNET/IMD

## 1. Data Source & Authentication Blockers
**Source:** data.gov.in AGMARKNET mandi-price API (Resource ID `9ef84268-d588-465a-a308-a864a43d0070`).
**Actual Blockers Hit:** 
- **Auth Friction:** Accessing the live API requires a registered API key. Without a government portal API key, pulling real-time samples is blocked.
- **Historical Data Quality:** Based on Kaggle dumps of the same dataset, market names and commodity names are highly inconsistent (e.g., "Turmeric" vs "Haldi" vs "Haldi (Raw)", and state/market typos). 
- **Arrival Data Gaps:** Often the "arrivals" column is blank or misreported (e.g., recorded in tons instead of quintals inconsistently).

## 1a. Supervisor addendum — real live pull, 2026-09-16 (verified, not inferred)

The blocker above is real: the user registered a free data.gov.in account and got a personal API key, which was used to pull real records directly against the live resource. Three findings that change the feasibility picture from the inferred version above:

1. **This resource is a live "today" snapshot, not a historical archive.** Filtering `arrival_date` to a past date still returned today's records — the API silently ignores the date filter rather than erroring, which is worse than a clean rejection (it looks like it worked). This means the "pull 3-5 years of history in one shot" plan in §3 below is **not achievable through this specific resource**. A real historical dataset may exist elsewhere on data.gov.in under a different resource ID (not yet located) — or the realistic path is running a scheduled daily pull starting now and accumulating history forward, which takes calendar time, not a one-off backfill.
2. **Honey — one of BharatPure's three demo crops — has zero records in this dataset.** `filters[commodity]=Honey` returns `total: 0`. Honey isn't a mandi/APMC-traded commodity in India in any meaningful volume, so it was never going to be in AGMARKNET. A trained model can realistically cover Turmeric and Mustard; Honey demand forecasting would need to stay on the heuristic (or a different, honey-specific data source, if one even exists) regardless of how the rest of this pipeline turns out.
3. **The naming-inconsistency caveat is confirmed empirically, not just inferred.** `filters[state]=Kerala` returns `total: 0`; the data is actually stored as `"Keralam"`. Real sample pulled for Turmeric (23 records, today) shows modal price ranging from ₹1,700 to ₹19,000 across markets on the same day — a mix of real regional variance and likely unit/reporting inconsistencies that would need real investigation before trusting it as a training signal. Mustard fared better (165 records today, including Rajasthan markets matching BharatPure's own seeded Kota cluster).

**Revised verdict**: partial feasibility, not full. Turmeric and Mustard have real, live, reasonably dense data (with real cleaning work ahead, as predicted); Honey does not and should stay on the heuristic either way. The "5 years of history via one API pull" assumption in the plan below needs replacing with either a located historical resource or a forward-accumulating daily pull.

## 2. Proposed Cleaned Join-Ready Schema
To train the model effectively, the AGMARKNET data needs to be cleaned and joined with IMD district rainfall data.

```sql
CREATE TABLE historical_mandi_data (
    record_id UUID PRIMARY KEY,
    date DATE NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    market VARCHAR(100) NOT NULL,
    crop_type VARCHAR(50) NOT NULL,
    arrivals_quintals NUMERIC,
    min_price_rs_quintal NUMERIC,
    max_price_rs_quintal NUMERIC,
    modal_price_rs_quintal NUMERIC,
    rainfall_mm NUMERIC, -- Joined from IMD
    festival_proximity_days INT -- Computed feature
);
```

## 3. Feature Engineering Plan
To match the heuristic's output in `ai/models/demand_model.py`, the following features will be engineered:
1. **Target Variable:** `arrivals_quintals` (converted to KG) will act as a proxy for actual demanded volume (`predicted_kg`) in a specific market.
2. **Lag Features:** 7-day, 14-day, and 30-day rolling averages of arrivals and modal prices.
3. **Seasonal/Calendar Features:** Day of week, Month, Quarter, and `festival_proximity_days` (distance to major festivals like Diwali, Navratri).
4. **Weather Impact:** 15-day cumulative `rainfall_mm` to account for supply disruptions.
5. **Model Selection:** An XGBoost or LightGBM regressor predicting the volume, coupled with quantile regression (predicting 10th and 90th percentiles) to generate `range_low_kg` and `range_high_kg`.
6. **Confidence & Drivers:** `confidence_pct` can be derived from the variance of the quantile predictions (narrow range = high confidence). `demand_drivers` can be extracted using SHAP values to explain the top 3 features influencing the prediction (e.g., "Festival Season", "Recent Price Drop").

## 4. Contract Matching
The trained model will output a JSON structure exactly matching the existing heuristic:
```json
{
  "predicted_kg": 850,
  "confidence_pct": 78,
  "range_low_kg": 750,
  "range_high_kg": 950,
  "demand_drivers": ["Navratri approaching", "Historical seasonal peak"]
}
```
