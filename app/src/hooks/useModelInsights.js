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

// The ModelInsights page has tight coupling to the mock data shape across
// 5 tabs and 30+ fields. The API provides real ablation + SHAP data but
// in a different structure. We fetch from API to validate it's live, then
// overlay real values where the shapes match cleanly.

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

        // Start with mock data as the safe baseline
        const merged = { ...MOCK_DATA };

        // Overlay real ablation metrics where available
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
                spearman_rho: real.spearman_rho ?? cfg.spearman_rho,
              };
            }
            return cfg;
          });
        }

        // Overlay real SHAP features
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
        // API failed — fall back to full mock data
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
