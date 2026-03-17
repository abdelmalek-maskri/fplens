import Jersey from "../ui/Jersey";

export default function PitchPlayerCard({ player, onClick, isCaptain, isVice }) {
  const captain = isCaptain ?? player.is_captain;
  const vice = isVice ?? player.is_vice;

  const opacityClass =
    player.status === "i" ? "opacity-50" : player.status === "d" ? "opacity-70" : "";

  return (
    <div className={`flex flex-col items-center gap-0.5 transition-opacity ${opacityClass}`}>
      <Jersey
        teamName={player.team_name}
        position={player.position}
        isCaptain={captain}
        isVice={vice}
        status={player.status}
      />
      <div
        className={`bg-surface-800/95 px-2.5 py-0.5 rounded text-[11px] font-bold text-surface-100 text-center min-w-[72px] max-w-[100px] truncate${onClick ? " cursor-pointer hover:bg-surface-700" : ""} transition-colors`}
        onClick={onClick ? () => onClick(player.element) : undefined}
      >
        {player.web_name}
      </div>
      <div className="bg-surface-800/80 px-2 py-0.5 rounded text-2xs text-center whitespace-nowrap">
        <span className="text-brand-400 font-semibold">{player.predicted_points.toFixed(1)}</span>
        <span className="text-surface-400 mx-0.5">&middot;</span>
        <span className="text-surface-300">{player.opponent_name}</span>
      </div>
    </div>
  );
}
