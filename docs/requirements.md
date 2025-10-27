# Fantasy Foresight – Requirements

## 1. Project Overview
Fantasy Foresight is a web application that predicts each player’s expected Fantasy Premier League (FPL) points for the next gameweek and recommends a “Best XI” team based on those predictions.  
The goal is to help FPL managers make smarter choices when selecting or transferring players.

---

## 2. Functional Requirements

| ID | Requirement | Description |
|----|--------------|-------------|
| FR1 | Data Access | The system must retrieve FPL player and team data from the official FPL API or public datasets. |
| FR2 | Data Processing | The system must clean and prepare the data so it can be used by the prediction model. |
| FR3 | Player Prediction | The system must predict each player’s next-gameweek points using a machine-learning model (for example, XGBoost, Random Forest, or MLP). |
| FR4 | Best XI Recommendation | The system must generate a valid starting team that maximises total predicted points while respecting FPL rules (budget, formation, and club limits). |
| FR5 | Baseline Comparison | The system must include a simple baseline model (like the 3-gameweek moving average) for comparison. |
| FR6 | API Service | The backend must provide REST endpoints (for example `/predictions` and `/bestxi`) so the frontend can access results. |
| FR7 | Web Interface | The frontend must display predictions, recommended team, and performance charts in an easy-to-use interface. |
| FR8 | User Interaction | Users must be able to view, filter, and sort predicted players and refresh results. |
|

---

## 3. Non-Functional Requirements

| ID | Category | Requirement |
|----|-----------|-------------|
| NFR1 | Performance | The backend should generate predictions and Best XI recommendations within 30 to 50 seconds. |
| NFR2 | Usability | The interface should be simple, responsive, and easy for non-technical users to understand. |
| NFR3 | Reliability | The system should handle missing or delayed FPL data without crashing. |
| NFR4 | Reproducibility | Anyone should be able to reproduce results using the same dataset and configuration. |
| NFR5 | Maintainability | Code should be modular, readable, and documented with clear folder structure. |
| NFR6 | Portability | The app should run on any system with Python 3.11+ and Node 16+. |
| NFR7 | Accuracy | The ML model should perform at least 10 % better than the baseline (by MAE). |
| NFR8 | Security | The system should only use public data and avoid storing personal information. |
| NFR9 | Deployment | The backend should be deployable on Render/Fly.io, and the frontend on Netlify/Vercel. |
| NFR10 | Ethics | Predictions should be used for educational purposes only, not gambling or monetisation. |


---

## 4. Tools Summary

| Area | Tool / Framework | Purpose |
|-------|------------------|----------|
| Backend | FastAPI | Web API framework |
| Backend Server | Uvicorn | Runs FastAPI app |
| ML | XGBoost / Random Forest / MLP | Predict player points |
| Optimisation | (haven't decided which algorithm to use yet) | Build Best XI |
| Frontend | React (Vite + Tailwind) | Web interface |
| Styling | TailwindCSS + PostCSS + Autoprefixer | Responsive design |

---
