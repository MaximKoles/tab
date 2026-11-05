// Офлайн-проверка лицензионного ключа Pro.
// Ключ = первые 12 hex-символов HMAC-SHA256(секрет, имя покупателя), сгруппированные по 4.
// Защита условная (секрет лежит в бандле) — для аудитории 990 ₽ этого достаточно.
// Генерация ключей: scripts/gen-key.mjs (см. DEPLOY.md).

const SECRET = "GONORAR-PRO-2026-v1";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeKey(key: string): string {
  return key.trim().toUpperCase().replace(/[\s-]+/g, "");
}

function groupKey(hex12: string): string {
  return hex12.match(/.{1,4}/g)!.join("-");
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Проверяет пару «имя + ключ». Возвращает true, если ключ выдан на это имя. */
export async function validateKey(name: string, key: string): Promise<boolean> {
  if (!name.trim() || !key.trim()) return false;
  try {
    const digest = await hmacHex(normalizeName(name));
    const expected = normalizeKey(groupKey(digest.slice(0, 12).toUpperCase()));
    return expected === normalizeKey(key);
  } catch {
    return false;
  }
}

/** Вычисляет ожидаемый ключ для имени (используется на экране активации в демо-целях). */
export async function computeKey(name: string): Promise<string> {
  const digest = await hmacHex(normalizeName(name));
  return groupKey(digest.slice(0, 12).toUpperCase());
}
