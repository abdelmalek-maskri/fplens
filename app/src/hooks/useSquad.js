import { useState, useEffect, useRef } from "react";
import { getBestXI } from "../lib/api";
import { mockSquad, FORMATIONS } from "../mocks/squad";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

// Build mock result matching backend shape
const _mockStarters = mockSquad.slice(0, 11);
const _mockBench = mockSquad.slice(11);
const _mockSorted = [..._mockStarters].sort((a, b) => b.predicted_points - a.predicted_points);
const _mockData = {
  starters: _mockStarters,
  bench: _mockBench,
  captainId: _mockSorted[0]?.element,
  viceId: _mockSorted[1]?.element,
  formation: "3-4-3",
  totalPoints: _mockStarters.reduce((s, p) => s + p.predicted_points, 0),
  totalWithCaptain:
    _mockStarters.reduce((s, p) => s + p.predicted_points, 0) +
    (_mockSorted[0]?.predicted_points || 0),
  formations: FORMATIONS,
};

export function useSquad() {
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
          formations: FORMATIONS,
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
