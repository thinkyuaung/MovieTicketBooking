import { randomInt } from "node:crypto";

/** Letters and digits that are hard to confuse (no 0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generates a booking code customers can read out at the counter, e.g. `MT-7KQ2XD`.
 *
 * @returns A new random booking code (9 characters).
 */
export function generateBookingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `MT-${code}`;
}
