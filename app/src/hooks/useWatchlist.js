import { useState, useEffect, useCallback } from "react";
import { getPredictions } from "../lib/api";

const STORAGE_KEY = "fpl-watchlist";

function getWatchlistIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const [allPlayers, setAllPlayers] = useState(null);
  const [watchIds, setWatchIds] = useState(getWatchlistIds);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPredictions()
      .then((res) => setAllPlayers(Array.isArray(res) ? res : (res?.predictions ?? [])))
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  const players = allPlayers ? allPlayers.filter((p) => watchIds.includes(p.element)) : [];

  const add = useCallback((elementId) => {
    setWatchIds((prev) => {
      const next = [...new Set([...prev, elementId])];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((elementId) => {
    setWatchIds((prev) => {
      const next = prev.filter((id) => id !== elementId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    data: { players, allPlayers: allPlayers ?? [] },
    isLoading,
    error,
    add,
    remove,
    watchIds,
  };
}
