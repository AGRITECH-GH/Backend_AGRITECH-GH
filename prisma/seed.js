import { PrismaClient } from "../prisma/prisma-client-js/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("Admin1234", 12);

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
      fullName: "Stanley Boateng",
      email: "stankofb@gmail.com",
      passwordHash: hashedPassword,
      role: "ADMIN",
      isVerified: true,
      isActive: true,
    },
  });

  const admin3 = await prisma.user.upsert({
    where: { email: "e.animwaa.kumah@gmail.com" },
    update: {},
    create: {
      fullName: "FarmBridge Admin 3",
      email: "e.animwaa.kumah@gmail.com",
      passwordHash: hashedPassword,
      role: "ADMIN",
      isVerified: true,
      isActive: true,
    },
  });

  console.log("Admin 1 created:", admin1.email);
  console.log("Admin 2 created:", admin2.email);
  console.log("Admin 2 created:", admin3.email);
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
