try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment.
}

/**
 * Reads a required environment variable.
 *
 * @param name - The variable name.
 * @returns The variable's value.
 * @throws If the variable is not set.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.`);
  return value;
}

/**
 * Application settings loaded from the environment.
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  /**
   * Database URL. Under Vitest this is always TEST_DATABASE_URL, never the
   * development database, because integration tests delete all data.
   */
  get databaseUrl(): string {
    if (process.env.VITEST) {
      return process.env.TEST_DATABASE_URL ?? "mysql://not-configured@127.0.0.1:1/test_db_not_configured";
    }
    return required("DATABASE_URL");
  },
  get jwtSecret(): string {
    if (process.env.VITEST) return process.env.JWT_SECRET ?? "test-secret";
    return required("JWT_SECRET");
  },
  jwtExpiresIn: "7d" as const,
};
