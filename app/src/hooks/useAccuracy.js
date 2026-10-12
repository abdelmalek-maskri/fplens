import { useState, useEffect } from "react";
import { getAccuracy, getModels, getManifest } from "../lib/api";

export function useAccuracy() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // defaultModel matters because gameweeks scored before per-model XI logging
    // have only that model's team, kept at the top level of the file.
    Promise.all([getAccuracy(), getModels(), getManifest()])
      .then(([scored, models, manifest]) => {
        if (cancelled) return;
        const names = Object.fromEntries(models.map((m) => [m.id, m.name]));
        setData({ ...scored, names, defaultModel: manifest.default_model });
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
