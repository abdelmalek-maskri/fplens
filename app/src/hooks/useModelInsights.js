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
} from "../mocks/modelInsights";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = {
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
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCKS) return;

    getModelInsights()
      .then((result) => {
        setData({
          ...result,
          // Spread API data but keep mock constants the frontend expects
          modelVariants: result.model_variants || modelVariants,
          baselines,
          positionPerformance,
          ablationConfigs,
          ablationSignificance,
          interactionEffect,
          twoheadMethods,
          shapFeatures: result.shap_features || shapFeatures,
          ensembleWeights,
          datasetStats,
          calibrationDeciles,
          calibrationStats,
          categoryColors,
          categoryTextColors,
          exampleShap,
          tabs: TABS,
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
