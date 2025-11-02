from fastapi import APIRouter

router = APIRouter(
    prefix="/fpl",
    tags=["FPL"]
)

@router.get("/predict")
def get_predictions():
    """Placeholder endpoint for player predictions."""
    sample_predictions = {
        "player": "Erling Haaland",
        "predicted_points": 9.5,
        "gameweek": 9
    }
    return sample_predictions
