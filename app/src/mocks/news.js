// ============================================================
// MOCK NEWS DATA — Guardian NLP pipeline output
// Will be replaced with: GET /api/news?days=7
// Pipeline: Guardian API → spaCy NER (player extraction) → RoBERTa sentiment
// ============================================================
export const mockArticles = [
  {
    id: 1,
    headline: "Haaland in contention for Ballon d'Or after record-breaking run",
    source: "The Guardian",
    date: "2025-02-08",
    sentiment: 0.85,
    players: [{ element: 2, web_name: "Haaland", team_name: "MCI", position: "FWD" }],
    injury_flag: false,
    snippet:
      "Erling Haaland's extraordinary goalscoring form has put him firmly in the conversation for this year's Ballon d'Or, with 18 goals in 21 Premier League appearances.",
  },
  {
    id: 2,
    headline: "Salah contract saga continues as Liverpool weigh options",
    source: "The Guardian",
    date: "2025-02-07",
    sentiment: -0.15,
    players: [{ element: 3, web_name: "Salah", team_name: "LIV", position: "MID" }],
    injury_flag: false,
    snippet:
      "Mohamed Salah's future at Anfield remains uncertain with negotiations reportedly stalling over contract length and wages.",
  },
  {
    id: 3,
    headline: "Saka doubtful for Chelsea clash with muscle injury",
    source: "The Guardian",
    date: "2025-02-07",
    sentiment: -0.62,
    players: [{ element: 5, web_name: "Saka", team_name: "ARS", position: "MID" }],
    injury_flag: true,
    snippet:
      "Bukayo Saka is a doubt for Arsenal's London derby against Chelsea after picking up a muscle problem in training.",
  },
  {
    id: 4,
    headline: "Palmer dazzles as Chelsea close gap on leaders",
    source: "The Guardian",
    date: "2025-02-06",
    sentiment: 0.78,
    players: [{ element: 7, web_name: "Palmer", team_name: "CHE", position: "MID" }],
    injury_flag: false,
    snippet:
      "Cole Palmer scored twice and provided an assist as Chelsea dismantled Wolves at Stamford Bridge.",
  },
  {
    id: 5,
    headline: "Manchester City eye title charge as Haaland leads scoring charts",
    source: "The Guardian",
    date: "2025-02-05",
    sentiment: 0.72,
    players: [{ element: 2, web_name: "Haaland", team_name: "MCI", position: "FWD" }],
    injury_flag: false,
    snippet:
      "Pep Guardiola's side are building momentum in the title race, with Haaland's 18 league goals powering their charge.",
  },
  {
    id: 6,
    headline: "Watkins facing extended spell on sidelines with hamstring problem",
    source: "The Guardian",
    date: "2025-02-05",
    sentiment: -0.78,
    players: [{ element: 10, web_name: "Watkins", team_name: "AVL", position: "FWD" }],
    injury_flag: true,
    snippet:
      "Aston Villa striker Ollie Watkins could miss up to three weeks after scans revealed a hamstring injury sustained in training.",
  },
  {
    id: 7,
    headline: "Isak's hot streak continues with brace against Wolves",
    source: "The Guardian",
    date: "2025-02-04",
    sentiment: 0.81,
    players: [{ element: 50, web_name: "Isak", team_name: "NEW", position: "FWD" }],
    injury_flag: false,
    snippet:
      "Alexander Isak scored twice as Newcastle cruised to a comfortable victory, taking his tally to 12 Premier League goals this season.",
  },
  {
    id: 8,
    headline: "Salah scores twice in dominant Liverpool display",
    source: "The Guardian",
    date: "2025-02-03",
    sentiment: 0.82,
    players: [{ element: 3, web_name: "Salah", team_name: "LIV", position: "MID" }],
    injury_flag: false,
    snippet:
      "Mohamed Salah put contract uncertainty to one side with a devastating two-goal performance as Liverpool moved top of the table.",
  },
  {
    id: 9,
    headline: "Alexander-Arnold linked with Real Madrid as contract talks stall",
    source: "The Guardian",
    date: "2025-02-03",
    sentiment: -0.32,
    players: [{ element: 15, web_name: "Alexander-Arnold", team_name: "LIV", position: "DEF" }],
    injury_flag: false,
    snippet:
      "Trent Alexander-Arnold's future at Liverpool is in question with reports of interest from Real Madrid intensifying.",
  },
  {
    id: 10,
    headline: "Guardiola praises Haaland's work rate in emphatic victory",
    source: "The Guardian",
    date: "2025-02-01",
    sentiment: 0.68,
    players: [{ element: 2, web_name: "Haaland", team_name: "MCI", position: "FWD" }],
    injury_flag: false,
    snippet:
      "Pep Guardiola singled out Erling Haaland for special praise after the Norwegian's all-round display in City's 4-1 win.",
  },
  {
    id: 11,
    headline: "Mbeumo emerges as Brentford's talisman in Toney's absence",
    source: "The Guardian",
    date: "2025-02-01",
    sentiment: 0.55,
    players: [{ element: 40, web_name: "Mbeumo", team_name: "BRE", position: "MID" }],
    injury_flag: false,
    snippet:
      "Bryan Mbeumo has stepped up as Brentford's primary attacking threat, with 10 goals making him one of the bargains of the season.",
  },
  {
    id: 12,
    headline: "Gabriel's aerial threat makes Arsenal set-piece kings",
    source: "The Guardian",
    date: "2025-01-31",
    sentiment: 0.48,
    players: [{ element: 12, web_name: "Gabriel", team_name: "ARS", position: "DEF" }],
    injury_flag: false,
    snippet:
      "Gabriel Magalh\u00e3es has scored four goals from set-pieces this season, making Arsenal the most dangerous team from dead-ball situations.",
  },
  {
    id: 13,
    headline: "Raya's save percentage best in Europe as Arsenal tighten up",
    source: "The Guardian",
    date: "2025-01-30",
    sentiment: 0.61,
    players: [{ element: 20, web_name: "Raya", team_name: "ARS", position: "GK" }],
    injury_flag: false,
    snippet:
      "David Raya's 78% save rate ranks highest among goalkeepers in Europe's top five leagues this season.",
  },
  {
    id: 14,
    headline: "Palmer and Saka lead new generation of English playmakers",
    source: "The Guardian",
    date: "2025-01-29",
    sentiment: 0.45,
    players: [
      { element: 7, web_name: "Palmer", team_name: "CHE", position: "MID" },
      { element: 5, web_name: "Saka", team_name: "ARS", position: "MID" },
    ],
    injury_flag: false,
    snippet:
      "Cole Palmer and Bukayo Saka are redefining the creative midfielder role in English football.",
  },
];
