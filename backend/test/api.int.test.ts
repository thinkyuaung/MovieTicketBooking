import request from "supertest";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { prisma } from "../src/db.js";
import { generateHall } from "../src/domain/hallLayout.js";

const DAY = 24 * 60 * 60 * 1000;
const app = createApp();

/**
 * Deletes every row in the test database, children before parents.
 */
async function resetDatabase(): Promise<void> {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`;
  if (!/test/i.test(db)) throw new Error(`Refusing to wipe "${db}": not a test database.`);
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.review.deleteMany();
  await prisma.showtime.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.hall.deleteMany();
  await prisma.movieGenre.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Builds an Authorization header.
 *
 * @param token - A login token.
 * @returns Header object for supertest's `.set()`.
 */
function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

describe.runIf(inject("dbReady"))("movieTicket API (MySQL)", () => {
  const prices = { priceStandard: 5000, priceVip: 10000, priceCouple: 18000 };
  /** 8 standard + 8 VIP + 4 couple = 192,000 MMK for the whole hall. */
  const FULL_HALL_SUM = 8 * 5000 + 8 * 10000 + 4 * 18000;
  const ids = { movie: 0, hall: 0, soon: 0, far: 0, far2: 0, past: 0 };
  const tokens = { aung: "", su: "", admin: "" };

  beforeAll(async () => {
    await resetDatabase();
    const now = Date.now();

    const movie = await prisma.movie.create({
      data: { title: "Coco", director: "Lee Unkrich", releaseYear: 2017, durationMin: 100, ageRating: "PG" },
    });
    const { seats, ...hall } = generateHall({
      name: "Test Hall",
      rows: [
        { rowLabel: "A", type: "standard", blocks: [4, 4] },
        { rowLabel: "B", type: "vip", blocks: [4, 4] },
        { rowLabel: "C", type: "couple", blocks: [2, 2] },
      ],
    });
    const createdHall = await prisma.hall.create({ data: { ...hall, seats: { create: seats } } });
    const makeShow = async (offsetMs: number) =>
      (
        await prisma.showtime.create({
          data: {
            movieId: movie.id,
            hallId: createdHall.id,
            startsAt: new Date(now + offsetMs),
            endsAt: new Date(now + offsetMs + 115 * 60_000),
            ...prices,
          },
        })
      ).id;

    Object.assign(ids, {
      movie: movie.id,
      hall: createdHall.id,
      soon: await makeShow(2 * DAY),
      far: await makeShow(10 * DAY),
      far2: await makeShow(12 * DAY),
      past: await makeShow(-DAY),
    });

    await prisma.user.create({
      data: { name: "Admin", email: "admin@test.local", role: "admin", passwordHash: await hashPassword("admin-pass-1") },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("auth", () => {
    it("registers users and returns a token", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Aung Aung", email: "Aung@Example.com", password: "password123" });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email: "aung@example.com", role: "user" });
      tokens.aung = res.body.token;

      const su = await request(app).post("/api/auth/register").send({ name: "Su Su", email: "su@example.com", password: "password123" });
      tokens.su = su.body.token;
    });

    it("rejects duplicate emails, short passwords and wrong logins", async () => {
      const dup = await request(app).post("/api/auth/register").send({ name: "X", email: "aung@example.com", password: "password123" });
      expect(dup.status).toBe(409);
      const short = await request(app).post("/api/auth/register").send({ name: "X", email: "x@example.com", password: "short" });
      expect(short.status).toBe(400);
      const wrong = await request(app).post("/api/auth/login").send({ email: "aung@example.com", password: "nope-nope" });
      expect(wrong.status).toBe(401);
    });

    it("logs in and returns the profile", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "admin-pass-1" });
      expect(res.status).toBe(200);
      tokens.admin = res.body.token;
      const me = await request(app).get("/api/auth/me").set(auth(tokens.admin));
      expect(me.body).toMatchObject({ name: "Admin", role: "admin" });
    });
  });

  describe("movies", () => {
    it("lists movies with their next showing", async () => {
      const res = await request(app).get("/api/movies");
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ title: "Coco", reviewCount: 0 });
      expect(res.body[0].nextShowtime).not.toBeNull();
    });

    it("shows a movie with upcoming showings, free seats and prices", async () => {
      const res = await request(app).get(`/api/movies/${ids.movie}`);
      expect(res.body.showtimes).toHaveLength(3); // the past showing is hidden
      expect(res.body.showtimes[0]).toMatchObject({
        availableSeats: 20,
        prices: { standard: 5000, vip: 10000, couple: 18000 },
        priceFrom: 5000,
      });
    });

    it("returns 404 for an unknown movie", async () => {
      expect((await request(app).get("/api/movies/999999")).status).toBe(404);
    });
  });

  describe("seat plan", () => {
    it("shows every seat and says when the whole hall can't be booked", async () => {
      const res = await request(app).get(`/api/showtimes/${ids.soon}/seats`);
      expect(res.body.plan.counts).toEqual({ total: 20, available: 20, taken: 0 });
      expect(res.body.plan.fullHall).toMatchObject({ eligible: false, price: FULL_HALL_SUM });
      expect(res.body.plan.fullHall.reason).toContain("7 days");
    });

    it("offers the whole hall for an empty show 10 days away", async () => {
      const res = await request(app).get(`/api/showtimes/${ids.far}/seats`);
      expect(res.body.plan.fullHall).toEqual({ eligible: true, blockedBy: null, reason: null, price: FULL_HALL_SUM });
    });
  });

  describe("seat booking", () => {
    it("needs a login", async () => {
      expect((await request(app).post("/api/bookings").send({ showtimeId: ids.soon, seats: ["A1"] })).status).toBe(401);
    });

    it("books seats and charges each seat's price", async () => {
      const res = await request(app).post("/api/bookings").set(auth(tokens.aung)).send({ showtimeId: ids.soon, seats: ["a1", "B1"] });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: "confirmed", totalPrice: 15000, seatCount: 2, canCancel: true });
      expect(res.body.bookingCode).toMatch(/^MT-/);
    });

    it("returns 409 with the taken seats", async () => {
      const res = await request(app).post("/api/bookings").set(auth(tokens.su)).send({ showtimeId: ids.soon, seats: ["A1", "A2"] });
      expect(res.status).toBe(409);
      expect(res.body.details).toEqual({ seats: ["A1"] });
    });

    it("rejects too many seats, unknown seats and started showings", async () => {
      const eleven = ["A2", "A3", "A4", "A5", "A6", "A7", "A8", "B2", "B3", "B4", "B5"];
      expect((await request(app).post("/api/bookings").set(auth(tokens.su)).send({ showtimeId: ids.soon, seats: eleven })).status).toBe(400);
      expect((await request(app).post("/api/bookings").set(auth(tokens.su)).send({ showtimeId: ids.soon, seats: ["Z9"] })).status).toBe(400);
      expect((await request(app).post("/api/bookings").set(auth(tokens.su)).send({ showtimeId: ids.past, seats: ["A1"] })).status).toBe(400);
    });

    it("lets only one of two people book the same seat at the same moment", async () => {
      const [a, b] = await Promise.all([
        request(app).post("/api/bookings").set(auth(tokens.aung)).send({ showtimeId: ids.soon, seats: ["C1"] }),
        request(app).post("/api/bookings").set(auth(tokens.su)).send({ showtimeId: ids.soon, seats: ["C1"] }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await prisma.bookingSeat.count({ where: { showtimeId: ids.soon, seat: { label: "C1" } } })).toBe(1);
    });
  });

  describe("whole-hall booking", () => {
    it("refuses a show less than 7 days away", async () => {
      const res = await request(app).post(`/api/showtimes/${ids.soon}/book-all`).set(auth(tokens.su));
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("7 days");
    });

    it("books every seat of an empty show 10 days away", async () => {
      const res = await request(app).post(`/api/showtimes/${ids.far}/book-all`).set(auth(tokens.su));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ isFullHall: true, totalPrice: FULL_HALL_SUM, seatCount: 20 });

      const plan = await request(app).get(`/api/showtimes/${ids.far}/seats`);
      expect(plan.body.plan.counts.available).toBe(0);
      const seat = await request(app).post("/api/bookings").set(auth(tokens.aung)).send({ showtimeId: ids.far, seats: ["A1"] });
      expect(seat.status).toBe(409);
    });

    it("refuses once anyone has booked a seat", async () => {
      await request(app).post("/api/bookings").set(auth(tokens.aung)).send({ showtimeId: ids.far2, seats: ["A1"] });
      const res = await request(app).post(`/api/showtimes/${ids.far2}/book-all`).set(auth(tokens.su));
      expect(res.status).toBe(409);
      expect(res.body.error).toContain("no seats are booked");
    });
  });

  describe("cancelling", () => {
    it("frees the seats so someone else can book them", async () => {
      const mine = await request(app).get("/api/bookings/me").set(auth(tokens.aung));
      const booking = mine.body.find((b: { showtime: { id: number }; seats: { label: string }[] }) =>
        b.showtime.id === ids.soon && b.seats.some((s) => s.label === "A1"),
      );

      expect((await request(app).delete(`/api/bookings/${booking.id}`).set(auth(tokens.su))).status).toBe(404);
      const cancel = await request(app).delete(`/api/bookings/${booking.id}`).set(auth(tokens.aung));
      expect(cancel.body).toMatchObject({ status: "cancelled", canCancel: false });
      expect((await request(app).delete(`/api/bookings/${booking.id}`).set(auth(tokens.aung))).status).toBe(409);

      const rebook = await request(app).post("/api/bookings").set(auth(tokens.su)).send({ showtimeId: ids.soon, seats: ["A1"] });
      expect(rebook.status).toBe(201);
    });
  });

  describe("reviews", () => {
    it("allows one review per user per movie, score 1–10", async () => {
      const url = `/api/movies/${ids.movie}/reviews`;
      expect((await request(app).post(url).set(auth(tokens.aung)).send({ score: 9, comment: "Loved it" })).status).toBe(201);
      expect((await request(app).post(url).set(auth(tokens.aung)).send({ score: 8, comment: "Again" })).status).toBe(409);
      expect((await request(app).post(url).set(auth(tokens.su)).send({ score: 11, comment: "Too high" })).status).toBe(400);
      expect((await request(app).post(url).set(auth(tokens.su)).send({ score: 2, comment: "Not for me" })).status).toBe(201);
    });
  });

  describe("admin", () => {
    it("blocks customers and anonymous users", async () => {
      expect((await request(app).get("/api/admin/dashboard")).status).toBe(401);
      expect((await request(app).get("/api/admin/dashboard").set(auth(tokens.aung))).status).toBe(403);
    });

    it("reports revenue equal to all confirmed bookings, and flags low reviews", async () => {
      const res = await request(app).get("/api/admin/dashboard").set(auth(tokens.admin));
      const { _sum } = await prisma.booking.aggregate({ where: { status: "confirmed" }, _sum: { totalPrice: true } });
      expect(res.status).toBe(200);
      expect(res.body.totals.revenue).toBe(_sum.totalPrice);
      expect(res.body.totals.fullHallBookings).toBe(1);
      expect(res.body.lowScoreReviews).toHaveLength(1);
      expect(res.body.showtimes.find((s: { showtimeId: number }) => s.showtimeId === ids.far)).toMatchObject({ occupancyRate: 100, isFullHall: true });
    });

    it("creates a movie and a hall, and blocks overlapping showings", async () => {
      const movie = await request(app)
        .post("/api/admin/movies")
        .set(auth(tokens.admin))
        .send({ title: "Inception", director: "Christopher Nolan", releaseYear: 2010, durationMin: 148, ageRating: "PG13", genres: ["Sci-Fi"] });
      expect(movie.status).toBe(201);
      expect(movie.body.genres).toEqual(["Sci-Fi"]);

      const preview = await request(app)
        .post("/api/admin/halls/preview")
        .set(auth(tokens.admin))
        .send({ rows: [{ rowLabel: "A", type: "couple", blocks: [2] }] });
      expect(preview.body).toMatchObject({ seatCount: 2, layoutCols: 4 });
      const badPreview = await request(app)
        .post("/api/admin/halls/preview")
        .set(auth(tokens.admin))
        .send({ rows: [{ rowLabel: "A", type: "standard", blocks: [2], wheelchairSeats: [9] }] });
      expect(badPreview.status).toBe(400);

      const hall = await request(app)
        .post("/api/admin/halls")
        .set(auth(tokens.admin))
        .send({ name: "Hall 9", rows: [{ rowLabel: "A", type: "standard", blocks: [3, 3] }] });
      expect(hall.status).toBe(201);
      expect(hall.body).toMatchObject({ seatCount: 6, layoutCols: 7 });

      const soon = await prisma.showtime.findUniqueOrThrow({ where: { id: ids.soon } });
      const body = { movieId: movie.body.id, hallId: ids.hall, ...prices };
      const clash = await request(app)
        .post("/api/admin/showtimes")
        .set(auth(tokens.admin))
        .send({ ...body, startsAt: new Date(soon.startsAt.getTime() + 30 * 60_000).toISOString() });
      expect(clash.status).toBe(409);

      const ok = await request(app)
        .post("/api/admin/showtimes")
        .set(auth(tokens.admin))
        .send({ ...body, startsAt: soon.endsAt.toISOString() });
      expect(ok.status).toBe(201);
      expect(new Date(ok.body.endsAt).getTime() - new Date(ok.body.startsAt).getTime()).toBe((148 + 15) * 60_000);
    });

    it("switches a seat off, and refuses changing a seat to couple", async () => {
      const hall = await request(app).get(`/api/admin/halls/${ids.hall}`).set(auth(tokens.admin));
      const a8 = hall.body.seats.find((s: { label: string }) => s.label === "A8");
      const off = await request(app).patch(`/api/admin/halls/${ids.hall}/seats/${a8.id}`).set(auth(tokens.admin)).send({ isActive: false });
      expect(off.body.isActive).toBe(false);
      const plan = await request(app).get(`/api/showtimes/${ids.soon}/seats`);
      expect(plan.body.plan.seats.find((s: { label: string }) => s.label === "A8").status).toBe("unavailable");

      const couple = await request(app).patch(`/api/admin/halls/${ids.hall}/seats/${a8.id}`).set(auth(tokens.admin)).send({ type: "couple" });
      expect(couple.status).toBe(400);
    });

    it("lists who booked a showing, then cancels the showing and all its bookings", async () => {
      const list = await request(app).get(`/api/admin/showtimes/${ids.soon}/bookings`).set(auth(tokens.admin));
      expect(list.body.length).toBeGreaterThan(0);
      expect(list.body[0].customer.email).toMatch(/@example\.com$/);

      expect((await request(app).delete(`/api/admin/showtimes/${ids.soon}`).set(auth(tokens.admin))).status).toBe(409);
      const cancel = await request(app).post(`/api/admin/showtimes/${ids.soon}/cancel`).set(auth(tokens.admin));
      expect(cancel.body.cancelledBookings).toBeGreaterThan(0);
      expect(await prisma.booking.count({ where: { showtimeId: ids.soon, status: "confirmed" } })).toBe(0);
      expect(await prisma.bookingSeat.count({ where: { showtimeId: ids.soon } })).toBe(0);
    });

    it("deletes a review", async () => {
      const review = await prisma.review.findFirstOrThrow({ where: { score: 2 } });
      expect((await request(app).delete(`/api/admin/reviews/${review.id}`).set(auth(tokens.admin))).status).toBe(204);
      expect((await request(app).delete(`/api/admin/reviews/${review.id}`).set(auth(tokens.admin))).status).toBe(404);
    });
  });
});
