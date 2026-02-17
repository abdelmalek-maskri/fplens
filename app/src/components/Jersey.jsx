import { useId } from "react";

// ============================================================
// PREMIER LEAGUE 2024-25 KIT DEFINITIONS
// ============================================================
// eslint-disable-next-line react-refresh/only-export-components
export const TEAM_KITS = {
  ARS: { body: "#EF0107", sleeves: "#FFFFFF", collar: "#FFFFFF", accent: "#9C824A", gk: "#e8d44d" },
  AVL: { body: "#670E36", sleeves: "#95BFE5", collar: "#FEE505", accent: "#95BFE5", gk: "#2ecc71" },
  BOU: { body: "#DA291C", sleeves: "#1E1E1E", collar: "#1E1E1E", accent: "#1E1E1E", gk: "#e8d44d" },
  BRE: {
    body: "#E30613",
    sleeves: "#E30613",
    collar: "#FFFFFF",
    accent: "#FFFFFF",
    pattern: "stripes",
    stripeColor: "#FFFFFF",
    gk: "#1a1a1a",
  },
  BHA: {
    body: "#0057B8",
    sleeves: "#0057B8",
    collar: "#FFFFFF",
    accent: "#FFFFFF",
    pattern: "stripes",
    stripeColor: "#FFFFFF",
    gk: "#e8d44d",
  },
  CHE: { body: "#034694", sleeves: "#034694", collar: "#034694", accent: "#6EBED2", gk: "#4bc8a0" },
  CRY: { body: "#1B458F", sleeves: "#C4122E", collar: "#1B458F", accent: "#C4122E", gk: "#e8d44d" },
  EVE: { body: "#003399", sleeves: "#003399", collar: "#003399", accent: "#FFFFFF", gk: "#2ecc71" },
  FUL: {
    body: "#FFFFFF",
    sleeves: "#000000",
    collar: "#CC0000",
    accent: "#000000",
    text: "#000000",
    gk: "#e8d44d",
  },
  IPS: { body: "#3A64A3", sleeves: "#3A64A3", collar: "#FFFFFF", accent: "#FFFFFF", gk: "#e8d44d" },
  LEI: { body: "#003090", sleeves: "#003090", collar: "#FDBE11", accent: "#FDBE11", gk: "#2ecc71" },
  LIV: { body: "#C8102E", sleeves: "#C8102E", collar: "#00A651", accent: "#00A651", gk: "#91c940" },
  MCI: { body: "#6CABDD", sleeves: "#6CABDD", collar: "#1C2C5B", accent: "#FFFFFF", gk: "#e8d44d" },
  MUN: { body: "#DA291C", sleeves: "#DA291C", collar: "#FBE122", accent: "#FBE122", gk: "#2ecc71" },
  NEW: {
    body: "#241F20",
    sleeves: "#241F20",
    collar: "#241F20",
    accent: "#FFFFFF",
    pattern: "stripes",
    stripeColor: "#FFFFFF",
    gk: "#e8d44d",
  },
  NFO: { body: "#E53233", sleeves: "#E53233", collar: "#FFFFFF", accent: "#FFFFFF", gk: "#e8d44d" },
  SOU: {
    body: "#D71920",
    sleeves: "#D71920",
    collar: "#FFFFFF",
    accent: "#FFFFFF",
    pattern: "stripes",
    stripeColor: "#FFFFFF",
    gk: "#e8d44d",
  },
  TOT: {
    body: "#FFFFFF",
    sleeves: "#FFFFFF",
    collar: "#132257",
    accent: "#132257",
    text: "#132257",
    gk: "#1a1a1a",
  },
  WHU: { body: "#7A263A", sleeves: "#1BB1E7", collar: "#7A263A", accent: "#1BB1E7", gk: "#e8d44d" },
  WOL: {
    body: "#FDB913",
    sleeves: "#FDB913",
    collar: "#231F20",
    accent: "#231F20",
    text: "#231F20",
    gk: "#2ecc71",
  },
};

const DEFAULT_KIT = {
  body: "#555",
  sleeves: "#555",
  collar: "#333",
  accent: "#777",
  gk: "#4bc8a0",
};

function isLightColor(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  return ((num >> 16) * 299 + ((num >> 8) & 0xff) * 587 + (num & 0xff) * 114) / 1000 > 128;
}

const BODY_PATH = "M26 16 V62 Q26 64 28 64 H52 Q54 64 54 62 V16 Z";

/**
 * Jersey — realistic Premier League team kit SVG
 * @param {string} teamName - team abbreviation (e.g. "ARS")
 * @param {string} [position] - player position, "GK" shows goalkeeper kit
 * @param {boolean} [isCaptain] - show captain badge
 * @param {boolean} [isVice] - show vice captain badge
 * @param {string} [status] - player status (i/d shows injury/doubtful indicator)
 */
