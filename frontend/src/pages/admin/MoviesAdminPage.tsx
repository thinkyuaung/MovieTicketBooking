import { useState, type FormEvent } from "react";
import { AgeBadge, LoadState, Notice } from "../../components/common";
import { api, errorMessage } from "../../lib/api";
import type { AgeRating, IAdminMovie } from "../../lib/types";
import { useApi } from "../../lib/useApi";

/**
 * Movie form fields, kept as strings while editing.
 */
interface IMovieForm {
  title: string;
  director: string;
  releaseYear: string;
  durationMin: string;
  ageRating: AgeRating;
  genres: string;
  description: string;
  posterUrl: string;
}

const EMPTY: IMovieForm = { title: "", director: "", releaseYear: "", durationMin: "", ageRating: "PG", genres: "", description: "", posterUrl: "" };

/**
 * Admin movie list with add, edit and delete.
 *
 * @returns The movies admin page.
 */
export function MoviesAdminPage() {
  const movies = useApi<IAdminMovie[]>("/admin/movies");
  const [editing, setEditing] = useState<IAdminMovie | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  /**
   * Deletes a movie.
   *
   * @param movie - The movie.
   */
  async function remove(movie: IAdminMovie): Promise<void> {
    try {
      await api(`/admin/movies/${movie.id}`, { method: "DELETE" });
      setMessage({ tone: "ok", text: `Deleted "${movie.title}".` });
      await movies.reload();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>Movies</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          Add movie
        </button>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {editing && (
        <MovieForm
          movie={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async (title) => {
            setEditing(null);
            setMessage({ tone: "ok", text: `Saved "${title}".` });
            await movies.reload();
          }}
        />
      )}

      <LoadState loading={movies.loading && !movies.data} error={movies.error} />
      {movies.data && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Rating</th>
                <th className="num">Length</th>
                <th>Genres</th>
                <th className="num">Showings</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {movies.data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.title}</strong>
                    <div className="muted small">
                      {m.director} · {m.releaseYear}
                    </div>
                  </td>
                  <td>
                    <AgeBadge rating={m.ageRating} />
                  </td>
                  <td className="num">{m.durationMinutes} min</td>
                  <td>{m.genres.join(", ")}</td>
                  <td className="num">{m.showtimeCount}</td>
                  <td className="actions">
                    {confirmDelete === m.id ? (
                      <>
                        <button type="button" className="btn btn-danger btn-small" onClick={() => void remove(m)}>
                          Delete
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-small" onClick={() => setEditing(m)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => setConfirmDelete(m.id)}
                          disabled={m.showtimeCount > 0}
                          title={m.showtimeCount > 0 ? "Movies with showings can't be deleted" : undefined}
                        >
                          Delete…
                        </button>
                      </>
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
 * Add/edit form for a movie.
 *
 * @param props - The movie to edit (null to add), and callbacks.
 * @returns The form.
 */
function MovieForm({ movie, onCancel, onSaved }: { movie: IAdminMovie | null; onCancel: () => void; onSaved: (title: string) => Promise<void> }) {
  const [form, setForm] = useState<IMovieForm>(
    movie
      ? {
          title: movie.title,
          director: movie.director,
          releaseYear: String(movie.releaseYear),
          durationMin: String(movie.durationMinutes),
          ageRating: movie.ageRating,
          genres: movie.genres.join(", "),
          description: movie.description ?? "",
          posterUrl: movie.posterUrl ?? "",
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Updates one field.
   *
   * @param key - Field name.
   * @param value - New value.
   */
  function set<K extends keyof IMovieForm>(key: K, value: IMovieForm[K]): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /**
   * Saves the movie.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title: form.title,
      director: form.director,
      releaseYear: Number(form.releaseYear),
      durationMin: Number(form.durationMin),
      ageRating: form.ageRating,
      genres: form.genres.split(",").map((g) => g.trim()).filter(Boolean),
      description: form.description.trim() || null,
      posterUrl: form.posterUrl.trim() || null,
    };
    try {
      await api(movie ? `/admin/movies/${movie.id}` : "/admin/movies", { method: movie ? "PATCH" : "POST", body });
      await onSaved(form.title);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2 className="span-all">{movie ? `Edit "${movie.title}"` : "Add a movie"}</h2>
      <label className="field">
        <span>Title</span>
        <input id="movie-title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
      </label>
      <label className="field">
        <span>Director</span>
        <input id="movie-director" value={form.director} onChange={(e) => set("director", e.target.value)} required />
      </label>
      <label className="field">
        <span>Release year</span>
        <input id="movie-year" type="number" min={1888} max={2100} value={form.releaseYear} onChange={(e) => set("releaseYear", e.target.value)} required />
      </label>
      <label className="field">
        <span>Length (minutes)</span>
        <input id="movie-duration" type="number" min={1} max={600} value={form.durationMin} onChange={(e) => set("durationMin", e.target.value)} required />
      </label>
      <label className="field">
        <span>Age rating</span>
        <select id="movie-rating" value={form.ageRating} onChange={(e) => set("ageRating", e.target.value as AgeRating)}>
          <option value="G">G</option>
          <option value="PG">PG</option>
          <option value="PG13">PG-13</option>
          <option value="R">R</option>
        </select>
      </label>
      <label className="field">
        <span>Genres</span>
        <input id="movie-genres" placeholder="Drama, Thriller" value={form.genres} onChange={(e) => set("genres", e.target.value)} />
      </label>
      <label className="field span-all">
        <span>Poster URL (optional)</span>
        <input id="movie-poster" type="url" value={form.posterUrl} onChange={(e) => set("posterUrl", e.target.value)} />
      </label>
      <label className="field span-all">
        <span>Description (optional)</span>
        <textarea id="movie-description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      {error && (
        <div className="span-all">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="btn-row span-all">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save movie"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
