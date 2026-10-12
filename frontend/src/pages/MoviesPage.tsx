import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AgeBadge, LoadState, Poster, Score } from "../components/common";
import { query } from "../lib/api";
import { formatDateTime } from "../lib/dates";
import type { IMovieListItem } from "../lib/types";
import { useApi } from "../lib/useApi";

/**
 * Movie list with search and genre filter. Movies with the soonest showing come first.
 *
 * @returns The movies page.
 */
export function MoviesPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const genres = useApi<string[]>("/movies/genres");
  const movies = useApi<IMovieListItem[]>(`/movies${query({ q, genre })}`);

  // Wait until typing pauses before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <section className="page">
      <div className="page-head">
        <h1>Now showing</h1>
        <div className="filters">
          <label className="field field-inline">
            <span className="sr-only">Search movies</span>
            <input id="movie-search" type="search" placeholder="Search by title" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="field field-inline">
            <span className="sr-only">Genre</span>
            <select id="movie-genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">All genres</option>
              {genres.data?.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <LoadState loading={movies.loading && !movies.data} error={movies.error} />
      {movies.data?.length === 0 && <p className="muted">No movies match your search.</p>}

      <ul className="movie-grid">
        {movies.data?.map((m) => (
          <li key={m.id}>
            <Link to={`/movies/${m.id}`} className="movie-card">
              <Poster title={m.title} url={m.posterUrl} />
              <div className="movie-card-body">
                <h2>{m.title}</h2>
                <p className="meta">
                  <AgeBadge rating={m.ageRating} /> {m.durationMinutes} min · {m.genres.join(", ")}
                </p>
                <Score score={m.averageScore} count={m.reviewCount} />
                <p className="next">
                  {m.nextShowtime ? (
                    <>
                      Next show <strong>{formatDateTime(m.nextShowtime)}</strong>
                    </>
                  ) : (
                    <span className="muted">No upcoming shows</span>
                  )}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
