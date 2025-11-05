from fastapi import APIRouter
from schemas import PredictionItem, BestXIResponse

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

@router.get("/bestxi", response_model=BestXIResponse)
def get_best_xi():
    samplePlayers = [
        PredictionItem(player_id=i, player_name=f"player {i}", team = "MCI", position ="MID", price=8.5+i/10, predicted_points=7+i/2, gameweek=9)

        for i in range(1,12)
    ]

    return BestXIResponse(gameweek=9, total_predicted_points=sum(p.predicted_points for p in samplePlayers), players=samplePlayers)
