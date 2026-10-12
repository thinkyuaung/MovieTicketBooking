import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Notice } from "../components/common";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

/**
 * Returns where to go after logging in: the `next` parameter if it is a local path.
 *
 * @param next - The `next` query value.
 * @param isAdmin - Whether the user is an admin (defaults them to the dashboard).
 * @returns A local path.
 */
function afterLogin(next: string | null, isAdmin: boolean): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return isAdmin ? "/admin" : "/";
}

/**
 * Login form.
 *
 * @returns The login page.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Logs in and goes to the next page.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      navigate(afterLogin(params.get("next"), user.role === "admin"), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <section className="page narrow">
      <form className="card auth-form" onSubmit={submit}>
        <h1>Log in</h1>
        <label className="field">
          <span>Email</span>
          <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <Notice tone="error">{error}</Notice>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        <p className="muted small">
          New here? <Link to={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>Create an account</Link>
        </p>
      </form>
    </section>
  );
}

/**
 * Registration form.
 *
 * @returns The register page.
 */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Creates the account and goes to the next page.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, phone: form.phone || undefined });
      navigate(afterLogin(params.get("next"), false), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  /**
   * Updates one form field.
   *
   * @param key - Field name.
   * @param value - New value.
   */
  function set(key: keyof typeof form, value: string): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <section className="page narrow">
      <form className="card auth-form" onSubmit={submit}>
        <h1>Create an account</h1>
        <label className="field">
          <span>Name</span>
          <input id="reg-name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input id="reg-phone" type="tel" autoComplete="tel" placeholder="09 …" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
          />
          <span className="muted small">At least 8 characters.</span>
        </label>
        <Notice tone="error">{error}</Notice>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="muted small">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  );
}
