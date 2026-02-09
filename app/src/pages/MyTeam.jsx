import { useState } from "react";
import Jersey from "../components/Jersey";
import StatusBadge from "../components/StatusBadge";

// ============================================================
// MOCK DATA - matches real FPL API structure for user's team
// Will be replaced with: GET /api/team/{fpl_id}
// ============================================================

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
    out: { web_name: "Watkins", team_name: "AVL", position: "FWD", predicted_points: 1.8, status: "i", value: 9.0, selling_price: 8.8 },
    in: { web_name: "Cunha", team_name: "WOL", position: "FWD", predicted_points: 5.8, status: "a", value: 7.2 },
    points_gain: 4.0,
    cost_saving: 1.6,
  },
  {
    out: { web_name: "Saka", team_name: "ARS", position: "MID", predicted_points: 4.2, status: "d", value: 10.1, selling_price: 9.9 },
    in: { web_name: "Son", team_name: "TOT", position: "MID", predicted_points: 5.8, status: "a", value: 10.0 },
    points_gain: 1.6,
    cost_saving: -0.1,
  },
];


// ============================================================
// PLAYER CARD ON PITCH
// ============================================================
const PitchPlayerCard = ({ player }) => (
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
    <div className="bg-white/95 px-2.5 py-0.5 rounded text-[11px] font-bold text-gray-900 text-center min-w-[72px] max-w-[100px] truncate shadow-sm">
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
// PITCH VIEW COMPONENT - Modern pitch with premium grass
// ============================================================
const PitchView = ({ starters, bench }) => {
  const gk = starters.filter((p) => p.position === "GK");
  const def = starters.filter((p) => p.position === "DEF");
  const mid = starters.filter((p) => p.position === "MID");
  const fwd = starters.filter((p) => p.position === "FWD");
  const formation = `${def.length}-${mid.length}-${fwd.length}`;

  return (
    <div className="card overflow-hidden">
      {/* Pitch header */}
      <div className="px-4 py-2.5 border-b border-surface-700 flex items-center justify-between bg-surface-800/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-surface-100">
            Pitch View
          </span>
          <span className="badge bg-surface-700 text-surface-300">
            {formation}
          </span>
        </div>
        <span className="text-xs text-surface-500">
          Predicted pts shown per player
        </span>
      </div>

      {/* The pitch - modern grass with SVG pattern */}
      <div className="relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            {/* Grass stripe pattern */}
            <pattern id="grass" width="100%" height="90" patternUnits="userSpaceOnUse">
              <rect width="100%" height="45" fill="#1b7a35" />
              <rect y="45" width="100%" height="45" fill="#1a7030" />
            </pattern>
            {/* Subtle noise overlay */}
            <filter id="grassNoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
              <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
              <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grass)" />
          {/* Vignette / depth at edges */}
          <rect width="100%" height="100%" fill="url(#grass)" opacity="0.3" filter="url(#grassNoise)" />
        </svg>

        {/* Pitch markings - cleaner, crisper */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Outer boundary */}
          <div className="absolute inset-[16px] border-2 border-white/20 rounded-[3px]" />
          {/* Half-way line */}
          <div className="absolute left-[16px] right-[16px] top-1/2 h-[2px] bg-white/20" />
          {/* Center circle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full border-2 border-white/20" />
          {/* Center dot */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/25" />

          {/* Top penalty box */}
          <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-b-2 border-l-2 border-r-2 border-white/15 rounded-b-[2px]" />
          <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-b-2 border-l-2 border-r-2 border-white/12 rounded-b-[2px]" />
          {/* Top penalty arc */}
          <div className="absolute top-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-b-2 border-white/10 rounded-b-full" />

          {/* Bottom penalty box */}
          <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-t-2 border-l-2 border-r-2 border-white/15 rounded-t-[2px]" />
          <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-t-2 border-l-2 border-r-2 border-white/12 rounded-t-[2px]" />
          {/* Bottom penalty arc */}
          <div className="absolute bottom-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-t-2 border-white/10 rounded-t-full" />

          {/* Corner arcs */}
          <div className="absolute top-[16px] left-[16px] w-5 h-5 border-r-2 border-b-2 border-white/10 rounded-br-full" />
          <div className="absolute top-[16px] right-[16px] w-5 h-5 border-l-2 border-b-2 border-white/10 rounded-bl-full" />
          <div className="absolute bottom-[16px] left-[16px] w-5 h-5 border-r-2 border-t-2 border-white/10 rounded-tr-full" />
          <div className="absolute bottom-[16px] right-[16px] w-5 h-5 border-l-2 border-t-2 border-white/10 rounded-tl-full" />
        </div>

        {/* Player formation rows */}
        <div
          className="relative z-10 flex flex-col justify-around py-8 px-4"
          style={{ minHeight: "560px" }}
        >
          <div className="flex justify-center gap-8">
            {gk.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {def.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
          </div>
          <div className="flex justify-center gap-3 sm:gap-5 lg:gap-8">
            {mid.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {fwd.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
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
              <div className="bg-surface-700/80 px-2 py-0.5 rounded-sm text-[11px] font-semibold text-surface-300 text-center min-w-[72px] max-w-[100px] truncate">
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
  const [fplId, setFplId] = useState("");
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [team, setTeam] = useState(null);

  const handleLoadTeam = (e) => {
    e.preventDefault();
    setTeam(mockUserTeam);
    setTeamLoaded(true);
  };

  const getCaptainPick = (picks) => {
    const starters = picks.filter((p) => p.multiplier >= 1);
    return [...starters].sort(
      (a, b) => b.predicted_points - a.predicted_points
    )[0];
  };

  const getVicePick = (picks) => {
    const starters = picks.filter((p) => p.multiplier >= 1);
    return [...starters].sort(
      (a, b) => b.predicted_points - a.predicted_points
    )[1];
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
  const captainPick = getCaptainPick(team.picks);
  const vicePick = getVicePick(team.picks);
  const totalPredicted = starters.reduce(
    (sum, p) => sum + p.predicted_points * p.multiplier,
    0
  );
  const injuredStarters = starters.filter(
    (p) => p.status === "i" || p.status === "d"
  );

  return (
    <div className="space-y-6 stagger">
      {/* Controls */}
      <div className="flex items-center justify-end">
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
          <span className="text-xl font-bold text-surface-100">{team.overallRank.toLocaleString()}</span>
          <span className="text-xs text-surface-500 ml-1.5">rank</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-brand-400">{totalPredicted.toFixed(1)}</span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-surface-100">£{team.budget}m</span>
          <span className="text-xs text-surface-500 ml-1.5">ITB</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-surface-100">{team.freeTransfers}</span>
          <span className="text-xs text-surface-500 ml-1.5">FT{team.freeTransfers !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Flagged starters — left-border list */}
      {injuredStarters.length > 0 && (
        <div className="space-y-0.5">
          {injuredStarters.map((p) => (
            <div key={p.element} className={`flex items-center gap-2 py-1 pl-3 border-l-2 ${p.status === "i" ? "border-danger-500" : "border-warning-500"}`}>
              <span className="text-sm text-surface-300">
                <span className="font-medium text-surface-100">{p.web_name}</span>
                {" "}<span className="text-surface-500">{p.team_name}</span>
                {" — "}{p.news || (p.status === "i" ? "Injured" : "Doubtful")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pitch Formation View */}
      <PitchView starters={starters} bench={bench} />

      {/* Captain Recommendation */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* AI Captain Pick */}
          <div
            className={`p-4 rounded-lg border-2 ${
              captainPick?.element ===
              starters.find((p) => p.is_captain)?.element
                ? "border-success-500/30 bg-success-500/5"
                : "border-brand-500/30 bg-brand-500/5"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-brand-400 uppercase tracking-wide">
                Recommended Captain
              </span>
              {captainPick?.element !==
                starters.find((p) => p.is_captain)?.element && (
                <span className="badge bg-brand-500/20 text-brand-400">
                  Change suggested
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
                C
              </div>
              <div>
                <p className="font-semibold text-surface-100">
                  {captainPick?.web_name}
                </p>
                <p className="text-xs text-surface-500">
                  {captainPick?.position} · {captainPick?.team_name} vs{" "}
                  {captainPick?.opponent_name}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-bold text-surface-100">
                  {captainPick?.predicted_points.toFixed(1)} pts
                </p>
                <p className="text-xs text-surface-500">
                  ×2 = {(captainPick?.predicted_points * 2).toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          {/* Vice Captain Pick */}
          <div className="p-4 rounded-lg border border-surface-700 bg-surface-800/50">
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
              Vice Captain Pick
            </span>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-10 h-10 rounded-full bg-surface-600 flex items-center justify-center text-surface-300 font-bold text-sm">
                V
              </div>
              <div>
                <p className="font-semibold text-surface-100">
                  {vicePick?.web_name}
                </p>
                <p className="text-xs text-surface-500">
                  {vicePick?.position} · {vicePick?.team_name} vs{" "}
                  {vicePick?.opponent_name}
                </p>
              </div>
              <div className="ml-auto">
                <p className="text-lg font-bold text-surface-100">
                  {vicePick?.predicted_points.toFixed(1)} pts
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Suggestions */}
      <div>
        <div className="space-y-3">
          {mockTransferSuggestions.map((transfer, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 p-3 rounded-lg bg-surface-800/50 border border-surface-700"
            >
              {/* Out */}
              <div className="flex-1">
                <p className="text-xs text-danger-400 font-medium uppercase mb-1">
                  Sell
                </p>
                <p className="font-medium text-surface-100">
                  {transfer.out.web_name}
                </p>
                <p className="text-xs text-surface-500">
                  {transfer.out.position} · {transfer.out.team_name} ·{" "}
                  {transfer.out.predicted_points.toFixed(1)} pts
                </p>
                <StatusBadge status={transfer.out.status} chance={0} compact />
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-1">
                <svg
                  className="w-5 h-5 text-brand-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                <span className="text-xs font-semibold text-success-400">
                  +{transfer.points_gain.toFixed(1)} pts
                </span>
              </div>

              {/* In */}
              <div className="flex-1">
                <p className="text-xs text-success-400 font-medium uppercase mb-1">
                  Buy
                </p>
                <p className="font-medium text-surface-100">
                  {transfer.in.web_name}
                </p>
                <p className="text-xs text-surface-500">
                  {transfer.in.position} · {transfer.in.team_name} ·{" "}
                  {transfer.in.predicted_points.toFixed(1)} pts
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  £{transfer.in.value}m
                  {transfer.cost_saving > 0 && (
                    <span className="text-success-400">
                      {" "}
                      (save £{transfer.cost_saving.toFixed(1)}m)
                    </span>
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
