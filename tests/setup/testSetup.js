import { PrismaClient } from "../../prisma/prisma-client-js/index.js";
import { config } from "dotenv";
import path from "path";
import { afterAll, beforeAll } from "vitest";

config({ path: path.resolve(process.cwd(), ".env.test") });

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
