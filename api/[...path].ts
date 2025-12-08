import type { VercelRequest, VercelResponse } from "@vercel/node";

const VPS_BASE_URL =
  process.env.VPS_API_BASE_URL || "http://72.60.228.212:3001/api";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const segments = req.query.path;
    const path = Array.isArray(segments) ? segments.join("/") : segments || "";
    const targetUrl = `${VPS_BASE_URL}/${path}`;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === "host") continue;
      if (typeof value === "undefined") continue;
      headers[key] = Array.isArray(value) ? value[0] : (value as string);
    }

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method && !["GET", "HEAD"].includes(req.method.toUpperCase())) {
      init.body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, init);
    const bodyText = await upstream.text();

    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-length") return;
      res.setHeader(key, value);
    });

    res.status(upstream.status).send(bodyText);
  } catch (err: any) {
    console.error("[PROXY] Erro:", err.message);
    res.status(500).json({ error: "Erro no proxy para a VPS." });
  }
}