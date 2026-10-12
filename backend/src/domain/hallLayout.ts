import type { SeatType } from "@prisma/client";

/**
 * One row of a hall, described the way staff would sketch it.
 *
 * Example: `{ rowLabel: "A", type: "standard", blocks: [6, 6] }` is six seats,
 * an aisle, then six more seats, labelled A1–A12.
 */
export interface IHallRowSpec {
  rowLabel: string;
  type: SeatType;
  /** Seats per block, left to right. Blocks are separated by a one-cell aisle. */
  blocks: number[];
  /** Seat numbers in this row that are wheelchair spaces. */
  wheelchairSeats?: number[];
  /** Leave an empty grid row (a cross aisle) before this row. */
  gapBefore?: boolean;
}

/**
 * A full hall description, front row (nearest the screen) first.
 */
export interface IHallLayoutSpec {
  name: string;
  rows: IHallRowSpec[];
}

/**
 * A seat ready to be inserted into the `seats` table.
 */
export interface IGeneratedSeat {
  label: string;
  rowLabel: string;
  number: number;
  gridRow: number;
  gridCol: number;
  width: number;
  type: SeatType;
}

/**
 * A hall ready to be inserted, with its grid size and seats.
 */
export interface IGeneratedHall {
  name: string;
  layoutRows: number;
  layoutCols: number;
  seats: IGeneratedSeat[];
}

/**
 * Returns how many grid cells a seat of the given type covers.
 *
 * @param type - The seat type.
 * @returns 2 for couple seats, otherwise 1.
 */
export function seatWidth(type: SeatType): number {
  return type === "couple" ? 2 : 1;
}

/**
 * Returns the number of grid cells a row needs, including aisles between blocks.
 *
 * @param row - The row description.
 * @returns Row width in grid cells.
 */
function rowWidth(row: IHallRowSpec): number {
  const seats = row.blocks.reduce((sum, n) => sum + n, 0);
  return seats * seatWidth(row.type) + (row.blocks.length - 1);
}

/**
 * Checks a hall description and throws a readable error if it is invalid.
 *
 * @param spec - The hall description.
 * @throws If rows are missing, duplicated or malformed.
 */
function validate(spec: IHallLayoutSpec): void {
  if (spec.rows.length === 0) throw new Error(`Hall "${spec.name}" has no rows.`);
  const seen = new Set<string>();
  for (const row of spec.rows) {
    if (!/^[A-Z]{1,2}$/.test(row.rowLabel)) {
      throw new Error(`Row label "${row.rowLabel}" must be 1–2 capital letters.`);
    }
    if (seen.has(row.rowLabel)) throw new Error(`Row ${row.rowLabel} appears twice.`);
    seen.add(row.rowLabel);
    if (row.blocks.length === 0 || row.blocks.some((n) => !Number.isInteger(n) || n < 1)) {
      throw new Error(`Row ${row.rowLabel} needs at least one block of 1 or more seats.`);
    }
    const total = row.blocks.reduce((sum, n) => sum + n, 0);
    for (const n of row.wheelchairSeats ?? []) {
      if (row.type === "couple") throw new Error(`Row ${row.rowLabel}: couple rows can't have wheelchair spaces.`);
      if (n < 1 || n > total) throw new Error(`Row ${row.rowLabel}: wheelchair seat ${n} doesn't exist.`);
    }
  }
}

/**
 * Builds the seats and grid size for a hall. Seat numbers run left to right
 * and continue across aisles (A1–A6, aisle, A7–A12). Rows narrower than the
 * widest row are centred, as in a real cinema.
 *
 * @param spec - The hall description, front row first.
 * @returns The hall's grid size and all its seats.
 * @throws If the description is invalid.
 */
export function generateHall(spec: IHallLayoutSpec): IGeneratedHall {
  validate(spec);
  const layoutCols = Math.max(...spec.rows.map(rowWidth));
  const seats: IGeneratedSeat[] = [];
  let gridRow = 0;

  for (const row of spec.rows) {
    if (row.gapBefore && gridRow > 0) gridRow++;
    const width = seatWidth(row.type);
    const wheelchair = new Set(row.wheelchairSeats ?? []);
    let gridCol = Math.floor((layoutCols - rowWidth(row)) / 2);
    let number = 1;

    row.blocks.forEach((count, blockIndex) => {
      if (blockIndex > 0) gridCol++; // aisle
      for (let i = 0; i < count; i++) {
        seats.push({
          label: `${row.rowLabel}${number}`,
          rowLabel: row.rowLabel,
          number,
          gridRow,
          gridCol,
          width,
          type: wheelchair.has(number) ? "wheelchair" : row.type,
        });
        gridCol += width;
        number++;
      }
    });
    gridRow++;
  }

  return { name: spec.name, layoutRows: gridRow, layoutCols, seats };
}
