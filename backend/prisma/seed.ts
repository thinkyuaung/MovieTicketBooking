import { PrismaClient, type AgeRating, type Hall, type Movie, type Seat } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateBookingCode } from "../src/domain/bookingCode.js";
import { generateHall, type IHallLayoutSpec } from "../src/domain/hallLayout.js";
import { fullHallPrice, seatPrice, type IShowtimePrices } from "../src/domain/pricing.js";

const prisma = new PrismaClient();

/** Myanmar Time is UTC+06:30 all year. */
const YANGON_OFFSET_MS = 6.5 * 60 * 60 * 1000;

/**
 * Returns a UTC Date for a wall-clock time in Yangon, a number of days from today.
 *
 * @param dayOffset - Days from today (Yangon date). 0 = today.
 * @param hour - Hour in Yangon time (0–23).
 * @param minute - Minute.
 * @returns The matching instant.
 */
function yangonTime(dayOffset: number, hour: number, minute = 0): Date {
  const yangonNow = new Date(Date.now() + YANGON_OFFSET_MS);
  const utc = Date.UTC(
    yangonNow.getUTCFullYear(),
    yangonNow.getUTCMonth(),
    yangonNow.getUTCDate() + dayOffset,
    hour,
    minute,
  );
  return new Date(utc - YANGON_OFFSET_MS);
}

const HALLS: IHallLayoutSpec[] = [
  {
    name: "Hall 1",
    rows: [
      { rowLabel: "A", type: "standard", blocks: [6, 6], wheelchairSeats: [1, 12] },
      { rowLabel: "B", type: "standard", blocks: [6, 6] },
      { rowLabel: "C", type: "standard", blocks: [6, 6] },
      { rowLabel: "D", type: "standard", blocks: [6, 6] },
      { rowLabel: "E", type: "vip", blocks: [6, 6], gapBefore: true },
      { rowLabel: "F", type: "vip", blocks: [6, 6] },
      { rowLabel: "G", type: "couple", blocks: [3, 3] },
    ],
  },
  {
    name: "Hall 2",
    rows: [
      { rowLabel: "A", type: "standard", blocks: [4, 6, 4], wheelchairSeats: [1, 14] },
      { rowLabel: "B", type: "standard", blocks: [4, 6, 4] },
      { rowLabel: "C", type: "standard", blocks: [4, 6, 4] },
      { rowLabel: "D", type: "standard", blocks: [4, 6, 4] },
      { rowLabel: "E", type: "standard", blocks: [4, 6, 4] },
      { rowLabel: "F", type: "vip", blocks: [4, 6, 4], gapBefore: true },
    ],
  },
];

/** Showtime prices per hall, in MMK. */
const HALL_PRICES: Record<string, IShowtimePrices> = {
  "Hall 1": { priceStandard: 8000, priceVip: 15000, priceCouple: 25000, fullHallPrice: 800000 },
  "Hall 2": { priceStandard: 7000, priceVip: 12000, priceCouple: 20000, fullHallPrice: null },
};

const MOVIES: {
  title: string;
  director: string;
  releaseYear: number;
  durationMin: number;
  ageRating: AgeRating;
  genres: string[];
  description: string;
}[] = [
  {
    title: "Inception",
    director: "Christopher Nolan",
    releaseYear: 2010,
    durationMin: 148,
    ageRating: "PG13",
    genres: ["Sci-Fi", "Action", "Thriller"],
    description: "A thief who steals secrets through dreams is given one last job: to plant an idea.",
  },
  {
    title: "Spirited Away",
    director: "Hayao Miyazaki",
    releaseYear: 2001,
    durationMin: 125,
    ageRating: "PG",
    genres: ["Animation", "Fantasy"],
    description: "A girl wanders into a world of spirits and must work in a bathhouse to free her parents.",
  },
  {
    title: "Interstellar",
    director: "Christopher Nolan",
    releaseYear: 2014,
    durationMin: 169,
    ageRating: "PG13",
    genres: ["Sci-Fi", "Drama"],
    description: "Explorers travel through a wormhole in search of a new home for humanity.",
  },
  {
    title: "Parasite",
    director: "Bong Joon-ho",
    releaseYear: 2019,
    durationMin: 132,
    ageRating: "R",
    genres: ["Thriller", "Drama"],
    description: "A poor family schemes its way into working for a wealthy household.",
  },
  {
    title: "Coco",
    director: "Lee Unkrich",
    releaseYear: 2017,
    durationMin: 105,
    ageRating: "PG",
    genres: ["Animation", "Family", "Music"],
    description: "A young musician crosses into the Land of the Dead to find his great-great-grandfather.",
  },
];

/**
 * Deletes all rows so the seed can be run again. Children before parents.
 */
