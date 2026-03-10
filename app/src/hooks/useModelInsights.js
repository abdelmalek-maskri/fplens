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

// Static evaluation data from training outputs.
// TODO: Replace with /api/model-insights once API schema matches frontend.
const INSIGHTS_DATA = {
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
  return { data: INSIGHTS_DATA, isLoading: false, error: null };
}
