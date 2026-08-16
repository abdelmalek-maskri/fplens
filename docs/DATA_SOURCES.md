# Data sources and attribution

FPLens is a non-commercial academic project. It holds no rights to the underlying
football data — every source below belongs to its respective owner and remains under
its own terms. The MIT licence in this repository covers the source code only.

## Historical FPL data — vaastav/Fantasy-Premier-League

Per-player, per-gameweek statistics from 2016-17 onward, and the commit history used
to reconstruct injury snapshots.

- Source: <https://github.com/vaastav/Fantasy-Premier-League>
- Licence: **MIT** — Copyright (c) 2017-19 Vaastav Anand
- Used as a git submodule (`external/vaastav_fpl`), so the data is fetched from the
  original repository rather than copied into this one.

> Anand, V. (2016–). *Fantasy Premier League Dataset.* GitHub.
> <https://github.com/vaastav/Fantasy-Premier-League>

## Fantasy Premier League API

Live player prices, availability, fixtures, and user squads at inference time.

- Source: `https://fantasy.premierleague.com/api/`
- These are undocumented public endpoints with no published developer terms. Use here is
  read-only, non-commercial, low-volume, and cached to minimise requests.
- **FPLens is not affiliated with, endorsed by, or connected to the Premier League or
  Fantasy Premier League.** "Fantasy Premier League" and "Premier League" are trademarks
  of the Football Association Premier League Limited.

## Understat — expected goals

xG, xA, npxG, xG chain, xG buildup, shots, and key passes. The FPL API only exposes
expected-goals statistics from 2022-23 onward, so Understat is the sole source for the
six earlier seasons.

- Source: <https://understat.com>
- Accessed through the [`understat`](https://github.com/amosbastian/understat) Python
  package (MIT). The package licence covers the client code, not the data.
- Understat publishes no data licence. Retrieved data is kept locally, is excluded from
  version control, and is **not redistributed**. Anyone reproducing this project fetches
  it themselves.

## The Guardian — Open Platform API

Football articles used for news sentiment features.

- Source: <https://open-platform.theguardian.com>
- Terms: the free developer tier is **non-commercial only**, **requires attribution**,
  and **content must not be retained for longer than 24 hours**.
- Live path: `/api/news` fetches on demand and caches for 60 minutes, within the
  retention limit.
- Training path: sentiment features are derived aggregates (mention counts, sentiment
  scores, injury context) rather than stored article text. Raw responses used during
  feature engineering are excluded from version control and are not redistributed.
- Content is credited to The Guardian wherever it is displayed.

> Content powered by [the Guardian Open Platform](https://open-platform.theguardian.com).

## Sentiment model — cardiffnlp/twitter-roberta-base-sentiment-latest

- Source: <https://huggingface.co/cardiffnlp/twitter-roberta-base-sentiment-latest>
- Used for article sentiment scoring, chosen over keyword counting because football
  language is ambiguous ("devastating strike" is positive in context).

> Loureiro, D., Barbieri, F., Neves, L., Espinosa Anke, L., & Camacho-Collados, J. (2022).
> *TimeLMs: Diachronic Language Models from Twitter.* ACL 2022 System Demonstrations.

## Libraries

All permissively licensed: LightGBM (MIT), XGBoost (Apache-2.0), CatBoost (Apache-2.0),
scikit-learn (BSD-3-Clause), SHAP (MIT), spaCy (MIT), Transformers (Apache-2.0),
FastAPI (MIT), SciPy (BSD-3-Clause), pandas (BSD-3-Clause), React (MIT), Vite (MIT),
Tailwind CSS (MIT).

## If you reuse this

The code is MIT — use it freely. The data is not mine to license. Fetch it from the
original sources under their terms, and get your own Guardian API key. If you intend
anything commercial, the Guardian developer tier does not permit it and the FPL
endpoints are not licensed for it.
