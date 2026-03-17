import { useState, useEffect, useRef } from "react";
import { getFixtures } from "../lib/api";
import { FDR_BG, FDR_TEXT } from "../lib/constants";

export function useFixtures(numGws = 6) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    getFixtures(numGws)
      .then((res) => {
        if (cancelledRef.current) return;
        setData({
          teams: res.teams || [],
          teamFull: res.team_full || {},
          fixtures: res.fixtures || {},
          fdrBg: res.fdr_bg || FDR_BG,
          fdrText: res.fdr_text || FDR_TEXT,
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
  }, [numGws]);

  return { data, isLoading, error };
}
