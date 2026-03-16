import { useState, useEffect, useMemo } from "react";
import { getMultiGW } from "../lib/api";

export function useTransfers(horizon = 6) {
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

    const gwLabels = Array.from({ length: horizon }, (_, i) => `GW+${i + 1}`);

    const targets = multiGW
      .filter((p) => p.predicted && p.predicted.length > 0)
      .map((p) => ({
        element: p.element,
        web_name: p.web_name,
        team: p.team_name,
        position: p.position,
        value: p.value,
        selling_price: p.value,
        status: p.status || "a",
        form: p.form || 0,
        predicted: p.predicted,
        fdr: p.fdr || Array(horizon).fill(3),
        predicted_total: p.predicted_total || 0,
        fdr_avg: p.fdr_avg || 3,
        pts_last5: [],
      }));

    // myTeam is empty until user connects via FPL ID (My Team page).
    // The transfer planner still works for browsing targets.
    return { myTeam: [], targets, gwLabels };
  }, [multiGW, horizon]);

  return { data, isLoading, error };
}
