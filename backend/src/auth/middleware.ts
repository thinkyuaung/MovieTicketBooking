import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../errors.js";
import { verifyToken, type IAuthUser } from "./token.js";

/**
 * Requires a valid `Authorization: Bearer <token>` header and stores the user
 * in `res.locals.user`.
 *
 * @param req - The request.
 * @param res - The response.
 * @param next - Next middleware.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? verifyToken(token) : null;
  if (!user) return next(unauthorized());
  res.locals.user = user;
  next();
}

/**
 * Requires a logged-in admin.
 *
 * @param req - The request.
 * @param res - The response.
 * @param next - Next middleware.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (currentUser(res).role !== "admin") return next(forbidden("Admins only."));
    next();
  });
}

/**
 * Returns the user set by {@link requireAuth}.
 *
 * @param res - The response.
 * @returns The logged-in user.
 * @throws AppError 401 if the route forgot to use requireAuth.
 */
export function currentUser(res: Response): IAuthUser {
  const user = res.locals.user as IAuthUser | undefined;
  if (!user) throw unauthorized();
  return user;
}
