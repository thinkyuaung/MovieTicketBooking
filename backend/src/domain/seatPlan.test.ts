import { describe, expect, it } from "vitest";
import { generateHall } from "./hallLayout.js";
import { buildSeatPlan } from "./seatPlan.js";

describe("buildSeatPlan", () => {
  const hall = generateHall({
    name: "Test",
    rows: [
      { rowLabel: "A", type: "standard", blocks: [2, 2] },
      { rowLabel: "B", type: "couple", blocks: [1, 1] },
    ],
  });
  const seats = hall.seats.map((s, i) => ({ ...s, id: i + 1, isActive: s.label !== "A4" }));
  const plan = buildSeatPlan({
    layoutRows: hall.layoutRows,
    layoutCols: hall.layoutCols,
    seats,
    takenSeatIds: new Set([1]),
    prices: { priceStandard: 8000, priceVip: 15000, priceCouple: 25000, fullHallPrice: null },
    fullHall: { eligible: false, blockedBy: "too_soon", reason: "test", price: 66000 },
  });
  const seat = (label: string) => plan.seats.find((s) => s.label === label)!;

  it("marks taken, unavailable and available seats", () => {
    expect(seat("A1").status).toBe("taken");
    expect(seat("A4").status).toBe("unavailable");
    expect(seat("A2").status).toBe("available");
  });

  it("prices seats by type", () => {
    expect(seat("A2").price).toBe(8000);
    expect(seat("B1").price).toBe(25000);
  });

  it("lists rows front first and counts only seats in service", () => {
    expect(plan.rows).toEqual([
      { rowLabel: "A", gridRow: 0 },
      { rowLabel: "B", gridRow: 1 },
    ]);
    expect(plan.counts).toEqual({ total: 5, available: 4, taken: 1 });
  });
});
