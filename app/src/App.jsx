import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Loading from "./components/Loading";

// Lazy-loaded pages — each becomes its own chunk
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OptimalXI = lazy(() => import("./pages/OptimalXI"));
const MyTeam = lazy(() => import("./pages/MyTeam"));
const TransferPlanner = lazy(() => import("./pages/TransferPlanner"));
const FixtureTicker = lazy(() => import("./pages/FixtureTicker"));
const PlayerComparison = lazy(() => import("./pages/PlayerComparison"));
const NewsSentiment = lazy(() => import("./pages/NewsSentiment"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const ModelInsights = lazy(() => import("./pages/ModelInsights"));
const SeasonPlanner = lazy(() => import("./pages/SeasonPlanner"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/optimal-xi" element={<OptimalXI />} />
              <Route path="/my-team" element={<MyTeam />} />
              <Route path="/transfers" element={<TransferPlanner />} />
              <Route path="/fixtures" element={<FixtureTicker />} />
              <Route path="/compare" element={<PlayerComparison />} />
              <Route path="/news" element={<NewsSentiment />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/insights" element={<ModelInsights />} />
              <Route path="/season-planner" element={<SeasonPlanner />} />
              <Route path="/player/:id" element={<PlayerDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
