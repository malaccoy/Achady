import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as http from "http";
import { Buffer } from "buffer";

const VPS_HOST = "72.60.228.212";
const VPS_PORT = 3001;

interface ProxyOptions {
  path: string;
  method?: string;
  logPrefix?: string;
}

/**
 * Generic HTTP proxy handler for forwarding requests to VPS
 * @param req - Vercel request object
 * @param res - Vercel response object
 * @param options - Proxy configuration options
 */
export function createProxyHandler(options: ProxyOptions) {
  return function handler(req: VercelRequest, res: VercelResponse) {
    try {
      const method = options.method || req.method || "GET";
      const logPrefix = options.logPrefix || "Vercel Proxy";

      const requestOptions: http.RequestOptions = {
        hostname: VPS_HOST,
        port: VPS_PORT,
        path: options.path,
        method: method,
        headers: {
          ...req.headers,
          host: `${VPS_HOST}:${VPS_PORT}`,
        },
      };

      // Handle POST/PUT requests with body
      if (method !== "GET" && method !== "HEAD" && req.body) {
        const bodyData = JSON.stringify(req.body);
        requestOptions.headers = {
          ...requestOptions.headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyData),
        };

        const proxyReq = http.request(requestOptions, (proxyRes) => {
          let data = "";
          proxyRes.on("data", (chunk) => (data += chunk));
          proxyRes.on("end", () => {
            const statusCode = proxyRes.statusCode ?? 500;
            copyHeaders(proxyRes.headers, res);
            res.status(statusCode).send(data);
          });
        });

        proxyReq.on("error", (err) => {
          console.error(`[${logPrefix}] erro:`, err);
          res.status(500).json({ error: `Erro ao acessar ${options.path} na VPS.` });
        });

        proxyReq.write(bodyData);
        proxyReq.end();
        return;
      }

      // Handle GET/HEAD requests
      const proxyReq = http.request(requestOptions, (proxyRes) => {
        let data = "";
        proxyRes.on("data", (chunk) => (data += chunk));
        proxyRes.on("end", () => {
          const statusCode = proxyRes.statusCode ?? 500;
          copyHeaders(proxyRes.headers, res);
          res.status(statusCode).send(data);
        });
      });

      proxyReq.on("error", (err) => {
        console.error(`[${logPrefix}] erro:`, err);
        res.status(500).json({ error: `Erro ao acessar ${options.path} na VPS.` });
      });

      proxyReq.end();
    } catch (err: any) {
      console.error(`[${options.logPrefix || "Vercel Proxy"}] exceção:`, err);
      res.status(500).json({ error: `Falha interna na função ${options.path}.` });
    }
  };
}

/**
 * Helper function to copy headers from upstream response to Vercel response
 */
function copyHeaders(
  headers: http.IncomingHttpHeaders,
  res: VercelResponse
): void {
  Object.entries(headers).forEach(([key, value]) => {
    if (!value) return;
    if (key.toLowerCase() === "content-length") return;
    res.setHeader(key, value as string);
  });
}
