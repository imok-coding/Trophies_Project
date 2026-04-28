import crypto from "node:crypto";

export async function postIngest(url: string, secret: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": sig
    },
    body: raw
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Ingest failed ${res.status}: ${txt}`);
  }
}