import type { VercelRequest, VercelResponse } from "@vercel/node";

const VPS_API_BASE_URL = "http://72.60.228.212:3001/api";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const upstream = await fetch(`${VPS_API_BASE_URL}/whatsapp/qr`, {
      method: "GET",
    });

    const text = await upstream.text();

    // Repassa alguns headers básicos
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-length") return;
      res.setHeader(key, value);
    });

    res.status(upstream.status).send(text);
  } catch (err: any) {
    console.error("[Vercel QR Proxy] Erro:", err.message);
    res.status(500).json({ error: "Erro ao acessar WhatsApp QR na VPS." });
  }
}