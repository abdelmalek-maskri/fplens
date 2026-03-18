import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TEAM_COLORS, POSITION_COLORS } from "../lib/constants";
import TeamBadge from "../components/badges/TeamBadge";
import TabBar from "../components/ui/TabBar";
import { useNews } from "../hooks";
import Loading from "../components/feedback/Loading";
import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";

const PLAYER_TAG_LIMIT = 4;

function sentimentBorderClass(v) {
  if (v >= 0.3) return "border-l-success-400";
  if (v >= 0) return "border-l-surface-600";
  return "border-l-danger-400";
}

function sentimentTextClass(v) {
  if (v >= 0.3) return "text-success-400";
  if (v >= 0) return "text-surface-400";
  return "text-danger-400";
}

const SentimentBar = ({ value }) => {
  const pct = ((value + 1) / 2) * 100;
  const bg = value >= 0.3 ? "bg-success-400" : value >= 0 ? "bg-surface-400" : "bg-danger-400";
  return (
    <div className="w-24 h-2 bg-surface-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

function PlayerTags({ players, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? players : players.slice(0, PLAYER_TAG_LIMIT);
  const overflow = players.length - PLAYER_TAG_LIMIT;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visible.map((p) => (
        <button
          key={p.element}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(`/player/${p.element}`);
          }}
          className="inline-flex items-center gap-1 text-2xs text-surface-400 hover:text-brand-400 transition-colors"
        >
          <TeamBadge team={p.team_name} size="xs" />
          <span>{p.web_name}</span>
        </button>
      ))}
      {overflow > 0 && !expanded && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(true);
          }}
          className="text-2xs text-surface-500 hover:text-surface-300 transition-colors"
        >
          +{overflow} more
        </button>
      )}
    </div>
  );
}

export default function NewsSentiment() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sentimentFilter = searchParams.get("sentiment") || "ALL";
  const setSentimentFilter = (value) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("sentiment", value);
      return p;
    });
  };
  const { data: newsData, isLoading, error } = useNews();
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const articles = useMemo(() => (newsData ? newsData.articles : []), [newsData]);

  const TEAMS = useMemo(
    () => [...new Set(articles.flatMap((a) => a.players.map((p) => p.team_name)))].sort(),
    [articles]
  );

  const trendingPlayers = useMemo(() => {
    const playerMap = {};
    articles.forEach((article) => {
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
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 20);
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
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
  }, [articles, teamFilter, sentimentFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = articles.length;
    const positive = articles.filter((a) => a.sentiment >= 0.3).length;
    const negative = articles.filter((a) => a.sentiment < 0).length;
    const injuries = articles.filter((a) => a.injury_flag).length;
    return { total, positive, negative, injuries };
  }, [articles]);

  if (isLoading) return <Loading />;

  if (error) return <ErrorState message="Failed to load news articles." />;

  if (!newsData) return null;

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            {stats.total}
          </span>
          <span className="text-xs text-surface-500 ml-1">articles</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-success-400 font-data tabular-nums">
            {stats.positive}
          </span>
          <span className="text-xs text-surface-500 ml-1">positive</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-danger-400 font-data tabular-nums">
            {stats.negative}
          </span>
          <span className="text-xs text-surface-500 ml-1">negative</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-warning-400 font-data tabular-nums">
            {stats.injuries}
          </span>
          <span className="text-xs text-surface-500 ml-1">injury alerts</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search players or headlines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded px-3 py-1.5 text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-500/50 w-56"
        />

        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-brand-500/50"
        >
          <option value="ALL">All teams</option>
          {TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <TabBar
          tabs={[
            { id: "ALL", label: "All" },
            { id: "positive", label: "Positive" },
            { id: "negative", label: "Negative" },
            { id: "injury", label: "Injuries" },
          ]}
          active={sentimentFilter}
          onChange={setSentimentFilter}
          id="sentiment"
          variant="border"
          className="ml-auto"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="lg:sticky lg:top-[44px] lg:self-start">
          <span className="section-label">Trending players</span>
          <div className="flex items-center justify-between mt-2 mb-1 text-2xs text-surface-500">
            <span>Player</span>
            <span className="text-surface-600">Sentiment</span>
          </div>
          <div className="mt-3 space-y-0 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:scrollbar-thin">
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
                  <span className="text-2xs text-surface-500">{p.mentions} mentions</span>
                </div>
                <span
                  className={`text-xs font-data tabular-nums ${sentimentTextClass(p.avgSentiment)}`}
                >
                  {p.avgSentiment > 0 ? "+" : ""}
                  {p.avgSentiment.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="section-label mb-3 block">Recent articles</span>

          {filteredArticles.length === 0 ? (
            <EmptyState
              title="No articles found"
              message="Try adjusting your filters or search query."
            />
          ) : (
            <div className="space-y-2">
              {filteredArticles.map((a) => (
                <div
                  key={a.id}
                  className={`border-l-2 ${sentimentBorderClass(a.sentiment)} rounded-r bg-surface-850/50 hover:bg-surface-800/70 transition-colors`}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-surface-200 leading-snug flex-1">
                        {a.url ? (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-surface-100 transition-colors"
                          >
                            {a.headline}
                            <svg
                              className="inline-block w-3 h-3 ml-1.5 text-surface-600 hover:text-brand-400 transition-colors -translate-y-px"
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path
                                d="M3.5 1.5h7m0 0v7m0-7L2 10"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </a>
                        ) : (
                          a.headline
                        )}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.injury_flag && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning-400/10 text-warning-400 text-2xs font-medium">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Injury
                          </span>
                        )}
                        <span
                          className={`text-xs font-data tabular-nums font-medium ${sentimentTextClass(a.sentiment)}`}
                        >
                          {a.sentiment > 0 ? "+" : ""}
                          {a.sentiment.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-surface-500 mt-1.5 leading-relaxed line-clamp-2">
                      {a.snippet}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      <span className="text-2xs text-surface-600">{a.date}</span>
                      <span className="text-2xs text-surface-600">{a.source}</span>
                      <div className="flex-1" />
                      <PlayerTags players={a.players} navigate={navigate} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <span className="section-label">Player sentiment summary</span>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th scope="col" className="py-2 pr-4 text-xs text-surface-500 font-medium">
                  Player
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 text-xs text-surface-500 font-medium text-center"
                >
                  Mentions
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 text-xs text-surface-500 font-medium text-center"
                >
                  Avg sentiment
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 text-xs text-surface-500 font-medium text-center"
                >
                  Injury
                </th>
                <th scope="col" className="py-2 text-xs text-surface-500 font-medium">
                  Latest
                </th>
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
                      <span className="text-surface-200 hover:text-brand-400 transition-colors">
                        {p.web_name}
                      </span>
                      <span className={`text-2xs ${POSITION_COLORS[p.position]}`}>
                        {p.position}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-center">
                    <span className="font-data tabular-nums text-surface-200">{p.mentions}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center justify-center gap-2">
                      <SentimentBar value={p.avgSentiment} />
                      <span
                        className={`text-xs font-data tabular-nums ${sentimentTextClass(p.avgSentiment)}`}
                      >
                        {p.avgSentiment > 0 ? "+" : ""}
                        {p.avgSentiment.toFixed(2)}
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
