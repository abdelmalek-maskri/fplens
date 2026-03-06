"""Fixture endpoints, team x GW grid with FDR ratings"""

from fastapi import APIRouter, Request

router = APIRouter(tags=["Fixtures"])


@router.get("/fixtures")
def get_fixtures(request: Request):
    # 20-team x 6-GW fixture grid with attack/defence FDR
    # FF-4: Will call fetch_fixtures() once implemented
    return {"message": "Not yet implemented"}
