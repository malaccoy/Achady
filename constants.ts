// Relies on vercel.json rewrites (prod) or vite.config.ts proxy (dev)
export const API_BASE_URL = "/api";

export const MOCK_PREVIEW_DATA = {
  titulo: "Kit 10 Organizadores Acrílico Gaveta Geladeira",
  preco: "R$ 50,19",
  precoOriginal: "R$ 66,64",
  desconto: "25%",
  link: "https://s.shopee.com.br/exemplo"
};

// Mock data without discount for testing conditional rendering
export const MOCK_PREVIEW_DATA_NO_DISCOUNT = {
  titulo: "Kit 10 Organizadores Acrílico Gaveta Geladeira",
  preco: "R$ 50,19",
  precoOriginal: "",
  desconto: "",
  link: "https://s.shopee.com.br/exemplo"
};

export const DEFAULT_TEMPLATE = `🔥 Oferta Shopee! (por tempo limitado)

🛍️ {{titulo}}

💸 De: ~{{precoOriginal}}~
🔥 Agora: {{preco}}  ({{desconto}} OFF)

🛒 Link: {{link}}

*O preço e a disponibilidade do produto podem variar, pois as promoções são por tempo limitado.`;

export const DEFAULT_SIGNATURE = "Grupo de ofertas Achady – promoções atualizadas todos os dias.";

// Emoji library for quick insertion
export const EMOJI_LIBRARY = [
  { emoji: "🔥", label: "Fogo" },
  { emoji: "💥", label: "Boom" },
  { emoji: "🤑", label: "Rico" },
  { emoji: "🛒", label: "Carrinho" },
  { emoji: "📦", label: "Caixa" },
  { emoji: "💸", label: "Dinheiro" },
  { emoji: "⚡", label: "Raio" },
  { emoji: "🎁", label: "Presente" },
  { emoji: "⭐", label: "Estrela" },
  { emoji: "✨", label: "Brilho" },
  { emoji: "🚀", label: "Foguete" },
  { emoji: "💎", label: "Diamante" },
  { emoji: "🏆", label: "Troféu" },
  { emoji: "👑", label: "Coroa" },
  { emoji: "🎯", label: "Alvo" },
  { emoji: "💯", label: "100" },
  { emoji: "🛍️", label: "Sacola" },
  { emoji: "🎉", label: "Festa" },
  { emoji: "🔔", label: "Sino" },
  { emoji: "⏰", label: "Relógio" }
];

// Text snippets for quick insertion
export const TEXT_SNIPPETS = [
  { text: "Por tempo limitado", label: "Tempo limitado" },
  { text: "Estoque reduzido", label: "Estoque reduzido" },
  { text: "Frete grátis para sua região", label: "Frete grátis" },
  { text: "Últimas unidades", label: "Últimas unidades" },
  { text: "Oferta relâmpago", label: "Oferta relâmpago" },
  { text: "Aproveite agora", label: "Aproveite agora" },
  { text: "Não perca essa chance", label: "Não perca" },
  { text: "Melhor preço garantido", label: "Melhor preço" },
  { text: "Exclusivo para o grupo", label: "Exclusivo" },
  { text: "Compre agora e economize", label: "Economize" }
];

// Template presets
export const TEMPLATE_PRESETS = [
  {
    name: "Padrão",
    content: `🔥 Oferta Shopee! (por tempo limitado)

🛍️ {{titulo}}

💸 De: ~{{precoOriginal}}~
🔥 Agora: {{preco}}  ({{desconto}} OFF)

🛒 Link: {{link}}

*O preço e a disponibilidade do produto podem variar, pois as promoções são por tempo limitado.`
  },
  {
    name: "Curto",
    content: `🔥 {{titulo}}

💰 {{preco}} ({{desconto}} OFF)
🛒 {{link}}`
  },
  {
    name: "Promoção Especial",
    content: `⚡ OFERTA IMPERDÍVEL ⚡

🎁 {{titulo}}

💎 Preço: {{preco}}
💸 Desconto: {{desconto}}

🚀 Garanta já: {{link}}

🔔 Corre que é por tempo limitado!`
  }
];
