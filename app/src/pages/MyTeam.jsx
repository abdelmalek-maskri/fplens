import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import Jersey from "../components/Jersey";
import StatusBadge from "../components/StatusBadge";
import TeamBadge from "../components/TeamBadge";
import FdrBadge from "../components/FdrBadge";

// ============================================================
// MOCK DATA - matches real FPL API structure for user's team
// Will be replaced with: GET /api/team/{fpl_id}
// ============================================================

const FDR_MAP = {
  ARS: 5, AVL: 3, BOU: 2, BRE: 2, BHA: 3, CHE: 4, CRY: 2, EVE: 2,
  FUL: 2, IPS: 1, LEI: 2, LIV: 5, MCI: 4, MUN: 3, NEW: 3, NFO: 2,
  SOU: 1, TOT: 3, WHU: 2, WOL: 2,
};

const mockUserTeam = {
  manager: "Abdelmalek Maskri",
  teamName: "ML FC",
  overallRank: 48201,
  gameweekPoints: 62,
  totalPoints: 1284,
  budget: 2.3,
  freeTransfers: 1,
  picks: [
    // Starting 11
    { element: 20, web_name: "Raya", position: "GK", team_name: "ARS", value: 5.5, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.2, form: 4.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "CHE", selected_by_percent: 18.2, selling_price: 5.3 },
    { element: 15, web_name: "Alexander-Arnold", position: "DEF", team_name: "LIV", value: 7.1, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 5.4, form: 6.1, status: "a", chance_of_playing: 100, news: "", opponent_name: "EVE", selected_by_percent: 28.9, selling_price: 7.0 },
    { element: 12, web_name: "Gabriel", position: "DEF", team_name: "ARS", value: 6.2, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 5.1, form: 5.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "CHE", selected_by_percent: 31.2, selling_price: 6.0 },
    { element: 30, web_name: "Saliba", position: "DEF", team_name: "ARS", value: 6.0, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.8, form: 5.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "CHE", selected_by_percent: 22.1, selling_price: 5.8 },
    { element: 3, web_name: "Salah", position: "MID", team_name: "LIV", value: 13.2, multiplier: 2, is_captain: true, is_vice: false, predicted_points: 6.8, form: 7.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "EVE", selected_by_percent: 52.1, selling_price: 13.0 },
    { element: 7, web_name: "Palmer", position: "MID", team_name: "CHE", value: 9.5, multiplier: 1, is_captain: false, is_vice: true, predicted_points: 6.1, form: 9.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "ARS", selected_by_percent: 45.8, selling_price: 9.3 },
    { element: 5, web_name: "Saka", position: "MID", team_name: "ARS", value: 10.1, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.2, form: 6.5, status: "d", chance_of_playing: 75, news: "Muscle injury - 75% chance of playing", opponent_name: "CHE", selected_by_percent: 38.4, selling_price: 9.9 },
    { element: 40, web_name: "Mbeumo", position: "MID", team_name: "BRE", value: 7.8, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.5, form: 5.6, status: "a", chance_of_playing: 100, news: "", opponent_name: "NFO", selected_by_percent: 19.5, selling_price: 7.6 },
    { element: 2, web_name: "Haaland", position: "FWD", team_name: "MCI", value: 15.3, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 7.2, form: 8.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "BOU", selected_by_percent: 85.2, selling_price: 15.1 },
    { element: 50, web_name: "Isak", position: "FWD", team_name: "NEW", value: 8.8, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 5.5, form: 7.0, status: "a", chance_of_playing: 100, news: "", opponent_name: "WOL", selected_by_percent: 24.3, selling_price: 8.6 },
    { element: 10, web_name: "Watkins", position: "FWD", team_name: "AVL", value: 9.0, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 1.8, form: 5.4, status: "i", chance_of_playing: 0, news: "Hamstring injury - Expected back in 2-3 weeks", opponent_name: "NFO", selected_by_percent: 22.3, selling_price: 8.8 },
    // Bench
    { element: 60, web_name: "Flekken", position: "GK", team_name: "BRE", value: 4.5, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 3.6, form: 3.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "NFO", selected_by_percent: 5.1, selling_price: 4.3 },
    { element: 61, web_name: "Mykolenko", position: "DEF", team_name: "EVE", value: 4.3, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 3.1, form: 3.5, status: "a", chance_of_playing: 100, news: "", opponent_name: "LIV", selected_by_percent: 4.2, selling_price: 4.1 },
    { element: 62, web_name: "Wharton", position: "MID", team_name: "CRY", value: 4.8, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 2.8, form: 2.9, status: "a", chance_of_playing: 100, news: "", opponent_name: "MUN", selected_by_percent: 3.8, selling_price: 4.6 },
    { element: 63, web_name: "Archer", position: "FWD", team_name: "SOU", value: 4.5, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 2.1, form: 1.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "TOT", selected_by_percent: 1.2, selling_price: 4.3 },
  ],
};

