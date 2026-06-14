import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "world_picks_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Session secret is not configured");
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function normalizeUsername(username) {
  return String(username || "").trim().toLocaleLowerCase("ar");
}

export function validateCredentials(username, password) {
  const cleanUsername = String(username || "").trim();
  if (cleanUsername.length < 2 || cleanUsername.length > 30) {
    return "اسم المستخدم يجب أن يكون بين حرفين و30 حرفاً.";
  }
  if (!/^[\p{L}\p{N}_. -]+$/u.test(cleanUsername)) {
    return "اسم المستخدم يحتوي على رموز غير مسموحة.";
  }
  if (String(password || "").length < 4 || String(password || "").length > 72) {
    return "كلمة المرور يجب أن تكون بين 4 و72 حرفاً.";
  }
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(String(password), salt, 64);
  return `${salt.toString("base64url")}.${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, storedHash) {
  const [saltValue, hashValue] = String(storedHash).split(".");
  if (!saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  const actual = Buffer.from(await scrypt(String(password), salt, expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(user) {
  const payload = encode(JSON.stringify({
    id: String(user.id),
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  }));
  return `${payload}.${sign(payload)}`;
}

export function readSession(request) {
  const cookies = String(request.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const cookie = cookies.find((item) => item.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;

  const token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSessionCookie(response, user) {
  const token = createSessionToken(user);
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`
  );
}

export function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );
}

export function requireSession(request, response, role = null) {
  const session = readSession(request);
  if (!session) {
    response.status(401).json({ error: "يجب تسجيل الدخول أولاً." });
    return null;
  }
  if (role && session.role !== role) {
    response.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء." });
    return null;
  }
  return session;
}

export function allowMethod(request, response, methods) {
  if (!methods.includes(request.method)) {
    response.setHeader("Allow", methods.join(", "));
    response.status(405).json({ error: "طريقة الطلب غير مسموحة." });
    return false;
  }
  return true;
}
