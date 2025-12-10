import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as http from "http";

const VPS_HOST = "72.60.228.212";
const VPS_PORT = 3001;

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const options: http.RequestOptions = {
      hostname: VPS_HOST,
      port: VPS_PORT,
      path: "/api/logs",
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
      console.error("[Vercel Logs Proxy] erro:", err);
      res.status(500).json({ error: "Erro ao acessar logs na VPS." });
    });

    proxyReq.end();
  } catch (err: any) {
    console.error("[Vercel Logs Proxy] exceção:", err);
    res.status(500).json({ error: "Falha interna na função de logs." });
  }
}