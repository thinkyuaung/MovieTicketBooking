import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const server = createApp().listen(config.port, () => {
  console.log(`movieTicket API running at http://localhost:${config.port}`);
});

/**
 * Stops accepting requests and closes the database connection.
 *
 * @param signal - The process signal that triggered the shutdown.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
