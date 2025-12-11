// api/whatsapp/status.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProxyHandler } from "../lib/proxy-utils";

export default createProxyHandler({
  path: "/api/whatsapp/status",
  method: "GET",
  logPrefix: "Vercel Status Proxy",
});