const mockTransferSuggestions = [
  {
    out: { element: 10, web_name: "Watkins", team_name: "AVL", position: "FWD", predicted_points: 1.8, status: "i", value: 9.0, selling_price: 8.8 },
    in: { element: 70, web_name: "Cunha", team_name: "WOL", position: "FWD", predicted_points: 5.8, status: "a", value: 7.2 },
    points_gain: 4.0,
    cost_saving: 1.6,
  },
  {
    out: { element: 5, web_name: "Saka", team_name: "ARS", position: "MID", predicted_points: 4.2, status: "d", value: 10.1, selling_price: 9.9 },
    in: { element: 71, web_name: "Son", team_name: "TOT", position: "MID", predicted_points: 5.8, status: "a", value: 10.0 },
    points_gain: 1.6,
    cost_saving: -0.1,
  },
];


// ============================================================
// PLAYER CARD ON PITCH
// ============================================================
const PitchPlayerCard = ({ player, onClick }) => (
  <div
    className={`flex flex-col items-center gap-0.5 transition-opacity ${
      player.status === "i" ? "opacity-50" : ""
    }`}
  >
    <Jersey
      teamName={player.team_name}
      position={player.position}
      isCaptain={player.is_captain}
      isVice={player.is_vice}
      status={player.status}
    />
    <div
      className="bg-white/95 px-2.5 py-0.5 rounded text-[11px] font-bold text-gray-900 text-center min-w-[72px] max-w-[100px] truncate shadow-sm cursor-pointer hover:bg-white transition-colors"
      onClick={() => onClick(player.element)}
    >
      {player.web_name}
    </div>
    <div className="bg-gray-900/80 backdrop-blur-sm px-2 py-0.5 rounded text-2xs text-center whitespace-nowrap">
      <span className="text-emerald-400 font-semibold">
        {player.predicted_points.toFixed(1)}
      </span>
      <span className="text-gray-400 mx-0.5">·</span>
      <span className="text-gray-300">{player.opponent_name}</span>
    </div>
  </div>
);

