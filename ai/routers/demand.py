from fastapi import APIRouter

from models.demand_model import DemandModel

router = APIRouter()
model = DemandModel()


# GET, not POST -- BHARATPURE-AI.md documents POST /demand/forecast with a JSON body, but the
# already-built, already-tested Node caller (demand.service.js) calls this as a GET with query
# params. The Node side is the real, verified contract; this matches it, not the doc.
@router.get("/forecast")
def forecast_demand(crop_type: str, city: str, forecast_days: int = 30):
    return model.predict(crop_type=crop_type, city=city, forecast_days=forecast_days)
