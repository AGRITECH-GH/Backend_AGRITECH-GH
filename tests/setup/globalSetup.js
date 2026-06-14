import { execSync } from "child_process";
import { config } from "dotenv";
import path from "path";

export async function setup() {
  config({ path: path.resolve(process.cwd(), ".env.test") });
  execSync("npx prisma migrate deploy", {
    env: process.env,
    stdio: "inherit",
  });
}
