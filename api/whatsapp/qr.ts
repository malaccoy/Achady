// api/whatsapp/qr.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProxyHandler } from "../lib/proxy-utils";

export default createProxyHandler({
  path: "/api/whatsapp/qr",
  method: "GET",
  logPrefix: "Vercel QR Proxy",
});