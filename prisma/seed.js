import { PrismaClient } from "../prisma/prisma-client-js/index.js";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  // OWASP A05 – Security Misconfiguration:
  // Never hardcode credentials in source code. Read the admin password from
  // an environment variable so it is never committed to version control.
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!adminPassword || adminPassword.trim().length < 8) {
    console.error(
      "\n[SEED ERROR] ADMIN_SEED_PASSWORD is not set or is too short (min 8 chars).\n" +
      "Add it to your .env file and re-run: npm run seed\n"
    );
    process.exit(1);
  }

  // Enforce a basic strength check so the seed can't be run with a trivial password
  if (!/\d/.test(adminPassword) || !/[A-Za-z]/.test(adminPassword)) {
    console.error(
      "\n[SEED ERROR] ADMIN_SEED_PASSWORD must contain at least one letter and one number.\n"
    );
    process.exit(1);
  }

  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash(adminPassword.trim(), 12);

  const admin1 = await prisma.user.upsert({
    where: { email: "admin@agritechgh.me" },
    update: {},
    create: {
      fullName: "AgriTech Admin",
      email: "admin@agritechgh.me",
      passwordHash: hashedPassword,
      role: "ADMIN",
      isVerified: true,
      isActive: true,
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: "stankofb@gmail.com" },
    update: {},
    create: {
      fullName: "Stanley",
      email: "stankofb@gmail.com",
      passwordHash: hashedPassword,
      role: "ADMIN",
      isVerified: true,
      isActive: true,
    },
  });

  console.log("Admin 1 seeded:", admin1.email);
  console.log("Admin 2 seeded:", admin2.email);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
