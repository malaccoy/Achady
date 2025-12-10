import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as http from "http";
import { Buffer } from "buffer";

const VPS_HOST = "72.60.228.212";
const VPS_PORT = 3001;

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const options: http.RequestOptions = {
      hostname: VPS_HOST,
      port: VPS_PORT,
      path: "/api/groups",
      method: req.method,
      headers: {
        ...req.headers,
        host: `${VPS_HOST}:${VPS_PORT}`,
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        // Prepare body for forwarding if needed (POST/PUT)
        const bodyData = JSON.stringify(req.body);
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyData)
        };
        
        const proxyReq = http.request(options, (proxyRes) => {
            let data = "";
            proxyRes.on("data", chunk => data += chunk);
            proxyRes.on("end", () => {
                const statusCode = proxyRes.statusCode ?? 500;
                Object.entries(proxyRes.headers).forEach(([key, value]) => {
                    if (key.toLowerCase() !== "content-length" && value) {
                        res.setHeader(key, value as string);
                    }
                });
                res.status(statusCode).send(data);
            });
        });
        
        proxyReq.on("error", (err) => {
             res.status(500).json({ error: "Erro proxy groups" });
        });

        proxyReq.write(bodyData);
        proxyReq.end();
        return;
    }

    // Handle GET requests
    const proxyReq = http.request(options, (proxyRes) => {
      let data = "";
      proxyRes.on("data", (chunk) => data += chunk);
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
      console.error("[Vercel Groups Proxy] erro:", err);
      res.status(500).json({ error: "Erro ao acessar grupos na VPS." });
    });

    proxyReq.end();
  } catch (err: any) {
    console.error("[Vercel Groups Proxy] exceção:", err);
    res.status(500).json({ error: "Falha interna na função de grupos." });
  }
}