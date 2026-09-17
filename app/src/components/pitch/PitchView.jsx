import Jersey from "../ui/Jersey";
import PitchPlayerCard from "./PitchPlayerCard";
import PitchLayout from "./PitchLayout";

export default function PitchView({
  starters,
  bench,
  onPlayerClick,
  captainId,
  viceId,
  id = "pitch",
  benchLabel = "Substitutes",
  fill = false,
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

  // fill: take the height the parent gives and spread the rows over it, so
  // a page can size the pitch to the viewport instead of the pitch sizing the
  // page. Default keeps a fixed minimum so it reads well inside a long page.
  return (
    <div className={`card overflow-hidden ${fill ? "flex flex-col h-full" : ""}`}>
      <PitchLayout id={id} className={fill ? "flex-1 min-h-0" : ""}>
        <div
          className={`relative z-10 flex flex-col justify-around px-4 ${fill ? "h-full py-4" : "py-8"}`}
          style={fill ? undefined : { minHeight: "560px" }}
        >
          <div className="flex justify-center gap-8">{gk.map(renderCard)}</div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">{def.map(renderCard)}</div>
          <div className="flex justify-center gap-3 sm:gap-5 lg:gap-8">{mid.map(renderCard)}</div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">{fwd.map(renderCard)}</div>
        </div>
      </PitchLayout>

      <div className="bg-surface-800/60 px-4 py-3 border-t border-surface-700 shrink-0">
        <p className="section-label mb-3">{benchLabel}</p>
        <div className="flex justify-around">
          {bench.map((p, idx) => {
            const Wrapper = onPlayerClick ? "button" : "div";
            return (
              <Wrapper
                key={p.element}
                type={onPlayerClick ? "button" : undefined}
                onClick={onPlayerClick ? () => onPlayerClick(p.element) : undefined}
                aria-label={onPlayerClick ? `Open ${p.web_name}` : undefined}
                className={`flex flex-col items-center gap-0.5${onPlayerClick ? " cursor-pointer group" : ""}`}
              >
                <span className="text-2xs text-surface-500 font-medium mb-1">{idx + 1}</span>
                <Jersey
                  teamName={p.team_name}
                  position={p.position}
                  isCaptain={false}
                  isVice={false}
                  status={p.status}
                />
                <div className="bg-surface-700/80 px-2 py-0.5 rounded-sm text-[11px] font-semibold text-surface-300 text-center min-w-[72px] max-w-[100px] truncate group-hover:text-brand-400 transition-colors">
                  {p.web_name}
                </div>
                <div className="text-2xs text-surface-500 whitespace-nowrap">
                  {p.predicted_points.toFixed(1)} &middot; {p.opponent_name}
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}
