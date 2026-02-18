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

const _data = {
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
  return { data: _data, isLoading: false, error: null };
}
