import { z } from "zod";

/** A positive whole-number id from the URL, e.g. `/movies/3`. */
export const idParam = z.coerce.number().int().positive();

/** A price in whole kyat (MMK). */
export const mmk = z.number().int().min(0).max(100_000_000);

const seatType = z.enum(["standard", "vip", "couple", "wheelchair"]);

/** Optional date range in the query string, e.g. `?from=2026-10-01&to=2026-11-01`. */
export const dateRangeQuery = z
  .object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })
  .refine((r) => !r.from || !r.to || r.from < r.to, { message: "`from` must be before `to`.", path: ["from"] });

export const registerBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(191),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100),
  phone: z.string().trim().max(30).optional(),
});

export const loginBody = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export const movieListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(50).optional(),
});

export const reviewBody = z.object({
  score: z.number().int().min(1, "Score must be 1–10.").max(10, "Score must be 1–10."),
  comment: z.string().trim().min(1, "Write a short comment.").max(2000),
});

export const bookingBody = z.object({
  showtimeId: z.number().int().positive(),
  seats: z.array(z.string().trim().min(1).max(5)).min(1, "Choose at least one seat.").max(50),
});

export const movieBody = z.object({
  title: z.string().trim().min(1).max(200),
  director: z.string().trim().min(1).max(100),
  releaseYear: z.number().int().min(1888).max(2100),
  durationMin: z.number().int().min(1).max(600),
  ageRating: z.enum(["G", "PG", "PG13", "R"]),
  description: z.string().trim().max(5000).nullable().optional(),
  posterUrl: z.string().trim().url().max(500).nullable().optional(),
  genres: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
});

export const movieUpdateBody = movieBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to change.");

const hallRow = z.object({
  rowLabel: z.string().regex(/^[A-Z]{1,2}$/, "Row label must be 1–2 capital letters."),
  type: seatType,
  blocks: z.array(z.number().int().min(1).max(60)).min(1).max(6),
  wheelchairSeats: z.array(z.number().int().min(1)).optional(),
  gapBefore: z.boolean().optional(),
});

export const hallBody = z.object({
  name: z.string().trim().min(1).max(50),
  rows: z.array(hallRow).min(1).max(60),
});

export const hallRenameBody = z.object({ name: z.string().trim().min(1).max(50) });

export const hallLayoutBody = z.object({ rows: z.array(hallRow).min(1).max(60) });

export const seatUpdateBody = z
  .object({ isActive: z.boolean().optional(), type: seatType.optional() })
  .refine((b) => b.isActive !== undefined || b.type !== undefined, "Nothing to change.");

export const showtimeBody = z.object({
  movieId: z.number().int().positive(),
  hallId: z.number().int().positive(),
  startsAt: z.coerce.date(),
  priceStandard: mmk,
  priceVip: mmk,
  priceCouple: mmk,
  fullHallPrice: mmk.nullable().optional(),
});

export const showtimeUpdateBody = showtimeBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to change.");

export const showtimeListQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  movieId: z.coerce.number().int().positive().optional(),
  hallId: z.coerce.number().int().positive().optional(),
});
