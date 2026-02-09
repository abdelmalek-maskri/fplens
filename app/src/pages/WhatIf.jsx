import { useState, useMemo } from "react";
import { FDR_COLORS, POSITION_COLORS } from "../lib/constants";
import TeamBadge from "../components/TeamBadge";

// ============================================================
// MOCK DATA — player pool for scenario simulation
// Will be replaced with: GET /api/predictions/all
// ============================================================
const players = [
  { id: 2, web_name: "Haaland", team: "MCI", position: "FWD", value: 15.3, predicted_points: 7.2, form: 8.8, selected_by_percent: 85.2, opponent: "BOU", opponent_fdr: 2 },
  { id: 3, web_name: "Salah", team: "LIV", position: "MID", value: 13.2, predicted_points: 6.8, form: 7.2, selected_by_percent: 52.1, opponent: "EVE", opponent_fdr: 2 },
  { id: 7, web_name: "Palmer", team: "CHE", position: "MID", value: 9.5, predicted_points: 6.1, form: 9.2, selected_by_percent: 45.8, opponent: "ARS", opponent_fdr: 5 },
  { id: 50, web_name: "Isak", team: "NEW", position: "FWD", value: 8.8, predicted_points: 5.5, form: 7.0, selected_by_percent: 24.3, opponent: "WOL", opponent_fdr: 2 },
  { id: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", value: 7.1, predicted_points: 5.4, form: 6.1, selected_by_percent: 28.9, opponent: "EVE", opponent_fdr: 2 },
  { id: 12, web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2, predicted_points: 5.1, form: 5.8, selected_by_percent: 31.2, opponent: "CHE", opponent_fdr: 4 },
  { id: 20, web_name: "Raya", team: "ARS", position: "GK", value: 5.5, predicted_points: 4.2, form: 4.8, selected_by_percent: 18.2, opponent: "CHE", opponent_fdr: 4 },
  { id: 40, web_name: "Mbeumo", team: "BRE", position: "MID", value: 7.8, predicted_points: 4.5, form: 5.6, selected_by_percent: 19.5, opponent: "NFO", opponent_fdr: 2 },
  { id: 5, web_name: "Saka", team: "ARS", position: "MID", value: 10.1, predicted_points: 4.2, form: 6.5, selected_by_percent: 38.4, opponent: "CHE", opponent_fdr: 4 },
  { id: 30, web_name: "Son", team: "TOT", position: "MID", value: 9.8, predicted_points: 4.0, form: 4.5, selected_by_percent: 10.3, opponent: "LEI", opponent_fdr: 2 },
  { id: 35, web_name: "Solanke", team: "TOT", position: "FWD", value: 7.5, predicted_points: 3.5, form: 3.8, selected_by_percent: 8.1, opponent: "LEI", opponent_fdr: 2 },
  { id: 45, web_name: "Gordon", team: "NEW", position: "MID", value: 7.3, predicted_points: 4.3, form: 6.2, selected_by_percent: 15.8, opponent: "WOL", opponent_fdr: 2 },
];

// ============================================================
// SCENARIO DEFINITIONS
// FPL scoring: https://fantasy.premierleague.com/help/rules
// ============================================================
const SCENARIOS = [
  {
    id: "hat_trick",
    label: "Hat-trick",
    description: "Player scores 3 goals",
    icon: "G",
    calcPoints: (p) => {
      const goalPts = p.position === "FWD" ? 4 : p.position === "MID" ? 5 : 6;
      return (goalPts * 3) + 3; // 3 goals + hat-trick bonus
    },
  },
  {
    id: "brace",
    label: "Brace (2 goals)",
    description: "Player scores 2 goals",
    icon: "GG",
    calcPoints: (p) => {
      const goalPts = p.position === "FWD" ? 4 : p.position === "MID" ? 5 : 6;
      return goalPts * 2;
    },
  },
  {
    id: "goal_assist",
    label: "Goal + Assist",
    description: "Player scores 1 and assists 1",
    icon: "GA",
    calcPoints: (p) => {
      const goalPts = p.position === "FWD" ? 4 : p.position === "MID" ? 5 : 6;
      return goalPts + 3; // goal + assist
    },
  },
  {
    id: "clean_sheet",
    label: "Clean Sheet",
    description: "Team keeps a clean sheet (60+ mins)",
    icon: "CS",
    calcPoints: (p) => {
      if (p.position === "GK" || p.position === "DEF") return 4;
      if (p.position === "MID") return 1;
      return 0;
    },
  },
  {
    id: "blank",
    label: "Blank (2 pts)",
    description: "Player plays 60+ mins, no returns",
    icon: "—",
    calcPoints: () => 2,
  },
  {
    id: "one_pointer",
    label: "Sub appearance",
    description: "Player comes off the bench (<60 mins)",
    icon: "S",
    calcPoints: () => 1,
  },
  {
    id: "red_card",
    label: "Red Card",
    description: "Player gets sent off",
    icon: "R",
    calcPoints: () => -2,
  },
];


// ============================================================
// MAIN PAGE
// ============================================================
export default function WhatIf() {
  const [selectedPlayer, setSelectedPlayer] = useState(2);
  const [selectedScenario, setSelectedScenario] = useState("hat_trick");
  const [isCaptain, setIsCaptain] = useState(false);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(true);

  const player = players.find((p) => p.id === selectedPlayer);
  const scenario = SCENARIOS.find((s) => s.id === selectedScenario);

  const scenarioPoints = useMemo(() => {
    if (!player || !scenario) return 0;
    const base = scenario.calcPoints(player);
    return isCaptain ? base * 2 : base;
  }, [player, scenario, isCaptain]);

  const pointsDelta = useMemo(() => {
    if (!player) return 0;
    return scenarioPoints - player.predicted_points;
  }, [scenarioPoints, player]);

  // Rank impact estimation (simplified)
  const rankImpact = useMemo(() => {
    if (!player) return 0;
    const eo = player.selected_by_percent / 100;
    // If you own them and others don't: positive delta helps
    // If everyone owns them: no rank benefit
    return pointsDelta * (1 - eo);
  }, [pointsDelta, player]);

  const filteredPlayers = useMemo(() => {
    if (!search) return players;
    const q = search.toLowerCase();
    return players.filter(
      (p) => p.web_name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="space-y-6 stagger">
      <div className="grid grid-cols-[1fr_1fr] gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          {/* Player Selector */}
          <div className="card p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-3">
              Select Player
            </p>
            <input
              type="text"
              placeholder="Search player or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-brand-500 mb-3"
            />
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filteredPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPlayer(p.id); setShowResults(true); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    p.id === selectedPlayer
                      ? "bg-brand-600/20 border border-brand-500/30"
                      : "hover:bg-surface-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TeamBadge team={p.team} size="sm" />
                    <div>
                      <p className="text-sm text-surface-100">{p.web_name}</p>
                      <p className="text-xs text-surface-500">{p.position} · £{p.value}m</p>
                    </div>
                  </div>
                  <span className="text-xs text-surface-500">
                    {p.predicted_points.toFixed(1)} pts
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Scenario Selector */}
          <div className="card p-5">
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-3">
              Select Scenario
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedScenario(s.id); setShowResults(true); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors border ${
                    s.id === selectedScenario
                      ? "border-brand-500/50 bg-brand-600/15"
                      : "border-surface-700 bg-surface-800/30 hover:border-surface-600"
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-2xs font-bold ${
                    s.id === selectedScenario ? "bg-brand-500/30 text-brand-300" : "bg-surface-700 text-surface-400"
                  }`}>
                    {s.icon}
                  </span>
                  <div>
                    <p className="text-sm text-surface-200">{s.label}</p>
                    <p className="text-2xs text-surface-500">{s.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Captain Toggle */}
            <div className="mt-4 flex items-center justify-between p-3 bg-surface-800/30 rounded-lg border border-surface-700">
              <div>
                <p className="text-sm text-surface-200">Captain</p>
                <p className="text-xs text-surface-500">Double the scenario points</p>
              </div>
              <button
                onClick={() => setIsCaptain(!isCaptain)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isCaptain ? "bg-brand-600" : "bg-surface-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    isCaptain ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {player && scenario && showResults && (
            <>
              {/* Scenario Result */}
              <div className="p-6 border-b border-surface-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <TeamBadge team={player.team} size="lg" />
                    <div>
                      <p className="text-lg font-bold text-surface-100">
                        {player.web_name}
                      </p>
                      <p className="text-xs text-surface-500">
                        {player.position} · vs {player.opponent}
                        {isCaptain && " · (C)"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded text-2xs font-bold ${
                      FDR_COLORS[player.opponent_fdr]?.bg
                    } ${FDR_COLORS[player.opponent_fdr]?.text}`}
                  >
                    {player.opponent_fdr}
                  </span>
                </div>

                {/* Points Comparison */}
                <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800 mb-5">
                  <div>
                    <span className="text-xl font-bold text-surface-300">{player.predicted_points.toFixed(1)}</span>
                    <span className="text-xs text-surface-500 ml-1.5">predicted</span>
                  </div>
                  <div className="w-px h-5 bg-surface-700" />
                  <div>
                    <span className="text-xl font-bold text-brand-400">{scenarioPoints}</span>
                    <span className="text-xs text-surface-500 ml-1.5">scenario</span>
                  </div>
                  <div className="w-px h-5 bg-surface-700" />
                  <div>
                    <span className={`text-xl font-bold ${
                      pointsDelta > 0 ? "text-success-400" : pointsDelta < 0 ? "text-danger-400" : "text-surface-400"
                    }`}>
                      {pointsDelta > 0 ? "+" : ""}{pointsDelta.toFixed(1)}
                    </span>
                    <span className="text-xs text-surface-500 ml-1.5">delta</span>
                  </div>
                </div>

                {/* Scenario Breakdown */}
                <div className="p-3 bg-surface-800/20 rounded-lg border border-surface-800 mb-4">
                  <p className="text-xs font-medium text-surface-400 uppercase tracking-wide mb-2">
                    Scenario Breakdown
                  </p>
                  <p className="text-sm text-surface-300">
                    <strong className="text-surface-100">{scenario.label}</strong>
                    {" → "}
                    {scenario.calcPoints(player)} base points
                    {isCaptain && ` × 2 (captain) = ${scenarioPoints}`}
                  </p>
                </div>

                {/* Rank Impact */}
                <div className="p-3 bg-surface-800/20 rounded-lg border border-surface-800">
                  <p className="text-xs font-medium text-surface-400 uppercase tracking-wide mb-2">
                    Estimated Rank Impact
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-surface-300">
                        Ownership: <strong className="text-surface-100">{player.selected_by_percent}%</strong>
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {player.selected_by_percent > 50
                          ? "Template pick -- limited upside, costly to miss"
                          : player.selected_by_percent > 20
                          ? "Mid-range ownership -- moderate rank swing"
                          : "Differential -- large rank gain if owned"
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        rankImpact > 0 ? "text-success-400" : rankImpact < 0 ? "text-danger-400" : "text-surface-400"
                      }`}>
                        {rankImpact > 0 ? "+" : ""}{rankImpact.toFixed(1)}
                      </p>
                      <p className="text-2xs text-surface-500">effective pts gain</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Player Quick Compare */}
              <div className="mt-8">
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {[...players]
                    .map((p) => ({
                      ...p,
                      scenarioPts: isCaptain ? scenario.calcPoints(p) * 2 : scenario.calcPoints(p),
                    }))
                    .sort((a, b) => b.scenarioPts - a.scenarioPts)
                    .map((p) => {
                      const delta = p.scenarioPts - p.predicted_points;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between py-1.5 px-2 rounded ${
                            p.id === selectedPlayer ? "bg-brand-600/10" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-surface-300 w-24 truncate">{p.web_name}</span>
                            <span className={`text-xs ${POSITION_COLORS[p.position]}`}>{p.position}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-data tabular-nums text-surface-400 w-12 text-right">
                              {p.predicted_points.toFixed(1)}
                            </span>
                            <span className="text-surface-600">→</span>
                            <span className="text-sm font-bold text-brand-400 w-8 text-right">
                              {p.scenarioPts}
                            </span>
                            <span className={`text-xs font-bold w-12 text-right ${
                              delta > 0 ? "text-success-400" : delta < 0 ? "text-danger-400" : "text-surface-400"
                            }`}>
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}

          {(!player || !scenario) && (
            <div className="p-12 text-center">
              <p className="text-surface-500">Select a player and scenario</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
