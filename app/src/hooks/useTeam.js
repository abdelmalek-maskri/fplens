import { useState, useEffect } from "react";
import { getTeam } from "../lib/api";

export function useTeam(fplId) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fplId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    getTeam(fplId)
      .then((result) => {
        if (cancelled) return;
        setData({
          team: {
            manager: result.manager,
            teamName: result.team_name,
            overallRank: result.overall_rank,
            totalPoints: result.overall_points,
            budget: result.bank,
            picks: result.picks.map((p) => ({
              ...p,
              position: p.player_position || p.position,
              is_vice: p.is_vice_captain ?? false,
            })),
          },
          transferSuggestions: result.transfer_suggestions || [],
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fplId]);

  return { data, isLoading, error };
}
