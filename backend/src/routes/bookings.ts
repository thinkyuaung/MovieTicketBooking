import { Router } from "express";
import { currentUser, requireAuth } from "../auth/middleware.js";
import { bookSeats, cancelBooking, getBookingForUser, listUserBookings } from "../services/bookingService.js";
import { bookingBody, idParam } from "./schemas.js";

/**
 * Booking routes. All need a logged-in user.
 */
export const bookingsRouter = Router();

bookingsRouter.use(requireAuth);

bookingsRouter.post("/", async (req, res) => {
  const { showtimeId, seats } = bookingBody.parse(req.body);
  res.status(201).json(await bookSeats(currentUser(res).id, showtimeId, seats));
});

bookingsRouter.get("/me", async (_req, res) => {
  res.json(await listUserBookings(currentUser(res).id));
});

bookingsRouter.get("/:id", async (req, res) => {
  res.json(await getBookingForUser(currentUser(res), idParam.parse(req.params.id)));
});

bookingsRouter.delete("/:id", async (req, res) => {
  res.json(await cancelBooking(currentUser(res), idParam.parse(req.params.id)));
});
