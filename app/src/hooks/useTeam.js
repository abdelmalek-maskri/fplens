import { useState, useEffect, useRef } from "react";
import { getTeam } from "../lib/api";

export function useTeam(fplId) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!fplId) return;

    cancelledRef.current = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    getTeam(fplId)
      .then((result) => {
        if (cancelledRef.current) return;
        setData({
          team: {
            manager: result.manager,
            teamName: result.team_name,
            overallRank: result.overall_rank,
            totalPoints: result.overall_points,
            gameweekPoints: 0,
            budget: result.bank,
            freeTransfers: result.free_transfers ?? 1,
            picks: result.picks.map((p) => ({
              ...p,
              position: p.player_position || p.position,
            })),
          },
          transferSuggestions: result.transfer_suggestions || [],
        });
      })
      .catch((err) => {
        if (!cancelledRef.current) setError(err);
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [fplId]);

  return { data, isLoading, error };
}
