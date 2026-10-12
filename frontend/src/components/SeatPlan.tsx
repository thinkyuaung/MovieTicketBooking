import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatMMK } from "../lib/money";
import type { IPlanSeat, SeatType } from "../lib/types";

export const SEAT_TYPE_NAMES: Record<SeatType, string> = {
  standard: "Standard",
  vip: "VIP",
  couple: "Couple (for 2)",
  wheelchair: "Wheelchair space",
};

const ZOOM_STEPS = [14, 17, 20, 24, 28, 34, 40];
const DEFAULT_ZOOM = 4;
/** Gap between seats and width of the row-letter columns, in px (match styles.css). */
const SEAT_GAP = 5;
const ROW_LABEL = 22;

/**
 * Props for {@link SeatPlan}.
 */
interface ISeatPlanProps {
  layoutRows: number;
  layoutCols: number;
  seats: IPlanSeat[];
  /** Labels of selected seats. */
  selected?: Set<string>;
  /** Called when a seat is clicked. Without it the plan is read-only. */
  onSeatClick?: (seat: IPlanSeat) => void;
  /** "pick": only available seats can be clicked. "any": every seat can (admin). */
  clickable?: "pick" | "any";
  /** Extra tooltip line for a seat, e.g. who booked it. */
  describeSeat?: (seat: IPlanSeat) => string | null;
  /** Short name for screen readers, e.g. "Seat plan for Hall 1". */
  label: string;
}

/**
 * Draws a hall like a real cinema: screen at the top, row letters on both
 * sides, aisles and gaps from the layout grid. Seats show their type and state;
 * hovering or focusing a seat shows its label, type and price.
 *
 * @param props - Seats, layout size, selection and click handler.
 * @returns The seat plan with zoom controls and a legend.
 */
