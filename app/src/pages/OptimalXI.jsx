import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PitchView } from "../components/pitch";
import ErrorState from "../components/feedback/ErrorState";
import Loading from "../components/feedback/Loading";
import { useOptimalXI } from "../hooks";

export default function OptimalXI() {
  const navigate = useNavigate();
  const [modelId, setModelId] = useState(null);
  const { data: plannerData, isLoading, error } = useOptimalXI(modelId);

  const recommended = plannerData?.recommended;
  const BUDGET = plannerData?.budget ?? 100;

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load season data." />;
  if (!plannerData || !recommended) return <ErrorState message="No squad data available." />;

  // Header is 2.75rem and the page has 1.25rem padding top and bottom, so this
  // is the full viewport on a desktop. Phones cannot fit a pitch and bench in
  // one screen whatever we do, so they keep scrolling.
  return (
    <div className="flex flex-col gap-4 stagger lg:h-[calc(100vh-5.25rem)]">
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-200 shrink-0">
        <div>
          <span className="text-lg font-bold text-brand-700 font-data tabular-nums">
            {recommended.totalPoints.toFixed(1)}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-300" />
        <div>
          <span className="text-lg font-bold text-surface-900 font-data tabular-nums">
            £{recommended.totalValue.toFixed(1)}m
          </span>
          <span className="text-xs text-surface-500 ml-1.5">/ £{BUDGET}m</span>
        </div>
        <div className="w-px h-5 bg-surface-300" />
        <div>
          <span className="text-sm font-semibold text-surface-900">{recommended.formation}</span>
          <span className="text-xs text-surface-500 ml-1.5">formation</span>
        </div>
        <div className="w-px h-5 bg-surface-300" />
        <div>
          <span
            className={`text-sm font-semibold ${recommended.budgetRemaining >= 0 ? "text-success-400" : "text-danger-400"}`}
          >
            £{recommended.budgetRemaining.toFixed(1)}m
          </span>
          <span className="text-xs text-surface-500 ml-1.5">remaining</span>
        </div>

        {plannerData.models?.length > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-surface-500">Picked by</span>
            <select
              value={plannerData.selected}
              onChange={(e) => setModelId(e.target.value)}
              aria-label="Which model picks the squad"
              className="bg-surface-200 border border-surface-300 rounded px-3 py-1.5 text-sm text-surface-800 focus:outline-none cursor-pointer"
            >
              {plannerData.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <PitchView
          starters={recommended.starters}
          bench={recommended.bench}
          captainId={recommended.captainId}
          viceId={recommended.viceId}
          id="season"
          benchLabel="Bench"
          onPlayerClick={(id) => navigate(`/player/${id}`)}
          fill
        />
      </div>
    </div>
  );
}
