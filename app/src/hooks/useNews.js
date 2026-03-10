import { useState, useEffect } from "react";
import { getNews } from "../lib/api";

export function useNews(days = 7) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getNews(days)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [days]);

  return { data, isLoading, error };
}
