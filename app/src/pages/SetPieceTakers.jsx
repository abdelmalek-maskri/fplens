import { useState, useMemo } from "react";
import MiniSparkline from "../components/MiniSparkline";

// ============================================================
// MOCK DATA - Set piece taker directory
// Will be replaced with: GET /api/set-pieces/takers
// ============================================================
const mockSetPieces = [
  { team: "ARS", color: "#EF0107", penalties: { taker: "Saka", backup: "Havertz", scored: 3, missed: 0, attempts: 3 }, corners_left: "Saka", corners_right: "Odegaard", direct_fk: "Odegaard", indirect_fk: "Saka", long_throws: null, pts_last5: [8, 2, 6, 3, 9] },
  { team: "LIV", color: "#C8102E", penalties: { taker: "Salah", backup: "Alexander-Arnold", scored: 7, missed: 1, attempts: 8 }, corners_left: "Alexander-Arnold", corners_right: "Alexander-Arnold", direct_fk: "Alexander-Arnold", indirect_fk: "Salah", long_throws: null, pts_last5: [12, 3, 8, 5, 15] },
  { team: "MCI", color: "#6CABDD", penalties: { taker: "Haaland", backup: "De Bruyne", scored: 5, missed: 1, attempts: 6 }, corners_left: "Foden", corners_right: "De Bruyne", direct_fk: "De Bruyne", indirect_fk: "Bernardo", long_throws: null, pts_last5: [13, 2, 9, 5, 12] },
  { team: "CHE", color: "#034694", penalties: { taker: "Palmer", backup: "Jackson", scored: 6, missed: 0, attempts: 6 }, corners_left: "Palmer", corners_right: "Palmer", direct_fk: "Palmer", indirect_fk: "James", long_throws: null, pts_last5: [5, 13, 2, 10, 8] },
  { team: "NEW", color: "#241F20", penalties: { taker: "Isak", backup: "Gordon", scored: 2, missed: 0, attempts: 2 }, corners_left: "Gordon", corners_right: "Trippier", direct_fk: "Trippier", indirect_fk: "Gordon", long_throws: null, pts_last5: [8, 5, 2, 10, 6] },
  { team: "AVL", color: "#670E36", penalties: { taker: "Watkins", backup: "Tielemans", scored: 3, missed: 1, attempts: 4 }, corners_left: "Digne", corners_right: "Cash", direct_fk: "Digne", indirect_fk: "Tielemans", long_throws: null, pts_last5: [2, 6, 3, 2, 5] },
  { team: "BRE", color: "#E30613", penalties: { taker: "Mbeumo", backup: "Wissa", scored: 4, missed: 0, attempts: 4 }, corners_left: "Mbeumo", corners_right: "Damsgaard", direct_fk: "Mbeumo", indirect_fk: "Damsgaard", long_throws: null, pts_last5: [3, 7, 2, 5, 6] },
  { team: "BHA", color: "#0057B8", penalties: { taker: "João Pedro", backup: "Gross", scored: 2, missed: 1, attempts: 3 }, corners_left: "Gross", corners_right: "Gross", direct_fk: "Gross", indirect_fk: "Mitoma", long_throws: null, pts_last5: [4, 2, 5, 3, 6] },
  { team: "TOT", color: "#132257", penalties: { taker: "Son", backup: "Maddison", scored: 4, missed: 0, attempts: 4 }, corners_left: "Son", corners_right: "Maddison", direct_fk: "Maddison", indirect_fk: "Son", long_throws: null, pts_last5: [7, 3, 9, 2, 6] },
  { team: "MUN", color: "#DA291C", penalties: { taker: "Fernandes", backup: "Rashford", scored: 5, missed: 2, attempts: 7 }, corners_left: "Fernandes", corners_right: "Fernandes", direct_fk: "Fernandes", indirect_fk: "Eriksen", long_throws: null, pts_last5: [5, 8, 2, 3, 6] },
  { team: "WHU", color: "#7A263A", penalties: { taker: "Bowen", backup: "Antonio", scored: 3, missed: 0, attempts: 3 }, corners_left: "Bowen", corners_right: "Kudus", direct_fk: "Ward-Prowse", indirect_fk: "Bowen", long_throws: null, pts_last5: [3, 5, 2, 6, 4] },
  { team: "FUL", color: "#000000", penalties: { taker: "Jiménez", backup: "Pereira", scored: 2, missed: 0, attempts: 2 }, corners_left: "Pereira", corners_right: "Wilson", direct_fk: "Pereira", indirect_fk: "Wilson", long_throws: null, pts_last5: [2, 5, 3, 2, 4] },
  { team: "CRY", color: "#1B458F", penalties: { taker: "Eze", backup: "Mateta", scored: 2, missed: 0, attempts: 2 }, corners_left: "Eze", corners_right: "Eze", direct_fk: "Eze", indirect_fk: "Schlupp", long_throws: null, pts_last5: [4, 6, 2, 8, 5] },
  { team: "BOU", color: "#DA291C", penalties: { taker: "Kluivert", backup: "Solanke", scored: 3, missed: 0, attempts: 3 }, corners_left: "Kluivert", corners_right: "Tavernier", direct_fk: "Kluivert", indirect_fk: "Tavernier", long_throws: null, pts_last5: [5, 3, 7, 2, 4] },
  { team: "EVE", color: "#003399", penalties: { taker: "Calvert-Lewin", backup: "McNeil", scored: 1, missed: 0, attempts: 1 }, corners_left: "McNeil", corners_right: "Harrison", direct_fk: "McNeil", indirect_fk: "Harrison", long_throws: null, pts_last5: [2, 1, 3, 2, 2] },
  { team: "WOL", color: "#FDB913", penalties: { taker: "Cunha", backup: "Hwang", scored: 3, missed: 1, attempts: 4 }, corners_left: "Sarabia", corners_right: "Sarabia", direct_fk: "Sarabia", indirect_fk: "Cunha", long_throws: null, pts_last5: [9, 2, 7, 5, 8] },
  { team: "NFO", color: "#DD0000", penalties: { taker: "Wood", backup: "Gibbs-White", scored: 4, missed: 0, attempts: 4 }, corners_left: "Gibbs-White", corners_right: "Elanga", direct_fk: "Gibbs-White", indirect_fk: "Elanga", long_throws: null, pts_last5: [7, 2, 5, 8, 3] },
  { team: "IPS", color: "#3A64A3", penalties: { taker: "Szmodics", backup: "Hutchinson", scored: 1, missed: 1, attempts: 2 }, corners_left: "Hutchinson", corners_right: "Burns", direct_fk: "Hutchinson", indirect_fk: "Burns", long_throws: null, pts_last5: [2, 1, 3, 1, 2] },
  { team: "LEI", color: "#003090", penalties: { taker: "Vardy", backup: "Daka", scored: 2, missed: 0, attempts: 2 }, corners_left: "Maddison", corners_right: "Dewsbury-Hall", direct_fk: "Maddison", indirect_fk: "Dewsbury-Hall", long_throws: null, pts_last5: [3, 2, 5, 2, 3] },
  { team: "SOU", color: "#D71920", penalties: { taker: "Ward-Prowse", backup: "Adams", scored: 1, missed: 0, attempts: 1 }, corners_left: "Ward-Prowse", corners_right: "Aribo", direct_fk: "Ward-Prowse", indirect_fk: "Aribo", long_throws: null, pts_last5: [2, 4, 1, 3, 2] },
];

