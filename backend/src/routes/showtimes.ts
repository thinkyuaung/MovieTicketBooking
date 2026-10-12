import { Router } from "express";
import { currentUser, requireAuth } from "../auth/middleware.js";
import { bookFullHall } from "../services/bookingService.js";
import { getSeatPlan } from "../services/seatPlanService.js";
import { idParam } from "./schemas.js";

/**
 * Showing routes: the seat plan (public) and whole-hall booking (logged in).
 */
export const showtimesRouter = Router();

showtimesRouter.get("/:id/seats", async (req, res) => {
  res.json(await getSeatPlan(idParam.parse(req.params.id)));
});

showtimesRouter.post("/:id/book-all", requireAuth, async (req, res) => {
  res.status(201).json(await bookFullHall(currentUser(res).id, idParam.parse(req.params.id)));
});