export default function Jersey({ teamName, position, isCaptain, isVice, status }) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  const kitDef = TEAM_KITS[teamName] || DEFAULT_KIT;

  const isGK = position === "GK";
  const kit = isGK
    ? {
        body: kitDef.gk,
        sleeves: kitDef.gk,
        collar: "#1a1a1a",
        accent: "#333",
        text: isLightColor(kitDef.gk) ? "#1a1a1a" : "#ffffff",
      }
    : kitDef;

  const textColor = kit.text || "#ffffff";
  const hasStripes = !isGK && kit.pattern === "stripes";

  return (
    <div className="relative">
      <svg viewBox="0 0 80 70" className="w-[62px] h-[54px] drop-shadow-lg">
        <defs>
          <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.10" />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.12" />
          </linearGradient>
          {hasStripes && (
            <clipPath id={`bc${uid}`}>
              <path d={BODY_PATH} />
            </clipPath>
          )}
        </defs>

        <ellipse cx="40" cy="67" rx="20" ry="2" fill="black" opacity="0.12" />

        {/* Body */}
        <path d={BODY_PATH} fill={kit.body} />
        {hasStripes && (
          <g clipPath={`url(#bc${uid})`}>
            {[29.5, 36.5, 43.5, 50.5].map((x) => (
              <rect key={x} x={x} y="16" width="3.5" height="50" fill={kit.stripeColor} />
            ))}
          </g>
        )}
        <path d={BODY_PATH} fill={`url(#sh${uid})`} />

        {/* Sleeves */}
        <path d="M26 16 L14 22 Q6 26 4 32 V34 Q4 36 6 36 H15 V26 L26 20 Z" fill={kit.sleeves} />
        <path d="M54 16 L66 22 Q74 26 76 32 V34 Q76 36 74 36 H65 V26 L54 20 Z" fill={kit.sleeves} />
        <path
          d="M26 16 L14 22 Q6 26 4 32 V34 Q4 36 6 36 H15 V26 L26 20 Z"
          fill={`url(#sh${uid})`}
        />
        <path
          d="M54 16 L66 22 Q74 26 76 32 V34 Q76 36 74 36 H65 V26 L54 20 Z"
          fill={`url(#sh${uid})`}
        />

        {/* Collar */}
        <path d="M26 16 L34 9 Q40 17 46 9 L54 16 Z" fill={kit.collar} />
        <path
          d="M34 9 Q40 19 46 9"
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* Accent details */}
        <line
          x1="24"
          y1="17"
          x2="12"
          y2="25"
          stroke={kit.accent}
          strokeWidth="2.5"
          opacity="0.55"
          strokeLinecap="round"
        />
        <line
          x1="56"
          y1="17"
          x2="68"
          y2="25"
          stroke={kit.accent}
          strokeWidth="2.5"
          opacity="0.55"
          strokeLinecap="round"
        />
        <rect x="5" y="33" width="10" height="2" rx="0.5" fill={kit.accent} opacity="0.6" />
        <rect x="65" y="33" width="10" height="2" rx="0.5" fill={kit.accent} opacity="0.6" />
        <rect x="26" y="61" width="28" height="2.5" rx="1" fill="rgba(0,0,0,0.10)" />

        {/* Outlines */}
        <path d={BODY_PATH} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
        <path
          d="M26 16 L14 22 Q6 26 4 32 V34 Q4 36 6 36 H15 V26 L26 20"
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="0.5"
        />
        <path
          d="M54 16 L66 22 Q74 26 76 32 V34 Q76 36 74 36 H65 V26 L54 20"
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="0.5"
        />

        {/* Team abbreviation */}
        <text
          x="40"
          y="48"
          textAnchor="middle"
          fill={textColor}
          opacity="0.85"
          fontSize="11"
          fontWeight="800"
          fontFamily="Outfit, system-ui, sans-serif"
          letterSpacing="0.5"
        >
          {teamName}
        </text>
      </svg>

      {isCaptain && (
        <div className="absolute -bottom-0.5 -right-1 w-[18px] h-[18px] rounded-full bg-warning-500 border-[1.5px] border-warning-300 text-surface-50 text-2xs font-black flex items-center justify-center shadow-lg">
          C
        </div>
      )}
      {isVice && (
        <div className="absolute -bottom-0.5 -right-1 w-[18px] h-[18px] rounded-full bg-surface-600 border-[1.5px] border-surface-400 text-surface-100 text-2xs font-bold flex items-center justify-center shadow-lg">
          V
        </div>
      )}
      {(status === "i" || status === "d") && (
        <div
          className={`absolute -top-0.5 -left-1 w-[16px] h-[16px] rounded-full text-2xs font-bold flex items-center justify-center shadow ${
            status === "i" ? "bg-danger-500 text-white" : "bg-warning-500 text-surface-50"
          }`}
        >
          !
        </div>
      )}
    </div>
  );
}
