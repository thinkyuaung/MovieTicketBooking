import { Router } from "express";
import { currentUser, requireAuth } from "../auth/middleware.js";
import { getMovieView, listGenres, listMovies } from "../services/movieService.js";
import { createReview } from "../services/reviewService.js";
import { idParam, movieListQuery, reviewBody } from "./schemas.js";

/**
 * Public movie routes, plus writing a review (logged in).
 */
export const moviesRouter = Router();

moviesRouter.get("/", async (req, res) => {
  res.json(await listMovies(movieListQuery.parse(req.query)));
});

moviesRouter.get("/genres", async (_req, res) => {
  res.json(await listGenres());
});

moviesRouter.get("/:id", async (req, res) => {
  res.json(await getMovieView(idParam.parse(req.params.id)));
});

moviesRouter.post("/:id/reviews", requireAuth, async (req, res) => {
  const { score, comment } = reviewBody.parse(req.body);
  const review = await createReview(currentUser(res).id, idParam.parse(req.params.id), score, comment);
  res.status(201).json(review);
});
