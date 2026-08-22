import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}

export function randomToken() {
  return randomBytes(32).toString("hex");
}

export function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
