// FPL allows at most three players from any one club.
const MAX_PER_CLUB = 3;

// The free-transfers dropdown uses this value to mean "Wildcard".
export const WILDCARD = 5;
export const SQUAD_SIZE = 15;

/**
 * Greedily suggest transfers, worst squad player first.
 *
 * Budget and club counts carry across suggestions. Checking each one against
 * the starting bank in isolation lets two individually affordable moves add up
 * to more than you have, and lets two signings from the same club push you past
 * the limit.
 */
export function computeSuggestions(squad, targets, horizon, maxTransfers = 1, bank = 0) {
  const suggestions = [];
  const candidates = squad
    .map((p) => {
      const sum = p.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
      const avgFdr = p.fdr.slice(0, horizon).reduce((s, v) => s + v, 0) / horizon;
      let reason = null;
      if (p.status === "i") reason = "Injured";
      else if (p.status === "d") reason = "Doubtful";
      else if (sum / horizon < 3.0 && avgFdr >= 3) reason = "Low pts + tough run";
      else if (sum / horizon < 2.5) reason = "Low predicted";
      return { ...p, sum, avgFdr, reason };
    })
    .filter((p) => p.reason)
    .sort((a, b) => a.sum - b.sum);

  const squadIds = new Set(squad.map((p) => p.element));
  const usedIds = new Set();

  const clubCounts = {};
  for (const p of squad) clubCounts[p.team] = (clubCounts[p.team] ?? 0) + 1;

  let remaining = bank;

  for (const out of candidates) {
    if (suggestions.length >= maxTransfers) break;

    // Selling this player frees their slot, so their club has room again.
    const afterSale = { ...clubCounts, [out.team]: (clubCounts[out.team] ?? 1) - 1 };

    const best = targets
      .filter(
        (t) =>
          t.position === out.position &&
          t.value <= out.selling_price + remaining &&
          (afterSale[t.team] ?? 0) < MAX_PER_CLUB &&
          !squadIds.has(t.element) &&
          !usedIds.has(t.element)
      )
      .map((t) => ({
        ...t,
        sum: t.predicted.slice(0, horizon).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.sum - a.sum)[0];

    if (!best) continue;

    remaining += out.selling_price - best.value;
    clubCounts[out.team] = (clubCounts[out.team] ?? 1) - 1;
    clubCounts[best.team] = (clubCounts[best.team] ?? 0) + 1;
    squadIds.delete(out.element);
    squadIds.add(best.element);
    usedIds.add(best.element);

    suggestions.push({
      out,
      in: best,
      points_gain: best.sum - out.sum,
      reason: out.reason,
    });
  }

  return suggestions;
}
