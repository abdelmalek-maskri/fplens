import { useState, useEffect } from "react";
import { getBestSquad, getPredictions, getModels } from "../lib/api";
import { FPL_BUDGET, POS_LIMITS, MAX_PER_TEAM } from "../lib/constants";

export function useOptimalXI(modelId) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    Promise.allSettled([getBestSquad(), getPredictions(modelId), getModels()])
      .then(([squadSettled, predictionsSettled, modelsSettled]) => {
        if (cancelled) return;

        const file = squadSettled.status === "fulfilled" ? squadSettled.value : null;
        const preds = predictionsSettled.status === "fulfilled" ? predictionsSettled.value : null;
        const models = modelsSettled.status === "fulfilled" ? modelsSettled.value : [];

        // The file used to hold a single squad, the default model's. It now
        // holds one per model, so read either shape until a new snapshot lands.
        const perModel = file?.squads ?? (file ? { [file.default_model ?? "default"]: file } : {});
        const defaultModel = file?.default_model ?? Object.keys(perModel)[0];
        const chosen = modelId && perModel[modelId] ? modelId : defaultModel;
        const squad = perModel[chosen] ?? null;

        if (!file && !preds) {
          setError(new Error("Failed to load season planner data."));
          return;
        }

        const res = {
          budget: FPL_BUDGET,
          posLimits: POS_LIMITS,
          maxPerTeam: MAX_PER_TEAM,
          // Only models the file actually carries, so the picker cannot offer
          // a squad that does not exist.
          models: models.filter((m) => perModel[m.id]),
          selected: chosen,
          defaultModel,
        };

        if (squad) {
          const xi = squad.best_xi || {};
          res.recommended = {
            squad: squad.squad || [],
            totalValue: squad.total_value,
            totalPoints: squad.total_points,
            budgetRemaining: squad.budget_remaining,
            starters: xi.starters || [],
            bench: xi.bench || [],
            captainId: xi.captain_id,
            viceId: xi.vice_id,
            formation: xi.formation,
            totalWithCaptain: xi.total_with_captain,
          };
        }

        if (preds) {
          res.playerPool = preds.map((p) => ({
            ...p,
            team: p.team_name,
            predicted_1gw: p.predicted_points,
            ownership: p.selected_by_percent || 0,
          }));
        }

        setData(res);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelId]);

  return { data, isLoading, error };
}
