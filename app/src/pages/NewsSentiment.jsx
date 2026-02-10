import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TEAM_COLORS, POSITION_COLORS } from "../lib/constants";
import TeamBadge from "../components/TeamBadge";

// ============================================================
// MOCK NEWS DATA — Guardian NLP pipeline output
// Will be replaced with: GET /api/news?days=7
// Pipeline: Guardian API → spaCy NER (player extraction) → RoBERTa sentiment
// ============================================================
const mockArticles = [
  {
    id: 1,
    headline: "Haaland in contention for Ballon d'Or after record-breaking run",
    source: "The Guardian",
    date: "2025-02-08",
    sentiment: 0.85,
    players: [{ element: 2, web_name: "Haaland", team_name: "MCI", position: "FWD" }],
    injury_flag: false,
    snippet: "Erling Haaland's extraordinary goalscoring form has put him firmly in the conversation for this year's Ballon d'Or, with 18 goals in 21 Premier League appearances.",
  },
  {
    id: 2,
    headline: "Salah contract saga continues as Liverpool weigh options",
    source: "The Guardian",
    date: "2025-02-07",
    sentiment: -0.15,
    players: [{ element: 3, web_name: "Salah", team_name: "LIV", position: "MID" }],
    injury_flag: false,
    snippet: "Mohamed Salah's future at Anfield remains uncertain with negotiations reportedly stalling over contract length and wages.",
  },
  {
    id: 3,
    headline: "Saka doubtful for Chelsea clash with muscle injury",
    source: "The Guardian",
    date: "2025-02-07",
    sentiment: -0.62,
    players: [{ element: 5, web_name: "Saka", team_name: "ARS", position: "MID" }],
    injury_flag: true,
    snippet: "Bukayo Saka is a doubt for Arsenal's London derby against Chelsea after picking up a muscle problem in training.",
  },
  {
    id: 4,
    headline: "Palmer dazzles as Chelsea close gap on leaders",
    source: "The Guardian",
    date: "2025-02-06",
    sentiment: 0.78,
    players: [{ element: 7, web_name: "Palmer", team_name: "CHE", position: "MID" }],
    injury_flag: false,
    snippet: "Cole Palmer scored twice and provided an assist as Chelsea dismantled Wolves at Stamford Bridge.",
  },
  {
    id: 5,
    headline: "Manchester City eye title charge as Haaland leads scoring charts",
    source: "The Guardian",
    date: "2025-02-05",
    sentiment: 0.72,
    players: [{ element: 2, web_name: "Haaland", team_name: "MCI", position: "FWD" }],
    injury_flag: false,
    snippet: "Pep Guardiola's side are building momentum in the title race, with Haaland's 18 league goals powering their charge.",
  },
  {
    id: 6,
    headline: "Watkins facing extended spell on sidelines with hamstring problem",
    source: "The Guardian",
    date: "2025-02-05",
    sentiment: -0.78,
    players: [{ element: 10, web_name: "Watkins", team_name: "AVL", position: "FWD" }],
    injury_flag: true,
    snippet: "Aston Villa striker Ollie Watkins could miss up to three weeks after scans revealed a hamstring injury sustained in training.",
  },
  {
    id: 7,
    headline: "Isak's hot streak continues with brace against Wolves",
    source: "The Guardian",
    date: "2025-02-04",
    sentiment: 0.81,
    players: [{ element: 50, web_name: "Isak", team_name: "NEW", position: "FWD" }],
    injury_flag: false,
    snippet: "Alexander Isak scored twice as Newcastle cruised to a comfortable victory, taking his tally to 12 Premier League goals this season.",
  },
  {
    id: 8,
    headline: "Salah scores twice in dominant Liverpool display",
    source: "The Guardian",
    date: "2025-02-03",
    sentiment: 0.82,
    players: [{ element: 3, web_name: "Salah", team_name: "LIV", position: "MID" }],
    injury_flag: false,
    snippet: "Mohamed Salah put contract uncertainty to one side with a devastating two-goal performance as Liverpool moved top of the table.",
  },
  {
    id: 9,
    headline: "Alexander-Arnold linked with Real Madrid as contract talks stall",
    source: "The Guardian",
    date: "2025-02-03",
    sentiment: -0.32,
    players: [{ element: 15, web_name: "Alexander-Arnold", team_name: "LIV", position: "DEF" }],
    injury_flag: false,
    snippet: "Trent Alexander-Arnold's future at Liverpool is in question with reports of interest from Real Madrid intensifying.",
  },
  {
    id: 10,
    headline: "Guardiola praises Haaland's work rate in emphatic victory",
    source: "The Guardian",
    date: "2025-02-01",
    sentiment: 0.68,
    players: [{ element: 2, web_name: "Haaland", team_name: "MCI", position: "FWD" }],
    injury_flag: false,
    snippet: "Pep Guardiola singled out Erling Haaland for special praise after the Norwegian's all-round display in City's 4-1 win.",
  },
  {
    id: 11,
    headline: "Mbeumo emerges as Brentford's talisman in Toney's absence",
    source: "The Guardian",
    date: "2025-02-01",
    sentiment: 0.55,
    players: [{ element: 40, web_name: "Mbeumo", team_name: "BRE", position: "MID" }],
    injury_flag: false,
    snippet: "Bryan Mbeumo has stepped up as Brentford's primary attacking threat, with 10 goals making him one of the bargains of the season.",
  },
  {
    id: 12,
    headline: "Gabriel's aerial threat makes Arsenal set-piece kings",
    source: "The Guardian",
    date: "2025-01-31",
    sentiment: 0.48,
    players: [{ element: 12, web_name: "Gabriel", team_name: "ARS", position: "DEF" }],
    injury_flag: false,
    snippet: "Gabriel Magalhães has scored four goals from set-pieces this season, making Arsenal the most dangerous team from dead-ball situations.",
  },
  {
    id: 13,
    headline: "Raya's save percentage best in Europe as Arsenal tighten up",
    source: "The Guardian",
    date: "2025-01-30",
    sentiment: 0.61,
    players: [{ element: 20, web_name: "Raya", team_name: "ARS", position: "GK" }],
    injury_flag: false,
    snippet: "David Raya's 78% save rate ranks highest among goalkeepers in Europe's top five leagues this season.",
  },
  {
    id: 14,
    headline: "Palmer and Saka lead new generation of English playmakers",
    source: "The Guardian",
    date: "2025-01-29",
    sentiment: 0.45,
    players: [
      { element: 7, web_name: "Palmer", team_name: "CHE", position: "MID" },
      { element: 5, web_name: "Saka", team_name: "ARS", position: "MID" },
    ],
    injury_flag: false,
    snippet: "Cole Palmer and Bukayo Saka are redefining the creative midfielder role in English football.",
  },
];

