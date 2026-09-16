// FPL allows at most three players from any one club.
const MAX_PER_CLUB = 3;

// The free-transfers dropdown uses this value to mean "Wildcard".
export const WILDCARD = 5;
export const SQUAD_SIZE = 15;

const sumOver = (p, horizon) => p.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);

/**
 * Greedily suggest transfers, biggest gain first.
 *
 * Every squad player is a candidate. Ordering by how bad the outgoing player
 * is spent the one free transfer on a £4.5m bench forward for +0.4, while an
 * injured starter with a real upgrade available went unmentioned. Gain is what
 * the manager is choosing between, so gain decides the order.
 *
 * Budget and club counts carry across suggestions. Checking each one against
 * the starting bank in isolation lets two individually affordable moves add up
 * to more than you have, and lets two signings from the same club push you past
 * the limit.
 */
export function computeSuggestions(squad, targets, horizon, maxTransfers = 1, bank = 0) {
  const suggestions = [];
  const squadIds = new Set(squad.map((p) => p.element));
  const usedIds = new Set();
  const soldIds = new Set();

  const clubCounts = {};
  for (const p of squad) clubCounts[p.team] = (clubCounts[p.team] ?? 0) + 1;

  let remaining = bank;

  while (suggestions.length < maxTransfers) {
    let best = null;

    for (const out of squad) {
      if (soldIds.has(out.element)) continue;
      const outSum = sumOver(out, horizon);

      // Selling this player frees their slot, so their club has room again.
      const afterSale = { ...clubCounts, [out.team]: (clubCounts[out.team] ?? 1) - 1 };

      const replacement = targets
        .filter(
          (t) =>
            t.position === out.position &&
            t.value <= out.selling_price + remaining &&
            (afterSale[t.team] ?? 0) < MAX_PER_CLUB &&
            !squadIds.has(t.element) &&
            !usedIds.has(t.element)
        )
        .map((t) => ({ ...t, sum: sumOver(t, horizon) }))
        .sort((a, b) => b.sum - a.sum)[0];

      if (!replacement) continue;
      const gain = replacement.sum - outSum;
      if (!best || gain > best.gain) best = { out: { ...out, sum: outSum }, in: replacement, gain };
    }

    if (!best || best.gain <= 0) break;

    remaining += best.out.selling_price - best.in.value;
    clubCounts[best.out.team] = (clubCounts[best.out.team] ?? 1) - 1;
    clubCounts[best.in.team] = (clubCounts[best.in.team] ?? 0) + 1;
    squadIds.delete(best.out.element);
    squadIds.add(best.in.element);
    usedIds.add(best.in.element);
    soldIds.add(best.out.element);

    const reason =
      { i: "Injured", d: "Doubtful", s: "Suspended", u: "Left the club" }[best.out.status] ?? null;
    suggestions.push({ out: best.out, in: best.in, points_gain: best.gain, reason });
  }

  return suggestions;
}
