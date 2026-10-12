import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { LoadState, Notice } from "../../components/common";
import { api, errorMessage, query } from "../../lib/api";
import { formatDateTime, fromInputValue, startOfDay, toInputValue } from "../../lib/dates";
import { formatMMK } from "../../lib/money";
import type { IAdminMovie, IAdminShowtime, IHallListItem } from "../../lib/types";
import { useApi } from "../../lib/useApi";

/**
 * Admin showtime list with filters and a form to schedule new showings.
 *
 * @returns The showtimes admin page.
 */
export function ShowtimesAdminPage() {
  const [movieId, setMovieId] = useState("");
  const [hallId, setHallId] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const movies = useApi<IAdminMovie[]>("/admin/movies");
  const halls = useApi<IHallListItem[]>("/admin/halls");
  const showtimes = useApi<IAdminShowtime[]>(
    `/admin/showtimes${query({ movieId, hallId, from: upcomingOnly ? startOfDay(0) : undefined })}`,
  );

  return (
    <section className="page">
      <div className="page-head">
        <h1>Showtimes</h1>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          Schedule showing
        </button>
      </div>
      <Notice tone="ok">{message}</Notice>

      {adding && movies.data && halls.data && (
        <ShowtimeForm
          movies={movies.data}
          halls={halls.data}
          onCancel={() => setAdding(false)}
          onSaved={async (s) => {
            setAdding(false);
            setMessage(`Scheduled "${s.movieTitle}" on ${formatDateTime(s.startsAt)} in ${s.hallName}.`);
            await showtimes.reload();
          }}
        />
      )}

      <div className="filters">
        <label className="field field-inline">
          <span>Movie</span>
          <select id="filter-movie" value={movieId} onChange={(e) => setMovieId(e.target.value)}>
            <option value="">All movies</option>
            {movies.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-inline">
          <span>Hall</span>
          <select id="filter-hall" value={hallId} onChange={(e) => setHallId(e.target.value)}>
            <option value="">All halls</option>
            {halls.data?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input id="filter-upcoming" type="checkbox" checked={upcomingOnly} onChange={(e) => setUpcomingOnly(e.target.checked)} />
          From today on
        </label>
      </div>

      <LoadState loading={showtimes.loading && !showtimes.data} error={showtimes.error} />
      {showtimes.data?.length === 0 && <p className="muted">No showings match these filters.</p>}
      {showtimes.data && showtimes.data.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Movie</th>
                <th>Hall</th>
                <th className="num">Seats sold</th>
                <th className="num">Standard / VIP / Couple</th>
                <th className="num">Revenue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {showtimes.data.map((s) => (
                <tr key={s.id} className={s.status === "cancelled" ? "is-cancelled" : ""}>
                  <td>
                    <Link to={`/admin/showtimes/${s.id}`}>{formatDateTime(s.startsAt)}</Link>
                  </td>
                  <td>{s.movieTitle}</td>
                  <td>{s.hallName}</td>
                  <td className="num">
                    {s.bookedSeats}/{s.totalSeats}
                  </td>
                  <td className="num small">
                    {[s.prices.standard, s.prices.vip, s.prices.couple].map((p) => (p === undefined ? "–" : p.toLocaleString("en-US"))).join(" / ")}
                  </td>
                  <td className="num">{formatMMK(s.revenue)}</td>
                  <td>
                    {s.status === "cancelled" ? (
                      <span className="pill pill-bad">Cancelled</span>
                    ) : s.hasFullHallBooking ? (
                      <span className="pill pill-accent">Whole hall</span>
                    ) : (
                      <span className="pill pill-ok">Scheduled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Prices form values (MMK, as strings while editing).
 */
export interface IPriceForm {
  priceStandard: string;
  priceVip: string;
  priceCouple: string;
  fullHallPrice: string;
}

/**
 * Converts price form values to numbers for the API.
 *
 * @param p - Form values.
 * @returns Prices in MMK; an empty full-hall price becomes null.
 */
export function pricesBody(p: IPriceForm) {
  return {
    priceStandard: Number(p.priceStandard),
    priceVip: Number(p.priceVip),
    priceCouple: Number(p.priceCouple),
    fullHallPrice: p.fullHallPrice.trim() === "" ? null : Number(p.fullHallPrice),
  };
}

/**
 * Price inputs shared by the schedule and edit forms.
 *
 * @param props - Values and change handler.
 * @returns Four MMK inputs.
 */
export function PriceFields({ value, onChange }: { value: IPriceForm; onChange: (v: IPriceForm) => void }) {
  const field = (key: keyof IPriceForm, label: string, required = true) => (
    <label className="field">
      <span>{label}</span>
      <span className="input-suffix">
        <input
          id={`price-${key}`}
          type="number"
          min={0}
          step={500}
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          required={required}
          placeholder={required ? undefined : "Sum of seats"}
        />
        <span>MMK</span>
      </span>
    </label>
  );
  return (
    <>
      {field("priceStandard", "Standard seat")}
      {field("priceVip", "VIP seat")}
      {field("priceCouple", "Couple seat (pair)")}
      {field("fullHallPrice", "Whole hall (optional)", false)}
    </>
  );
}

/**
 * Form to schedule a showing. Times are entered in Myanmar Time.
 *
 * @param props - Movies, halls and callbacks.
 * @returns The form.
 */
function ShowtimeForm({
  movies,
  halls,
  onCancel,
  onSaved,
}: {
  movies: IAdminMovie[];
  halls: IHallListItem[];
  onCancel: () => void;
  onSaved: (s: IAdminShowtime) => Promise<void>;
}) {
  const tomorrow7pm = toInputValue(new Date(new Date(startOfDay(1)).getTime() + 19 * 3600_000));
  const [movieId, setMovieId] = useState(String(movies[0]?.id ?? ""));
  const [hallId, setHallId] = useState(String(halls[0]?.id ?? ""));
  const [startsAt, setStartsAt] = useState(tomorrow7pm);
  const [prices, setPrices] = useState<IPriceForm>({ priceStandard: "8000", priceVip: "15000", priceCouple: "25000", fullHallPrice: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Schedules the showing.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<IAdminShowtime>("/admin/showtimes", {
        method: "POST",
        body: { movieId: Number(movieId), hallId: Number(hallId), startsAt: fromInputValue(startsAt), ...pricesBody(prices) },
      });
      await onSaved(created);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2 className="span-all">Schedule a showing</h2>
      <label className="field">
        <span>Movie</span>
        <select id="new-show-movie" value={movieId} onChange={(e) => setMovieId(e.target.value)} required>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} ({m.durationMinutes} min)
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Hall</span>
        <select id="new-show-hall" value={hallId} onChange={(e) => setHallId(e.target.value)} required>
          {halls.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.activeSeatCount} seats)
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Starts (Myanmar Time)</span>
        <input id="new-show-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
      </label>
      <PriceFields value={prices} onChange={setPrices} />
      <p className="muted small span-all">The end time is the film length plus 15 minutes of cleaning. Showings in the same hall can't overlap.</p>
      {error && (
        <div className="span-all">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="btn-row span-all">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Scheduling…" : "Schedule"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
