import { describe, expect, it } from "vitest";
import { fullHallPrice, seatPrice, type IShowtimePrices } from "./pricing.js";

const prices: IShowtimePrices = { priceStandard: 8000, priceVip: 15000, priceCouple: 25000, fullHallPrice: null };

describe("seatPrice", () => {
  it("prices each seat type", () => {
    expect(seatPrice("standard", prices)).toBe(8000);
    expect(seatPrice("wheelchair", prices)).toBe(8000);
    expect(seatPrice("vip", prices)).toBe(15000);
    expect(seatPrice("couple", prices)).toBe(25000);
  });
});

describe("fullHallPrice", () => {
  it("sums seat prices when no fixed price is set", () => {
    expect(fullHallPrice(["standard", "vip", "couple", "wheelchair"], prices)).toBe(56000);
  });

  it("uses the fixed full-hall price when set", () => {
    expect(fullHallPrice(["standard", "vip"], { ...prices, fullHallPrice: 800000 })).toBe(800000);
  });
});
