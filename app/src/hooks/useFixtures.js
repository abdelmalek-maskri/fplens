import { useState, useEffect, useRef } from "react";
import { getFixtures } from "../lib/api";
import { TEAMS, TEAM_FULL, FIXTURES, FDR_BG, FDR_TEXT } from "../mocks/fixtures";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = {
  teams: TEAMS,
  teamFull: TEAM_FULL,
  fixtures: FIXTURES,
  fdrBg: FDR_BG,
  fdrText: FDR_TEXT,
};

export function useFixtures(numGws = 6) {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (USE_MOCKS) return;

    cancelledRef.current = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    getFixtures(numGws)
      .then((result) => {
        if (cancelledRef.current) return;
        setData({
          teams: result.teams || TEAMS,
          teamFull: result.team_full || TEAM_FULL,
          fixtures: result.fixtures || FIXTURES,
          fdrBg: result.fdr_bg || FDR_BG,
          fdrText: result.fdr_text || FDR_TEXT,
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
