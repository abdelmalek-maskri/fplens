import Jersey from "../ui/Jersey";

export default function PitchPlayerCard({ player, onClick, isCaptain, isVice }) {
  const captain = isCaptain ?? player.is_captain;
  const vice = isVice ?? player.is_vice;

  const opacityClass =
    player.status === "i" ? "opacity-50" : player.status === "d" ? "opacity-70" : "";

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick ? () => onClick(player.element) : undefined}
      aria-label={onClick ? `Open ${player.web_name}` : undefined}
      className={`flex flex-col items-center gap-0.5 transition-opacity ${opacityClass}${
        onClick ? " cursor-pointer group" : ""
      }`}
    >
      <Jersey
        teamName={player.team_name}
        position={player.position}
        isCaptain={captain}
        isVice={vice}
        status={player.status}
      />
      <div className="bg-surface-800/95 px-2.5 py-0.5 rounded text-[11px] font-bold text-surface-100 text-center min-w-[72px] max-w-[100px] truncate group-hover:bg-surface-700 group-hover:text-brand-400 transition-colors">
        {player.web_name}
      </div>
      <div className="bg-surface-800/80 px-2 py-0.5 rounded text-2xs text-center whitespace-nowrap">
        <span className="text-brand-400 font-semibold">{player.predicted_points.toFixed(1)}</span>
        <span className="text-surface-400 mx-0.5">&middot;</span>
        <span className="text-surface-300">{player.opponent_name}</span>
      </div>
    </Wrapper>
  );
}
