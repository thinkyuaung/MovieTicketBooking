import type { SeatType } from "@prisma/client";

/**
 * Prices (MMK) set on a showtime for each seat type.
 */
export interface IShowtimePrices {
  priceStandard: number;
  priceVip: number;
  priceCouple: number;
  fullHallPrice: number | null;
}

/**
 * Returns the price of one seat for a showtime. Wheelchair spaces use the
 * standard price; a couple seat's price covers the pair.
 *
 * @param type - The seat type.
 * @param prices - The showtime's prices.
 * @returns Price in MMK.
 */
export function seatPrice(type: SeatType, prices: IShowtimePrices): number {
  switch (type) {
    case "vip":
      return prices.priceVip;
    case "couple":
      return prices.priceCouple;
    case "standard":
    case "wheelchair":
      return prices.priceStandard;
  }
}

/**
 * Returns the price for booking the whole hall: the showtime's fixed
 * full-hall price if set, otherwise the sum of every active seat's price.
 *
 * @param seatTypes - Types of all active seats in the hall.
 * @param prices - The showtime's prices.
 * @returns Price in MMK.
 */
export function fullHallPrice(seatTypes: SeatType[], prices: IShowtimePrices): number {
  if (prices.fullHallPrice !== null) return prices.fullHallPrice;
  return seatTypes.reduce((sum, type) => sum + seatPrice(type, prices), 0);
}