// ============================================================
// PENALTY KINGS - top penalty takers by volume
// ============================================================
const penaltyKings = [...mockSetPieces]
  .sort((a, b) => b.penalties.attempts - a.penalties.attempts)
  .slice(0, 6);

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SetPieceTakers() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // all | penalties | corners | freekicks

  const filtered = useMemo(() => {
    let list = [...mockSetPieces];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.team.toLowerCase().includes(q) ||
        t.penalties.taker.toLowerCase().includes(q) ||
        t.corners_left.toLowerCase().includes(q) ||
        t.corners_right.toLowerCase().includes(q) ||
        t.direct_fk.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search]);

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center justify-end">
        <div className="relative">
          <input type="text" placeholder="Search team or player..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-4 py-2 pl-9 text-sm text-surface-100 placeholder:text-surface-500 w-full sm:w-64 focus:border-brand-500 focus:outline-none" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: "all", label: "All Set Pieces" },
          { id: "penalties", label: "Penalties" },
          { id: "corners", label: "Corners" },
          { id: "freekicks", label: "Free Kicks" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === tab.id ? "bg-brand-600 text-white" : "bg-surface-800 text-surface-400 hover:text-surface-100"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Penalty Kings Section */}
      {(filterType === "all" || filterType === "penalties") && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {penaltyKings.map((t, idx) => {
              const convRate = t.penalties.attempts > 0 ? (t.penalties.scored / t.penalties.attempts * 100) : 0;
              return (
                <div key={t.team} className={`rounded-lg border p-4 ${
                  idx === 0 ? "border-brand-500/30 bg-brand-500/5" : "border-surface-700 bg-surface-800/30"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-sm font-medium text-surface-100">{t.team}</span>
                    </div>
                    {idx === 0 && <span className="badge bg-brand-500/20 text-brand-400">Top</span>}
                  </div>
                  <p className="text-lg font-bold text-surface-100">{t.penalties.taker}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-surface-400">{t.penalties.scored}/{t.penalties.attempts} scored</span>
                    <span className={`font-bold ${convRate === 100 ? "text-success-400" : convRate >= 75 ? "text-surface-100" : "text-warning-400"}`}>
                      {convRate.toFixed(0)}%
                    </span>
                  </div>
                  {/* Penalty dots */}
                  <div className="flex items-center gap-1 mt-2">
                    {[...Array(t.penalties.attempts)].map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${
                        i < t.penalties.scored ? "bg-success-500/60" : "bg-danger-500/60"
                      }`} />
                    ))}
                  </div>
                  <p className="text-2xs text-surface-500 mt-1">Backup: {t.penalties.backup}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Directory Table */}
      <div className="card overflow-y-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              <th className="table-header text-left py-2.5 px-3">Team</th>
              <th className="table-header text-left py-2.5 px-3">Taker Form</th>
              {(filterType === "all" || filterType === "penalties") && (
                <>
                  <th className="table-header text-left py-2.5 px-3">Penalties</th>
                  <th className="table-header text-left py-2.5 px-3">Record</th>
                </>
              )}
              {(filterType === "all" || filterType === "corners") && (
                <>
                  <th className="table-header text-left py-2.5 px-3">Corners (L)</th>
                  <th className="table-header text-left py-2.5 px-3">Corners (R)</th>
                </>
              )}
              {(filterType === "all" || filterType === "freekicks") && (
                <>
                  <th className="table-header text-left py-2.5 px-3">Direct FK</th>
                  <th className="table-header text-left py-2.5 px-3">Indirect FK</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.team} className="border-t border-surface-800 hover:bg-surface-800/40">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-medium text-surface-100">{t.team}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <MiniSparkline pts={t.pts_last5} />
                </td>
                {(filterType === "all" || filterType === "penalties") && (
                  <>
                    <td className="py-2.5 px-3">
                      <div>
                        <span className="text-sm font-semibold text-surface-100">{t.penalties.taker}</span>
                        <span className="text-2xs text-surface-500 ml-1">(backup: {t.penalties.backup})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-surface-300">{t.penalties.scored}/{t.penalties.attempts}</span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(t.penalties.attempts)].map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${
                              i < t.penalties.scored ? "bg-success-500/60" : "bg-danger-500/60"
                            }`} />
                          ))}
                        </div>
                      </div>
                    </td>
                  </>
                )}
                {(filterType === "all" || filterType === "corners") && (
                  <>
                    <td className="py-2.5 px-3 text-sm text-surface-200">{t.corners_left}</td>
                    <td className="py-2.5 px-3 text-sm text-surface-200">{t.corners_right}</td>
                  </>
                )}
                {(filterType === "all" || filterType === "freekicks") && (
                  <>
                    <td className="py-2.5 px-3 text-sm text-surface-200">{t.direct_fk}</td>
                    <td className="py-2.5 px-3 text-sm text-surface-200">{t.indirect_fk}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Why Set Pieces Matter */}
      <div className="mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-4">
            <p className="text-2xl font-bold text-brand-400 font-data tabular-nums">~25%</p>
            <p className="text-sm text-surface-300 mt-1">of PL goals from set pieces</p>
            <p className="text-xs text-surface-500 mt-1">Goal + assist points for takers</p>
          </div>
          <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-4">
            <p className="text-2xl font-bold text-success-400 font-data tabular-nums">+5 pts</p>
            <p className="text-sm text-surface-300 mt-1">per penalty scored (MID/FWD)</p>
            <p className="text-xs text-surface-500 mt-1">Guaranteed 1v1 chance</p>
          </div>
          <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-4">
            <p className="text-2xl font-bold text-info-400">BPS</p>
            <p className="text-sm text-surface-300 mt-1">Bonus from key passes</p>
            <p className="text-xs text-surface-500 mt-1">Corner takers accumulate BPS via key passes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
