/** Minutes added after each film for cleaning before the hall's next show. */
export const CLEANUP_MINUTES = 15;

/**
 * Returns when a showing ends: film length plus cleaning time.
 *
 * @param startsAt - When the show starts.
 * @param durationMin - Film length in minutes.
 * @returns When the hall is free again.
 */
export function computeEndsAt(startsAt: Date, durationMin: number): Date {
  return new Date(startsAt.getTime() + (durationMin + CLEANUP_MINUTES) * 60_000);
}

/**
 * Returns whether two time ranges overlap. Touching ends (one ends exactly
 * when the other starts) do not count as overlapping.
 *
 * @param a - First range.
 * @param b - Second range.
 * @returns True if they overlap.
 */
export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}
