from fastapi import FastAPI

app = FastAPI(title="Fantasy Foresight API")

@app.get("/")
def home():
    return {"message": "Fantasy Foresight backend is running!"}

@app.get("/predictions")
def get_predictions():
    #dummy response for now
    return {"status": "ok", "data": []}
