from pydantic import BaseModel

class PredictionItem(BaseModel):
    player_id: int
    player_name: str
    team: str
    position: str
    price: float
    predicted_points: float
    gameweek: int

class BestXIResponse(BaseModel):
    gameweek: int
    total_predicted_points: float
    players: list[PredictionItem]
