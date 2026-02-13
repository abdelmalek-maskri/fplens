import { TEAMS, TEAM_FULL, FIXTURES, FDR_BG, FDR_TEXT } from "../mocks/fixtures";

const _data = { teams: TEAMS, teamFull: TEAM_FULL, fixtures: FIXTURES, fdrBg: FDR_BG, fdrText: FDR_TEXT };

export function useFixtures() {
  return { data: _data, isLoading: false, error: null };
}
