import { useState, useEffect } from "react";
import { getTeam } from "../lib/api";
import { mockUserTeam, mockTransferSuggestions } from "../mocks/team";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = { team: mockUserTeam, transferSuggestions: mockTransferSuggestions };

export function useTeam(fplId) {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCKS || !fplId) return;

    setData(null);
    setIsLoading(true);
    setError(null);

    getTeam(fplId)
      .then((result) => {
        setData({
          team: result,
          transferSuggestions: result.transfer_suggestions || [],
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [fplId]);

  return { data, isLoading, error };
}
