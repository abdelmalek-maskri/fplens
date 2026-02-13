import { mockPredictions, mockLocalShap, defaultShap, MODEL_OPTIONS } from "../mocks/predictions";

const _data = { predictions: mockPredictions, localShap: mockLocalShap, defaultShap, modelOptions: MODEL_OPTIONS };

export function usePredictions() {
  return { data: _data, isLoading: false, error: null };
}
