import { Router } from "express";
import { requireAdmin } from "../auth/middleware.js";
import { listShowtimeBookings } from "../services/bookingService.js";
import {
  cancelShowtime,
  createHall,
  createMovie,
  createShowtime,
  deleteHall,
  deleteMovie,
  deleteShowtime,
  getAdminShowtime,
  getHall,
  listAdminMovies,
  listHalls,
  listShowtimes,
  previewHall,
  renameHall,
  replaceHallLayout,
  updateMovie,
  updateSeat,
  updateShowtime,
} from "../services/catalogService.js";
import { getDashboard } from "../services/dashboardService.js";
import { deleteReview } from "../services/reviewService.js";
import {
  dateRangeQuery,
  hallBody,
  hallLayoutBody,
  hallRenameBody,
  idParam,
  movieBody,
  movieUpdateBody,
  seatUpdateBody,
  showtimeBody,
  showtimeListQuery,
  showtimeUpdateBody,
} from "./schemas.js";

/**
 * Admin routes. Every route needs a logged-in admin.
 */
export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/dashboard", async (req, res) => {
  res.json(await getDashboard(dateRangeQuery.parse(req.query)));
});

// Movies
adminRouter.get("/movies", async (_req, res) => {
  res.json(await listAdminMovies());
});
adminRouter.post("/movies", async (req, res) => {
  res.status(201).json(await createMovie(movieBody.parse(req.body)));
});
adminRouter.patch("/movies/:id", async (req, res) => {
  res.json(await updateMovie(idParam.parse(req.params.id), movieUpdateBody.parse(req.body)));
});
adminRouter.delete("/movies/:id", async (req, res) => {
  await deleteMovie(idParam.parse(req.params.id));
  res.status(204).end();
});

// Halls and seats
adminRouter.get("/halls", async (_req, res) => {
  res.json(await listHalls());
});
adminRouter.post("/halls/preview", (req, res) => {
  res.json(previewHall(hallLayoutBody.parse(req.body).rows));
});
adminRouter.get("/halls/:id", async (req, res) => {
  res.json(await getHall(idParam.parse(req.params.id)));
});
adminRouter.post("/halls", async (req, res) => {
  const { name, rows } = hallBody.parse(req.body);
  res.status(201).json(await createHall(name, rows));
});
adminRouter.patch("/halls/:id", async (req, res) => {
  res.json(await renameHall(idParam.parse(req.params.id), hallRenameBody.parse(req.body).name));
});
adminRouter.put("/halls/:id/layout", async (req, res) => {
  res.json(await replaceHallLayout(idParam.parse(req.params.id), hallLayoutBody.parse(req.body).rows));
});
adminRouter.patch("/halls/:id/seats/:seatId", async (req, res) => {
  const seat = await updateSeat(idParam.parse(req.params.id), idParam.parse(req.params.seatId), seatUpdateBody.parse(req.body));
  res.json(seat);
});
adminRouter.delete("/halls/:id", async (req, res) => {
  await deleteHall(idParam.parse(req.params.id));
  res.status(204).end();
});

// Showtimes
adminRouter.get("/showtimes", async (req, res) => {
  res.json(await listShowtimes(showtimeListQuery.parse(req.query)));
});
adminRouter.get("/showtimes/:id", async (req, res) => {
  res.json(await getAdminShowtime(idParam.parse(req.params.id)));
});
adminRouter.get("/showtimes/:id/bookings", async (req, res) => {
  res.json(await listShowtimeBookings(idParam.parse(req.params.id)));
});
adminRouter.post("/showtimes", async (req, res) => {
  res.status(201).json(await createShowtime(showtimeBody.parse(req.body)));
});
adminRouter.patch("/showtimes/:id", async (req, res) => {
  res.json(await updateShowtime(idParam.parse(req.params.id), showtimeUpdateBody.parse(req.body)));
});
adminRouter.post("/showtimes/:id/cancel", async (req, res) => {
  res.json(await cancelShowtime(idParam.parse(req.params.id)));
});
adminRouter.delete("/showtimes/:id", async (req, res) => {
  await deleteShowtime(idParam.parse(req.params.id));
  res.status(204).end();
});

// Reviews
adminRouter.delete("/reviews/:id", async (req, res) => {
  await deleteReview(idParam.parse(req.params.id));
  res.status(204).end();
});
