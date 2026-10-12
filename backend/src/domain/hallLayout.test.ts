import { describe, expect, it } from "vitest";
import { generateHall } from "./hallLayout.js";

describe("generateHall", () => {
  const hall = generateHall({
    name: "Test",
    rows: [
      { rowLabel: "A", type: "standard", blocks: [6, 6], wheelchairSeats: [1] },
      { rowLabel: "B", type: "vip", blocks: [6, 6], gapBefore: true },
      { rowLabel: "C", type: "couple", blocks: [3, 3] },
      { rowLabel: "D", type: "standard", blocks: [4] },
    ],
  });
  const seat = (label: string) => hall.seats.find((s) => s.label === label)!;

  it("numbers seats left to right across the aisle", () => {
    expect(seat("A6").gridCol).toBe(5);
    expect(seat("A7").gridCol).toBe(7); // column 6 is the aisle
    expect(seat("A12").gridCol).toBe(12);
    expect(hall.layoutCols).toBe(13);
  });

  it("marks wheelchair spaces", () => {
    expect(seat("A1").type).toBe("wheelchair");
    expect(seat("A2").type).toBe("standard");
  });

  it("leaves a cross aisle before a row with gapBefore", () => {
    expect(seat("A1").gridRow).toBe(0);
    expect(seat("B1").gridRow).toBe(2);
    expect(hall.layoutRows).toBe(5);
  });

  it("makes couple seats two cells wide", () => {
    expect(seat("C1")).toMatchObject({ width: 2, gridCol: 0, type: "couple" });
    expect(seat("C2").gridCol).toBe(2);
    expect(seat("C4").gridCol).toBe(7);
  });

  it("centres narrow rows", () => {
    expect(seat("D1").gridCol).toBe(4); // (13 - 4) / 2 = 4.5, rounded down
  });

  it("gives every seat a unique grid position", () => {
    const keys = hall.seats.map((s) => `${s.gridRow}:${s.gridCol}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("rejects duplicate rows and bad wheelchair seats", () => {
    expect(() =>
      generateHall({ name: "X", rows: [{ rowLabel: "A", type: "standard", blocks: [2] }, { rowLabel: "A", type: "standard", blocks: [2] }] }),
    ).toThrow("appears twice");
    expect(() =>
      generateHall({ name: "X", rows: [{ rowLabel: "A", type: "standard", blocks: [2], wheelchairSeats: [5] }] }),
    ).toThrow("doesn't exist");
  });
});
