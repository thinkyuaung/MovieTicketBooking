import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";

/**
 * State returned by {@link useApi}.
 */
export interface IApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Fetch again (e.g. after a change). Keeps the old data on screen while loading. */
  reload: () => Promise<void>;
}

/**
 * Loads JSON from the API and reloads when the path changes.
 *
 * @param path - Path under `/api`, or null to skip loading.
 * @returns The data, error, loading flag and a reload function.
 */
export function useApi<T>(path: string | null): IApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (path === null) return;
      setLoading(true);
      try {
        const result = await api<T>(path, { signal });
        setData(result);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(errorMessage(err));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => load(), [load]);
  return { data, error, loading, reload };
}
