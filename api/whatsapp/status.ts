// api/whatsapp/status.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import http from "http";

const VPS_HOST = "72.60.228.212";
const VPS_PORT = 3001;

export default function handler(req: VercelRequest, res: VercelResponse) {
  const options: http.RequestOptions = {
    hostname: VPS_HOST,
    port: VPS_PORT,
    path: "/api/whatsapp/status",
    method: "GET",
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = "";

    proxyRes.on("data", (chunk) => {
      data += chunk;
    });

    proxyRes.on("end", () => {
      const statusCode = proxyRes.statusCode ?? 500;

      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (!value) return;
        if (key.toLowerCase() === "content-length") return;
        res.setHeader(key, value as string);
      });

      res.status(statusCode).send(data);
    });
  });

  proxyReq.on("error", (err) => {
    console.error("[Vercel Status Proxy] erro:", err);
    res
      .status(500)
      .json({ error: "Erro ao acessar WhatsApp status na VPS." });
  });

  proxyReq.end();
}