import { useState, useEffect, useRef } from "react";
import { getPlayer } from "../lib/api";
import { mockPlayers, defaultPlayer } from "../mocks/playerDetail";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

function normalizePlayer(raw) {
  const nameParts = (raw.name || raw.web_name || "").split(" ");
  return {
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
  };
}

export function usePlayer(playerId) {
  const mockData = USE_MOCKS
    ? mockPlayers[playerId] || {
        ...defaultPlayer,
        element: Number(playerId) || 0,
        web_name: `Player #${playerId}`,
      }
    : null;

  const [data, setData] = useState(mockData);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (USE_MOCKS) return;

    cancelledRef.current = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    getPlayer(playerId)
      .then((result) => {
        if (!cancelledRef.current) setData(normalizePlayer(result));
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
  }, [playerId]);

  return { data, isLoading, error };
}
