import { useSearchParams } from "react-router-dom";
import TabBar from "../components/ui/TabBar";
import ErrorState from "../components/feedback/ErrorState";
import Loading from "../components/feedback/Loading";
import { useModelInsights } from "../hooks";
import OverviewTab from "./insights/OverviewTab";
import ShapTab from "./insights/ShapTab";
import AblationTab from "./insights/AblationTab";
import PositionsTab from "./insights/PositionsTab";
import CalibrationTab from "./insights/CalibrationTab";

export default function ModelInsights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { data, isLoading, error } = useModelInsights();
  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load model data." />;
  if (!data) return null;
  const {
    modelVariants,
    baselines,
    positionPerformance,
    ablationConfigs,
    ablationSignificance,
    interactionEffect,
    twoheadMethods,
    shapFeatures,
    ensembleWeights,
    datasetStats,
    calibrationDeciles,
    calibrationStats,
    exampleShap,
    tabs: TABS,
  } = data;

  return (
    <div className="space-y-6 stagger">
      <TabBar
        tabs={TABS}
        active={activeTab}
        onChange={(value) =>
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("tab", value);
            return p;
          })
        }
        id="insights"
        variant="border"
      />

      <div role="tabpanel" id={`insights-panel-${activeTab}`}>
        {activeTab === "overview" && (
          <OverviewTab
            modelVariants={modelVariants}
            baselines={baselines}
            ensembleWeights={ensembleWeights}
            datasetStats={datasetStats}
            twoheadMethods={twoheadMethods}
            ablationConfigs={ablationConfigs}
          />
        )}
        {activeTab === "shap" && <ShapTab shapFeatures={shapFeatures} exampleShap={exampleShap} />}
        {activeTab === "ablation" && (
          <AblationTab
            ablationConfigs={ablationConfigs}
            ablationSignificance={ablationSignificance}
            interactionEffect={interactionEffect}
          />
        )}
        {activeTab === "positions" && <PositionsTab positionPerformance={positionPerformance} />}
        {activeTab === "calibration" && (
          <CalibrationTab
            calibrationDeciles={calibrationDeciles}
            calibrationStats={calibrationStats}
          />
        )}
      </div>
    </div>
  );
}
