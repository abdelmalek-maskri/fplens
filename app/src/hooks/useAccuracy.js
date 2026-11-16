import { useState, useEffect } from "react";
import { getAccuracy, getModels, getManifest, ApiError } from "../lib/api";

export function useAccuracy() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Only accuracy.json is allowed to be absent, and only that absence means
    // no gameweek has been scored. Catching the 404 here rather than around
    // all three keeps a missing models.json or manifest.json, which is what a
    // failed snapshot publish looks like, from being reported to the visitor
    // as an empty season.
    const scored = getAccuracy().catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    });

    // defaultModel matters because gameweeks scored before per-model XI logging
    // have only that model's team, kept at the top level of the file.
    Promise.all([scored, getModels(), getManifest()])
      .then(([results, models, manifest]) => {
        if (cancelled) return;
        if (results === null) {
          setData(null);
          return;
        }
        const names = Object.fromEntries(models.map((m) => [m.id, m.name]));
        setData({ ...results, names, defaultModel: manifest.default_model });
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
  }, []);

  return { data, isLoading, error };
}
