// ============================================================
// MOCK DATA - 20 PL teams × 6 upcoming GWs
// Will be replaced with: GET /api/fixtures/ticker
// ============================================================

export const TEAMS = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "CRY", "EVE",
  "FUL", "IPS", "LEI", "LIV", "MCI", "MUN", "NEW", "NFO",
  "SOU", "TOT", "WHU", "WOL",
];

export const TEAM_FULL = {
  ARS: "Arsenal", AVL: "Aston Villa", BOU: "Bournemouth", BRE: "Brentford",
  BHA: "Brighton", CHE: "Chelsea", CRY: "Crystal Palace", EVE: "Everton",
  FUL: "Fulham", IPS: "Ipswich", LEI: "Leicester", LIV: "Liverpool",
  MCI: "Man City", MUN: "Man United", NEW: "Newcastle", NFO: "Nott'm Forest",
  SOU: "Southampton", TOT: "Tottenham", WHU: "West Ham", WOL: "Wolves",
};

// Fixture data: each entry is { opponent, home, atkFdr, defFdr }
// atkFdr = how hard to ATTACK (goals opponent concedes — low = they concede less = harder)
// defFdr = how hard to DEFEND (goals opponent scores — low = they score less = easier)
export const FIXTURES = {
  ARS: [
    { gw: 24, opponent: "CHE", home: true, atkFdr: 4, defFdr: 4 },
    { gw: 25, opponent: "MCI", home: false, atkFdr: 5, defFdr: 5 },
    { gw: 26, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 27, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 28, opponent: "BOU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "FUL", home: false, atkFdr: 3, defFdr: 2 },
  ],
  LIV: [
    { gw: 24, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 25, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "MCI", home: true, atkFdr: 4, defFdr: 5 },
    { gw: 27, opponent: "IPS", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 28, opponent: "SOU", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
  ],
  MCI: [
    { gw: 24, opponent: "BOU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "ARS", home: true, atkFdr: 5, defFdr: 4 },
    { gw: 26, opponent: "LIV", home: false, atkFdr: 5, defFdr: 5 },
    { gw: 27, opponent: "TOT", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 29, opponent: "BHA", home: true, atkFdr: 3, defFdr: 3 },
  ],
  CHE: [
    { gw: 24, opponent: "ARS", home: false, atkFdr: 5, defFdr: 4 },
    { gw: 25, opponent: "BHA", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "SOU", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 27, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "LEI", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "WOL", home: true, atkFdr: 2, defFdr: 2 },
  ],
  NEW: [
    { gw: 24, opponent: "WOL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 26, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 27, opponent: "BHA", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "CRY", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
  ],
  AVL: [
    { gw: 24, opponent: "NFO", home: true, atkFdr: 3, defFdr: 2 },
    { gw: 25, opponent: "EVE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 26, opponent: "WHU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "NEW", home: true, atkFdr: 3, defFdr: 3 },
  ],
  BOU: [
    { gw: 24, opponent: "MCI", home: false, atkFdr: 4, defFdr: 5 },
    { gw: 25, opponent: "SOU", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 26, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 28, opponent: "ARS", home: false, atkFdr: 5, defFdr: 4 },
    { gw: 29, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
  ],
  BRE: [
    { gw: 24, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 25, opponent: "CRY", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "TOT", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "WHU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
  ],
  BHA: [
    { gw: 24, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 25, opponent: "CHE", home: false, atkFdr: 4, defFdr: 4 },
    { gw: 26, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "NEW", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "MCI", home: false, atkFdr: 4, defFdr: 5 },
  ],
  CRY: [
    { gw: 24, opponent: "MUN", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "BRE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 26, opponent: "IPS", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 27, opponent: "SOU", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 28, opponent: "NEW", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
  ],
  EVE: [
    { gw: 24, opponent: "LIV", home: false, atkFdr: 5, defFdr: 5 },
    { gw: 25, opponent: "AVL", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "NEW", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "WOL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "TOT", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "CRY", home: false, atkFdr: 2, defFdr: 2 },
  ],
  FUL: [
    { gw: 24, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 25, opponent: "TOT", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "BHA", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "CHE", home: false, atkFdr: 4, defFdr: 4 },
    { gw: 28, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "ARS", home: true, atkFdr: 5, defFdr: 4 },
  ],
  IPS: [
    { gw: 24, opponent: "BHA", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "MUN", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "CRY", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "LIV", home: true, atkFdr: 5, defFdr: 5 },
    { gw: 28, opponent: "WHU", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "BOU", home: false, atkFdr: 2, defFdr: 3 },
  ],
  LEI: [
    { gw: 24, opponent: "FUL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "WHU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "ARS", home: false, atkFdr: 5, defFdr: 4 },
    { gw: 27, opponent: "BOU", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 28, opponent: "CHE", home: true, atkFdr: 4, defFdr: 4 },
    { gw: 29, opponent: "BRE", home: false, atkFdr: 2, defFdr: 3 },
  ],
  MUN: [
    { gw: 24, opponent: "CRY", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "IPS", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 26, opponent: "NFO", home: true, atkFdr: 3, defFdr: 2 },
    { gw: 27, opponent: "AVL", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "BHA", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "LIV", home: true, atkFdr: 5, defFdr: 5 },
  ],
  NFO: [
    { gw: 24, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "NEW", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "ARS", home: true, atkFdr: 5, defFdr: 4 },
    { gw: 28, opponent: "MCI", home: true, atkFdr: 4, defFdr: 5 },
    { gw: 29, opponent: "SOU", home: false, atkFdr: 1, defFdr: 1 },
  ],
  SOU: [
    { gw: 24, opponent: "TOT", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "BOU", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 26, opponent: "CHE", home: true, atkFdr: 4, defFdr: 4 },
    { gw: 27, opponent: "CRY", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "NFO", home: true, atkFdr: 3, defFdr: 2 },
  ],
  TOT: [
    { gw: 24, opponent: "SOU", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 25, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "BRE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 27, opponent: "MCI", home: false, atkFdr: 4, defFdr: 5 },
    { gw: 28, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 29, opponent: "WHU", home: false, atkFdr: 2, defFdr: 2 },
  ],
  WHU: [
    { gw: 24, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "LEI", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 26, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "BRE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 28, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "TOT", home: true, atkFdr: 3, defFdr: 3 },
  ],
  WOL: [
    { gw: 24, opponent: "NEW", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "LIV", home: true, atkFdr: 5, defFdr: 5 },
    { gw: 26, opponent: "BOU", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 27, opponent: "EVE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 28, opponent: "BRE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 29, opponent: "CHE", home: false, atkFdr: 4, defFdr: 4 },
  ],
};

// ============================================================
// FDR COLORS
// ============================================================
export const FDR_BG = {
  1: "bg-success-600",
  2: "bg-success-500/60",
  3: "bg-surface-600",
  4: "bg-danger-500/60",
  5: "bg-danger-700",
};

export const FDR_TEXT = {
  1: "text-white",
  2: "text-white",
  3: "text-surface-200",
  4: "text-white",
  5: "text-white",
};
