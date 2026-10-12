import { Link } from "react-router";

/**
 * Shown for unknown URLs.
 *
 * @returns The not found page.
 */
export function NotFoundPage() {
  return (
    <section className="page">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to movies</Link>
      </p>
    </section>
  );
}
