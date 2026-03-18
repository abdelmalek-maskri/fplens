# Literature Review (Revised)

**Abdelmalek Maskri - 2541248**

---

## 1. Motivation

Fantasy Premier League (FPL) is played by millions of users worldwide, and it requires making weekly decisions about player transfers, captaincy, and squad selection. These decisions are difficult because player performance depends on many factors, including historical statistics, fixture difficulty, injuries, and even news or manager comments. Most prediction tools available to players focus on only one source of information, and often rely on simple statistical heuristics or black-box models that do not explain their predictions.

Recent research shows that different types of data can provide complementary information. Structured statistics capture long-term performance trends, injury metadata reflects short-term availability, and textual content from football news can provide early signals about player form or rotation risk. However, existing work that combines multiple data streams has produced mixed results, some studies show benefits from text integration while others find no improvement over structured-data baselines. This motivates a careful investigation of whether targeted NLP extraction of injury information adds predictive value beyond what is captured in historical playing patterns.

## 2. Problem Definition

The core problem addressed in this project is the prediction of next-gameweek player points in the Fantasy Premier League using multiple heterogeneous data sources. Existing methods typically rely on a single data stream, usually historical player statistics, which limits their ability to model context such as injuries, tactical changes, or media sentiment. Moreover, current systems rarely include an optimisation layer to recommend a full starting eleven under FPL constraints, nor do they provide explanations to help users understand the recommendations.

We therefore define the problem as follows: given structured FPL data, fixture difficulty, injury and availability information, and textual news content related to EPL players, develop a unified prediction and decision-support system that produces accurate point forecasts, selects an optimal team, and provides human-readable explanations.

## 3. Research Questions

This project is guided by the following research questions:

- **RQ1**: Does FPL's official injury status (structured) add predictive value beyond historical playing patterns?

- **RQ2**: Does NLP-extracted injury information (injury type, expected return date, sentiment) improve predictions beyond structured injury status?

- **RQ3**: Which data streams (statistics, fixtures, injury metadata, or news-derived features) contribute most to predictive performance, and do they provide complementary or redundant information?

- **RQ4**: Does providing an interactive interface where users can adjust model parameters improve understanding and trust in the system?

## 4. Project Aim and Objectives

### Aim

The aim of this project is to design, implement, and evaluate a multi-stream hybrid prediction system that combines ML and NLP models with an optimisation and explanation layer to support decision-making in Fantasy Premier League.

### Objectives

- **O1**: Collect and preprocess multi-stream data, including structured FPL statistics, fixture difficulty, and historical injury/availability metadata from the FPL API.

- **O2**: Build a strong baseline ML model (e.g., LightGBM stacked ensemble) using only structured features, and evaluate its predictive performance.

- **O3**: Extract structured injury features from FPL news text (injury type, expected return date) and generate transformer-based embeddings for comparison.

- **O4**: Train and evaluate hybrid multi-stream models through systematic ablation studies comparing: baseline → +injury_structured → +injury_NLP.

- **O5**: Implement a mixed-integer optimisation model to select an optimal FPL lineup based on predicted points.

- **O6**: Develop an interactive user interface that visualises predictions, explanations, and team recommendations, and allows users to adjust model parameters.

- **O7**: Conduct experimental analysis to answer the research questions, with particular focus on whether NLP adds value beyond structured injury data.

## 5. Methodology Overview

The project adopts a modular methodology with five main components: data collection, baseline modelling, NLP feature extraction, hybrid modelling, and decision-support integration.

### Data Collection and Preprocessing

Structured FPL and EPL data is extracted from the publicly available vaastav Fantasy-Premier-League dataset on GitHub, which provides historical player statistics updated weekly throughout each season. Historical injury and availability states are reconstructed using git version history to obtain per-gameweek snapshots without temporal leakage. Additional expected statistics are sourced from Understat. All data is stored in a unified feature store with proper gameweek alignment.

### Baseline Machine Learning Model

A baseline stacked ensemble model using gradient-boosted trees (LightGBM, XGBoost) and linear models is trained on structured features only. Evaluation is performed using rolling time-aware train/test splits across multiple seasons, with 2024-25 as the holdout season. Metrics include MAE, RMSE, and R², with comparisons against zero and mean baselines.

