import { mockWatchlistPlayers } from "../mocks/watchlist";

const _data = { players: mockWatchlistPlayers };

export function useWatchlist() {
  return { data: _data, isLoading: false, error: null };
}
