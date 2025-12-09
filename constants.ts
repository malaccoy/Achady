// Relies on vercel.json rewrites (prod) or vite.config.ts proxy (dev)
export const API_BASE_URL = "/api";

export const MOCK_PREVIEW_DATA = {
  titulo: "Kit 10 Organizadores Acrílico Gaveta Geladeira",
  preco: "R$ 50,19",
  precoOriginal: "R$ 66,64",
  desconto: "25%",
  link: "https://s.shopee.com.br/exemplo"
};

export const DEFAULT_TEMPLATE = `🔥 Oferta Shopee! (por tempo limitado)

🛍️ {{titulo}}

💸 De: ~{{precoOriginal}}~
🔥 Agora: {{preco}}  ({{desconto}} OFF)

🛒 Link: {{link}}

*O preço e a disponibilidade do produto podem variar, pois as promoções são por tempo limitado.`;
