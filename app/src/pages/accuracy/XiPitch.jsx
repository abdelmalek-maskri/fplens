import Jersey from "../../components/ui/Jersey";
import PitchLayout from "../../components/pitch/PitchLayout";

const ROWS = ["GK", "DEF", "MID", "FWD"];

/**
 * The eleven a model picked, laid out on a pitch, showing what each one scored.
 *
 * Not components/pitch/PitchView, which this looked like a job for. That one
 * renders a squad: it needs team_name, predicted_points and opponent_name, and
 * draws a substitutes bench underneath. The accuracy log keeps none of those,
 * only element, name, position, actual and captain, so PitchView would read
 * undefined.toFixed and there is no bench to draw.
 *
 * PitchLayout and Jersey are shared, so the pitch still looks like the one on
 * My Team. Jersey falls back to a neutral kit when it is given no club, which
 * is what happens here.
 */
export default function XiPitch({ players }) {
  const byRow = ROWS.map((pos) => players.filter((p) => p.position === pos)).filter(
    (row) => row.length > 0
  );

  return (
    <div className="card overflow-hidden">
      <PitchLayout id="accuracy-xi">
        <div
          className="relative z-10 flex flex-col justify-around px-4 py-8"
          style={{ minHeight: "520px" }}
        >
          {byRow.map((row, i) => (
            <div key={ROWS[i]} className="flex justify-center gap-3 sm:gap-5 lg:gap-8 flex-wrap">
              {row.map((p) => (
                <Player key={p.element} player={p} />
              ))}
            </div>
          ))}
        </div>
      </PitchLayout>
    </div>
  );
}

function Player({ player }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Jersey
        teamName={undefined}
        position={player.position}
        isCaptain={player.captain}
        isVice={false}
      />
      <div className="bg-surface-200/95 px-2.5 py-0.5 rounded text-[11px] font-bold text-surface-900 text-center min-w-[72px] max-w-[100px] truncate">
        {player.name}
      </div>
      {/* The score, not a prediction: this pitch is what happened, and the
          same badge on My Team shows what is expected to happen. */}
      <div className="bg-surface-200/80 px-2 py-0.5 rounded text-2xs text-center whitespace-nowrap">
        <span className="font-data tabular-nums font-semibold text-surface-900">
          {player.actual ?? "-"}
        </span>
        <span className="text-surface-600 ml-1">{player.actual === 1 ? "pt" : "pts"}</span>
      </div>
    </div>
  );
}