async function clearDatabase(): Promise<void> {
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
 * Creates a confirmed booking for the given seat labels, charging each seat's price.
 *
 * @param userId - Who books.
 * @param showtimeId - Which showing.
 * @param prices - The showtime's prices.
 * @param hallSeats - All seats of the showtime's hall.
 * @param labels - Seat labels to book; labels not in this hall are skipped.
 */
async function bookSeats(
  userId: number,
  showtimeId: number,
  prices: IShowtimePrices,
  hallSeats: Seat[],
  labels: string[],
): Promise<void> {
  const seats = hallSeats.filter((s) => labels.includes(s.label));
  const lines = seats.map((s) => ({ seatId: s.id, showtimeId, price: seatPrice(s.type, prices) }));
  await prisma.booking.create({
    data: {
      bookingCode: generateBookingCode(),
      userId,
      showtimeId,
      totalPrice: lines.reduce((sum, l) => sum + l.price, 0),
      seats: { create: lines },
    },
  });
}

/**
 * Fills the movieTicket database with sample data for local development.
 */
async function main(): Promise<void> {
  await clearDatabase();

  const passwordHash = await bcrypt.hash("password123", 10);
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@movieticket.local", passwordHash: adminHash, role: "admin" },
  });
  const [aung, su, min] = await Promise.all(
    [
      { name: "Aung Aung", email: "aung@example.com", phone: "09 421 000 111" },
      { name: "Su Su", email: "su@example.com", phone: "09 421 000 222" },
      { name: "Min Thu", email: "min@example.com", phone: "09 421 000 333" },
    ].map((u) => prisma.user.create({ data: { ...u, passwordHash } })),
  );

  const genreNames = [...new Set(MOVIES.flatMap((m) => m.genres))];
  const genres = await Promise.all(genreNames.map((name) => prisma.genre.create({ data: { name } })));
  const genreId = new Map(genres.map((g) => [g.name, g.id]));

  const movies: Movie[] = [];
  for (const { genres: names, ...movie } of MOVIES) {
    movies.push(
      await prisma.movie.create({
        data: { ...movie, genres: { create: names.map((n) => ({ genreId: genreId.get(n)! })) } },
      }),
    );
  }

  const halls: (Hall & { seats: Seat[] })[] = [];
  for (const spec of HALLS) {
    const { seats, ...hall } = generateHall(spec);
    halls.push(await prisma.hall.create({ data: { ...hall, seats: { create: seats } }, include: { seats: true } }));
  }

  // Two shows per hall per day for the next 14 days (some of today's may already be past).
  const slots = [
    { hall: halls[0], hour: 13, offset: 0 },
    { hall: halls[0], hour: 19, offset: 1 },
    { hall: halls[1], hour: 14, offset: 2 },
    { hall: halls[1], hour: 20, offset: 3 },
  ];
  for (let day = 0; day < 14; day++) {
    for (const slot of slots) {
      const movie = movies[(day + slot.offset) % movies.length];
      const startsAt = yangonTime(day, slot.hour);
      const endsAt = new Date(startsAt.getTime() + (movie.durationMin + 15) * 60_000);
      await prisma.showtime.create({
        data: { movieId: movie.id, hallId: slot.hall.id, startsAt, endsAt, ...HALL_PRICES[slot.hall.name] },
      });
    }
  }

  // Sample bookings on upcoming shows so seat plans and the dashboard aren't empty.
  const upcoming = await prisma.showtime.findMany({
    where: { startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { hall: { include: { seats: true } } },
  });
  const samples: { user: number; labels: string[] }[] = [
    { user: aung.id, labels: ["C5", "C6"] },
    { user: su.id, labels: ["E7", "E8", "E9"] },
    { user: min.id, labels: ["G2", "D3", "D4"] },
    { user: aung.id, labels: ["B1", "B2", "B3", "B4"] },
  ];
  for (let i = 0; i < 6 && i < upcoming.length; i++) {
    const show = upcoming[i];
    for (const sample of samples.slice(0, (i % samples.length) + 1)) {
      await bookSeats(sample.user, show.id, show, show.hall.seats, sample.labels);
    }
  }

  // One whole-hall booking: a Hall 2 show 10 days away (meets the 7-day, empty-hall rule).
  const privateShow = upcoming.find((s) => s.hallId === halls[1].id && s.startsAt >= yangonTime(10, 0));
  if (privateShow) {
    const seats = privateShow.hall.seats.filter((s) => s.isActive);
    await prisma.booking.create({
      data: {
        bookingCode: generateBookingCode(),
        userId: su.id,
        showtimeId: privateShow.id,
        totalPrice: fullHallPrice(seats.map((s) => s.type), privateShow),
        isFullHall: true,
        seats: {
          create: seats.map((s) => ({ seatId: s.id, showtimeId: privateShow.id, price: seatPrice(s.type, privateShow) })),
        },
      },
    });
  }

  const reviews = [
    { userId: aung.id, movie: 0, score: 9, comment: "Mind-bending. The hallway fight scene is amazing on a big screen." },
    { userId: su.id, movie: 0, score: 8, comment: "Great story, a bit confusing in the middle." },
    { userId: su.id, movie: 1, score: 10, comment: "Beautiful from start to finish. Bring the kids." },
    { userId: min.id, movie: 1, score: 9, comment: "Every frame looks like a painting." },
    { userId: aung.id, movie: 2, score: 8, comment: "Long, but the docking scene is worth it." },
    { userId: min.id, movie: 2, score: 3, comment: "Too slow for me and the sound was too loud." },
    { userId: aung.id, movie: 3, score: 9, comment: "Funny and dark. Did not expect that ending." },
    { userId: su.id, movie: 4, score: 9, comment: "Cried at the end. Great music." },
    { userId: min.id, movie: 4, score: 2, comment: "Not my type of movie." },
  ];
  await prisma.review.createMany({
    data: reviews.map((r) => ({ userId: r.userId, movieId: movies[r.movie].id, score: r.score, comment: r.comment })),
  });

  const counts = {
    users: await prisma.user.count(),
    movies: movies.length,
    halls: halls.length,
    seats: await prisma.seat.count(),
    showtimes: await prisma.showtime.count(),
    bookings: await prisma.booking.count(),
    reviews: await prisma.review.count(),
  };
  console.log("Seeded movieTicket:", counts);
  console.log(`Admin login: ${admin.email} / admin123 · user login: aung@example.com / password123`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
