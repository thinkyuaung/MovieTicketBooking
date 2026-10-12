import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { AgeBadge, LoadState, Notice, Poster, Score } from "../components/common";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dayKey, formatDay, formatTime } from "../lib/dates";
import { formatMMK } from "../lib/money";
import type { IMovieView, IReview, IUserShowtime } from "../lib/types";
import { useApi } from "../lib/useApi";

/**
 * A movie's page: details, showtimes grouped by day, and reviews.
 *
 * @returns The movie detail page.
 */
export function MovieDetailPage() {
  const { id } = useParams();
  const view = useApi<IMovieView>(`/movies/${id}`);
  const [day, setDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const groups = new Map<string, IUserShowtime[]>();
    for (const s of view.data?.showtimes ?? []) {
      const key = dayKey(s.startsAt);
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups];
  }, [view.data]);

  if (!view.data) return <LoadState loading={view.loading} error={view.error} />;
  const { movie, reviews } = view.data;
  const activeDay = days.find(([key]) => key === day) ?? days[0];

  return (
    <section className="page">
      <p>
        <Link to="/" className="back">
          ← All movies
        </Link>
      </p>
      <div className="movie-hero">
        <Poster title={movie.title} url={movie.posterUrl} />
        <div className="stack">
          <h1>{movie.title}</h1>
          <p className="meta">
            <AgeBadge rating={movie.ageRating} /> {movie.releaseYear} · {movie.durationMinutes} min · {movie.genres.join(", ")}
          </p>
          <p className="muted">Directed by {movie.director}</p>
          <Score score={view.data.averageScore} count={view.data.reviewCount} />
          {movie.description && <p className="lede">{movie.description}</p>}
        </div>
      </div>

      <h2>Showtimes</h2>
      {days.length === 0 ? (
        <p className="muted">No upcoming shows for this movie.</p>
      ) : (
        <>
          <div className="day-tabs" role="tablist" aria-label="Choose a day">
            {days.map(([key, shows]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeDay[0] === key}
                className={`day-tab${activeDay[0] === key ? " is-active" : ""}`}
                onClick={() => setDay(key)}
              >
                {formatDay(shows[0].startsAt)}
              </button>
            ))}
          </div>
          <ul className="show-grid">
            {activeDay[1].map((s) => (
              <li key={s.showtimeId}>
                <Link to={`/showtimes/${s.showtimeId}`} className={`show-card${s.soldOut ? " is-soldout" : ""}`}>
                  <span className="show-time">{formatTime(s.startsAt)}</span>
                  <span>{s.hallName}</span>
                  <span className="muted small">
                    {s.soldOut ? "Sold out" : `${s.availableSeats} of ${s.totalSeats} seats free`}
                  </span>
                  {s.priceFrom !== null && <span className="small">from {formatMMK(s.priceFrom)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Reviews</h2>
      <ReviewForm movieId={movie.id} alreadyReviewed={reviews} onAdded={view.reload} />
      {reviews.length === 0 ? (
        <p className="muted">No reviews yet. Be the first to write one.</p>
      ) : (
        <ul className="reviews">
          {reviews.map((r) => (
            <li key={r.id} className="review">
              <div className="review-head">
                <strong>{r.userName}</strong>
                <span className="score">★ {r.score}/10</span>
                <span className="muted small">{formatDay(r.createdAt)}</span>
              </div>
              <p>{r.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Form for writing a review. Shows a login link to guests and hides itself
 * once the user has reviewed this movie.
 *
 * @param props - Movie id, existing reviews and a callback after posting.
 * @returns The form, a login prompt, or nothing.
 */
function ReviewForm({ movieId, alreadyReviewed, onAdded }: { movieId: number; alreadyReviewed: IReview[]; onAdded: () => Promise<void> }) {
  const { user } = useAuth();
  const [score, setScore] = useState(8);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <p className="muted">
        <Link to={`/login?next=/movies/${movieId}`}>Log in</Link> to write a review.
      </p>
    );
  }
  if (alreadyReviewed.some((r) => r.userId === user.id)) return null;

  /**
   * Posts the review.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/movies/${movieId}/reviews`, { method: "POST", body: { score, comment } });
      setComment("");
      await onAdded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card review-form" onSubmit={submit}>
      <div className="form-row">
        <label className="field">
          <span>Your score</span>
          <select id="review-score" value={score} onChange={(e) => setScore(Number(e.target.value))}>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} / 10
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          <span>Comment</span>
          <input id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} required placeholder="What did you think?" />
        </label>
      </div>
      <Notice tone="error">{error}</Notice>
      <button className="btn btn-primary" disabled={busy || !comment.trim()}>
        {busy ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
