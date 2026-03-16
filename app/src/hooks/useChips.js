import { useState, useEffect, useMemo } from "react";
import { getMultiGW } from "../lib/api";
import { CHIP_META } from "../mocks/chips";

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
    if (!multiGW) return null;

    // Build per-GW aggregate stats for chip recommendations
    const gwLabels = Array.from({ length: horizon }, (_, i) => `GW+${i + 1}`);

    const gameweeks = gwLabels.map((label, idx) => {
      const gwPreds = multiGW.map((p) => p.predicted[idx] || 0);
      const avgPred = gwPreds.reduce((a, b) => a + b, 0) / gwPreds.length;
      const topPred = Math.max(...gwPreds);
      const avgFdr = multiGW.reduce((a, p) => a + (p.fdr[idx] || 3), 0) / multiGW.length;

      return {
        label,
        gw_offset: idx + 1,
        avg_predicted: Math.round(avgPred * 100) / 100,
        top_predicted: Math.round(topPred * 100) / 100,
        avg_fdr: Math.round(avgFdr * 100) / 100,
      };
    });

    return { gameweeks, chipMeta: CHIP_META, multiGW };
  }, [multiGW, horizon]);

  return { data, isLoading, error };
}
