import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { LoadState, Notice } from "../../components/common";
import { SEAT_TYPE_NAMES, SeatPlan } from "../../components/SeatPlan";
import { api, errorMessage } from "../../lib/api";
import type { IHallDetail, IHallSeat, IPlanSeat, SeatType } from "../../lib/types";
import { useApi } from "../../lib/useApi";
import { HallLayoutEditor } from "./HallLayoutEditor";

/**
 * One hall for admins: click a seat to switch it off or change its type,
 * rename the hall, replace its layout (only before it has showings), or delete it.
 *
 * @returns The hall detail page.
 */
export function HallDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const hall = useApi<IHallDetail>(`/admin/halls/${id}`);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!hall.data) return <LoadState loading={hall.loading} error={hall.error} />;
  const h = hall.data;
  const seat = h.seats.find((s) => s.id === selectedId) ?? null;
  const planSeats: IPlanSeat[] = h.seats.map((s) => ({ ...s, status: s.isActive ? "available" : "unavailable" }));

  /**
   * Runs an admin action and shows the result.
   *
   * @param action - The API call.
   * @param success - Message on success.
   */
  async function run(action: () => Promise<unknown>, success: string): Promise<void> {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "ok", text: success });
      await hall.reload();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    }
  }

  return (
    <section className="page">
      <p>
        <Link to="/admin/halls" className="back">
          ← Halls
        </Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{h.name}</h1>
          <p className="meta">
            {h.activeSeatCount} of {h.seatCount} seats in service · {h.showtimeCount} showings
          </p>
        </div>
        <RenameHall hall={h} onRename={(name) => run(() => api(`/admin/halls/${h.id}`, { method: "PATCH", body: { name } }), `Renamed to "${name}".`)} />
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {replacing ? (
        <HallLayoutEditor
          withName={false}
          submitLabel="Replace layout"
          onCancel={() => setReplacing(false)}
          onSubmit={async (_name, rows) => {
            await api(`/admin/halls/${h.id}/layout`, { method: "PUT", body: { rows } });
            setReplacing(false);
            setMessage({ tone: "ok", text: "Layout replaced." });
            await hall.reload();
          }}
        />
      ) : (
        <div className="admin-show">
          <div className="card">
            <h2>Seats</h2>
            <p className="muted small">Click a seat to switch it off (for example if it's broken) or change its type.</p>
            <SeatPlan
              label={`Seats in ${h.name}`}
              layoutRows={h.layoutRows}
              layoutCols={h.layoutCols}
              seats={planSeats}
              selected={new Set(seat ? [seat.label] : [])}
              clickable="any"
              onSeatClick={(s) => setSelectedId(s.id ?? null)}
            />
          </div>
          <div className="stack">
            {seat ? (
              <SeatEditor
                key={seat.id}
                seat={seat}
                onSave={(patch) => run(() => api(`/admin/halls/${h.id}/seats/${seat.id}`, { method: "PATCH", body: patch }), `Seat ${seat.label} updated.`)}
              />
            ) : (
              <div className="card">
                <p className="muted">Select a seat on the plan to edit it.</p>
              </div>
            )}
            <div className="card stack">
              <h2>Layout</h2>
              {h.showtimeCount > 0 ? (
                <p className="muted small">This hall has showings, so its layout can't be replaced. Switch single seats off instead.</p>
              ) : (
                <button type="button" className="btn" onClick={() => setReplacing(true)}>
                  Replace layout…
                </button>
              )}
              {h.showtimeCount === 0 &&
                (confirmDelete ? (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() =>
                        void api(`/admin/halls/${h.id}`, { method: "DELETE" })
                          .then(() => navigate("/admin/halls"))
                          .catch((err) => setMessage({ tone: "error", text: errorMessage(err) }))
                      }
                    >
                      Delete {h.name}
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>
                    Delete hall…
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Inline hall rename form.
 *
 * @param props - The hall and a rename callback.
 * @returns The form.
 */
function RenameHall({ hall, onRename }: { hall: IHallDetail; onRename: (name: string) => Promise<void> }) {
  const [name, setName] = useState(hall.name);

  /**
   * Renames the hall.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await onRename(name);
  }

  return (
    <form className="filters" onSubmit={submit}>
      <label className="field field-inline">
        <span className="sr-only">Hall name</span>
        <input id="rename-hall" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <button className="btn btn-small" disabled={!name.trim() || name.trim() === hall.name}>
        Rename
      </button>
    </form>
  );
}

/**
 * Edits one seat: in service or not, and its type (not to or from couple).
 *
 * @param props - The seat and a save callback.
 * @returns The seat editor card.
 */
function SeatEditor({ seat, onSave }: { seat: IHallSeat; onSave: (patch: { isActive?: boolean; type?: SeatType }) => Promise<void> }) {
  const [type, setType] = useState<SeatType>(seat.type);
  const types: SeatType[] = seat.type === "couple" ? ["couple"] : ["standard", "vip", "wheelchair"];

  return (
    <div className="card stack">
      <h2>Seat {seat.label}</h2>
      <p className="meta">
        {SEAT_TYPE_NAMES[seat.type]} · {seat.isActive ? <span className="pill pill-ok">In service</span> : <span className="pill pill-bad">Switched off</span>}
      </p>
      <button type="button" className="btn" onClick={() => void onSave({ isActive: !seat.isActive })}>
        {seat.isActive ? "Switch seat off" : "Put seat back in service"}
      </button>
      {seat.type !== "couple" && (
        <div className="form-row">
          <label className="field grow">
            <span>Seat type</span>
            <select id="seat-type" value={type} onChange={(e) => setType(e.target.value as SeatType)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {SEAT_TYPE_NAMES[t]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" disabled={type === seat.type} onClick={() => void onSave({ type })}>
            Change type
          </button>
        </div>
      )}
      {seat.type === "couple" && <p className="muted small">Couple seats take two places, so their type can't be changed here.</p>}
    </div>
  );
}
