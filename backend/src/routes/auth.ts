import { Router } from "express";
import { currentUser, requireAuth } from "../auth/middleware.js";
import { notFound } from "../errors.js";
import { getProfile, login, register } from "../services/authService.js";
import { loginBody, registerBody } from "./schemas.js";

/**
 * Account routes: register, log in, and "who am I".
 */
export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const body = registerBody.parse(req.body);
  res.status(201).json(await register(body));
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  res.json(await login(email, password));
});

authRouter.get("/me", requireAuth, async (_req, res) => {
  const user = await getProfile(currentUser(res).id);
  if (!user) throw notFound("User");
  res.json(user);
});
