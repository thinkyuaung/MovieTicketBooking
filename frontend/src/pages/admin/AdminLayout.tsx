import { NavLink, Outlet } from "react-router";
import { RequireAuth } from "../../components/common";

/**
 * Admin area shell: section navigation above the admin pages. Admins only.
 *
 * @returns The admin layout.
 */
export function AdminLayout() {
  return (
    <RequireAuth admin>
      <div className="admin">
        <nav className="admin-nav" aria-label="Admin sections">
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          <NavLink to="/admin/showtimes">Showtimes</NavLink>
          <NavLink to="/admin/movies">Movies</NavLink>
          <NavLink to="/admin/halls">Halls</NavLink>
        </nav>
        <Outlet />
      </div>
    </RequireAuth>
  );
}
