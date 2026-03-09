import { useState, useEffect } from "react";
import { getNews } from "../lib/api";
import { mockArticles } from "../mocks/news";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = { articles: mockArticles, trending: [] };

export function useNews(days = 7) {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCKS) return;

    getNews(days)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [days]);

  return { data, isLoading, error };
}
