import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_root():
    r = client.get("/")
    assert r.status_code == 200

def test_predict_schema():
    r = client.get("/fpl/predict")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert {"player_id","player_name","team","position","price","predicted_points","gameweek"} <= set(data[0].keys())
