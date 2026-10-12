/**
 * Represents a movie.
 */
export interface IMovie {
  id: number;
  title: string;
  director: string;
  releaseYear: number;
  genres: string[];
  durationMinutes: number;
  /** G, PG, PG13 or R. */
  ageRating: string;
  description: string | null;
  posterUrl: string | null;
}

/**
 * Formats a movie's details as a multi-line string and logs it to the console.
 *
 * @param movie - The movie to display.
 * @returns The formatted movie details.
 */
export function showMovie(movie: IMovie): string {
  const lines = [
    `Title:    ${movie.title}`,
    `Director: ${movie.director}`,
    `Year:     ${movie.releaseYear}`,
    `Genres:   ${movie.genres.join(", ")}`,
    `Duration: ${movie.durationMinutes} min`,
    `Rated:    ${movie.ageRating}`,
  ];
  const output = lines.join("\n");
  console.log(output);
  return output;
}
