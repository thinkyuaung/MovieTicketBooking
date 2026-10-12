import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";

/**
 * Shared Prisma client for the movieTicket MySQL database.
 */
export const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
