import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { saveMessageLog } from './_db';

// --- Types & Interfaces ---

interface ShopeeProduct {
  id: string;
  titulo: string;
  precoPromocional: number; // Sempre number
  precoOriginal: number;    // Sempre number
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

// --- Helpers de Segurança de Tipos (Anti-Crash) ---

/**
 * Converte qualquer entrada para number de forma segura.
 * Nunca lança erro. Retorna 0 em caso de falha.
 */
const safeParseFloat = (val: any): number => {
  try {
    if (typeof val === 'number') {
      return isNaN(val) ? 0 : val;
    }
    
    if (val === null || val === undefined) return 0;

    if (typeof val === 'string') {
      // Remove tudo que não for dígito, ponto, vírgula ou sinal de menos
      const clean = val.replace(/[^0-9.,-]/g, '');
      if (!clean.trim()) return 0;
      
      // Substitui vírgula por ponto para parsear corretamente
      const normalized = clean.replace(',', '.');
      const parsed = parseFloat(normalized);
      
      return isNaN(parsed) ? 0 : parsed;
    }
    
    // Tenta conversão direta como fallback
    const fallback = Number(val);
    return isNaN(fallback) ? 0 : fallback;
  } catch (e) {
    return 0;
  }
};

/**
 * Formata um valor como moeda BRL (ex: 12,50).
 * Garante que toFixed seja chamado apenas em number.
 */
const safeFormatCurrency = (val: any): string => {
  try {
    const num = safeParseFloat(val);
    return num.toFixed(2).replace('.', ',');
  } catch (e) {
    return "0,00";
  }
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
  // Em produção, buscar do banco real
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

    if (!res.ok) {
      console.warn(`[Shopee] API Error ${res.status}`);
      return [];
    }

    const json = await res.json();
    const nodes = json.data?.productOfferV2?.nodes || [];

    return nodes.map((n: any, i: number) => {
      // 1. Conversão Segura de Valores da API
      const price = safeParseFloat(n.price);
      const priceMin = safeParseFloat(n.priceMin);
      const priceMax = safeParseFloat(n.priceMax);

      // 2. Lógica de Preço Atual
      let precoAtual = 0;
      if (price > 0) precoAtual = price;
      else if (priceMin > 0) precoAtual = priceMin;
      else if (priceMax > 0) precoAtual = priceMax;

      // 3. Lógica de Preço Original ("De")
      // Se priceMax for maior que atual, usa ele. Senão aplica markup fictício de 40%
      const precoOrig = (priceMax > precoAtual) ? priceMax : (precoAtual * 1.4);
      
      // 4. Cálculo de Desconto
      let descontoVal = 0;
      if (precoOrig > 0 && precoAtual > 0) {
        descontoVal = Math.round(((precoOrig - precoAtual) / precoOrig) * 100);
      }

      return {
        id: `prod_${Date.now()}_${i}`,
        titulo: n.productName || 'Produto Shopee',
        precoPromocional: precoAtual, // Já garantido como number pelo safeParseFloat
        precoOriginal: precoOrig,     // Já garantido como number
        desconto: `${descontoVal}%`,
        descontoValor: descontoVal,
        imagem: n.imageUrl || '',
        linkAfiliado: n.offerLink || ''
      };
    });

  } catch (err: any) {
    console.error("Shopee API execution error:", err);
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
  // Conversão de segurança na hora de montar a string
  const titulo = p.titulo || 'Oferta Imperdível';
  const precoFormatado = safeFormatCurrency(p.precoPromocional);
  const precoOriginalFormatado = safeFormatCurrency(p.precoOriginal);
  const desconto = p.desconto || '0%';
  const link = p.linkAfiliado || '';

  return template
    .replace(/{{titulo}}/g, titulo)
    .replace(/{{preco}}/g, precoFormatado)
    .replace(/{{precoOriginal}}/g, precoOriginalFormatado)
    .replace(/{{desconto}}/g, String(desconto))
    .replace(/{{link}}/g, link);
}

// --- Enviar para Grupos ---
async function dispatchOffers(groups: Grupo[], products: ShopeeProduct[], template: string) {
  let sent = 0;
  const errors: any[] = [];

  // Enviar apenas o melhor produto para evitar spam
  const product = products[0];
  
  if (!product) {
    return { sent: 0, errors: [] };
  }

  for (const g of groups) {
    // Monta mensagem segura
    const message = buildMessage(template, product);

    try {
      console.log(`🔵 Enviando oferta "${product.titulo}" para grupo ${g.nome} (${g.categoria})...`);

      // Verifica se é simulação ou envio real
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
      } else {
        console.log(`[DRY RUN] Mensagem não enviada (URL padrão httpbin): \n${message}`);
      }

      sent++;

      // Salva log compartilhado
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
      console.error(`[Erro Envio] Grupo ${g.nome}:`, err);
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
    if (groups.length === 0) {
      result.errors.push({ local: "init", msg: "Nenhum grupo ativo encontrado." });
      return res.json(result);
    }

    // Para MVP, pegamos a categoria do primeiro grupo. 
    // Idealmente faria um loop por categorias únicas.
    const categoriaAlvo = groups[0].categoria;
    
    console.log(` Iniciando coleta para categoria: ${categoriaAlvo}`);

    const productsRaw = await fetchShopeeOffersByCategory(categoriaAlvo);
    result.totalFound = productsRaw.length;

    const products = filterProducts(productsRaw);
    result.totalFiltered = products.length;

    if (products.length === 0) {
      console.log(" Nenhum produto passou no filtro (>30% desconto).");
      result.ok = true; // Execução ok, só não achou produtos
      return res.json(result);
    }

    const template = await getMessageTemplate();

    const dispatch = await dispatchOffers(groups, products, template);

    result.messagesSent = dispatch.sent;
    result.errors = dispatch.errors;
    result.ok = true;

    return res.json(result);

  } catch (err: any) {
    console.error("Critical error in handler:", err);
    result.errors.push({ local: "general", msg: err.message });
    return res.status(500).json(result);
  }
}