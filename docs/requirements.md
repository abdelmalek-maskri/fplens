# Requirements Specification

## 1. Overview

This project aims to build a decision-support system for Fantasy Premier League
(FPL). The system will predict next-gameweek points for players by combining:

- structured FPL/EPL statistics,
- fixture and team strength information,
- injury and availability metadata, and
- textual features extracted from football news using transformer models.

Predicted points will be used in an optimisation module that recommends an
optimal starting XI under FPL constraints. A simple web interface will allow
users to inspect predictions, view explanations, and adjust certain
model-related parameters (e.g. the weight given to news features).

The main goal is to investigate whether a **multi-stream hybrid model** can
improve prediction quality compared to traditional single-stream ML models, and
to provide more transparent support for FPL decision-making.

---

## 3. System Context

The system consists of:

- offline scripts to collect and preprocess data,
- ML / NLP models for prediction,
- an optimisation component for team selection,
- a REST API backend to expose model outputs,
- a simple web frontend for interaction and visualisation.


---

## 4. Functional Requirements

Each requirement has an ID and a priority:  
**M** = must have, **S** = should have, **C** = could have (nice to have).

### 4.1 Data Collection and Storage

- **FR-D1 (M):** The system shall ingest historical FPL/EPL data for multiple
  seasons, including per-player statistics such as minutes played, goals,
  assists, and total points.

- **FR-D2 (M):** The system shall ingest fixture information and/or team
  strength metrics (e.g. fixture difficulty or Elo-style ratings).

- **FR-D3 (M):** The system shall ingest injury and availability metadata for
  players (e.g. available, doubtful, injured).

- **FR-D4 (M):** The system shall collect football news articles or headlines
  relating to EPL players and align them with players and gameweeks.

- **FR-D5 (M):** The system shall store processed data in a structured format
  (e.g. relational database or equivalent feature store).

### 4.2 Baseline Modelling

- **FR-B1 (M):** The system shall construct numerical feature vectors from the
  structured data (statistics, fixtures, injury metadata).

- **FR-B2 (M):** The system shall train at least one baseline ML model
  (e.g. LightGBM or XGBoost) to predict next-gameweek points for each player.

- **FR-B3 (M):** The system shall evaluate the baseline model using appropriate
  metrics (e.g. MAE, RMSE) on a held-out test set with time-aware splits.

### 4.3 NLP Feature Extraction

- **FR-N1 (M):** The system shall preprocess news text (e.g. tokenisation,
  cleaning, removal of irrelevant articles).

- **FR-N2 (M):** The system shall use a pre-trained transformer model to
  generate embeddings for news articles.

- **FR-N3 (M):** The system shall aggregate embeddings to obtain a textual
  feature vector for each (player, gameweek) pair.

- **FR-N4 (S):** The system should optionally derive additional signals from
  text (e.g. sentiment or injury-related labels).

### 4.4 Hybrid Multi-Stream Model

- **FR-H1 (M):** The system shall construct hybrid feature vectors by combining
  structured features with textual embeddings.

- **FR-H2 (M):** The system shall train at least one hybrid model (ML or a
  simple neural network) on these hybrid features.

- **FR-H3 (M):** The system shall compare the hybrid model against the baseline
  model and report quantitative results.

- **FR-H4 (M):** The system shall perform ablation experiments that remove one
  or more data streams (e.g. no text, no injury data) and measure the effect on
  performance.

### 4.5 Optimisation and Recommendation

- **FR-O1 (M):** The system shall formulate FPL team selection for a single
  gameweek as an optimisation problem that respects FPL rules (budget,
  positions, and team-quota constraints).

- **FR-O2 (M):** The system shall use predicted points from a chosen model as
  the objective to be maximised.

- **FR-O3 (M):** The system shall output at least one recommended starting XI
  and captain choice.

- **FR-O4 (S):** The system should allow switching between using the baseline
  and hybrid models as the source of predicted points.

### 4.6 Explanation and User Interface

- **FR-U1 (M):** The system shall provide a simple web interface that displays
  predicted points for players in the upcoming gameweek.

- **FR-U2 (M):** The interface shall display the recommended starting XI
  produced by the optimiser.

- **FR-U3 (M):** The interface shall present basic explanations for
  recommendations, combining key numerical features (e.g. recent form and
  fixture difficulty) and, where available, short news summaries.

- **FR-U4 (S):** The interface should allow the user to adjust at least one
  model-related parameter (for example, the weight given to news-based
  features or a simple “risk” setting) and request updated predictions or
  recommendations.

- **FR-U5 (C):** The interface could display simple plots or charts to
  visualise model outputs and feature contributions.

### 4.7 Experimentation and Evaluation

- **FR-E1 (M):** The system shall log experiment configurations (e.g. model
  type, hyperparameters, feature sets) to allow results to be reproduced.

- **FR-E2 (M):** The system shall report results for all main models and
  ablation variants in a format suitable for inclusion in the dissertation
  (tables and/or plots).

- **FR-E3 (S):** The system should support a small user evaluation (e.g.
  questionnaire) to collect feedback on understanding and perceived usefulness
  of the interface and explanations.

---

## 5. Non-Functional Requirements

- **NFR-1 (Performance):** Inference for a single gameweek (predicting points
  for all players and computing one optimal XI) should complete within
  approximately 10 seconds on a standard laptop.

- **NFR-2 (Reproducibility):** Model training scripts shall support fixed
  random seeds and saved configurations so that key experiments can be
  reproduced.

- **NFR-3 (Modularity):** Data processing, modelling, optimisation, and
  interface components shall be separated into clear modules.

- **NFR-4 (Usability):** The web interface shall be simple to navigate, using
  clear labels and minimal steps to obtain predictions and a recommended team.

- **NFR-5 (Reliability):** The system shall handle missing or incomplete data
  gracefully (e.g. by skipping players with insufficient history).

- **NFR-6 (Ethics and Legal):** All data sources shall be publicly accessible
  and used in accordance with their terms of use. No personal data about
  users will be collected.

---
