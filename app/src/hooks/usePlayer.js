import { useState, useEffect } from "react";
import { getPlayer } from "../lib/api";

export function usePlayer(playerId) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    getPlayer(playerId)
      .then((raw) => {
        if (cancelled) return;
        const nameParts = (raw.name || raw.web_name || "").split(" ");
        setData({
          ...raw,
          first_name: raw.first_name || nameParts.slice(0, -1).join(" ") || raw.web_name,
          second_name: raw.second_name || nameParts.slice(-1)[0] || "",
          predicted_range: [raw.predicted_range_low ?? 0, raw.predicted_range_high ?? 0],
          transfers_in_event: raw.transfers_in_event ?? raw.transfers_in ?? 0,
          transfers_out_event: raw.transfers_out_event ?? raw.transfers_out ?? 0,
          fixtures: (raw.fixtures || []).map((f) => ({
            ...f,
            fdr: f.fdr ?? Math.round((f.atkFdr + f.defFdr) / 2),
          })),
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
  }, [playerId]);

  return { data, isLoading, error };
}
