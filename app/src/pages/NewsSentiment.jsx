import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TEAM_COLORS } from "../lib/constants";
import TeamBadge from "../components/badges/TeamBadge";
import TabBar from "../components/ui/TabBar";
import { useNews } from "../hooks";
import Loading from "../components/feedback/Loading";
import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";

const PLAYER_TAG_LIMIT = 4;

// The score behind this is a keyword count with five possible values in
// production, so showing "+0.33" claims a precision that does not exist.
// Three words is what the number actually means.
function sentiment(v) {
  if (v >= 0.3)
    return { label: "Positive", text: "text-success-400", border: "border-l-success-400" };
  if (v < 0) return { label: "Negative", text: "text-danger-400", border: "border-l-danger-400" };
  return { label: "Neutral", text: "text-surface-500", border: "border-l-surface-600" };
}

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
          aria-label="Search players or headlines"
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
          <span className="section-label">Most mentioned</span>
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
                  <span className="text-2xs text-surface-500 ml-1.5">{p.mentions} mentions</span>
                </div>
                <span className={`text-2xs ${sentiment(p.avgSentiment).text}`}>
                  {sentiment(p.avgSentiment).label}
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
                  className={`border-l-2 ${sentiment(a.sentiment).border} rounded-r bg-surface-850/50 hover:bg-surface-800/70 transition-colors`}
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
                        <span className={`text-2xs ${sentiment(a.sentiment).text}`}>
                          {sentiment(a.sentiment).label}
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

      <p className="text-2xs text-surface-500 pt-2 border-t border-surface-800">
        Content powered by{" "}
        <a
          href="https://open-platform.theguardian.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-surface-400 hover:text-brand-400 underline underline-offset-2"
        >
          the Guardian Open Platform
        </a>
        . Sentiment labels are generated by this project and are not endorsed by the Guardian.
      </p>
    </div>
  );
}
