import { useState, useEffect } from "react";
import { getStatus } from "../lib/api";

export function useGameweek() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStatus().then(setData).catch(setError);
  }, []);

  return { data, error };
}
