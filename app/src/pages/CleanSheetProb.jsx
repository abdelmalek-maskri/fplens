import { useState, useMemo } from "react";
import { FDR_COLORS, POSITION_COLORS, TEAM_COLORS } from "../lib/constants";
import SortHeader from "../components/SortHeader";
import MiniSparkline from "../components/MiniSparkline";

// ============================================================
// MOCK DATA - Clean sheet probabilities per team
// Will be replaced with: GET /api/clean-sheets/probabilities?gw={gw}
// ============================================================
const mockCSData = [
  { team: "LIV", color: "#C8102E", opponent: "EVE", is_home: true, fdr: 2, cs_prob: 48, xGA_last5: 0.82, goals_conceded_last5: 4, clean_sheets_season: 11, cs_pct_season: 48, best_def: "Saliba", best_gk: "Alisson", gk_save_pct: 78, cs_last5: [1, 1, 0, 1, 1] },
  { team: "ARS", color: "#EF0107", opponent: "CHE", is_home: true, fdr: 4, cs_prob: 38, xGA_last5: 1.05, goals_conceded_last5: 5, clean_sheets_season: 10, cs_pct_season: 43, best_def: "Gabriel", best_gk: "Raya", gk_save_pct: 74, cs_last5: [1, 0, 1, 1, 0] },
  { team: "MCI", color: "#6CABDD", opponent: "BOU", is_home: true, fdr: 2, cs_prob: 44, xGA_last5: 1.18, goals_conceded_last5: 6, clean_sheets_season: 8, cs_pct_season: 35, best_def: "Dias", best_gk: "Ederson", gk_save_pct: 71, cs_last5: [0, 1, 0, 1, 1] },
  { team: "NEW", color: "#241F20", opponent: "WOL", is_home: true, fdr: 2, cs_prob: 42, xGA_last5: 0.95, goals_conceded_last5: 5, clean_sheets_season: 9, cs_pct_season: 39, best_def: "Schär", best_gk: "Pope", gk_save_pct: 76, cs_last5: [1, 0, 1, 0, 1] },
  { team: "CHE", color: "#034694", opponent: "ARS", is_home: false, fdr: 5, cs_prob: 18, xGA_last5: 1.45, goals_conceded_last5: 7, clean_sheets_season: 7, cs_pct_season: 30, best_def: "Fofana", best_gk: "Sánchez", gk_save_pct: 68, cs_last5: [0, 0, 1, 0, 0] },
  { team: "BRE", color: "#E30613", opponent: "NFO", is_home: true, fdr: 2, cs_prob: 35, xGA_last5: 1.22, goals_conceded_last5: 6, clean_sheets_season: 6, cs_pct_season: 26, best_def: "Collins", best_gk: "Flekken", gk_save_pct: 72, cs_last5: [0, 1, 0, 0, 1] },
  { team: "BHA", color: "#0057B8", opponent: "FUL", is_home: true, fdr: 2, cs_prob: 32, xGA_last5: 1.30, goals_conceded_last5: 7, clean_sheets_season: 6, cs_pct_season: 26, best_def: "Dunk", best_gk: "Verbruggen", gk_save_pct: 70, cs_last5: [1, 0, 0, 1, 0] },
  { team: "AVL", color: "#670E36", opponent: "NFO", is_home: false, fdr: 2, cs_prob: 30, xGA_last5: 1.35, goals_conceded_last5: 7, clean_sheets_season: 7, cs_pct_season: 30, best_def: "Konsa", best_gk: "Martínez", gk_save_pct: 75, cs_last5: [0, 1, 1, 0, 0] },
  { team: "NFO", color: "#DD0000", opponent: "BRE", is_home: false, fdr: 2, cs_prob: 22, xGA_last5: 1.55, goals_conceded_last5: 8, clean_sheets_season: 5, cs_pct_season: 22, best_def: "Murillo", best_gk: "Sels", gk_save_pct: 69, cs_last5: [0, 0, 1, 0, 0] },
  { team: "BOU", color: "#DA291C", opponent: "MCI", is_home: false, fdr: 4, cs_prob: 12, xGA_last5: 1.85, goals_conceded_last5: 9, clean_sheets_season: 4, cs_pct_season: 17, best_def: "Senesi", best_gk: "Neto", gk_save_pct: 65, cs_last5: [0, 0, 0, 1, 0] },
  { team: "EVE", color: "#003399", opponent: "LIV", is_home: false, fdr: 5, cs_prob: 10, xGA_last5: 1.92, goals_conceded_last5: 10, clean_sheets_season: 3, cs_pct_season: 13, best_def: "Branthwaite", best_gk: "Pickford", gk_save_pct: 67, cs_last5: [0, 0, 0, 0, 1] },
  { team: "WOL", color: "#FDB913", opponent: "NEW", is_home: false, fdr: 3, cs_prob: 15, xGA_last5: 1.75, goals_conceded_last5: 9, clean_sheets_season: 3, cs_pct_season: 13, best_def: "Kilman", best_gk: "Sá", gk_save_pct: 66, cs_last5: [0, 1, 0, 0, 0] },
  { team: "FUL", color: "#000000", opponent: "BHA", is_home: false, fdr: 3, cs_prob: 20, xGA_last5: 1.48, goals_conceded_last5: 8, clean_sheets_season: 5, cs_pct_season: 22, best_def: "Robinson", best_gk: "Leno", gk_save_pct: 73, cs_last5: [1, 0, 0, 0, 1] },
  { team: "TOT", color: "#132257", opponent: "CRY", is_home: true, fdr: 2, cs_prob: 33, xGA_last5: 1.28, goals_conceded_last5: 6, clean_sheets_season: 6, cs_pct_season: 26, best_def: "Van de Ven", best_gk: "Vicario", gk_save_pct: 71, cs_last5: [0, 1, 0, 1, 0] },
  { team: "CRY", color: "#1B458F", opponent: "TOT", is_home: false, fdr: 3, cs_prob: 18, xGA_last5: 1.60, goals_conceded_last5: 8, clean_sheets_season: 4, cs_pct_season: 17, best_def: "Guéhi", best_gk: "Henderson", gk_save_pct: 68, cs_last5: [0, 0, 1, 0, 0] },
  { team: "MUN", color: "#DA291C", opponent: "IPS", is_home: true, fdr: 1, cs_prob: 40, xGA_last5: 1.40, goals_conceded_last5: 7, clean_sheets_season: 5, cs_pct_season: 22, best_def: "Martínez", best_gk: "Onana", gk_save_pct: 70, cs_last5: [0, 1, 0, 0, 1] },
  { team: "WHU", color: "#7A263A", opponent: "LEI", is_home: true, fdr: 2, cs_prob: 30, xGA_last5: 1.50, goals_conceded_last5: 8, clean_sheets_season: 4, cs_pct_season: 17, best_def: "Zouma", best_gk: "Fabianski", gk_save_pct: 66, cs_last5: [0, 0, 1, 0, 0] },
  { team: "IPS", color: "#3A64A3", opponent: "MUN", is_home: false, fdr: 3, cs_prob: 8, xGA_last5: 2.10, goals_conceded_last5: 11, clean_sheets_season: 2, cs_pct_season: 9, best_def: "Woolfenden", best_gk: "Muric", gk_save_pct: 62, cs_last5: [0, 0, 0, 0, 1] },
  { team: "LEI", color: "#003090", opponent: "WHU", is_home: false, fdr: 2, cs_prob: 15, xGA_last5: 1.80, goals_conceded_last5: 9, clean_sheets_season: 3, cs_pct_season: 13, best_def: "Faes", best_gk: "Ward", gk_save_pct: 64, cs_last5: [0, 1, 0, 0, 0] },
  { team: "SOU", color: "#D71920", opponent: "SOU", is_home: true, fdr: 2, cs_prob: 12, xGA_last5: 2.05, goals_conceded_last5: 10, clean_sheets_season: 2, cs_pct_season: 9, best_def: "Bednarek", best_gk: "Ramsdale", gk_save_pct: 63, cs_last5: [0, 0, 0, 1, 0] },
];