export function SeatPlan({ layoutRows, layoutCols, seats, selected, onSeatClick, clickable = "pick", describeSeat, label }: ISeatPlanProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [hover, setHover] = useState<{ seat: IPlanSeat; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On narrow screens, start zoomed out far enough for the whole hall to fit.
  useLayoutEffect(() => {
    const width = scrollRef.current?.clientWidth;
    if (!width) return;
    // Row letters on both sides, the seat columns, and a gap between every pair of columns.
    const fits = (size: number) => 2 * ROW_LABEL + layoutCols * size + (layoutCols + 1) * SEAT_GAP + 8 <= width;
    let step = DEFAULT_ZOOM;
    while (step > 0 && !fits(ZOOM_STEPS[step])) step--;
    setZoom(step);
  }, [layoutCols]);

  const rows = useMemo(() => {
    const byRow = new Map<number, string>();
    for (const s of seats) if (!byRow.has(s.gridRow)) byRow.set(s.gridRow, s.rowLabel);
    return [...byRow].map(([gridRow, rowLabel]) => ({ gridRow, rowLabel }));
  }, [seats]);

  const types = useMemo(() => {
    const present = new Set(seats.map((s) => s.type));
    return (Object.keys(SEAT_TYPE_NAMES) as SeatType[]).filter((t) => present.has(t));
  }, [seats]);
  const hasTaken = seats.some((s) => s.status === "taken");
  const hasOff = seats.some((s) => s.status === "unavailable");

  /**
   * Shows the tooltip above a seat.
   *
   * @param seat - The seat.
   * @param el - The seat's button.
   */
  function showTip(seat: IPlanSeat, el: HTMLElement): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = el.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    setHover({ seat, x: a.left - c.left + a.width / 2, y: a.top - c.top });
  }

  /**
   * Returns whether a seat can be clicked.
   *
   * @param seat - The seat.
   * @returns True if clickable.
   */
  function isClickable(seat: IPlanSeat): boolean {
    if (!onSeatClick) return false;
    return clickable === "any" || seat.status === "available";
  }

  /**
   * Describes a seat's state in words.
   *
   * @param seat - The seat.
   * @returns e.g. "Available", "Selected", "Taken".
   */
  function stateText(seat: IPlanSeat): string {
    if (selected?.has(seat.label)) return "Selected";
    return seat.status === "available" ? "Available" : seat.status === "taken" ? "Taken" : "Out of service";
  }

  const style = {
    "--seat": `${ZOOM_STEPS[zoom]}px`,
    gridTemplateColumns: `var(--row-label) repeat(${layoutCols}, var(--seat)) var(--row-label)`,
    gridTemplateRows: `repeat(${layoutRows}, var(--seat))`,
  } as CSSProperties;

  return (
    <div className="seatplan">
      <div className="seatplan-tools">
        <span className="muted small">Zoom</span>
        <button type="button" className="btn btn-small" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
          disabled={zoom === ZOOM_STEPS.length - 1}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div className="seatplan-scroll" ref={scrollRef}>
        <div className="seatplan-canvas" ref={canvasRef} onMouseLeave={() => setHover(null)}>
          <div className="screen" aria-hidden="true">
            <span>SCREEN</span>
          </div>
          <div className="seatgrid" style={style} role="group" aria-label={label}>
            {rows.map((r) => (
              <RowLabels key={r.gridRow} gridRow={r.gridRow} rowLabel={r.rowLabel} lastCol={layoutCols + 2} />
            ))}
            {seats.map((seat) => {
              const isSelected = selected?.has(seat.label) ?? false;
              const canClick = isClickable(seat);
              const price = seat.price !== undefined ? `, ${formatMMK(seat.price)}` : "";
              return (
                <button
                  key={seat.label}
                  type="button"
                  className={`seat seat-${seat.type} is-${seat.status}${isSelected ? " is-selected" : ""}${canClick ? " is-clickable" : ""}`}
                  style={{ gridColumn: `${seat.gridCol + 2} / span ${seat.width}`, gridRow: seat.gridRow + 1 }}
                  // Not `disabled`: browsers send no hover events to disabled buttons, and taken seats need their tooltip.
                  aria-disabled={!canClick}
                  tabIndex={canClick ? 0 : -1}
                  aria-pressed={onSeatClick && clickable === "pick" ? isSelected : undefined}
                  aria-label={`${seat.label}, ${SEAT_TYPE_NAMES[seat.type]}${price}, ${stateText(seat)}`}
                  onClick={() => canClick && onSeatClick?.(seat)}
                  onMouseEnter={(e) => showTip(seat, e.currentTarget)}
                  onFocus={(e) => showTip(seat, e.currentTarget)}
                  onBlur={() => setHover(null)}
                >
                  <span className="seat-num">{seat.type === "wheelchair" ? "♿" : seat.number}</span>
                </button>
              );
            })}
          </div>
          {hover && (
            <div className="seat-tip" style={{ left: hover.x, top: hover.y }} role="tooltip">
              <strong>{hover.seat.label}</strong> · {SEAT_TYPE_NAMES[hover.seat.type]}
              {hover.seat.price !== undefined && <> · {formatMMK(hover.seat.price)}</>}
              <div className="muted">{stateText(hover.seat)}</div>
              {describeSeat?.(hover.seat) && <div>{describeSeat(hover.seat)}</div>}
            </div>
          )}
        </div>
      </div>

      <ul className="legend" aria-label="Legend">
        {types.map((t) => (
          <li key={t}>
            <span className={`seat seat-${t} is-available legend-swatch`} aria-hidden="true" />
            {SEAT_TYPE_NAMES[t]}
          </li>
        ))}
        {selected && (
          <li>
            <span className="seat seat-standard is-available is-selected legend-swatch" aria-hidden="true" />
            Selected
          </li>
        )}
        {hasTaken && (
          <li>
            <span className="seat seat-standard is-taken legend-swatch" aria-hidden="true" />
            Taken
          </li>
        )}
        {hasOff && (
          <li>
            <span className="seat seat-standard is-unavailable legend-swatch" aria-hidden="true" />
            Out of service
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Row letters on both sides of a row.
 *
 * @param props - Grid row, row letter and the right-hand column number.
 * @returns Two label cells.
 */
function RowLabels({ gridRow, rowLabel, lastCol }: { gridRow: number; rowLabel: string; lastCol: number }) {
  return (
    <>
      <span className="row-label" style={{ gridColumn: 1, gridRow: gridRow + 1 }} aria-hidden="true">
        {rowLabel}
      </span>
      <span className="row-label" style={{ gridColumn: lastCol, gridRow: gridRow + 1 }} aria-hidden="true">
        {rowLabel}
      </span>
    </>
  );
}
