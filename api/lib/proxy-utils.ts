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

      // Handle POST/PUT/PATCH/DELETE requests with body
      const methodsWithBody = ["POST", "PUT", "PATCH", "DELETE"];
      if (methodsWithBody.includes(method) && req.body !== undefined) {
        const bodyData = JSON.stringify(req.body);
        requestOptions.headers = {
          ...requestOptions.headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyData),
        };

        const proxyReq = http.request(requestOptions, (proxyRes) => {
          handleResponse(proxyRes, res, logPrefix, options.path);
        });

        proxyReq.on("error", (err) => {
          handleError(err, res, logPrefix, options.path);
        });

        proxyReq.write(bodyData);
        proxyReq.end();
        return;
      }

      // Handle GET/HEAD requests or requests without body
      const proxyReq = http.request(requestOptions, (proxyRes) => {
        handleResponse(proxyRes, res, logPrefix, options.path);
      });

      proxyReq.on("error", (err) => {
        handleError(err, res, logPrefix, options.path);
      });

      proxyReq.end();
    } catch (err: any) {
      console.error(`[${options.logPrefix || "Vercel Proxy"}] exceção:`, err);
      res.status(500).json({ error: `Falha interna na função ${options.path}.` });
    }
  };
}

/**
 * Handle the response from the upstream VPS server
 */
function handleResponse(
  proxyRes: http.IncomingMessage,
  res: VercelResponse,
  logPrefix: string,
  path: string
): void {
  let data = "";
  proxyRes.on("data", (chunk) => (data += chunk));
  proxyRes.on("end", () => {
    const statusCode = proxyRes.statusCode ?? 500;
    copyHeaders(proxyRes.headers, res);
    res.status(statusCode).send(data);
  });
}

/**
 * Handle errors from the upstream VPS server
 */
function handleError(
  err: Error,
  res: VercelResponse,
  logPrefix: string,
  path: string
): void {
  console.error(`[${logPrefix}] erro:`, err);
  res.status(500).json({ error: `Erro ao acessar ${path} na VPS.` });
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
