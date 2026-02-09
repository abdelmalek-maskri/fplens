import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Loading from "./components/Loading";
import { ThemeProvider } from "./lib/theme";

// Lazy-loaded pages — each becomes its own chunk
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyTeam = lazy(() => import("./pages/MyTeam"));
const ModelInsights = lazy(() => import("./pages/ModelInsights"));
const SquadOptimizer = lazy(() => import("./pages/SquadOptimizer"));
const FixtureTicker = lazy(() => import("./pages/FixtureTicker"));
const PlayerComparison = lazy(() => import("./pages/PlayerComparison"));
const WhatIf = lazy(() => import("./pages/WhatIf"));
const RivalTracker = lazy(() => import("./pages/RivalTracker"));

const SetPieceTakers = lazy(() => import("./pages/SetPieceTakers"));
const CleanSheetProb = lazy(() => import("./pages/CleanSheetProb"));
const TransferPlanner = lazy(() => import("./pages/TransferPlanner"));
const RotationPlanner = lazy(() => import("./pages/RotationPlanner"));
const SeasonProgress = lazy(() => import("./pages/SeasonProgress"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/my-team" element={<MyTeam />} />

              <Route path="/insights" element={<ModelInsights />} />
              <Route path="/squad" element={<SquadOptimizer />} />
              <Route path="/fixtures" element={<FixtureTicker />} />
              <Route path="/compare" element={<PlayerComparison />} />
              <Route path="/what-if" element={<WhatIf />} />
              <Route path="/transfers" element={<TransferPlanner />} />
              <Route path="/set-pieces" element={<SetPieceTakers />} />
              <Route path="/clean-sheets" element={<CleanSheetProb />} />
              <Route path="/rival" element={<RivalTracker />} />
              <Route path="/rotation" element={<RotationPlanner />} />
              <Route path="/season" element={<SeasonProgress />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
    </ThemeProvider>
  );
}
