import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProxyHandler } from "./lib/proxy-utils";

export default createProxyHandler({
  path: "/api/logs",
  method: "GET",
  logPrefix: "Vercel Logs Proxy",
});