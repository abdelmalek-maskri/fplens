from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import fpl

app = FastAPI(title="Fantasy Foresight API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fpl.router)

@app.get("/")
def root():
    return {"message": "Fantasy Foresight API is running"}
