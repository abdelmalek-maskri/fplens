import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ErrorBoundary from "./components/feedback/ErrorBoundary";
import Loading from "./components/feedback/Loading";
import { health } from "./lib/api";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const OptimalXI = lazy(() => import("./pages/OptimalXI"));
const Accuracy = lazy(() => import("./pages/Accuracy"));
const MyTeam = lazy(() => import("./pages/MyTeam"));
const TransferPlanner = lazy(() => import("./pages/TransferPlanner"));
const FixtureTicker = lazy(() => import("./pages/FixtureTicker"));
const PlayerComparison = lazy(() => import("./pages/PlayerComparison"));
const NewsSentiment = lazy(() => import("./pages/NewsSentiment"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const ModelInsights = lazy(() => import("./pages/ModelInsights"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  // Start the API waking as soon as anyone opens the site, rather than when
  // they reach My Team or Transfers. Reading the dashboard takes far longer
  // than a cold start, so by the time those pages ask, the answer is ready.
  //
  // Nothing here reads the result. A failure means those two pages show their
  // own error when the visitor gets there, which is where it belongs; there is
  // nothing to tell someone looking at a page that does not use the API.
  useEffect(() => {
    health().catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/optimal-xi" element={<OptimalXI />} />
              <Route path="/accuracy" element={<Accuracy />} />
              <Route path="/my-team" element={<MyTeam />} />
              <Route path="/transfers" element={<TransferPlanner />} />
              <Route path="/fixtures" element={<FixtureTicker />} />
              <Route path="/compare" element={<PlayerComparison />} />
              <Route path="/news" element={<NewsSentiment />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/insights" element={<ModelInsights />} />
              <Route path="/player/:id" element={<PlayerDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
