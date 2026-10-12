import { useEffect, useState, type FormEvent } from "react";
import { Notice } from "../../components/common";
import { SEAT_TYPE_NAMES, SeatPlan } from "../../components/SeatPlan";
import { api, errorMessage } from "../../lib/api";
import type { IHallPreview, IHallRowSpec, SeatType } from "../../lib/types";

/**
 * One row in the editor, kept as text while typing.
 */
interface IRowDraft {
  rowLabel: string;
  type: SeatType;
  /** Seats per block, e.g. "6, 6" for six seats, an aisle, six seats. */
  blocks: string;
  /** Wheelchair seat numbers, e.g. "1, 12". */
  wheelchair: string;
  gapBefore: boolean;
}

/** A typical hall to start from: 4 standard rows, 2 VIP rows, 1 couple row. */
export const DEFAULT_ROWS: IRowDraft[] = [
  { rowLabel: "A", type: "standard", blocks: "6, 6", wheelchair: "1, 12", gapBefore: false },
  { rowLabel: "B", type: "standard", blocks: "6, 6", wheelchair: "", gapBefore: false },
  { rowLabel: "C", type: "standard", blocks: "6, 6", wheelchair: "", gapBefore: false },
  { rowLabel: "D", type: "standard", blocks: "6, 6", wheelchair: "", gapBefore: false },
  { rowLabel: "E", type: "vip", blocks: "6, 6", wheelchair: "", gapBefore: true },
  { rowLabel: "F", type: "vip", blocks: "6, 6", wheelchair: "", gapBefore: false },
  { rowLabel: "G", type: "couple", blocks: "3, 3", wheelchair: "", gapBefore: false },
];

/**
 * Parses "6, 6" into [6, 6]; blank or invalid parts are dropped.
 *
 * @param text - Comma-separated numbers.
 * @returns The numbers.
 */
function numbers(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Converts editor rows to the API's row description.
 *
 * @param rows - Editor rows.
 * @returns Row specs.
 */
function toSpecs(rows: IRowDraft[]): IHallRowSpec[] {
  return rows.map((r) => ({
    rowLabel: r.rowLabel.trim().toUpperCase(),
    type: r.type,
    blocks: numbers(r.blocks),
    ...(r.type !== "couple" && numbers(r.wheelchair).length > 0 && { wheelchairSeats: numbers(r.wheelchair) }),
    ...(r.gapBefore && { gapBefore: true }),
  }));
}

/**
 * Returns the next row letter after the last row (A → B, Z → AA).
 *
 * @param rows - Current rows.
 * @returns The next label.
 */
function nextLabel(rows: IRowDraft[]): string {
  const last = rows.at(-1)?.rowLabel.trim().toUpperCase() ?? "";
  if (!last) return "A";
  if (last.length === 1 && last < "Z") return String.fromCharCode(last.charCodeAt(0) + 1);
  return "A" + String.fromCharCode(65 + (rows.length % 26));
}

/**
 * Row-by-row hall layout editor with a live seat-plan preview from the server.
 *
 * @param props - Optional hall name field, submit label and save callback.
 * @returns The editor form.
 */
export function HallLayoutEditor({
  withName,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  withName: boolean;
  submitLabel: string;
  onSubmit: (name: string, rows: IHallRowSpec[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<IRowDraft[]>(DEFAULT_ROWS);
  const [preview, setPreview] = useState<IHallPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Refresh the preview shortly after the admin stops typing.
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setPreview(await api<IHallPreview>("/admin/halls/preview", { method: "POST", body: { rows: toSpecs(rows) } }));
        setPreviewError(null);
      } catch (err) {
        setPreviewError(errorMessage(err));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [rows]);

  /**
   * Changes one field of one row.
   *
   * @param index - Row index.
   * @param patch - Fields to change.
   */
  function update(index: number, patch: Partial<IRowDraft>): void {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  /**
   * Saves the hall.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name, toSpecs(rows));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card hall-editor" onSubmit={submit}>
      {withName && (
        <label className="field">
          <span>Hall name</span>
          <input id="hall-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Hall 3" />
        </label>
      )}
      <p className="muted small">
        Rows run from the screen backwards. <strong>Blocks</strong> are seats between aisles: "6, 6" means 6 seats, an aisle, 6 seats. Seat numbers skip the
        aisles.
      </p>
      <div className="table-wrap">
        <table className="table rows-table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Seat type</th>
              <th>Blocks</th>
              <th>Wheelchair seats</th>
              <th>Aisle before</th>
              <th>
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    id={`row-label-${i}`}
                    className="input-xs"
                    value={r.rowLabel}
                    maxLength={2}
                    aria-label={`Row ${i + 1} letter`}
                    onChange={(e) => update(i, { rowLabel: e.target.value.toUpperCase() })}
                  />
                </td>
                <td>
                  <select id={`row-type-${i}`} value={r.type} aria-label={`Row ${r.rowLabel} seat type`} onChange={(e) => update(i, { type: e.target.value as SeatType })}>
                    {(["standard", "vip", "couple"] as SeatType[]).map((t) => (
                      <option key={t} value={t}>
                        {SEAT_TYPE_NAMES[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input id={`row-blocks-${i}`} className="input-sm" value={r.blocks} aria-label={`Row ${r.rowLabel} blocks`} onChange={(e) => update(i, { blocks: e.target.value })} />
                </td>
                <td>
                  <input
                    id={`row-wheel-${i}`}
                    className="input-sm"
                    value={r.wheelchair}
                    disabled={r.type === "couple"}
                    placeholder={r.type === "couple" ? "–" : "e.g. 1, 12"}
                    aria-label={`Row ${r.rowLabel} wheelchair seats`}
                    onChange={(e) => update(i, { wheelchair: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    id={`row-gap-${i}`}
                    type="checkbox"
                    checked={r.gapBefore}
                    disabled={i === 0}
                    aria-label={`Cross aisle before row ${r.rowLabel}`}
                    onChange={(e) => update(i, { gapBefore: e.target.checked })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="link-btn"
                    disabled={rows.length === 1}
                    aria-label={`Remove row ${r.rowLabel}`}
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setRows((rs) => [...rs, { rowLabel: nextLabel(rs), type: "standard", blocks: rs.at(-1)?.blocks ?? "6, 6", wheelchair: "", gapBefore: false }])}
        >
          Add row
        </button>
      </div>

      <h3>Preview {preview && <span className="muted small">· {preview.seatCount} seats</span>}</h3>
      {previewError ? (
        <Notice tone="error">{previewError}</Notice>
      ) : (
        preview && (
          <SeatPlan
            label="Hall layout preview"
            layoutRows={preview.layoutRows}
            layoutCols={preview.layoutCols}
            seats={preview.seats.map((s) => ({ ...s, status: "available" as const }))}
          />
        )
      )}

      <Notice tone="error">{error}</Notice>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={busy || !!previewError}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
