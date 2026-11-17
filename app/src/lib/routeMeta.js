/**
 * What each route is called and what it is for.
 *
 * Read twice: the header shows `name` as the page title, and the build writes
 * a real HTML file per route carrying both fields in its head. Keeping one
 * source means the tab title and the link preview cannot drift apart.
 *
 * Descriptions are written for someone who has not seen the site, because the
 * place they appear is a link preview in a chat or a search result.
 */
export const SITE_NAME = "FPLens";

export const ROUTE_META = {
  "/": {
    name: "Dashboard",
    description:
      "Predicted points for every Premier League player this gameweek, from gradient-boosted models trained on nine seasons of Fantasy Premier League data.",
  },
  "/optimal-xi": {
    name: "Optimal XI",
    description:
      "The best squad £100m can buy this gameweek, solved as an integer program under the budget, position and three-per-club rules.",
  },
  "/accuracy": {
    name: "Accuracy",
    description:
      "How close each model's predicted points came to what players actually scored, gameweek by gameweek, scored after the fact.",
  },
  "/my-team": {
    name: "My Team",
    description:
      "Enter an FPL ID to see predicted points for your own squad, with a suggested captain and starting eleven.",
  },
  "/transfers": {
    name: "Transfers",
    description:
      "Suggested transfers for your squad: the best affordable replacement at each position, within budget and the three-per-club cap.",
  },
  "/fixtures": {
    name: "Fixture Ticker",
    description:
      "Upcoming fixture difficulty for every club, so you can see which teams have an easy run and which have a hard one.",
  },
  "/compare": {
    name: "Player Compare",
    description:
      "Put two players side by side on form, fixtures, underlying numbers and predicted points.",
  },
  "/news": {
    name: "News & Sentiment",
    description:
      "Guardian football coverage linked to FPL players, with a sentiment score per article and per player.",
  },
  "/watchlist": {
    name: "Watchlist",
    description:
      "Track the players you are considering and see their predicted points in one place.",
  },
  "/insights": {
    name: "Model Insights",
    description:
      "How the models work and how well: feature importance, ablation results, calibration and the ensemble's weights.",
  },
};

/** The browser tab title for a route, or the bare site name if it has none. */
export function pageTitle(path) {
  const meta = ROUTE_META[path];
  if (!meta || path === "/") return SITE_NAME;
  return `${meta.name} · ${SITE_NAME}`;
}
