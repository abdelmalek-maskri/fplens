import { useState, useEffect, useRef } from "react";
import { getBestXI } from "../lib/api";
import { mockBestXI } from "../mocks/squad";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

export function useBestXI() {
  const [data, setData] = useState(USE_MOCKS ? mockBestXI : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (USE_MOCKS) return;

    cancelledRef.current = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    getBestXI()
      .then((result) => {
        if (cancelledRef.current) return;
        setData({
          starters: result.starters || [],
          bench: result.bench || [],
          captainId: result.captain_id,
          viceId: result.vice_id,
          formation: result.formation,
          totalPoints: result.total_points,
          totalWithCaptain: result.total_with_captain,
        });
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
  }, []);

  return { data, isLoading, error };
}
