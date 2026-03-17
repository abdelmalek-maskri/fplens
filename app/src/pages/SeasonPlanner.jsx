import { PitchView } from "../components/pitch";
import ErrorState from "../components/ErrorState";
import { SkeletonStatStrip, SkeletonPitch } from "../components/skeletons";
import { useSeasonPlanner } from "../hooks";

export default function SeasonPlanner() {
  const { data: plannerData, isLoading, error } = useSeasonPlanner();

  const recommended = plannerData?.recommended;
  const BUDGET = plannerData?.budget ?? 100;

  if (isLoading)
    return (
      <div className="space-y-6">
        <SkeletonStatStrip items={4} />
        <SkeletonPitch id="season-sk" />
      </div>
    );
  if (error) return <ErrorState message="Failed to load season data." />;
  if (!plannerData || !recommended) return <ErrorState message="No squad data available." />;

  return (
    <div className="space-y-6 stagger">
      {/* Stats strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-brand-400 font-data tabular-nums">
            {recommended.totalPoints.toFixed(1)}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            £{recommended.totalValue.toFixed(1)}m
          </span>
          <span className="text-xs text-surface-500 ml-1.5">/ £{BUDGET}m</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-sm font-semibold text-surface-100">{recommended.formation}</span>
          <span className="text-xs text-surface-500 ml-1.5">formation</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span
            className={`text-sm font-semibold ${recommended.budgetRemaining >= 0 ? "text-success-400" : "text-danger-400"}`}
          >
            £{recommended.budgetRemaining.toFixed(1)}m
          </span>
          <span className="text-xs text-surface-500 ml-1.5">remaining</span>
        </div>
      </div>

      {/* Pitch view */}
      <PitchView
        starters={recommended.starters}
        bench={recommended.bench}
        captainId={recommended.captainId}
        viceId={recommended.viceId}
        id="season"
        benchLabel="Bench"
      />
    </div>
  );
}
