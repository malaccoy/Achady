// In Vite, env vars are exposed via import.meta.env and should usually be prefixed with VITE_
// We check for VITE_API_BASE_URL first, then fallback to NEXT_PUBLIC_API_BASE_URL, then the hardcoded VPS IP.

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.NEXT_PUBLIC_API_BASE_URL ||
  "http://72.60.228.212:3001/api";

export const MOCK_PREVIEW_DATA = {
  titulo: "Kit 10 Organizadores Acrílico Gaveta Geladeira",
  preco: "R$ 50,19",
  precoOriginal: "R$ 66,64",
  desconto: "25%",
  link: "https://s.shopee.com.br/exemplo"
};

export const DEFAULT_TEMPLATE = `A SHÓ TÁ DEMAISSSS 😱🔥

🎁 {{titulo}}

💸 De: {{precoOriginal}}
🔥 Por: {{preco}} ({{desconto}} OFF)

🛒 Compre aqui:
{{link}}

⚠️ O preço e disponibilidade do produto podem variar, pois as promoções são por tempo limitado.`;
