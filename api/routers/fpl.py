from fastapi import APIRouter
from schemas import PredictionItem

router = APIRouter(prefix="/fpl", tags=["FPL"])

@router.get("/predict", response_model=list[PredictionItem])
def get_predictions():
    return [
        PredictionItem(
            player_id=1,
            player_name="Sample Player",
            team="MCI",
            position="FWD",
            price=14.0,
            predicted_points=9.5,
            gameweek=9,
        )
    ]
