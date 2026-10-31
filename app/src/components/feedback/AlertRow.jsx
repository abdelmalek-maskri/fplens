import PlayerLink from "../ui/PlayerLink";

export default function AlertRow({ players, borderColor, renderDetail }) {
  return players.map((p) => (
    <div
      key={`${borderColor}-${p.element}`}
      className={`flex items-center gap-2 py-1 pl-3 border-l-2 ${borderColor}`}
    >
      <span className="text-sm text-surface-700">
        <PlayerLink element={p.element} className="font-medium text-surface-900">
          {p.web_name}
        </PlayerLink>
        {renderDetail(p)}
      </span>
    </div>
  ));
}
