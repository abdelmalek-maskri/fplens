import { useState, useEffect, useMemo } from "react";
import { getMultiGW } from "../lib/api";
import { CHIP_META, mockChipsAvailable } from "../mocks/chips";

export function useChips(horizon = 6) {
  const [multiGW, setMultiGW] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getMultiGW(horizon)
      .then((data) => {
        if (!cancelled) {
          setMultiGW(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [horizon]);

  const data = useMemo(() => {
    if (!multiGW || multiGW.length === 0) return null;

    const gameweeks = Array.from({ length: horizon }, (_, idx) => {
      // For each GW offset, compute chip-relevant stats from all players
      const players = multiGW
        .filter((p) => p.predicted && p.predicted[idx] != null)
        .map((p) => ({
          element: p.element,
          web_name: p.web_name,
          team: p.team_name,
          predicted: p.predicted[idx] || 0,
          opponent: (p.opponents && p.opponents[idx]) || "???",
          fdr: (p.fdr && p.fdr[idx]) || 3,
          status: p.status || "a",
        }));

      // Sort by predicted descending
      players.sort((a, b) => b.predicted - a.predicted);

      const best_captain = players[0] || { web_name: "N/A", predicted: 0, opponent: "???", fdr: 3 };
      const second_captain = players[1] || { web_name: "N/A", predicted: 0, opponent: "???", fdr: 3 };

      // Bench: positions 12-15 of a hypothetical best squad (use bottom 4 of top 15)
      const top15 = players.slice(0, 15);
      const bench_players = top15.slice(11, 15);
      const bench_total = bench_players.reduce((s, p) => s + p.predicted, 0);

      const team_total = top15.reduce((s, p) => s + p.predicted, 0);
      const avgFdr = players.length > 0
        ? players.reduce((s, p) => s + p.fdr, 0) / players.length
        : 3;
      const injured_count = players.filter((p) => p.status === "i" || p.status === "d").length;
      const hard_fixtures = players.filter((p) => p.fdr >= 4).length;

      return {
        gw: idx + 1,
        label: `GW+${idx + 1}`,
        best_captain,
        second_captain,
        bench_total: Math.round(bench_total * 10) / 10,
        bench_players,
        team_total: Math.round(team_total * 10) / 10,
        team_avg_fdr: Math.round(avgFdr * 10) / 10,
        injured_count,
        hard_fixtures,
      };
    });

    return {
      gameweeks,
      chipMeta: CHIP_META,
      chipsAvailable: mockChipsAvailable,
      multiGW,
    };
  }, [multiGW, horizon]);

  return { data, isLoading, error };
}
