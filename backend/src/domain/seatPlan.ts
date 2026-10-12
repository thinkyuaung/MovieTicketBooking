import type { SeatType } from "@prisma/client";
import type { IFullHallCheck } from "./booking.js";
import { seatPrice, type IShowtimePrices } from "./pricing.js";

/**
 * A seat on the plan, with its price and whether it can be picked.
 */
export interface IPlanSeat {
  id: number;
  label: string;
  rowLabel: string;
  number: number;
  gridRow: number;
  gridCol: number;
  width: number;
  type: SeatType;
  price: number;
  status: "available" | "taken" | "unavailable";
}

/**
 * Everything the frontend needs to draw a cinema seat plan.
 */
export interface ISeatPlan {
  layoutRows: number;
  layoutCols: number;
  /** Row letters with their grid row, front (screen side) first, for labels on both sides. */
  rows: { rowLabel: string; gridRow: number }[];
  seats: IPlanSeat[];
  counts: { total: number; available: number; taken: number };
  fullHall: IFullHallCheck & { price: number };
}

/**
 * Input for {@link buildSeatPlan}.
 */
export interface ISeatPlanInput {
  layoutRows: number;
  layoutCols: number;
  seats: { id: number; label: string; rowLabel: string; number: number; gridRow: number; gridCol: number; width: number; type: SeatType; isActive: boolean }[];
  takenSeatIds: Set<number>;
  prices: IShowtimePrices;
  fullHall: IFullHallCheck & { price: number };
}

/**
 * Builds the seat plan for one showing: each seat's price and state, row labels and counts.
 *
 * @param input - The hall's seats, which are taken, and the showing's prices.
 * @returns The seat plan, seats ordered row by row, left to right.
 */
export function buildSeatPlan(input: ISeatPlanInput): ISeatPlan {
  const seats: IPlanSeat[] = [...input.seats]
    .sort((a, b) => a.gridRow - b.gridRow || a.gridCol - b.gridCol)
    .map(({ isActive, ...seat }) => ({
      ...seat,
      price: seatPrice(seat.type, input.prices),
      status: input.takenSeatIds.has(seat.id) ? "taken" : isActive ? "available" : "unavailable",
    }));

  const rows = new Map<string, number>();
  for (const s of seats) if (!rows.has(s.rowLabel)) rows.set(s.rowLabel, s.gridRow);

  const active = seats.filter((s) => s.status !== "unavailable");
  const taken = seats.filter((s) => s.status === "taken").length;

  return {
    layoutRows: input.layoutRows,
    layoutCols: input.layoutCols,
    rows: [...rows].map(([rowLabel, gridRow]) => ({ rowLabel, gridRow })),
    seats,
    counts: { total: active.length, available: active.length - taken, taken },
    fullHall: input.fullHall,
  };
}
