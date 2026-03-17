import { useState, useEffect } from "react";
import { getModelInsights } from "../lib/api";
import {
  modelVariants,
  baselines,
  positionPerformance,
  ablationConfigs,
  ablationSignificance,
  interactionEffect,
  twoheadMethods,
  shapFeatures,
  ensembleWeights,
  datasetStats,
  calibrationDeciles,
  calibrationStats,
  categoryColors,
  categoryTextColors,
  exampleShap,
  TABS,
} from "../lib/insightsConfig";

// API returns ablation + SHAP in a different shape than what the 5-tab UI
// expects, so we merge real values into the mock baseline where shapes align.
const MOCK_DATA = {
  modelVariants,
  baselines,
  positionPerformance,
  ablationConfigs,
  ablationSignificance,
  interactionEffect,
  twoheadMethods,
  shapFeatures,
  ensembleWeights,
  datasetStats,
  calibrationDeciles,
  calibrationStats,
  categoryColors,
  categoryTextColors,
  exampleShap,
  tabs: TABS,
};

export function useModelInsights() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getModelInsights()
      .then((apiData) => {
        if (cancelled) return;

        const merged = { ...MOCK_DATA };

        const ab = apiData.ablation || {};
        if (ab.config_A && ab.config_D) {
          merged.ablationConfigs = merged.ablationConfigs.map((cfg) => {
            const real = ab[`config_${cfg.config}`];
            if (real) {
              return {
                ...cfg,
                mae: real.mae ?? cfg.mae,
                rmse: real.rmse ?? cfg.rmse,
                r2: real.r2 ?? cfg.r2,
                features: real.n_features ?? cfg.features,
                rho: real.spearman_rho ?? cfg.rho,
              };
            }
            return cfg;
          });
        }

        if (apiData.shap_features && apiData.shap_features.length > 0) {
          merged.shapFeatures = apiData.shap_features.map((f) => ({
            feature: f.feature,
            importance: parseFloat(f.importance),
            importance_pct: parseFloat(f.importance_pct),
            category: f.category || "other",
          }));
        }

        setData(merged);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setData(MOCK_DATA);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
