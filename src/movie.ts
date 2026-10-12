/**
 * Represents a movie.
 */
export interface IMovie {
  id: string;
  title: string;
  director: string;
  releaseYear: number;
  genres: string[];
  durationMinutes: number;
  rating?: number;
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
    `Rating:   ${movie.rating !== undefined ? `${movie.rating}/10` : "N/A"}`,
  ];
  const output = lines.join("\n");
  console.log(output);
  return output;
}
