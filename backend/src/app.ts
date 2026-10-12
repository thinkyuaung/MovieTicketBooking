import { Prisma } from "@prisma/client";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { AppError } from "./errors.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { bookingsRouter } from "./routes/bookings.js";
import { healthRouter } from "./routes/health.js";
import { moviesRouter } from "./routes/movies.js";
import { showtimesRouter } from "./routes/showtimes.js";

/**
 * Turns any thrown error into a JSON response with the right status.
 *
 * @param err - The error.
 * @param _req - The request.
 * @param res - The response.
 * @param _next - Unused; Express needs four arguments to treat this as an error handler.
 */
function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, ...(err.details !== undefined && { details: err.details }) });
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    res.status(400).json({ error: details[0]?.message ?? "Invalid request.", details });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return void res.status(404).json({ error: "Not found." });
    if (err.code === "P2002") return void res.status(409).json({ error: "This already exists." });
    if (err.code === "P2003") return void res.status(409).json({ error: "This is still used by other records." });
  }
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ error: "The request body is not valid JSON." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
}

/**
 * Creates the Express application with all routes and error handling.
 * Kept separate from `server.ts` so tests can use it without opening a port.
 *
 * @returns The configured Express app.
 */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ name: "movieTicket API" });
  });
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/movies", moviesRouter);
  app.use("/api/showtimes", showtimesRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/admin", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}
