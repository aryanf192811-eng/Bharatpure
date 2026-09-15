from fastapi import APIRouter

from models.price_model import PriceModel

router = APIRouter()
model = PriceModel()


@router.get("/recommendation")
def price_recommendation(crop_type: str, quality_score: float, city: str, demand_delta_pct: float = 0):
    return model.recommend(crop_type, quality_score, city, demand_delta_pct)
