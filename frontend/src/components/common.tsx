import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../lib/auth";
import type { AgeRating } from "../lib/types";

/**
 * A message box for success, warnings and errors.
 *
 * @param props - Tone and content.
 * @returns The message, or nothing when there is no content.
 */
export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "error"; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/**
 * Shows loading or error text while a page's data loads.
 *
 * @param props - Loading flag and error message.
 * @returns The status line, or nothing.
 */
export function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) return <Notice tone="error">{error}</Notice>;
  if (loading) return <p className="muted">Loading…</p>;
  return null;
}

/**
 * Average review score, e.g. "★ 8.5".
 *
 * @param props - Score (or null) and number of reviews.
 * @returns The score badge.
 */
export function Score({ score, count }: { score: number | null; count?: number }) {
  if (score === null) return <span className="muted small">No reviews yet</span>;
  return (
    <span className="score" aria-label={`Average score ${score} out of 10`}>
      <span aria-hidden="true">★</span> {score.toFixed(1)}
      <span className="muted">/10{count !== undefined && ` · ${count} review${count === 1 ? "" : "s"}`}</span>
    </span>
  );
}

/**
 * Age rating badge, e.g. "PG-13".
 *
 * @param props - The rating.
 * @returns The badge.
 */
export function AgeBadge({ rating }: { rating: AgeRating }) {
  return <span className="badge">{rating === "PG13" ? "PG-13" : rating}</span>;
}

/**
 * Poster image, or a typographic stand-in when the movie has no poster.
 *
 * @param props - Title and optional poster URL.
 * @returns The poster.
 */
export function Poster({ title, url }: { title: string; url: string | null }) {
  if (url) return <img className="poster" src={url} alt="" />;
  // Pick a stable hue from the title so each movie keeps its colour.
  const hash = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7);
  const hue = Math.round(hash * 137.508) % 360; // golden angle spreads titles across the colour wheel
  return (
    <div className="poster poster-blank" style={{ "--poster-hue": hue } as React.CSSProperties} aria-hidden="true">
      <span>{title}</span>
    </div>
  );
}

/**
 * Renders children only for logged-in users; sends others to the login page.
 *
 * @param props - Children and whether admin role is required.
 * @returns The children, a redirect, or a message.
 */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && user.role !== "admin") {
    return (
      <section className="page">
        <h1>Admins only</h1>
        <p className="muted">This area is for cinema staff. Log in with an admin account to continue.</p>
      </section>
    );
  }
  return <>{children}</>;
}
