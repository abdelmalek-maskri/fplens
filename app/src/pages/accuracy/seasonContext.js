/**
 * Say what is happening in the season around the gameweek on screen.
 *
 * The heading already names the scored gameweek, so this only covers what the
 * page cannot show: gameweeks that have been played but not checked against
 * predictions yet, and the one being predicted now.
 *
 * `scored` comes from the accuracy file, `upcoming` from the snapshot
 * manifest. They are normally one apart; the gap widens when a gameweek has
 * finished but the scoring run has not caught up with it.
 */
export function seasonContext(scored, final, upcoming) {
  if (!final) {
    return {
      note: "Bonus points are not confirmed yet, so these numbers can still change.",
      next: null,
    };
  }

  const next = upcoming != null && upcoming > scored ? upcoming : null;
  const unchecked = next == null ? 0 : next - scored - 1;

  let note = null;
  if (unchecked === 1) {
    note = `Gameweek ${scored + 1} has been played but not checked yet.`;
  } else if (unchecked > 1) {
    note = `Gameweeks ${scored + 1}-${next - 1} have been played but not checked yet.`;
  }

  return { note, next };
}