// Unique teams from articles
const TEAMS = [...new Set(mockArticles.flatMap((a) => a.players.map((p) => p.team_name)))].sort();

// ============================================================
// SENTIMENT DOT
// ============================================================
const SentimentDot = ({ value }) => {
  const color =
    value >= 0.5 ? "bg-success-400" : value >= 0 ? "bg-surface-400" : "bg-danger-400";
  return <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${color}`} />;
};

// ============================================================
// SENTIMENT BAR (for player summary)
// ============================================================
const SentimentBar = ({ value }) => {
  // value from -1 to 1, center at 0
  const pct = ((value + 1) / 2) * 100;
  return (
    <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${value >= 0.3 ? "bg-success-400" : value >= 0 ? "bg-surface-400" : "bg-danger-400"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ============================================================
// NEWS & SENTIMENT PAGE
// ============================================================
export default function NewsSentiment() {
  const navigate = useNavigate();
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [sentimentFilter, setSentimentFilter] = useState("ALL"); // ALL, positive, negative, injury
  const [searchQuery, setSearchQuery] = useState("");

  // Compute trending players — most mentioned, with avg sentiment
  const trendingPlayers = useMemo(() => {
    const playerMap = {};
    mockArticles.forEach((article) => {
      article.players.forEach((p) => {
        if (!playerMap[p.element]) {
          playerMap[p.element] = {
            ...p,
            mentions: 0,
            totalSentiment: 0,
            injuryMentions: 0,
            latestDate: article.date,
          };
        }
        playerMap[p.element].mentions += 1;
        playerMap[p.element].totalSentiment += article.sentiment;
        if (article.injury_flag) playerMap[p.element].injuryMentions += 1;
        if (article.date > playerMap[p.element].latestDate) {
          playerMap[p.element].latestDate = article.date;
        }
      });
    });

    return Object.values(playerMap)
      .map((p) => ({ ...p, avgSentiment: p.totalSentiment / p.mentions }))
      .sort((a, b) => b.mentions - a.mentions);
  }, []);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return mockArticles.filter((a) => {
      if (teamFilter !== "ALL" && !a.players.some((p) => p.team_name === teamFilter)) return false;
      if (sentimentFilter === "positive" && a.sentiment < 0.3) return false;
      if (sentimentFilter === "negative" && a.sentiment >= 0) return false;
      if (sentimentFilter === "injury" && !a.injury_flag) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesHeadline = a.headline.toLowerCase().includes(q);
        const matchesPlayer = a.players.some((p) => p.web_name.toLowerCase().includes(q));
        if (!matchesHeadline && !matchesPlayer) return false;
      }
      return true;
    });
  }, [teamFilter, sentimentFilter, searchQuery]);

  // Sentiment summary stats
  const stats = useMemo(() => {
    const total = mockArticles.length;
    const positive = mockArticles.filter((a) => a.sentiment >= 0.3).length;
    const negative = mockArticles.filter((a) => a.sentiment < 0).length;
    const injuries = mockArticles.filter((a) => a.injury_flag).length;
    return { total, positive, negative, injuries };
  }, []);

  return (
    <div className="space-y-6 stagger">
      {/* Stat strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">{stats.total}</span>
          <span className="text-xs text-surface-500 ml-1">articles</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-success-400 font-data tabular-nums">{stats.positive}</span>
          <span className="text-xs text-surface-500 ml-1">positive</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-danger-400 font-data tabular-nums">{stats.negative}</span>
          <span className="text-xs text-surface-500 ml-1">negative</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-warning-400 font-data tabular-nums">{stats.injuries}</span>
          <span className="text-xs text-surface-500 ml-1">injury alerts</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <input
          type="text"
          placeholder="Search players or headlines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded px-3 py-1.5 text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-500/50 w-56"
        />

        {/* Team filter */}
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-brand-500/50"
        >
          <option value="ALL">All teams</option>
          {TEAMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Sentiment tabs */}
        <div className="flex items-center gap-0 border-b border-surface-700 ml-auto">
          {[
            { key: "ALL", label: "All" },
            { key: "positive", label: "Positive" },
            { key: "negative", label: "Negative" },
            { key: "injury", label: "Injuries" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSentimentFilter(tab.key)}
              className={`px-3 py-1.5 text-xs transition-colors border-b-2 -mb-px ${
                sentimentFilter === tab.key
                  ? "border-brand-400 text-brand-400"
                  : "border-transparent text-surface-500 hover:text-surface-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column: trending players + articles */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Trending players */}
        <div>
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Trending players
          </span>
          <div className="mt-3 space-y-0">
            {trendingPlayers.map((p, i) => (
              <div
                key={p.element}
                className="flex items-center gap-2.5 py-2 border-b border-surface-800/60 last:border-0 group cursor-pointer"
                style={{ borderLeftColor: TEAM_COLORS[p.team_name], borderLeftWidth: 2 }}
                onClick={() => navigate(`/player/${p.element}`)}
              >
                <span className="text-xs text-surface-600 w-4 text-right font-data tabular-nums">
                  {i + 1}
                </span>
                <TeamBadge team={p.team_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-surface-200 group-hover:text-brand-400 transition-colors">
                    {p.web_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-surface-500">{p.mentions} mentions</span>
                    {p.injuryMentions > 0 && (
                      <span className="text-2xs text-warning-400">injury</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-xs font-data tabular-nums ${
                    p.avgSentiment >= 0.3 ? "text-success-400" : p.avgSentiment >= 0 ? "text-surface-400" : "text-danger-400"
                  }`}>
                    {p.avgSentiment > 0 ? "+" : ""}{p.avgSentiment.toFixed(2)}
                  </span>
                  <SentimentBar value={p.avgSentiment} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Articles list */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
              Recent articles
            </span>
            <span className="text-2xs text-surface-600">
              {filteredArticles.length} of {mockArticles.length}
            </span>
          </div>

          {filteredArticles.length === 0 ? (
            <p className="text-sm text-surface-600 py-8 text-center">No articles match filters</p>
          ) : (
            <div className="space-y-0">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  className="py-3 border-b border-surface-800/60 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <SentimentDot value={article.sentiment} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-200 leading-snug">
                        {article.headline}
                      </p>
                      <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                        {article.snippet}
                      </p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-2xs text-surface-600">{article.date}</span>
                        <span className="text-2xs text-surface-600">{article.source}</span>
                        <span className={`text-2xs font-data tabular-nums ${
                          article.sentiment >= 0.5 ? "text-success-400" : article.sentiment >= 0 ? "text-surface-400" : "text-danger-400"
                        }`}>
                          {article.sentiment > 0 ? "+" : ""}{article.sentiment.toFixed(2)}
                        </span>
                        {article.injury_flag && (
                          <span className="text-2xs text-warning-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Injury
                          </span>
                        )}
                        {/* Player tags */}
                        {article.players.map((p) => (
                          <button
                            key={p.element}
                            onClick={() => navigate(`/player/${p.element}`)}
                            className="inline-flex items-center gap-1 text-2xs text-surface-400 hover:text-brand-400 transition-colors"
                          >
                            <TeamBadge team={p.team_name} size="xs" />
                            <span>{p.web_name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Player sentiment summary table */}
      <div>
        <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
          Player sentiment summary
        </span>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="py-2 pr-4 text-xs text-surface-500 font-medium">Player</th>
                <th className="py-2 pr-4 text-xs text-surface-500 font-medium text-center">Mentions</th>
                <th className="py-2 pr-4 text-xs text-surface-500 font-medium text-center">Avg sentiment</th>
                <th className="py-2 pr-4 text-xs text-surface-500 font-medium text-center">Injury</th>
                <th className="py-2 text-xs text-surface-500 font-medium">Latest</th>
              </tr>
            </thead>
            <tbody>
              {trendingPlayers.map((p) => (
                <tr
                  key={p.element}
                  className="border-b border-surface-800/40 hover:bg-surface-800/30 cursor-pointer transition-colors"
                  style={{ borderLeftColor: TEAM_COLORS[p.team_name], borderLeftWidth: 2 }}
                  onClick={() => navigate(`/player/${p.element}`)}
                >
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <TeamBadge team={p.team_name} size="sm" />
                      <span className="text-surface-200 hover:text-brand-400 transition-colors">{p.web_name}</span>
                      <span className={`text-2xs ${POSITION_COLORS[p.position]}`}>{p.position}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-center">
                    <span className="font-data tabular-nums text-surface-200">{p.mentions}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center justify-center gap-2">
                      <SentimentBar value={p.avgSentiment} />
                      <span className={`text-xs font-data tabular-nums ${
                        p.avgSentiment >= 0.3 ? "text-success-400" : p.avgSentiment >= 0 ? "text-surface-400" : "text-danger-400"
                      }`}>
                        {p.avgSentiment > 0 ? "+" : ""}{p.avgSentiment.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-center">
                    {p.injuryMentions > 0 ? (
                      <span className="text-warning-400 text-xs">{p.injuryMentions}</span>
                    ) : (
                      <span className="text-surface-700">—</span>
                    )}
                  </td>
                  <td className="py-2 text-2xs text-surface-500">{p.latestDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
