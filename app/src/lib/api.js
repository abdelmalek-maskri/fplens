const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function getPredictions() {
  const res = await fetch(`${BASE_URL}/fpl/predict`);
  if (!res.ok) throw new Error("Failed to fetch predictions");
  return res.json();
}