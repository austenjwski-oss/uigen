import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";

const SECRET = new TextEncoder().encode("development-secret-key");

async function signToken(payload: object, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession

test("createSession sets an httpOnly cookie named auth-token", async () => {
  await createSession("user-1", "test@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, , options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession encodes userId and email in the token", async () => {
  await createSession("user-42", "user@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, SECRET);
  expect(payload.userId).toBe("user-42");
  expect(payload.email).toBe("user@example.com");
});

test("createSession sets a 7-day expiry on the cookie", async () => {
  const before = Date.now();
  await createSession("user-1", "test@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const expiresMs = options.expires.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays - 1000);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDays + 1000);
});

test("createSession uses HS256 algorithm", async () => {
  await createSession("user-1", "test@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  expect(header.alg).toBe("HS256");
});

test("createSession sets iat and exp claims in the token", async () => {
  const before = Math.floor(Date.now() / 1000);
  await createSession("user-1", "test@example.com");
  const after = Math.floor(Date.now() / 1000);

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, SECRET);
  expect(payload.iat).toBeGreaterThanOrEqual(before);
  expect(payload.iat).toBeLessThanOrEqual(after);
  expect(payload.exp).toBeGreaterThan(payload.iat!);
});

test("createSession includes expiresAt in the token payload", async () => {
  await createSession("user-1", "test@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, SECRET);
  expect(payload.expiresAt).toBeDefined();
});

test("createSession sets secure:false outside production", async () => {
  // NODE_ENV is "test" in vitest — no override needed
  await createSession("user-1", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.secure).toBe(false);
});

test("createSession sets secure:true in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await createSession("user-1", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.secure).toBe(true);
  vi.unstubAllEnvs();
});

// getSession

test("getSession returns null when no cookie is present", async () => {
  mockCookieStore.get.mockReturnValue(undefined);
  expect(await getSession()).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const token = await signToken({ userId: "user-1", email: "test@example.com", expiresAt: new Date() });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("test@example.com");
});

test("getSession returns null for a malformed token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.jwt" });
  expect(await getSession()).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await signToken(
    { userId: "user-1", email: "test@example.com", expiresAt: new Date() },
    "-1s"
  );
  mockCookieStore.get.mockReturnValue({ value: token });
  expect(await getSession()).toBeNull();
});

test("getSession returns null for a token signed with a different secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "u", email: "e" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(wrongSecret);
  mockCookieStore.get.mockReturnValue({ value: token });
  expect(await getSession()).toBeNull();
});

// deleteSession

test("deleteSession removes the auth-token cookie", async () => {
  await deleteSession();
  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

// verifySession

function makeRequest(token?: string) {
  return {
    cookies: { get: (name: string) => (token && name === "auth-token" ? { value: token } : undefined) },
  } as any;
}

test("verifySession returns null when no cookie in request", async () => {
  expect(await verifySession(makeRequest())).toBeNull();
});

test("verifySession returns the payload for a valid token", async () => {
  const token = await signToken({ userId: "user-99", email: "verify@example.com", expiresAt: new Date() });

  const session = await verifySession(makeRequest(token));
  expect(session?.userId).toBe("user-99");
  expect(session?.email).toBe("verify@example.com");
});

test("verifySession returns null for a malformed token", async () => {
  expect(await verifySession(makeRequest("bad-token"))).toBeNull();
});

test("verifySession returns null for an expired token", async () => {
  const token = await signToken(
    { userId: "user-1", email: "test@example.com", expiresAt: new Date() },
    "-1s"
  );
  expect(await verifySession(makeRequest(token))).toBeNull();
});
