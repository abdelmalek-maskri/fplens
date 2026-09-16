import { useState, useEffect, useMemo } from "react";
import { getMultiGW, getTeam } from "../lib/api";

const POS_MAP = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const toPos = (v) => {
  if (typeof v === "string" && ["GK", "DEF", "MID", "FWD"].includes(v)) return v;
  return POS_MAP[v] || null;
};

export function useTransfers(horizon = 3) {
  // horizon only narrows the already-fetched snapshot; it is not a request param.
  const [multiGW, setMultiGW] = useState(null);
  const [myTeamRaw, setMyTeamRaw] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fplId = localStorage.getItem("fpl_id");
    const promises = [getMultiGW()];
    if (fplId) promises.push(getTeam(fplId));

    Promise.all(promises)
      .then(([mgw, team]) => {
        if (!cancelled) {
          setMultiGW(mgw);
          if (team) setMyTeamRaw(team);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [horizon]);

  const data = useMemo(() => {
    if (!multiGW) return null;

    const gwLabels = Array.from({ length: horizon }, (_, i) => `GW+${i + 1}`);

    const mgwByElement = {};
    for (const p of multiGW) {
      mgwByElement[p.element] = p;
    }

    // Never suggest buying someone who cannot play. "u" has left the club,
    // "i" is injured, "s" is suspended. Doubtful stays in, with the flag.
    const targets = multiGW
      .filter((p) => p.predicted && p.predicted.length > 0)
      .filter((p) => !["u", "i", "s"].includes(p.status))
      .map((p) => ({
        element: p.element,
        web_name: p.web_name,
        team: p.team_name,
        position: p.position,
        value: p.value,
        selling_price: p.value,
        status: p.status || "a",
        form: p.form || 0,
        predicted: p.predicted,
        fdr: p.fdr || Array(horizon).fill(3),
        predicted_total: p.predicted_total || 0,
        fdr_avg: p.fdr_avg || 3,
        pts_last5: [],
      }));

    let myTeam = [];
    if (myTeamRaw && myTeamRaw.picks) {
      myTeam = myTeamRaw.picks.map((pick) => {
        const mgw = mgwByElement[pick.element] || {};
        return {
          element: pick.element,
          web_name: pick.web_name || mgw.web_name || "Unknown",
          team: pick.team_name || mgw.team_name || "",
          position:
            toPos(mgw.position) || toPos(pick.player_position) || toPos(pick.element_type) || "MID",
          value: pick.value || mgw.value || 0,
          selling_price: pick.selling_price || pick.value || 0,
          status: pick.status || mgw.status || "a",
          form: pick.form || mgw.form || 0,
          predicted: mgw.predicted || Array(horizon).fill(0),
          fdr: mgw.fdr || Array(horizon).fill(3),
          predicted_total: mgw.predicted_total || 0,
          fdr_avg: mgw.fdr_avg || 3,
          pts_last5: [],
        };
      });
    }

    // Null rather than 0 when no team is loaded, so the page can tell "no squad
    // yet" apart from "a squad with nothing in the bank".
    const bank = myTeamRaw ? (myTeamRaw.bank ?? 0) : null;

    return { myTeam, targets, gwLabels, bank };
  }, [multiGW, myTeamRaw, horizon]);

  return { data, isLoading, error };
}
