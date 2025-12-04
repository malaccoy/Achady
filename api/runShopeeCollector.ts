import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { saveMessageLog } from './_db';

// --- Types & Interfaces ---

interface ShopeeProduct {
  id: string;
  titulo: string;
  precoPromocional: number;
  precoOriginal: number;
  desconto: string;
  descontoValor: number;
  imagem: string;
  linkAfiliado: string;
}

interface Grupo {
  id: string;
  nome: string;
  linkWhatsapp: string;
  categoria: string;
  ativo: boolean;
}

interface ExecutionResult {
  ok: boolean;
  totalFound: number;
  totalFiltered: number;
  messagesSent: number;
  errors: Array<{ local: string; msg: string }>;
  timestamp: string;
}

// --- Config ---

const CONFIG = {
  APP_ID: process.env.SHOPEE_APP_ID || '',
  APP_SECRET: process.env.SHOPEE_SECRET || '',
  BOT_URL: process.env.WHATSAPP_WEBHOOK_URL || 'https://httpbin.org/post',
};

// --- Map categorias -> keywords Shopee ---
const CATEGORY_KEYWORDS: Record<string, string> = {
  moda: 'moda feminina roupas',
  beleza: 'maquiagem skincare beleza',
  casa: 'casa cozinha organizacao',
  eletronicos: 'eletronicos fone celular',
  geral: 'promoção oferta'
};

// --- Mock DB Groups ---
async function getActiveGroupsWithCategory(): Promise<Grupo[]> {
  // In production, fetch from your real DB
  return [
    {
      id: 'grp01',
      nome: 'Ofertas Moda',
      linkWhatsapp: process.env.WHATSAPP_GROUP_ID || '120363025225@g.us',
      categoria: 'moda',
      ativo: true
    }
  ];
}

async function getMessageTemplate(): Promise<string> {
  return `
🔥 ACHADO DA SHOPEE 🔥

{{titulo}}

💸 De: R$ {{precoOriginal}}
🔥 Por: R$ {{preco}}
📉 Desconto: {{desconto}} OFF

🛒 Compre aqui:
{{link}}
`;
}

// --- Shopee Signature ---
function generateSignature(payload: string, timestamp: number): string {
  const raw = `${CONFIG.APP_ID}${timestamp}${payload}${CONFIG.APP_SECRET}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// --- Buscar Ofertas Shopee ---
async function fetchShopeeOffersByCategory(category: string): Promise<ShopeeProduct[]> {
  const keyword = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS['geral'];

  const endpoint = 'https://open-api.affiliate.shopee.com.br/graphql';

  const query = `
  query {
    productOfferV2(
      keyword: "${keyword}",
      page: 1,
      limit: 20,
      sortType: 2
    ) {
      nodes {
        productName
        price
        priceMin
        priceMax
        imageUrl
        offerLink
      }
    }
  }`;

  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(payload, timestamp);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${CONFIG.APP_ID},Timestamp=${timestamp},Signature=${signature}`,
      },
      body: payload
    });

    if (!res.ok) return [];

    const json = await res.json();
    const nodes = json.data?.productOfferV2?.nodes || [];

    return nodes.map((n: any, i: number) => {
      // FIX: Ensure prices are numbers, as API returns strings often
      const price = parseFloat(n.price) || 0;
      const priceMin = parseFloat(n.priceMin) || 0;
      const priceMax = parseFloat(n.priceMax) || 0;

      const precoAtual = price || priceMin || 0;
      const precoOrig = priceMax || (precoAtual * 1.4);
      
      const descontoVal = precoOrig > 0 
        ? Math.round(((precoOrig - precoAtual) / precoOrig) * 100)
        : 0;

      return {
        id: `prod_${Date.now()}_${i}`,
        titulo: n.productName || 'Produto Shopee',
        precoPromocional: precoAtual,
        precoOriginal: precoOrig,
        desconto: `${descontoVal}%`,
        descontoValor: descontoVal,
        imagem: n.imageUrl,
        linkAfiliado: n.offerLink
      };
    });

  } catch (err: any) {
    console.error("Shopee API error:", err);
    return [];
  }
}

// --- Filtro de Ofertas ---
function filterProducts(products: ShopeeProduct[]) {
  return products.filter(p =>
    p.descontoValor >= 30 &&
    p.precoPromocional >= 10 &&
    p.imagem &&
    p.linkAfiliado
  );
}

// --- Montar Mensagem ---
function buildMessage(template: string, p: ShopeeProduct): string {
  // Safe formatting helpers
  const fmt = (val: number) => (typeof val === 'number' ? val.toFixed(2).replace('.', ',') : '0,00');

  return template
    .replace(/{{titulo}}/g, p.titulo)
    .replace(/{{preco}}/g, fmt(p.precoPromocional))
    .replace(/{{precoOriginal}}/g, fmt(p.precoOriginal))
    .replace(/{{desconto}}/g, p.desconto)
    .replace(/{{link}}/g, p.linkAfiliado);
}

// --- Enviar para Grupos ---
async function dispatchOffers(groups: Grupo[], products: ShopeeProduct[], template: string) {
  let sent = 0;
  const errors: any[] = [];

  for (const g of groups) {
    const product = products[0];
    if (!product) continue;

    const message = buildMessage(template, product);

    try {
      console.log(`🔵 Enviando para grupo ${g.nome}...`);

      if (!CONFIG.BOT_URL.includes("httpbin")) {
        await fetch(CONFIG.BOT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: g.linkWhatsapp,
            message,
            imageUrl: product.imagem
          })
        });
      }

      sent++;

      // Salva no banco de logs compartilhado
      await saveMessageLog({
        grupoId: g.id,
        grupoNome: g.nome,
        whatsappLink: g.linkWhatsapp,
        categoria: g.categoria,
        produtoId: product.id,
        titulo: product.titulo,
        precoOriginal: product.precoOriginal,
        preco: product.precoPromocional,
        descontoPercentual: product.descontoValor,
        linkAfiliado: product.linkAfiliado,
        mensagemEnviada: message,
        enviadoEm: new Date().toISOString()
      });

    } catch (err: any) {
      errors.push({ local: g.nome, msg: err.message });
      console.error(err);
    }
  }

  return { sent, errors };
}

// --- Handler Principal ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result: ExecutionResult = {
    ok: false,
    totalFound: 0,
    totalFiltered: 0,
    messagesSent: 0,
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    const groups = await getActiveGroupsWithCategory();
    if (groups.length === 0) return res.json(result);

    const productsRaw = await fetchShopeeOffersByCategory(groups[0].categoria);
    result.totalFound = productsRaw.length;

    const products = filterProducts(productsRaw);
    result.totalFiltered = products.length;

    const template = await getMessageTemplate();

    const dispatch = await dispatchOffers(groups, products, template);

    result.messagesSent = dispatch.sent;
    result.errors = dispatch.errors;
    result.ok = true;

    return res.json(result);

  } catch (err: any) {
    console.error("Critical error:", err);
    result.errors.push({ local: "general", msg: err.message });
    return res.status(500).json(result);
  }
}