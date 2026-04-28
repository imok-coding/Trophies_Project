import crypto from "node:crypto";

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

async function getAntiBotCookie(url: string): Promise<string | undefined> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const body = await res.text();
  return parseInfinityFreeCookie(body);
}

export async function postIngest(url: string, secret: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const cookie = await getAntiBotCookie(url);

  const res = await fetch(url, {
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
    throw new Error(`Ingest failed ${res.status}: ${txt}`);
  }

  if (txt.trim() !== "OK") {
    throw new Error(`Ingest returned unexpected response: ${txt.slice(0, 200)}`);
  }
}
