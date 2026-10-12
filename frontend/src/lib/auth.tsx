import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken } from "./api";
import type { IAuthResult, IUser } from "./types";

/**
 * What the auth context provides.
 */
interface IAuthContext {
  user: IUser | null;
  /** False until the saved login has been checked. */
  ready: boolean;
  login: (email: string, password: string) => Promise<IUser>;
  register: (input: { name: string; email: string; password: string; phone?: string }) => Promise<IUser>;
  logout: () => void;
}

const AuthContext = createContext<IAuthContext | null>(null);

/**
 * Holds the logged-in user for the whole app and restores a saved login on load.
 *
 * @param props - Children to render.
 * @returns The provider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<IUser>("/auth/me")
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) setToken(null);
      })
      .finally(() => setReady(true));
  }, []);

  /**
   * Saves a login result and returns the user.
   *
   * @param result - Token and user from the API.
   * @returns The user.
   */
  const accept = useCallback((result: IAuthResult) => {
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const value = useMemo<IAuthContext>(
    () => ({
      user,
      ready,
      login: async (email, password) => accept(await api<IAuthResult>("/auth/login", { method: "POST", body: { email, password } })),
      register: async (input) => accept(await api<IAuthResult>("/auth/register", { method: "POST", body: input })),
      logout: () => {
        setToken(null);
        setUser(null);
      },
    }),
    [user, ready, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the auth context.
 *
 * @returns Current user and login/logout functions.
 * @throws If used outside {@link AuthProvider}.
 */
export function useAuth(): IAuthContext {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
