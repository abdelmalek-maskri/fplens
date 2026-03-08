// ============================================================
// MOCK SQUAD — 15 players (same as MyTeam)
// Will be replaced with: GET /api/team/{fpl_id}
// ============================================================
export const mockSquad = [
  {
    element: 20,
    web_name: "Raya",
    position: "GK",
    team_name: "ARS",
    value: 5.5,
    predicted_points: 4.2,
    form: 4.8,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "CHE",
  },
  {
    element: 60,
    web_name: "Flekken",
    position: "GK",
    team_name: "BRE",
    value: 4.5,
    predicted_points: 3.6,
    form: 3.2,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "NFO",
  },
  {
    element: 15,
    web_name: "Alexander-Arnold",
    position: "DEF",
    team_name: "LIV",
    value: 7.1,
    predicted_points: 5.4,
    form: 6.1,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "EVE",
  },
  {
    element: 12,
    web_name: "Gabriel",
    position: "DEF",
    team_name: "ARS",
    value: 6.2,
    predicted_points: 5.1,
    form: 5.8,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "CHE",
  },
  {
    element: 30,
    web_name: "Saliba",
    position: "DEF",
    team_name: "ARS",
    value: 6.0,
    predicted_points: 4.8,
    form: 5.2,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "CHE",
  },
  {
    element: 61,
    web_name: "Mykolenko",
    position: "DEF",
    team_name: "EVE",
    value: 4.3,
    predicted_points: 3.1,
    form: 3.5,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "LIV",
  },
  {
    element: 3,
    web_name: "Salah",
    position: "MID",
    team_name: "LIV",
    value: 13.2,
    predicted_points: 6.8,
    form: 7.2,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "EVE",
  },
  {
    element: 7,
    web_name: "Palmer",
    position: "MID",
    team_name: "CHE",
    value: 9.5,
    predicted_points: 6.1,
    form: 9.2,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "ARS",
  },
  {
    element: 5,
    web_name: "Saka",
    position: "MID",
    team_name: "ARS",
    value: 10.1,
    predicted_points: 4.2,
    form: 6.5,
    status: "d",
    chance_of_playing: 75,
    opponent_name: "CHE",
  },
  {
    element: 40,
    web_name: "Mbeumo",
    position: "MID",
    team_name: "BRE",
    value: 7.8,
    predicted_points: 4.5,
    form: 5.6,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "NFO",
  },
  {
    element: 62,
    web_name: "Wharton",
    position: "MID",
    team_name: "CRY",
    value: 4.8,
    predicted_points: 2.8,
    form: 2.9,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "MUN",
  },
  {
    element: 2,
    web_name: "Haaland",
    position: "FWD",
    team_name: "MCI",
    value: 15.3,
    predicted_points: 7.2,
    form: 8.8,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "BOU",
  },
  {
    element: 50,
    web_name: "Isak",
    position: "FWD",
    team_name: "NEW",
    value: 8.8,
    predicted_points: 5.5,
    form: 7.0,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "WOL",
  },
  {
    element: 10,
    web_name: "Watkins",
    position: "FWD",
    team_name: "AVL",
    value: 9.0,
    predicted_points: 1.8,
    form: 5.4,
    status: "i",
    chance_of_playing: 0,
    opponent_name: "NFO",
  },
  {
    element: 63,
    web_name: "Archer",
    position: "FWD",
    team_name: "SOU",
    value: 4.5,
    predicted_points: 2.1,
    form: 1.8,
    status: "a",
    chance_of_playing: 100,
    opponent_name: "TOT",
  },
];

// ============================================================
// VALID FORMATIONS — all legal FPL starting formations
// ============================================================
export const FORMATIONS = [
  [3, 4, 3],
  [3, 5, 2],
  [4, 3, 3],
  [4, 4, 2],
  [4, 5, 1],
  [5, 3, 2],
  [5, 4, 1],
];

// ============================================================
// PRE-SOLVED MOCK — matches backend /best-xi response shape
// Best formation from this squad: 4-4-2 (56.9 pts)
// Captain: Haaland (7.2), Vice: Salah (6.8)
// ============================================================
const _available = mockSquad.filter((p) => p.status !== "i" && p.chance_of_playing > 0);
const _gks = _available
  .filter((p) => p.position === "GK")
  .sort((a, b) => b.predicted_points - a.predicted_points);
const _defs = _available
  .filter((p) => p.position === "DEF")
  .sort((a, b) => b.predicted_points - a.predicted_points);
const _mids = _available
  .filter((p) => p.position === "MID")
  .sort((a, b) => b.predicted_points - a.predicted_points);
const _fwds = _available
  .filter((p) => p.position === "FWD")
  .sort((a, b) => b.predicted_points - a.predicted_points);

// 4-4-2 is optimal for this mock data
const _starters = [_gks[0], ..._defs.slice(0, 4), ..._mids.slice(0, 4), ..._fwds.slice(0, 2)];
const _starterIds = new Set(_starters.map((p) => p.element));
const _benchGK = mockSquad.filter((p) => p.position === "GK" && !_starterIds.has(p.element));
const _benchOutfield = mockSquad
  .filter((p) => p.position !== "GK" && !_starterIds.has(p.element))
  .sort((a, b) => b.predicted_points - a.predicted_points);
const _sorted = [..._starters].sort((a, b) => b.predicted_points - a.predicted_points);

export const mockBestXI = {
  starters: _starters,
  bench: [..._benchGK, ..._benchOutfield],
  captainId: _sorted[0].element,
  viceId: _sorted[1].element,
  formation: "4-4-2",
  totalPoints: _starters.reduce((s, p) => s + p.predicted_points, 0),
  totalWithCaptain:
    _starters.reduce((s, p) => s + p.predicted_points, 0) + _sorted[0].predicted_points,
};