### NLP Feature Extraction

FPL's official news field contains injury descriptions (e.g., "Hamstring injury - Expected back 01 Mar"). Rather than applying generic text embeddings, we extract structured features:
- Injury type classification (hamstring, knee, ankle, illness, etc.)
- Expected return date parsing (weeks until return)
- Availability sentiment (positive/negative/neutral)

For comparison, we also generate transformer-based embeddings using sentence-transformers (all-MiniLM-L6-v2, 384 dimensions) to test whether deep embeddings capture additional signal.

### Hybrid Multi-Stream Model

A systematic ablation study evaluates the contribution of each data stream:
- **Config A**: Baseline (structured stats + extended features)
- **Config B**: + Injury structured (status, chance_of_playing)
- **Config C**: + Injury NLP (extracted type, return date, sentiment)
- **Config D**: + Injury embeddings (384-dim transformer embeddings)

This design directly answers whether NLP adds value beyond structured injury status.

### Optimisation and Decision Support

Predicted points are passed to a mixed-integer linear programming solver to construct an optimal starting eleven under FPL constraints (budget, position limits, team limits). The final system provides explanations by highlighting influential features via SHAP analysis.

### Evaluation

Experiments compare ablation configurations to answer the research questions. The key comparison is Config B vs Config C—does NLP extraction help beyond structured status? Results are presented through tables, statistical significance tests, and SHAP visualisations.

## 6. Related Work

Fantasy Premier League prediction has been studied using a range of machine learning, deep learning, and natural language processing methods. Most existing work focuses on one type of data only, such as historical match statistics or simple metadata like fixtures or injuries. This section reviews the main approaches in the literature and explains how they relate to our proposed multi-stream model.

### 6.1 Models based on structured FPL and EPL statistics

A large part of the literature uses only structured statistical data from the English Premier League (EPL), such as goals, assists, minutes played, or basic player form. Early studies by Hermann and Ntoso (2015) and more recent work by Bangdiwala et al. (2022) show that ML models such as Random Forests, Support Vector Machines, or Gradient Boosted Trees can outperform simple heuristics. However, these works do not include textual information or other contextual metadata, which limits the amount of signal available for prediction.

Other researchers extend structured data models by adding simple metadata. Rajesh et al. (2022) and Shah et al. (2023) include features such as fixture difficulty or team form. Gupta (2019), Lombu et al. (2024), and Ramdas (2022) use statistical and temporal features together with ML or DL models, including LSTMs and CNNs. These approaches show that temporal patterns can improve predictions, but they still rely only on numerical inputs and do not use unstructured information such as news or injury reports.

Recent work by Chen et al. (2024) on NBA prediction demonstrates the effectiveness of XGBoost combined with SHAP analysis for sports outcome prediction, achieving strong performance and interpretability. Similar gradient boosting approaches have shown promise in football player market value prediction, with LightGBM outperforming linear models by factors of 3-6x in terms of RMSE and MAE.

### 6.2 Models using textual or semantic information

More recent work explores the use of textual data. Baughman et al. (2021) developed a system at IBM/ESPN that processes over 100,000 news sources daily using document2vector models to manage fantasy football teams. Their work demonstrates the scale at which text can be incorporated but focuses on American football rather than FPL.

Frees et al. (2024) present the most relevant recent work, applying both CNNs and transfer learning to EPL player performance forecasting. Importantly, **their transfer learning experiments on Guardian news articles did not identify a strong predictive signal**, achieving worse performance than both their CNN baseline and traditional ML models. This negative result is significant—it suggests that naive text embedding approaches may not capture actionable fantasy-relevant information and motivates our focus on targeted injury extraction rather than generic embeddings.

### 6.3 Multi-stream and hybrid approaches

A smaller number of papers attempt to combine information from several sources. Bonello et al. (2019) propose a multi-stream framework that combines match statistics, betting odds, tweets, and blog sentiment. Their system achieved a top 0.5% ranking (within top 30,000 of 6.5 million players) in the 2018/19 season, outperforming statistical-only predictors by over 300 points. However, their text features were simple sentiment scores from the Aylien API rather than deep transformer embeddings.

