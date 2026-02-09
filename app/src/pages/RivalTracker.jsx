import { useState, useMemo } from "react";
import TeamBadge from "../components/TeamBadge";
import { POSITION_COLORS } from "../lib/constants";

// ============================================================
// MOCK DATA — loaded when user enters FPL IDs
// Will be replaced with: GET /api/teams/{fpl_id}
// ============================================================
const MOCK_MY_TEAM = {
  name: "FC Predictions",
  fpl_id: 1234567,
  overall_rank: 45231,
  gw_points: 68,
  total_points: 1423,
  players: [
    { id: 2, web_name: "Haaland", team: "MCI", position: "FWD", predicted_points: 7.2, is_captain: true, is_vice: false },
    { id: 3, web_name: "Salah", team: "LIV", position: "MID", predicted_points: 6.8, is_captain: false, is_vice: true },
    { id: 7, web_name: "Palmer", team: "CHE", position: "MID", predicted_points: 6.1, is_captain: false, is_vice: false },
    { id: 50, web_name: "Isak", team: "NEW", position: "FWD", predicted_points: 5.5, is_captain: false, is_vice: false },
    { id: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", predicted_points: 5.4, is_captain: false, is_vice: false },
    { id: 12, web_name: "Gabriel", team: "ARS", position: "DEF", predicted_points: 5.1, is_captain: false, is_vice: false },
    { id: 25, web_name: "Saliba", team: "ARS", position: "DEF", predicted_points: 4.8, is_captain: false, is_vice: false },
    { id: 40, web_name: "Mbeumo", team: "BRE", position: "MID", predicted_points: 4.5, is_captain: false, is_vice: false },
    { id: 45, web_name: "Gordon", team: "NEW", position: "MID", predicted_points: 4.3, is_captain: false, is_vice: false },
    { id: 20, web_name: "Raya", team: "ARS", position: "GK", predicted_points: 4.2, is_captain: false, is_vice: false },
    { id: 35, web_name: "Solanke", team: "TOT", position: "FWD", predicted_points: 3.5, is_captain: false, is_vice: false },
  ],
};

const MOCK_RIVAL_TEAM = {
  name: "KDB Enthusiasts",
  fpl_id: 7654321,
  overall_rank: 38912,
  gw_points: 72,
  total_points: 1451,
  players: [
    { id: 3, web_name: "Salah", team: "LIV", position: "MID", predicted_points: 6.8, is_captain: true, is_vice: false },
    { id: 2, web_name: "Haaland", team: "MCI", position: "FWD", predicted_points: 7.2, is_captain: false, is_vice: true },
    { id: 7, web_name: "Palmer", team: "CHE", position: "MID", predicted_points: 6.1, is_captain: false, is_vice: false },
    { id: 5, web_name: "Saka", team: "ARS", position: "MID", predicted_points: 4.2, is_captain: false, is_vice: false },
    { id: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", predicted_points: 5.4, is_captain: false, is_vice: false },
    { id: 12, web_name: "Gabriel", team: "ARS", position: "DEF", predicted_points: 5.1, is_captain: false, is_vice: false },
    { id: 30, web_name: "Son", team: "TOT", position: "MID", predicted_points: 4.0, is_captain: false, is_vice: false },
    { id: 22, web_name: "Martinez", team: "AVL", position: "GK", predicted_points: 3.8, is_captain: false, is_vice: false },
    { id: 10, web_name: "Watkins", team: "AVL", position: "FWD", predicted_points: 1.8, is_captain: false, is_vice: false },
    { id: 60, web_name: "Dalot", team: "MUN", position: "DEF", predicted_points: 3.2, is_captain: false, is_vice: false },
    { id: 55, web_name: "Jackson", team: "CHE", position: "FWD", predicted_points: 3.9, is_captain: false, is_vice: false },
  ],
};

// ============================================================
// HELPERS
// ============================================================
const calcPredicted = (players) =>
  players.reduce((sum, p) => sum + (p.is_captain ? p.predicted_points * 2 : p.predicted_points), 0);

// ============================================================
// SUB-COMPONENTS
// ============================================================

function TeamOverview({ team, predicted, label, isYou, gap, isAhead }) {
  return (
    <div className={`${isYou ? "ring-1 ring-brand-500/30 rounded-lg p-5" : "p-5 border-b border-surface-800"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-surface-500 uppercase">{label}</p>
          <p className="text-lg font-bold text-surface-100">{team.name}</p>
        </div>
        {isYou && <span className="badge bg-brand-500/20 text-brand-400">You</span>}
      </div>
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-surface-100">{team.gw_points}</span>
          <span className="text-xs text-surface-500 ml-1.5">GW pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-surface-100">{team.total_points.toLocaleString()}</span>
          <span className="text-xs text-surface-500 ml-1.5">total</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-surface-100">{team.overall_rank.toLocaleString()}</span>
          <span className="text-xs text-surface-500 ml-1.5">rank</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-brand-400">{predicted.toFixed(1)}</span>
          <span className="text-xs text-surface-500 ml-1.5">predicted</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-surface-500">
        {isYou ? (
          isAhead ? (
            <span>You lead by <strong className="text-success-400">{gap} pts</strong></span>
          ) : gap > 0 ? (
            <span>You trail by <strong className="text-danger-400">{gap} pts</strong></span>
          ) : (
            <span className="text-surface-400">Level on points</span>
          )
        ) : (
          isAhead ? (
            <span>Rival leads by <strong className="text-danger-400">{gap} pts</strong></span>
          ) : gap > 0 ? (
            <span>Rival trails by <strong className="text-success-400">{gap} pts</strong></span>
          ) : (
            <span className="text-surface-400">Level on points</span>
          )
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player, pointsColor = "text-surface-400", prefix = "", badges = null }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <TeamBadge team={player.team} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-surface-200 truncate">{player.web_name}</span>
            {badges}
          </div>
          <span className={`text-2xs font-bold ${POSITION_COLORS[player.position]}`}>{player.position}</span>
        </div>
      </div>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${pointsColor}`}>
        {prefix}{player.predicted_points.toFixed(1)}
      </span>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function RivalTracker() {
  const [myId, setMyId] = useState("");
  const [rivalId, setRivalId] = useState("");
  const [myTeam, setMyTeam] = useState(null);
  const [rivalTeam, setRivalTeam] = useState(null);

  const analysis = useMemo(() => {
    if (!myTeam || !rivalTeam) return null;

    const myIds = new Set(myTeam.players.map((p) => p.id));
    const rivalIds = new Set(rivalTeam.players.map((p) => p.id));

    const shared = myTeam.players.filter((p) => rivalIds.has(p.id));
    const onlyMine = myTeam.players
      .filter((p) => !rivalIds.has(p.id))
      .sort((a, b) => b.predicted_points - a.predicted_points);
    const onlyRival = rivalTeam.players
      .filter((p) => !myIds.has(p.id))
      .sort((a, b) => b.predicted_points - a.predicted_points);

    const myPredicted = calcPredicted(myTeam.players);
    const rivalPredicted = calcPredicted(rivalTeam.players);
    const gap = Math.abs(myTeam.total_points - rivalTeam.total_points);
    const iAmAhead = myTeam.total_points > rivalTeam.total_points;

    const myCaptain = myTeam.players.find((p) => p.is_captain);
    const rivalCaptain = rivalTeam.players.find((p) => p.is_captain);

    return {
      shared,
      onlyMine,
      onlyRival,
      myPredicted,
      rivalPredicted,
      gap,
      iAmAhead,
      myCaptain,
      rivalCaptain,
      sameCaptain: myCaptain?.id === rivalCaptain?.id,
    };
  }, [myTeam, rivalTeam]);

  const handleCompare = () => {
    // Mock: load sample teams regardless of input
    setMyTeam(MOCK_MY_TEAM);
    setRivalTeam(MOCK_RIVAL_TEAM);
  };

  return (
    <div className="space-y-6 stagger">
      {/* FPL ID Inputs */}
      <div className="card p-5">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">Your FPL ID</p>
            <input
              type="text"
              placeholder="e.g. 1234567"
              value={myId}
              onChange={(e) => setMyId(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">Rival's FPL ID</p>
            <input
              type="text"
              placeholder="e.g. 7654321"
              value={rivalId}
              onChange={(e) => setRivalId(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleCompare}
            className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors whitespace-nowrap"
          >
            Compare
          </button>
        </div>
        <p className="text-xs text-surface-500 mt-3">
          Find IDs at: <span className="font-data tabular-nums text-surface-400">fantasy.premierleague.com/entry/<strong className="text-brand-400">ID</strong>/event/24</span>
        </p>
      </div>

      {/* Results */}
      {analysis && (
        <>
          {/* Team Overview Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TeamOverview
              team={myTeam}
              predicted={analysis.myPredicted}
              label="Your Team"
              isYou={true}
              gap={analysis.gap}
              isAhead={analysis.iAmAhead}
            />
            <TeamOverview
              team={rivalTeam}
              predicted={analysis.rivalPredicted}
              label="Rival"
              isYou={false}
              gap={analysis.gap}
              isAhead={!analysis.iAmAhead}
            />
          </div>

          {/* Predicted Points Delta Banner */}
          {(() => {
            const diff = analysis.myPredicted - analysis.rivalPredicted;
            const youWin = diff > 0;
            return (
              <div className={`p-4 flex items-center justify-between rounded-lg ${
                youWin ? "ring-1 ring-success-500/30" : diff < 0 ? "ring-1 ring-danger-500/30" : "border border-surface-800"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    youWin ? "bg-success-500" : diff < 0 ? "bg-danger-500" : "bg-surface-500"
                  }`} />
                  <div>
                    <p className="text-sm font-semibold text-surface-100">
                      {youWin
                        ? `Projected +${diff.toFixed(1)} pts advantage this GW`
                        : diff < 0
                        ? `Rival projected +${Math.abs(diff).toFixed(1)} pts this GW`
                        : "Dead heat -- equal projected points"
                      }
                    </p>
                    <p className="text-xs text-surface-500">
                      {analysis.shared.length} shared · {analysis.onlyMine.length} only you · {analysis.onlyRival.length} only rival
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-lg font-bold font-data tabular-nums shrink-0">
                  <span className={youWin ? "text-success-400" : "text-surface-300"}>{analysis.myPredicted.toFixed(1)}</span>
                  <span className="text-surface-600">vs</span>
                  <span className={!youWin && diff !== 0 ? "text-danger-400" : "text-surface-300"}>{analysis.rivalPredicted.toFixed(1)}</span>
                </div>
              </div>
            );
          })()}

          {/* Captain Comparison */}
          {analysis.myCaptain && analysis.rivalCaptain && (
            <div className="mt-8 pt-2 pb-4 border-b border-surface-800">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <div className="flex items-center gap-3 p-3 bg-surface-800/30 rounded-lg">
                  <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-400">C</div>
                  <div>
                    <p className="text-sm font-semibold text-surface-100">{analysis.myCaptain.web_name}</p>
                    <p className="text-xs text-surface-500">
                      {analysis.myCaptain.team} · {(analysis.myCaptain.predicted_points * 2).toFixed(1)} pts (x2)
                    </p>
                  </div>
                </div>
                <span className="text-surface-600 text-sm font-medium">vs</span>
                <div className="flex items-center gap-3 p-3 bg-surface-800/30 rounded-lg">
                  <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-400">C</div>
                  <div>
                    <p className="text-sm font-semibold text-surface-100">{analysis.rivalCaptain.web_name}</p>
                    <p className="text-xs text-surface-500">
                      {analysis.rivalCaptain.team} · {(analysis.rivalCaptain.predicted_points * 2).toFixed(1)} pts (x2)
                    </p>
                  </div>
                </div>
              </div>
              {analysis.sameCaptain ? (
                <p className="text-xs text-surface-500 mt-3">Same captain — no captaincy differential this GW.</p>
              ) : (
                <p className="text-xs text-surface-500 mt-3">
                  Captain differential:{" "}
                  <strong className={
                    analysis.myCaptain.predicted_points >= analysis.rivalCaptain.predicted_points ? "text-success-400" : "text-danger-400"
                  }>
                    {Math.abs((analysis.myCaptain.predicted_points - analysis.rivalCaptain.predicted_points) * 2).toFixed(1)} pts
                  </strong>
                  {" "}in {analysis.myCaptain.predicted_points >= analysis.rivalCaptain.predicted_points ? "your" : "rival's"} favour.
                </p>
              )}
            </div>
          )}

          {/* Three columns: Shared / Only You / Only Rival */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Shared */}
            <div className="card p-4">
              <div className="space-y-0.5">
                {analysis.shared.map((p) => {
                  const rivalP = rivalTeam.players.find((r) => r.id === p.id);
                  return (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      pointsColor="text-surface-400"
                      badges={
                        <>
                          {p.is_captain && <span className="text-[8px] bg-brand-500/20 text-brand-400 px-1 rounded font-bold">C</span>}
                          {p.is_vice && <span className="text-[8px] bg-surface-600 text-surface-300 px-1 rounded font-bold">V</span>}
                          {rivalP?.is_captain && !p.is_captain && (
                            <span className="text-[8px] bg-danger-500/20 text-danger-400 px-1 rounded font-bold">RC</span>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            </div>

            {/* Only You */}
            <div className="card p-4 ring-1 ring-success-500/20">
              <div className="space-y-0.5">
                {analysis.onlyMine.map((p) => (
                  <PlayerRow key={p.id} player={p} pointsColor="text-success-400" prefix="+" />
                ))}
                {analysis.onlyMine.length === 0 && (
                  <p className="text-xs text-surface-500 py-4 text-center">No unique players</p>
                )}
              </div>
              {analysis.onlyMine.length > 0 && (
                <div className="mt-3 pt-2 border-t border-surface-800">
                  <p className="text-xs text-surface-500">
                    Differential edge: <strong className="text-success-400">
                      +{analysis.onlyMine.reduce((s, p) => s + p.predicted_points, 0).toFixed(1)} pts
                    </strong>
                  </p>
                </div>
              )}
            </div>

            {/* Only Rival */}
            <div className="card p-4 ring-1 ring-danger-500/20">
              <div className="space-y-0.5">
                {analysis.onlyRival.map((p) => (
                  <PlayerRow key={p.id} player={p} pointsColor="text-danger-400" prefix="-" />
                ))}
                {analysis.onlyRival.length === 0 && (
                  <p className="text-xs text-surface-500 py-4 text-center">No unique players</p>
                )}
              </div>
              {analysis.onlyRival.length > 0 && (
                <div className="mt-3 pt-2 border-t border-surface-800">
                  <p className="text-xs text-surface-500">
                    Threat level: <strong className="text-danger-400">
                      -{analysis.onlyRival.reduce((s, p) => s + p.predicted_points, 0).toFixed(1)} pts
                    </strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Net Differential Summary */}
          <div className="mt-8 pt-2">
            <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
              <div>
                <span className="text-xl font-bold font-data tabular-nums text-success-400">
                  +{analysis.onlyMine.reduce((s, p) => s + p.predicted_points, 0).toFixed(1)}
                </span>
                <span className="text-xs text-surface-500 ml-1.5">your differentials</span>
              </div>
              <div className="w-px h-5 bg-surface-700" />
              <div>
                <span className="text-xl font-bold font-data tabular-nums text-danger-400">
                  -{analysis.onlyRival.reduce((s, p) => s + p.predicted_points, 0).toFixed(1)}
                </span>
                <span className="text-xs text-surface-500 ml-1.5">rival differentials</span>
              </div>
              <div className="w-px h-5 bg-surface-700" />
              <div>
                <span className={`text-xl font-bold font-data tabular-nums ${
                  analysis.sameCaptain ? "text-surface-400" :
                  analysis.myCaptain.predicted_points >= analysis.rivalCaptain.predicted_points ? "text-success-400" : "text-danger-400"
                }`}>
                  {analysis.sameCaptain ? "0.0" : (
                    (analysis.myCaptain.predicted_points >= analysis.rivalCaptain.predicted_points ? "+" : "-") +
                    Math.abs((analysis.myCaptain.predicted_points - analysis.rivalCaptain.predicted_points) * 2).toFixed(1)
                  )}
                </span>
                <span className="text-xs text-surface-500 ml-1.5">captain diff</span>
              </div>
              <div className="w-px h-5 bg-surface-700" />
              {(() => {
                const myDiff = analysis.onlyMine.reduce((s, p) => s + p.predicted_points, 0);
                const rivalDiff = analysis.onlyRival.reduce((s, p) => s + p.predicted_points, 0);
                const capDiff = analysis.sameCaptain ? 0 : (analysis.myCaptain.predicted_points - analysis.rivalCaptain.predicted_points) * 2;
                const net = myDiff - rivalDiff + capDiff;
                return (
                  <div>
                    <span className={`text-xl font-bold font-data tabular-nums ${net > 0 ? "text-success-400" : net < 0 ? "text-danger-400" : "text-surface-400"}`}>
                      {net > 0 ? "+" : ""}{net.toFixed(1)}
                    </span>
                    <span className="text-xs text-surface-500 ml-1.5">net swing</span>
                  </div>
                );
              })()}
            </div>
            <p className="text-xs text-surface-500 mt-3">
              Net swing = your differentials - rival differentials + captain diff. Positive means you're projected to gain.
            </p>
          </div>
        </>
      )}

      {/* Empty State */}
      {!analysis && (
        <div className="p-16 text-center space-y-3">
          <svg className="w-12 h-12 text-surface-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-surface-400 font-medium">Enter FPL IDs above to compare</p>
          <p className="text-xs text-surface-500">
            Ownership gaps, differentials, and captain comparison between any two squads.
          </p>
        </div>
      )}
    </div>
  );
}