const getCSColor = (prob) => {
  if (prob >= 40) return "text-success-400";
  if (prob >= 25) return "text-surface-100";
  if (prob >= 15) return "text-warning-400";
  return "text-danger-400";
};

const getCSBarColor = (prob) => {
  if (prob >= 40) return "bg-success-500";
  if (prob >= 25) return "bg-brand-500";
  if (prob >= 15) return "bg-warning-500";
  return "bg-danger-500";
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CleanSheetProb() {
  const [sortBy, setSortBy] = useState("cs_prob");
  const [sortDesc, setSortDesc] = useState(true);
  const [homeOnly, setHomeOnly] = useState(false);

  const sorted = useMemo(() => {
    let list = [...mockCSData];
    if (homeOnly) list = list.filter(t => t.is_home);
    list.sort((a, b) => sortDesc ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
    return list;
  }, [sortBy, sortDesc, homeOnly]);

  const handleSort = (field) => {
    if (sortBy === field) setSortDesc(!sortDesc);
    else { setSortBy(field); setSortDesc(true); }
  };

  const topCS = sorted.slice(0, 4);

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center justify-end">
        <button onClick={() => setHomeOnly(!homeOnly)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            homeOnly ? "bg-brand-600 text-white" : "bg-surface-800 text-surface-400 hover:text-surface-100"
          }`}>
          Home Teams Only
        </button>
      </div>

      {/* Top CS Picks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {topCS.map((t, idx) => (
          <div key={t.team} className={`p-4 ${idx === 0 ? "border border-success-500/30 bg-success-500/5 rounded-lg" : ""}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-sm font-medium text-surface-100">{t.team}</span>
              </div>
              {idx === 0 && <span className="badge bg-success-500/20 text-success-400">Best</span>}
            </div>
            <p className={`text-3xl font-bold ${getCSColor(t.cs_prob)}`}>{t.cs_prob}%</p>
            <p className="text-xs text-surface-500 mt-1">
              vs {t.opponent} {t.is_home ? "(H)" : "(A)"}
            </p>
            <div className="w-full h-1.5 bg-surface-800 rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${getCSBarColor(t.cs_prob)}`}
                style={{ width: `${t.cs_prob}%` }} />
            </div>
            <div className="mt-3 pt-3 border-t border-surface-700/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-surface-500">xGA/match (L5)</span>
                <span className="text-surface-300">{t.xGA_last5}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-surface-500">Best DEF pick</span>
                <span className="text-surface-200 font-medium">{t.best_def}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-surface-500">GK pick</span>
                <span className="text-surface-200 font-medium">{t.best_gk}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Table */}
      <div className="card overflow-y-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              <th className="table-header text-left py-2.5 px-3">#</th>
              <th className="table-header text-left py-2.5 px-3">Team</th>
              <th className="table-header text-left py-2.5 px-3">Fixture</th>
              <SortHeader field="cs_prob" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>CS Prob.</SortHeader>
              <SortHeader field="xGA_last5" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>xGA/Match</SortHeader>
              <SortHeader field="goals_conceded_last5" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>Conceded (L5)</SortHeader>
              <SortHeader field="clean_sheets_season" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>CS (Season)</SortHeader>
              <th className="table-header text-left py-2.5 px-3">CS Trend</th>
              <SortHeader field="gk_save_pct" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>GK Save %</SortHeader>
              <th className="table-header text-left py-2.5 px-3">Best Picks</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => (
              <tr key={t.team} className={`border-t border-surface-800 hover:bg-surface-800/40 ${idx < 3 ? "bg-success-500/[0.03]" : ""}`} style={{ borderLeft: `3px solid ${t.color}` }}>
                <td className="py-2.5 px-3 text-surface-500 text-sm">{idx + 1}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-medium text-surface-100">{t.team}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-surface-200">
                      {t.is_home ? "vs" : "@"} {t.opponent}
                    </span>
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold ${FDR_COLORS[t.fdr].bg} ${FDR_COLORS[t.fdr].text}`}>
                      {t.fdr}
                    </span>
                    <span className={`badge text-2xs ${t.is_home ? "bg-success-500/15 text-success-400" : "bg-surface-700 text-surface-400"}`}>
                      {t.is_home ? "H" : "A"}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-surface-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getCSBarColor(t.cs_prob)}`}
                        style={{ width: `${t.cs_prob}%` }} />
                    </div>
                    <span className={`text-sm font-bold ${getCSColor(t.cs_prob)}`}>{t.cs_prob}%</span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`text-sm ${t.xGA_last5 < 1.0 ? "text-success-400 font-semibold" : t.xGA_last5 < 1.4 ? "text-surface-300" : "text-warning-400"}`}>
                    {t.xGA_last5.toFixed(2)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-surface-300">{t.goals_conceded_last5}</td>
                <td className="py-2.5 px-3">
                  <span className="text-surface-100 font-medium">{t.clean_sheets_season}</span>
                  <span className="text-surface-500 text-xs ml-1">({t.cs_pct_season}%)</span>
                </td>
                <td className="py-2.5 px-3">
                  <MiniSparkline pts={t.cs_last5} />
                </td>
                <td className="py-2.5 px-3">
                  <span className={`text-sm ${t.gk_save_pct >= 75 ? "text-success-400" : "text-surface-300"}`}>
                    {t.gk_save_pct}%
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="text-xs">
                    <span className="text-surface-200">{t.best_gk}</span>
                    <span className="text-surface-600 mx-1">·</span>
                    <span className="text-surface-200">{t.best_def}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DEF/GK Strategy Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="space-y-2">
            {[
              { pos: "GK", pts: 4, extra: "+1 per 3 saves, +5 penalty save" },
              { pos: "DEF", pts: 4, extra: "Best attacking DEFs also score/assist" },
              { pos: "MID", pts: 1, extra: "Only 1pt CS — focus on attacking output" },
              { pos: "FWD", pts: 0, extra: "No CS points — ignore clean sheets" },
            ].map(row => (
              <div key={row.pos} className="flex items-center justify-between py-1.5 border-b border-surface-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold w-10 ${POSITION_COLORS[row.pos]}`}>{row.pos}</span>
                  <span className={`text-lg font-bold ${row.pts >= 4 ? "text-success-400" : row.pts >= 1 ? "text-surface-300" : "text-surface-500"}`}>
                    {row.pts} pts
                  </span>
                </div>
                <span className="text-xs text-surface-500">{row.extra}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-success-500/20 text-success-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-sm text-surface-200 font-medium">Favour home sides</p>
                <p className="text-xs text-surface-500">Home CS rate ~15% higher on average</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-success-500/20 text-success-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-sm text-surface-200 font-medium">Check xGA, not just CS count</p>
                <p className="text-xs text-surface-500">Low xGA = sustainable. High CS + high xGA = regression candidate</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-success-500/20 text-success-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-sm text-surface-200 font-medium">Double up DEF + GK</p>
                <p className="text-xs text-surface-500">Same-team stack = 8 pts from a single clean sheet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
