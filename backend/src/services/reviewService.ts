import { Prisma } from "@prisma/client";
import type { IReview } from "../domain/cinema.js";
import { prisma } from "../db.js";
import { conflict, notFound } from "../errors.js";
import { toReview } from "./mappers.js";

/**
 * Adds a user's review of a movie. Each user can review a movie once.
 *
 * @param userId - The reviewer.
 * @param movieId - The movie.
 * @param score - Score from 1 to 10 (validated by the route).
 * @param comment - The review text.
 * @returns The new review.
 * @throws AppError 404 if the movie doesn't exist, 409 if the user already reviewed it.
 */
export async function createReview(userId: number, movieId: number, score: number, comment: string): Promise<IReview> {
  const movie = await prisma.movie.count({ where: { id: movieId } });
  if (!movie) throw notFound("Movie");
  try {
    const review = await prisma.review.create({
      data: { userId, movieId, score, comment: comment.trim() },
      include: { user: { select: { name: true } } },
    });
    return toReview(review);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("You have already reviewed this movie.");
    }
    throw err;
  }
}

/**
 * Deletes a review (admin moderation).
 *
 * @param id - The review id.
 * @throws AppError 404 if it doesn't exist.
 */
export async function deleteReview(id: number): Promise<void> {
  const { count } = await prisma.review.deleteMany({ where: { id } });
  if (count === 0) throw notFound("Review");
}
