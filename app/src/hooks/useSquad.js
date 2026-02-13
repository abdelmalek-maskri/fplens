import { mockSquad, FORMATIONS } from "../mocks/squad";

const _data = { squad: mockSquad, formations: FORMATIONS };

export function useSquad() {
  return { data: _data, isLoading: false, error: null };
}
