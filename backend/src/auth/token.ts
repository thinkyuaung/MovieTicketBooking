import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

/**
 * The logged-in user, as stored in the login token.
 */
export interface IAuthUser {
  id: number;
  name: string;
  role: Role;
}

/**
 * Creates a signed login token for a user.
 *
 * @param user - The user to log in.
 * @returns A JWT valid for 7 days.
 */
export function signToken(user: IAuthUser): string {
  return jwt.sign({ name: user.name, role: user.role }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Reads and checks a login token.
 *
 * @param token - The JWT from the Authorization header.
 * @returns The user, or null if the token is invalid or expired.
 */
export function verifyToken(token: string): IAuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || !payload.sub) return null;
    const role = payload.role === "admin" ? "admin" : "user";
    return { id: Number(payload.sub), name: String(payload.name ?? ""), role };
  } catch {
    return null;
  }
}
