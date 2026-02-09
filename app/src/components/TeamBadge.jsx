import { TEAM_COLORS } from "../lib/constants";

/**
 * Team badge circle with real team color.
 * Replaces the generic grey circle placeholder pattern.
 *
 * @param {string} team - 3-letter team code (e.g. "ARS", "LIV")
 * @param {"sm"|"md"|"lg"} size - Badge size variant
 */
const SIZES = {
  sm: "w-7 h-7 text-2xs",
  md: "w-8 h-8 text-xs",
  lg: "w-12 h-12 text-sm",
};

export default function TeamBadge({ team, size = "md" }) {
  const hex = TEAM_COLORS[team] || "#484848";

  // Determine if we need light text (dark bg) or dark text (light bg)
  // Simple luminance check on hex
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textClass = luminance > 0.55 ? "text-gray-900" : "text-white";

  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ backgroundColor: hex }}
    >
      <span className={textClass}>{team}</span>
    </div>
  );
}
