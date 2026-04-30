import crypto from "node:crypto";

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 5): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 429 && res.status < 500) {
        return res;
      }

      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }

    if (attempt < attempts) {
      await sleep(500 * attempt * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseInfinityFreeCookie(html: string): string | undefined {
  const match = html.match(/var a=toNumbers\("([0-9a-f]+)"\),b=toNumbers\("([0-9a-f]+)"\),c=toNumbers\("([0-9a-f]+)"\)/i);
  if (!match) return undefined;

  const [, keyHex, ivHex, encryptedHex] = match;
  const decipher = crypto.createDecipheriv(
    "aes-128-cbc",
    Buffer.from(keyHex, "hex"),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAutoPadding(false);

  const cookieValue = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("hex");

  return `__test=${cookieValue}`;
}

function summarizeBody(body: string) {
  const title = body.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]
    ?? body.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1];
  const text = (title ?? body)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 240);
}

export async function getAntiBotCookie(url: string): Promise<string | undefined> {
  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const body = await res.text();
  return parseInfinityFreeCookie(body);
}

export type IngestResponse = {
  ok: boolean;
  results?: Record<string, "inserted" | "updated" | "removed" | "invalid">;
};

export async function postIngest(url: string, secret: string, payload: unknown): Promise<IngestResponse> {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const cookie = await getAntiBotCookie(url);

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": sig,
      "User-Agent": "Mozilla/5.0",
      ...(cookie ? { "Cookie": cookie } : {})
    },
    body: raw
  });

  const txt = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Ingest failed ${res.status}: ${summarizeBody(txt)}`);
  }

  if (txt.trim() === "OK") {
    return { ok: true };
  }

  let data: IngestResponse;
  try {
    data = JSON.parse(txt) as IngestResponse;
  } catch {
    throw new Error(`Ingest returned unexpected response: ${summarizeBody(txt)}`);
  }
  if (!data.ok) {
    throw new Error(`Ingest returned unexpected response: ${summarizeBody(txt)}`);
  }

  return data;
}
