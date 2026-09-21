import { useState, useEffect } from "react";
import { getAccuracy, getModels } from "../lib/api";

export function useAccuracy() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getAccuracy(), getModels()])
      .then(([scored, models]) => {
        if (cancelled) return;
        const names = Object.fromEntries(models.map((m) => [m.id, m.name]));
        setData({ ...scored, names });
      })
      .catch((err) => {
        if (cancelled) return;
        // No file yet means no gameweek has been scored, which is a state to
        // show, not a failure to report.
        if (err.message === "Not found.") setData(null);
        else setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
