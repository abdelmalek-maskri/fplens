import { useState, useEffect } from "react";
import { getBestXI } from "../lib/api";

export function useBestXI() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBestXI()
      .then((res) => {
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
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
