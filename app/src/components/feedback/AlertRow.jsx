export default function AlertRow({ players, borderColor, renderDetail, onPlayerClick }) {
  return players.map((p) => (
    <div
      key={`${borderColor}-${p.element}`}
      className={`flex items-center gap-2 py-1 pl-3 border-l-2 ${borderColor}`}
    >
      <span className="text-sm text-surface-300">
        <span
          className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors"
          onClick={() => onPlayerClick(p.element)}
        >
          {p.web_name}
        </span>
        {renderDetail(p)}
      </span>
    </div>
  ));
}
