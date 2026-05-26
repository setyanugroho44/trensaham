// Short referral code helpers. Encodes a 36-char UUID into a 22-char
// base64url string, and persists the captured referrer in a cookie (7 days)
// in addition to localStorage so cross-tab / longer-lived flows still work.

const COOKIE_NAME = "pending_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeRef(uuid: string): string {
  if (!UUID_RE.test(uuid)) return uuid;
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRef(code: string): string | null {
  if (!code) return null;
  if (UUID_RE.test(code)) return code.toLowerCase();
  try {
    const pad = code.length % 4 === 0 ? "" : "=".repeat(4 - (code.length % 4));
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    if (bin.length !== 16) return null;
    const hex = Array.from(bin)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

export function setPendingRef(uuid: string) {
  if (typeof document === "undefined") return;
  try {
    localStorage.setItem(COOKIE_NAME, uuid);
  } catch {
    // ignore
  }
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(uuid)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function getPendingRef(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const ls = localStorage.getItem(COOKIE_NAME);
    if (ls && UUID_RE.test(ls)) return ls;
  } catch {
    // ignore
  }
  const m = document.cookie.match(/(?:^|;\s*)pending_ref=([^;]+)/);
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return UUID_RE.test(v) ? v : null;
}

export function clearPendingRef() {
  if (typeof document === "undefined") return;
  try {
    localStorage.removeItem(COOKIE_NAME);
  } catch {
    // ignore
  }
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/** Capture ?r= (short) or ?ref= (legacy UUID) from current URL and persist it. */
export function captureRefFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("r") ?? params.get("ref");
  if (!raw) return;
  const uuid = decodeRef(raw);
  if (uuid) setPendingRef(uuid);
}
