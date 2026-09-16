// FPL reassigns element IDs every season, so a fixed default pair goes stale.
// Open on the top predicted player against the next best in his position.
export function defaultPair(players) {
  const ranked = [...players].sort((x, y) => y.predicted_points - x.predicted_points);
  const first = ranked[0];
  const second = ranked.find((p) => p !== first && p.position === first?.position) ?? ranked[1];
  return [first?.id ?? null, second?.id ?? null];
}
