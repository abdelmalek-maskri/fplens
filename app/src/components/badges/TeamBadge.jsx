import { TEAM_COLORS } from "../../lib/constants";

const SIZES = {
  sm: "w-7 h-7 text-2xs",
  md: "w-8 h-8 text-xs",
  lg: "w-12 h-12 text-sm",
};

export default function TeamBadge({ team, size = "md" }) {
  const hex = TEAM_COLORS[team] || "#484848";

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Dark text on a light badge, white on a dark one. The threshold has to be
  // this high because the awkward badges are bright: WOL's gold reads 1.64:1
  // against white text and 9.73:1 against dark, City's blue 2.34:1 and 6.82:1.
  const textClass = luminance > 0.55 ? "text-surface-900" : "text-white";

  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ backgroundColor: hex }}
    >
      <span className={textClass}>{team}</span>
    </div>
  );
}
