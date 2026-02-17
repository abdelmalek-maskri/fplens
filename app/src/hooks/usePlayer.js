import { useMemo } from "react";
import { mockPlayers, defaultPlayer } from "../mocks/playerDetail";

export function usePlayer(playerId) {
  const data = useMemo(() => {
    const player = mockPlayers[playerId];
    return (
      player || {
        ...defaultPlayer,
        element: Number(playerId) || 0,
        web_name: `Player #${playerId}`,
      }
    );
  }, [playerId]);

  return { data, isLoading: false, error: null };
}
