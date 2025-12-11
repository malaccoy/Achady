import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProxyHandler } from "./lib/proxy-utils";

export default createProxyHandler({
  path: "/api/groups",
  logPrefix: "Vercel Groups Proxy",
});