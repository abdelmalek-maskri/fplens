import { useState, useEffect, useRef } from "react";
import { getBestXI } from "../lib/api";

export function useBestXI() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    getBestXI()
      .then((res) => {
        if (cancelledRef.current) return;
        setData({
          starters: res.starters || [],
          bench: res.bench || [],
          captainId: res.captain_id,
          viceId: res.vice_id,
          formation: res.formation,
          totalPoints: res.total_points,
          totalWithCaptain: res.total_with_captain,
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
