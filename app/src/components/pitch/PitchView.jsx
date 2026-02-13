import Jersey from "../Jersey";
import PitchPlayerCard from "./PitchPlayerCard";
import PitchLayout from "./PitchLayout";

/**
 * Full pitch visualization with formation rows and bench.
 *
 * @param {Array}    starters      - Starting 11 players
 * @param {Array}    bench         - Bench players (ordered)
 * @param {function} onPlayerClick - Optional, receives player.element
 * @param {number}   captainId     - Explicit captain element ID (falls back to player.is_captain)
 * @param {number}   viceId        - Explicit vice element ID (falls back to player.is_vice)
 * @param {string}   id            - SVG namespace ID (default: "pitch")
 * @param {string}   benchLabel    - Label above bench row (default: "Substitutes")
 */
export default function PitchView({
  starters,
  bench,
  onPlayerClick,
  captainId,
  viceId,
  id = "pitch",
  benchLabel = "Substitutes",
}) {
  const gk = starters.filter((p) => p.position === "GK");
  const def = starters.filter((p) => p.position === "DEF");
  const mid = starters.filter((p) => p.position === "MID");
  const fwd = starters.filter((p) => p.position === "FWD");

  const renderCard = (p) => (
    <PitchPlayerCard
      key={p.element}
      player={p}
      onClick={onPlayerClick}
      isCaptain={captainId != null ? p.element === captainId : undefined}
      isVice={viceId != null ? p.element === viceId : undefined}
    />
  );

  return (
    <div className="card overflow-hidden">
      <PitchLayout id={id}>
        <div className="relative z-10 flex flex-col justify-around py-8 px-4" style={{ minHeight: "560px" }}>
          <div className="flex justify-center gap-8">
            {gk.map(renderCard)}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {def.map(renderCard)}
          </div>
          <div className="flex justify-center gap-3 sm:gap-5 lg:gap-8">
            {mid.map(renderCard)}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {fwd.map(renderCard)}
          </div>
        </div>
      </PitchLayout>

      {/* Bench */}
      <div className="bg-surface-800/60 px-4 py-4 border-t border-surface-700">
        <p className="section-label mb-4">
          {benchLabel}
        </p>
        <div className="flex justify-around">
          {bench.map((p, idx) => (
            <div key={p.element} className="flex flex-col items-center gap-0.5">
              <span className="text-2xs text-surface-500 font-medium mb-1">{idx + 1}</span>
              <Jersey
                teamName={p.team_name}
                position={p.position}
                isCaptain={false}
                isVice={false}
                status={p.status}
              />
              <div
                className={`bg-surface-700/80 px-2 py-0.5 rounded-sm text-[11px] font-semibold text-surface-300 text-center min-w-[72px] max-w-[100px] truncate${onPlayerClick ? " cursor-pointer hover:text-brand-400" : ""} transition-colors`}
                onClick={onPlayerClick ? () => onPlayerClick(p.element) : undefined}
              >
                {p.web_name}
              </div>
              <div className="text-2xs text-surface-500 whitespace-nowrap">
                {p.predicted_points.toFixed(1)} &middot; {p.opponent_name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
