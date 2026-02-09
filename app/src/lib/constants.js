// ============================================================
// SHARED DESIGN CONSTANTS
// Single source of truth for colors and mappings used across pages
// ============================================================

export const FDR_COLORS = {
  1: { bg: "bg-emerald-600", text: "text-white", label: "Very Easy" },
  2: { bg: "bg-emerald-500/70", text: "text-white", label: "Easy" },
  3: { bg: "bg-gray-500", text: "text-white", label: "Medium" },
  4: { bg: "bg-red-500/70", text: "text-white", label: "Hard" },
  5: { bg: "bg-red-700", text: "text-white", label: "Very Hard" },
};

export const TEAM_COLORS = {
  ARS: "#EF0107", AVL: "#670E36", BOU: "#DA291C", BRE: "#E30613",
  BHA: "#0057B8", CHE: "#034694", CRY: "#1B458F", EVE: "#003399",
  FUL: "#000000", IPS: "#3A64A3", LEI: "#003090", LIV: "#C8102E",
  MCI: "#6CABDD", MUN: "#DA291C", NEW: "#241F20", NFO: "#DD0000",
  SOU: "#D71920", TOT: "#132257", WHU: "#7A263A", WOL: "#FDB913",
};

export const POSITION_COLORS = {
  GK: "text-warning-400",
  DEF: "text-success-400",
  MID: "text-brand-400",
  FWD: "text-danger-400",
};

export const POSITION_BG = {
  GK: "bg-warning-500/20",
  DEF: "bg-success-500/20",
  MID: "bg-brand-500/20",
  FWD: "bg-danger-500/20",
};
