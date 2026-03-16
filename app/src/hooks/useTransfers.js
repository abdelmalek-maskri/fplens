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

    const targets = multiGW.map((p) => ({
      element: p.element,
      web_name: p.web_name,
      team: p.team_name,
      position: p.position,
      value: p.value,
      status: p.status,
      form: p.form,
      predicted: p.predicted,
      fdr: p.fdr,
      predicted_total: p.predicted_total,
      fdr_avg: p.fdr_avg,
    }));

    return { targets, gwLabels };
  }, [multiGW, horizon]);

  return { data, isLoading, error };
}
