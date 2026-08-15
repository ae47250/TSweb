import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const password = process.argv[2] || "";
if (password.length < 12) {
  console.error("Provide a contractor password of at least 12 characters as the first argument.");
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const derived = await promisify(scryptCallback)(password, salt, 64);
  console.log(`scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`);
}
