import bcrypt from "bcryptjs";

const ROUNDS = 10;

/**
 * Hashes a password for storage.
 *
 * @param password - The plain-text password.
 * @returns The bcrypt hash.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

/**
 * Checks a password against a stored hash.
 *
 * @param password - The plain-text password from the login form.
 * @param hash - The stored bcrypt hash.
 * @returns True if the password matches.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
