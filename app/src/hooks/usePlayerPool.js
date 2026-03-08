import { allPlayers, STATUS_CONFIG } from "../mocks/playerComparison";

export { STATUS_CONFIG };

const _data = { players: allPlayers };

export function usePlayerPool() {
  return { data: _data, isLoading: false, error: null };
}
