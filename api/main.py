from fastapi import FastAPI
from routers import fpl

app = FastAPI(
    title="Fantasy Foresight API",
    description="Backend service for Fantasy Foresight: FPL predictions and Best XI recommendations.",
    version="1.0"
)

#include the FPL router
app.include_router(fpl.router)

@app.get("/")
def root():
    return {"message": "Fantasy Foresight API is running 🚀"}