Tamimi and Tran (2025) extend this idea using transformer-based sentiment analysis on news articles combined with FPL statistics. Published in the International Journal of Computer Science in Sport, their work represents the state-of-the-art in combining structured and textual data for FPL prediction. They show that transformer-based sentiment features can improve prediction accuracy when combined with boosting algorithms.

### 6.4 Injury prediction in sports

A separate but relevant body of work focuses on injury prediction using machine learning. Rossi et al. (2022) provide a comprehensive review of ML for understanding and predicting injuries in football, noting that gradient boosting methods and neural networks show promise but require careful feature engineering. Recent work in 2024 demonstrates the use of SHAP for interpretable injury risk prediction.

However, this literature primarily uses structured data (training loads, biomechanics, physiological measures) rather than text-based approaches. The extraction of injury information from news text for fantasy prediction remains underexplored.

### 6.5 Gap in the literature

While recent work has made progress in multi-stream prediction, several gaps remain:

1. **Mixed results on text value**: Frees et al. (2024) found that transfer learning on news text underperformed structured baselines, while Tamimi and Tran (2025) report improvements from sentiment features. This inconsistency motivates careful ablation to determine when and how text helps.

2. **Generic embeddings vs. targeted extraction**: Existing work either uses simple sentiment scores (Bonello et al., 2019) or generic transformer embeddings (Frees et al., 2024). No work specifically extracts structured injury information (injury type, expected return date) from FPL's official news field.

3. **Lack of ablation studies**: Most multi-stream papers report only final system performance without systematic ablation to isolate the contribution of each data stream.

4. **Temporal leakage concerns**: Few papers explicitly address how injury/availability data is aligned to prediction time to prevent information leakage.

This project addresses these gaps by:
- Using FPL's official injury metadata (status, chance_of_playing, news) with proper temporal alignment via git history
- Comparing structured injury features against NLP-extracted features through systematic ablation
- Evaluating whether targeted injury extraction provides value beyond what historical playing patterns capture
- Providing interpretable analysis via SHAP to understand feature contributions

## References

[1] Bangdiwala et al. "Predicting player performance in fantasy premier league using machine learning." IEEE ASIANCON, 2022.

[2] Baughman, A. et al. "Deep artificial intelligence for fantasy football language understanding." arXiv preprint arXiv:2111.02874, 2021.

[3] Bonello, N. et al. "Multi-stream data analytics for enhanced fantasy football predictions." arXiv preprint 1912.07441, 2019.

[4] Chen, Y. et al. "Integration of machine learning XGBoost and SHAP models for NBA game outcome prediction." PLOS One, 2024.

[5] Frees, D., Ravella, P., and Zhang, C. "Deep learning and transfer learning architectures for English Premier League player performance forecasting." arXiv preprint arXiv:2405.02412, 2024.

[6] Gupta, A. "Time series modeling for dream team in fantasy premier league." arXiv preprint arXiv:1909.12938, 2019.

[7] Hermann, J. and Ntoso, G. "Machine learning applications in fantasy basketball." Proceedings of ML in Sports, 2015.

[8] Lombu, J. et al. "Predicting fantasy premier league points using CNN and LSTM." Jurnal Teknologi Informasi, 2024.

[9] Rajesh, R. et al. "Player recommendation system for fantasy premier league using ML." IEEE JCSSE, 2022.

[10] Ramdas, R. "Using CNNs to predict performance in the FPL." ResearchGate, 2022.

[11] Rossi, A. et al. "Machine learning for understanding and predicting injuries in football." Sports Medicine - Open, 2022.

[12] Shah, S. et al. "Multi criteria decision making in fantasy sports." IEEE PuneCon, 2023.

[13] Tamimi, M. and Tran, T. "Players' performance prediction for fantasy premier league using transformer-based sentiment analysis on news and statistical data." International Journal of Computer Science in Sport, 2025.

[14] vaastav. "Fantasy-Premier-League." GitHub repository, https://github.com/vaastav/Fantasy-Premier-League, 2016-present.
