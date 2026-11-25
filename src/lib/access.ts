import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "jev_access";
export const ACCESS_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const TOKEN_VERSION = "v1";

function getEntryCode() {
  return process.env.ENTRY_CODE;
}

function getSessionSecret() {
  return process.env.ACCESS_SESSION_SECRET?.trim();
}

export function isAccessConfigured() {
  const entryCode = getEntryCode();
  const sessionSecret = getSessionSecret();
  return Boolean(entryCode && sessionSecret && sessionSecret.length >= 32);
}

export function matchesEntryCode(candidate: unknown) {
  const entryCode = getEntryCode();
  if (!entryCode || typeof candidate !== "string" || candidate.length > 256) return false;

  const expected = Buffer.from(entryCode, "utf8");
  const actual = Buffer.from(candidate, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(expiry: string) {
  const entryCode = getEntryCode();
  const sessionSecret = getSessionSecret();
  if (!entryCode || !sessionSecret || sessionSecret.length < 32) return null;

  return createHmac("sha256", sessionSecret)
    .update(`jev-access:${TOKEN_VERSION}:${entryCode}:${expiry}`)
    .digest("base64url");
}

export function createAccessToken(now = Date.now()) {
  const expiry = String(Math.floor(now / 1000) + ACCESS_SESSION_MAX_AGE);
  const signature = sign(expiry);
  if (!signature) throw new Error("Entry access is not configured.");
  return `${TOKEN_VERSION}.${expiry}.${signature}`;
}

export function isAccessTokenValid(token: string | undefined, now = Date.now()) {
  if (!token || !/^v1\.\d{10,12}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [, expiry, suppliedSignature] = token.split(".");
  const expiresAt = Number(expiry);
  const currentTime = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= currentTime) return false;

  const expectedSignature = sign(expiry);
  if (!expectedSignature) return false;
  const expected = Buffer.from(expectedSignature, "base64url");
  const actual = Buffer.from(suppliedSignature, "base64url");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
