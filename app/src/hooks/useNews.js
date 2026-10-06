import { useState, useEffect } from "react";
import { getNews } from "../lib/api";

export function useNews() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Retry once. A first failure almost always means the free-tier instance
    // was asleep, and waking it is most of the wait. The fetch that attempt
    // triggered keeps running server-side after the browser gives up, so the
    // second attempt either finds the cache filled or waits behind the same
    // in-flight fetch rather than starting another one.
    getNews()
      .then(setData)
      .catch(() => getNews().then(setData).catch(setError))
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
