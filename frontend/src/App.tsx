import { Link, NavLink, Route, Routes } from "react-router";
import { RequireAuth } from "./components/common";
import { useAuth } from "./lib/auth";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { HallDetailPage } from "./pages/admin/HallDetailPage";
import { HallsAdminPage } from "./pages/admin/HallsAdminPage";
import { MoviesAdminPage } from "./pages/admin/MoviesAdminPage";
import { ShowtimeDetailPage } from "./pages/admin/ShowtimeDetailPage";
import { ShowtimesAdminPage } from "./pages/admin/ShowtimesAdminPage";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { BookingDetailPage } from "./pages/BookingDetailPage";
import { MovieDetailPage } from "./pages/MovieDetailPage";
import { MoviesPage } from "./pages/MoviesPage";
import { MyBookingsPage } from "./pages/MyBookingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SeatPickerPage } from "./pages/SeatPickerPage";

/**
 * App shell: top navigation and page routes.
 *
 * @returns The app layout.
 */
export function App() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          movie<span>Ticket</span>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Movies
          </NavLink>
          {user && <NavLink to="/bookings">My bookings</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
          {user ? (
            <span className="user-menu">
              <span className="muted small">{user.name}</span>
              <button type="button" className="link-btn" onClick={logout}>
                Log out
              </button>
            </span>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<MoviesPage />} />
          <Route path="/movies/:id" element={<MovieDetailPage />} />
          <Route path="/showtimes/:id" element={<SeatPickerPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <MyBookingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings/:id"
            element={
              <RequireAuth>
                <BookingDetailPage />
              </RequireAuth>
            }
          />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="showtimes" element={<ShowtimesAdminPage />} />
            <Route path="showtimes/:id" element={<ShowtimeDetailPage />} />
            <Route path="movies" element={<MoviesAdminPage />} />
            <Route path="halls" element={<HallsAdminPage />} />
            <Route path="halls/:id" element={<HallDetailPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
