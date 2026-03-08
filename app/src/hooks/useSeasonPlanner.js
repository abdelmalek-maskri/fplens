import { playerPool, BUDGET, POS_LIMITS, MAX_PER_TEAM } from "../mocks/seasonPlanner";

const _data = { playerPool, budget: BUDGET, posLimits: POS_LIMITS, maxPerTeam: MAX_PER_TEAM };

export function useSeasonPlanner() {
  return { data: _data, isLoading: false, error: null };
}
