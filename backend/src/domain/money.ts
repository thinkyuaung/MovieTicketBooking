/**
 * Formats a whole-kyat amount for display, e.g. `15000` → `"15,000 MMK"`.
 *
 * @param amount - Amount in kyat (whole number).
 * @returns The formatted price.
 */
export function formatMMK(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} MMK`;
}
