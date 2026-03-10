// ============================================================
// SHARED DESIGN CONSTANTS
// Single source of truth for colors and mappings used across pages
// ============================================================

export const FDR_COLORS = {
  1: { bg: "bg-success-600", text: "text-white", label: "Very Easy" },
  2: { bg: "bg-success-500/70", text: "text-white", label: "Easy" },
  3: { bg: "bg-surface-600", text: "text-surface-200", label: "Medium" },
  4: { bg: "bg-danger-500/70", text: "text-white", label: "Hard" },
  5: { bg: "bg-danger-700", text: "text-white", label: "Very Hard" },
};

// Flat FDR lookups for Fixture Ticker (fdr level → CSS class)
export const FDR_BG = Object.fromEntries(Object.entries(FDR_COLORS).map(([k, v]) => [k, v.bg]));
export const FDR_TEXT = Object.fromEntries(Object.entries(FDR_COLORS).map(([k, v]) => [k, v.text]));

export const FDR_MAP = {
  ARS: 5,
  AVL: 3,
  BOU: 2,
  BRE: 2,
  BHA: 3,
  CHE: 4,
  CRY: 2,
  EVE: 2,
  FUL: 2,
  IPS: 1,
  LEI: 2,
  LIV: 5,
  MCI: 4,
  MUN: 3,
  NEW: 3,
  NFO: 2,
  SOU: 1,
  TOT: 3,
  WHU: 2,
  WOL: 2,
};

export const TEAM_COLORS = {
  ARS: "#EF0107",
  AVL: "#670E36",
  BOU: "#DA291C",
  BRE: "#E30613",
  BHA: "#0057B8",
  CHE: "#034694",
  CRY: "#1B458F",
  EVE: "#003399",
  FUL: "#000000",
  IPS: "#3A64A3",
  LEI: "#003090",
  LIV: "#C8102E",
  MCI: "#6CABDD",
  MUN: "#DA291C",
  NEW: "#241F20",
  NFO: "#DD0000",
  SOU: "#D71920",
  TOT: "#132257",
  WHU: "#7A263A",
  WOL: "#FDB913",
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

// ============================================================
// PLAYER STATUS
// ============================================================
export const STATUS_CONFIG = {
  a: { label: "Available", cls: "text-success-400" },
  d: { label: "Doubtful", cls: "text-warning-400" },
  i: { label: "Injured", cls: "text-danger-400" },
  u: { label: "Unavailable", cls: "text-surface-400" },
};

// ============================================================
// FPL SQUAD RULES
// ============================================================
export const FPL_BUDGET = 100;
export const POS_LIMITS = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
export const MAX_PER_TEAM = 3;

// ============================================================
// MODEL DISPLAY
// ============================================================
export const MODEL_OPTIONS = [
  {
    id: "lgbm_c",
    name: "LightGBM Config C",
    mae: 1.043,
    description: "Best overall — 141 features, tuned",
  },
  {
    id: "lgbm_a",
    name: "LightGBM Config A",
    mae: 1.06,
    description: "Baseline — FPL + Understat only",
  },
  {
    id: "lgbm_b",
    name: "LightGBM Config B",
    mae: 1.051,
    description: "With injury features",
  },
];

export const DEFAULT_SHAP = [
  { feature: "minutes_lag1", value: 90, impact: +0.8 },
  { feature: "total_points_season_avg", value: 4.5, impact: +0.5 },
  { feature: "form", value: 5.0, impact: +0.3 },
  { feature: "opponent_strength", value: "FDR 3", impact: -0.1 },
  { feature: "was_home", value: "No", impact: -0.2 },
];
