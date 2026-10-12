import { Prisma } from "@prisma/client";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signToken, type IAuthUser } from "../auth/token.js";
import { prisma } from "../db.js";
import { AppError, conflict } from "../errors.js";

/**
 * A user's public profile (no password hash).
 */
export interface IUserProfile extends IAuthUser {
  email: string;
  phone: string | null;
}

/**
 * Result of registering or logging in.
 */
export interface IAuthResult {
  token: string;
  user: IUserProfile;
}

/**
 * Creates a customer account and logs it in.
 *
 * @param input - Name, email, password and optional phone.
 * @returns A login token and the new user's profile.
 * @throws AppError 409 if the email is already registered.
 */
export async function register(input: { name: string; email: string; password: string; phone?: string }): Promise<IAuthResult> {
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        passwordHash: await hashPassword(input.password),
      },
    });
    const profile: IUserProfile = { id: user.id, name: user.name, role: user.role, email: user.email, phone: user.phone };
    return { token: signToken(profile), user: profile };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("An account with this email already exists.");
    }
    throw err;
  }
}

/**
 * Logs a user in with email and password.
 *
 * @param email - The account email.
 * @param password - The password.
 * @returns A login token and the user's profile.
 * @throws AppError 401 if the email or password is wrong.
 */
export async function login(email: string, password: string): Promise<IAuthResult> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(401, "Wrong email or password.");
  }
  const profile: IUserProfile = { id: user.id, name: user.name, role: user.role, email: user.email, phone: user.phone };
  return { token: signToken(profile), user: profile };
}

/**
 * Loads a user's profile.
 *
 * @param id - The user id.
 * @returns The profile, or null if the user no longer exists.
 */
export async function getProfile(id: number): Promise<IUserProfile | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user && { id: user.id, name: user.name, role: user.role, email: user.email, phone: user.phone };
}