// ============================================================
// PITCH VIEW COMPONENT
// ============================================================
const PitchView = ({ starters, bench, onPlayerClick }) => {
  const gk = starters.filter((p) => p.position === "GK");
  const def = starters.filter((p) => p.position === "DEF");
  const mid = starters.filter((p) => p.position === "MID");
  const fwd = starters.filter((p) => p.position === "FWD");

  return (
    <div className="card overflow-hidden">
      {/* The pitch */}
      <div className="relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <pattern id="grass-myteam" width="100%" height="90" patternUnits="userSpaceOnUse">
              <rect width="100%" height="45" fill="#1b7a35" />
              <rect y="45" width="100%" height="45" fill="#1a7030" />
            </pattern>
            <filter id="grassNoise-myteam">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
              <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
              <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grass-myteam)" />
          <rect width="100%" height="100%" fill="url(#grass-myteam)" opacity="0.3" filter="url(#grassNoise-myteam)" />
        </svg>

        {/* Pitch markings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-[16px] border-2 border-white/20 rounded-[3px]" />
          <div className="absolute left-[16px] right-[16px] top-1/2 h-[2px] bg-white/20" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full border-2 border-white/20" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/25" />
          <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-b-2 border-l-2 border-r-2 border-white/15 rounded-b-[2px]" />
          <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-b-2 border-l-2 border-r-2 border-white/12 rounded-b-[2px]" />
          <div className="absolute top-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-b-2 border-white/10 rounded-b-full" />
          <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-t-2 border-l-2 border-r-2 border-white/15 rounded-t-[2px]" />
          <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-t-2 border-l-2 border-r-2 border-white/12 rounded-t-[2px]" />
          <div className="absolute bottom-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-t-2 border-white/10 rounded-t-full" />
          <div className="absolute top-[16px] left-[16px] w-5 h-5 border-r-2 border-b-2 border-white/10 rounded-br-full" />
          <div className="absolute top-[16px] right-[16px] w-5 h-5 border-l-2 border-b-2 border-white/10 rounded-bl-full" />
          <div className="absolute bottom-[16px] left-[16px] w-5 h-5 border-r-2 border-t-2 border-white/10 rounded-tr-full" />
          <div className="absolute bottom-[16px] right-[16px] w-5 h-5 border-l-2 border-t-2 border-white/10 rounded-tl-full" />
        </div>

        {/* Player formation rows */}
        <div className="relative z-10 flex flex-col justify-around py-8 px-4" style={{ minHeight: "560px" }}>
          <div className="flex justify-center gap-8">
            {gk.map((p) => <PitchPlayerCard key={p.element} player={p} onClick={onPlayerClick} />)}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {def.map((p) => <PitchPlayerCard key={p.element} player={p} onClick={onPlayerClick} />)}
          </div>
          <div className="flex justify-center gap-3 sm:gap-5 lg:gap-8">
            {mid.map((p) => <PitchPlayerCard key={p.element} player={p} onClick={onPlayerClick} />)}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {fwd.map((p) => <PitchPlayerCard key={p.element} player={p} onClick={onPlayerClick} />)}
          </div>
        </div>
      </div>

      {/* Bench */}
      <div className="bg-surface-800/60 px-4 py-4 border-t border-surface-700">
        <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-4">
          Substitutes
        </p>
        <div className="flex justify-around">
          {bench.map((p, idx) => (
            <div key={p.element} className="flex flex-col items-center gap-0.5">
              <span className="text-2xs text-surface-500 font-medium mb-1">
                {idx + 1}
              </span>
              <Jersey
                teamName={p.team_name}
                position={p.position}
                isCaptain={false}
                isVice={false}
                status={p.status}
              />
              <div
                className="bg-surface-700/80 px-2 py-0.5 rounded-sm text-[11px] font-semibold text-surface-300 text-center min-w-[72px] max-w-[100px] truncate cursor-pointer hover:text-brand-400 transition-colors"
                onClick={() => onPlayerClick(p.element)}
              >
                {p.web_name}
              </div>
              <div className="text-2xs text-surface-500 whitespace-nowrap">
                {p.predicted_points.toFixed(1)} · {p.opponent_name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// ============================================================
// FPL ID HELP — collapsible details
// ============================================================
const FplIdHelp = () => (
  <details className="text-surface-400">
    <summary className="cursor-pointer text-sm text-surface-400 hover:text-surface-200 transition-colors">
      How to find your FPL ID
    </summary>
    <div className="mt-3 space-y-0 text-sm text-surface-400">
      <div className="border-l-2 border-surface-700 pl-3 py-2.5">
        <p className="text-surface-200 font-medium mb-2">Website</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Log in at <span className="font-mono text-surface-300">fantasy.premierleague.com</span></li>
          <li>Click <span className="text-surface-200">Points</span> or <span className="text-surface-200">My Team</span></li>
          <li>Copy the number after <span className="font-mono text-brand-400">/entry/</span> in the URL</li>
        </ol>
        <div className="mt-2.5 bg-surface-800 rounded px-3 py-2 font-mono text-xs text-surface-500 inline-block">
          fantasy.premierleague.com/entry/<span className="text-brand-400 font-semibold">1234567</span>/event/20
        </div>
      </div>
      <div className="border-l-2 border-surface-700 pl-3 py-2.5">
        <p className="text-surface-200 font-medium mb-2">Mobile App</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open the FPL app → <span className="text-surface-200">Points</span> tab</li>
          <li>Tap <span className="text-surface-200">⋯</span> (top-right) → <span className="text-surface-200">Share Team Link</span></li>
          <li>The number in the shared link is your ID</li>
        </ol>
      </div>
    </div>
  </details>
);

// ============================================================
// MY TEAM PAGE
// ============================================================
export default function MyTeam() {
  const navigate = useNavigate();
  const [fplId, setFplId] = useState("");
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [team, setTeam] = useState(null);
  const [viewMode, setViewMode] = useState("pitch"); // "pitch" | "table"

  const handleLoadTeam = (e) => {
    e.preventDefault();
    setTeam(mockUserTeam);
    setTeamLoaded(true);
  };

  const handlePlayerClick = (elementId) => {
    navigate(`/player/${elementId}`);
  };

  // ---- FPL ID input screen ----
  if (!teamLoaded) {
    return (
      <div className="max-w-sm mx-auto mt-16 space-y-5">
        <form onSubmit={handleLoadTeam} className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={fplId}
            onChange={(e) => setFplId(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter your FPL Team ID"
            className="w-full bg-surface-800 border border-surface-700 rounded pl-9 pr-20 py-2.5 text-surface-100 font-data tabular-nums placeholder:text-surface-600 focus:border-brand-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!fplId}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded bg-brand-600 text-white text-sm font-medium transition-colors hover:bg-brand-500 disabled:opacity-40 disabled:pointer-events-none"
          >
            Load
          </button>
        </form>
        <FplIdHelp />
      </div>
    );
  }

  // ---- Team loaded ----
  const starters = team.picks.filter((p) => p.multiplier >= 1);
  const bench = team.picks.filter((p) => p.multiplier === 0);

  // Captain recommendations based on predicted points
  const sortedByPredicted = [...starters].sort((a, b) => b.predicted_points - a.predicted_points);
  const recommendedCaptain = sortedByPredicted[0];
  const recommendedVice = sortedByPredicted[1];
  const currentCaptain = starters.find((p) => p.is_captain);
  const captainMismatch = recommendedCaptain && currentCaptain && recommendedCaptain.element !== currentCaptain.element;

  const totalPredicted = starters.reduce(
    (sum, p) => sum + p.predicted_points * p.multiplier,
    0
  );

  // Alerts: injuries, doubtful, tough fixtures, bench outscoring starters
  const injuredStarters = starters.filter((p) => p.status === "i");
  const doubtfulStarters = starters.filter((p) => p.status === "d");
  const toughFixtureStarters = starters.filter(
    (p) => p.status !== "i" && FDR_MAP[p.opponent_name] >= 4
  );
  const benchOutscoring = bench.filter((bp) =>
    starters.some(
      (sp) =>
        sp.position === bp.position &&
        sp.status === "a" &&
        bp.predicted_points > sp.predicted_points
    )
  );

  const hasAlerts = injuredStarters.length > 0 || doubtfulStarters.length > 0 || toughFixtureStarters.length > 0 || benchOutscoring.length > 0;

  const formation = `${starters.filter((p) => p.position === "DEF").length}-${starters.filter((p) => p.position === "MID").length}-${starters.filter((p) => p.position === "FWD").length}`;

  return (
    <div className="space-y-6 stagger">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/optimal-xi")}
            className="btn-ghost text-sm"
          >
            Optimal XI
          </button>
          <button
            onClick={() => navigate("/transfers")}
            className="btn-ghost text-sm"
          >
            Plan Transfers
          </button>
        </div>
        <button
          onClick={() => setTeamLoaded(false)}
          className="btn-ghost text-sm"
        >
          Change Team
        </button>
      </div>

      {/* Team Overview — horizontal stat strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-xl font-bold text-surface-100 font-data tabular-nums">{team.overallRank.toLocaleString()}</span>
          <span className="text-xs text-surface-500 ml-1.5">rank</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-brand-400 font-data tabular-nums">{totalPredicted.toFixed(1)}</span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-sm font-semibold text-surface-100">{formation}</span>
          <span className="text-xs text-surface-500 ml-1.5">formation</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-surface-100 font-data tabular-nums">£{team.budget}m</span>
          <span className="text-xs text-surface-500 ml-1.5">ITB</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-surface-100 font-data tabular-nums">{team.freeTransfers}</span>
          <span className="text-xs text-surface-500 ml-1.5">FT{team.freeTransfers !== 1 ? "s" : ""}</span>
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center border border-surface-700 rounded overflow-hidden">
          <button
            onClick={() => setViewMode("pitch")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "pitch" ? "bg-surface-700 text-surface-100" : "text-surface-500 hover:text-surface-300"}`}
          >
            Pitch
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-surface-700 text-surface-100" : "text-surface-500 hover:text-surface-300"}`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Alerts — left-border list */}
      {hasAlerts && (
        <div className="space-y-0.5">
          {injuredStarters.map((p) => (
            <div key={`inj-${p.element}`} className="flex items-center gap-2 py-1 pl-3 border-l-2 border-danger-500">
              <span className="text-sm text-surface-300">
                <span className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors" onClick={() => handlePlayerClick(p.element)}>{p.web_name}</span>
                {" "}<span className="text-surface-500">{p.team_name}</span>
                {" — "}{p.news || "Injured"}
              </span>
            </div>
          ))}
          {doubtfulStarters.map((p) => (
            <div key={`dbt-${p.element}`} className="flex items-center gap-2 py-1 pl-3 border-l-2 border-warning-500">
              <span className="text-sm text-surface-300">
                <span className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors" onClick={() => handlePlayerClick(p.element)}>{p.web_name}</span>
                {" "}<span className="text-surface-500">{p.team_name}</span>
                {" — "}{p.news || "Doubtful"}
              </span>
            </div>
          ))}
          {toughFixtureStarters.map((p) => (
            <div key={`fdr-${p.element}`} className="flex items-center gap-2 py-1 pl-3 border-l-2 border-surface-600">
              <span className="text-sm text-surface-300">
                <span className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors" onClick={() => handlePlayerClick(p.element)}>{p.web_name}</span>
                {" — tough fixture vs "}<span className="text-surface-200">{p.opponent_name}</span>
                {` (FDR ${FDR_MAP[p.opponent_name]})`}
              </span>
            </div>
          ))}
          {benchOutscoring.map((p) => (
            <div key={`bench-${p.element}`} className="flex items-center gap-2 py-1 pl-3 border-l-2 border-brand-500">
              <span className="text-sm text-surface-300">
                <span className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors" onClick={() => handlePlayerClick(p.element)}>{p.web_name}</span>
                {" "}<span className="text-surface-500">(bench)</span>
                {" — predicted "}<span className="text-brand-400 font-data">{p.predicted_points.toFixed(1)}</span>{" pts, outscoring a starter"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pitch or Table View */}
      {viewMode === "pitch" ? (
        <PitchView starters={starters} bench={bench} onPlayerClick={handlePlayerClick} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="table-header text-left py-2.5 px-3 w-8"></th>
                <th className="table-header text-left py-2.5 px-3">Player</th>
                <th className="table-header text-left py-2.5 px-3">Predicted</th>
                <th className="table-header text-left py-2.5 px-3">Form</th>
                <th className="table-header text-left py-2.5 px-3">Fixture</th>
                <th className="table-header text-left py-2.5 px-3">Value</th>
                <th className="table-header text-left py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Starters sorted by position then predicted */}
              {[...starters]
                .sort((a, b) => {
                  const posOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
                  return posOrder[a.position] - posOrder[b.position] || b.predicted_points - a.predicted_points;
                })
                .map((p) => (
                  <tr key={p.element} className="border-t border-surface-800/60 hover:bg-surface-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className={`w-1 h-8 rounded-full ${p.is_captain ? "bg-warning-400" : p.is_vice ? "bg-surface-400" : "bg-brand-500/40"}`} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <TeamBadge team={p.team_name} />
                        <div>
                          <p
                            className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                            onClick={() => handlePlayerClick(p.element)}
                          >
                            {p.web_name}
                          </p>
                          <p className="text-xs text-surface-500">
                            <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                            {" · "}{p.team_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-base font-semibold font-data tabular-nums ${p.predicted_points >= 6 ? "text-brand-400" : "text-surface-100"}`}>
                        {p.predicted_points.toFixed(1)}
                      </span>
                      {p.is_captain && <span className="text-xs text-warning-400 ml-1">×2</span>}
                    </td>
                    <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">{p.form}</td>
                    <td className="py-2.5 px-3">
                      <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                    </td>
                    <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">£{p.value}m</td>
                    <td className="py-2.5 px-3">
                      {p.status !== "a" ? (
                        <StatusBadge status={p.status} chance={p.chance_of_playing} compact />
                      ) : (
                        <span className="text-xs text-surface-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              {/* Bench divider */}
              <tr>
                <td colSpan={7} className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-surface-700" />
                    <span className="text-2xs text-surface-500 uppercase tracking-wider">Bench</span>
                    <div className="h-px flex-1 bg-surface-700" />
                  </div>
                </td>
              </tr>
              {/* Bench players */}
              {bench.map((p, idx) => (
                <tr key={p.element} className="border-t border-surface-800/60 opacity-60">
                  <td className="py-2.5 px-3 text-xs text-surface-600 font-data">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <TeamBadge team={p.team_name} />
                      <div>
                        <p
                          className="font-medium text-surface-300 hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={() => handlePlayerClick(p.element)}
                        >
                          {p.web_name}
                        </p>
                        <p className="text-xs text-surface-600">
                          <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                          {" · "}{p.team_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">{p.predicted_points.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">{p.form}</td>
                  <td className="py-2.5 px-3">
                    <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                  </td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">£{p.value}m</td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs text-surface-600">Bench {idx + 1}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Captain Recommendation */}
      <div className="flex items-start gap-4 py-4 border-t border-surface-800">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-brand-400 uppercase tracking-wide">Recommended Captain</span>
            {captainMismatch && (
              <span className="badge bg-brand-500/20 text-brand-400">Change suggested</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p
              className="font-semibold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
              onClick={() => handlePlayerClick(recommendedCaptain.element)}
            >
              {recommendedCaptain.web_name}
            </p>
            <span className="text-xs text-surface-500">{recommendedCaptain.position} · {recommendedCaptain.team_name} vs {recommendedCaptain.opponent_name}</span>
            <span className="text-sm font-bold text-surface-100 font-data tabular-nums ml-auto">
              {recommendedCaptain.predicted_points.toFixed(1)} pts
              <span className="text-xs text-surface-500 font-normal ml-1">×2 = {(recommendedCaptain.predicted_points * 2).toFixed(1)}</span>
            </span>
          </div>
        </div>
        <div className="w-px h-10 bg-surface-700 hidden sm:block" />
        <div className="flex-1 hidden sm:block">
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">Vice Captain</span>
          <div className="flex items-center gap-3 mt-1">
            <p
              className="font-semibold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
              onClick={() => handlePlayerClick(recommendedVice.element)}
            >
              {recommendedVice.web_name}
            </p>
            <span className="text-xs text-surface-500">{recommendedVice.position} · {recommendedVice.team_name} vs {recommendedVice.opponent_name}</span>
            <span className="text-sm font-bold text-surface-100 font-data tabular-nums ml-auto">{recommendedVice.predicted_points.toFixed(1)} pts</span>
          </div>
        </div>
      </div>

      {/* Transfer Suggestions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">Suggested Transfers</span>
          <button
            onClick={() => navigate("/transfers")}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            View all →
          </button>
        </div>
        <div className="space-y-3">
          {mockTransferSuggestions.map((transfer, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 p-3 rounded-lg bg-surface-800/50 border border-surface-700"
            >
              {/* Out */}
              <div className="flex-1">
                <p className="text-xs text-danger-400 font-medium uppercase mb-1">Sell</p>
                <p
                  className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                  onClick={() => handlePlayerClick(transfer.out.element)}
                >
                  {transfer.out.web_name}
                </p>
                <p className="text-xs text-surface-500">
                  {transfer.out.position} · {transfer.out.team_name} · {transfer.out.predicted_points.toFixed(1)} pts
                </p>
                {transfer.out.status !== "a" && (
                  <StatusBadge status={transfer.out.status} chance={0} compact />
                )}
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-1">
                <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="text-xs font-semibold text-success-400">
                  +{transfer.points_gain.toFixed(1)} pts
                </span>
              </div>

              {/* In */}
              <div className="flex-1">
                <p className="text-xs text-success-400 font-medium uppercase mb-1">Buy</p>
                <p className="font-medium text-surface-100">{transfer.in.web_name}</p>
                <p className="text-xs text-surface-500">
                  {transfer.in.position} · {transfer.in.team_name} · {transfer.in.predicted_points.toFixed(1)} pts
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  £{transfer.in.value}m
                  {transfer.cost_saving > 0 && (
                    <span className="text-success-400"> (save £{transfer.cost_saving.toFixed(1)}m)</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
