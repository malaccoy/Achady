
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { saveMessageLog } from './_db.js';

// --- Types & Interfaces ---

interface ShopeeProduct {
  id: string;
  titulo: string;
  precoPromocional: number;
  precoOriginal: number;
  desconto: string; // ex: "35%"
  descontoValor: number; // ex: 35
  imagem: string;
  linkAfiliado: string;
}

interface Grupo {
  id: string;
  nome: string;
  linkWhatsapp: string; // Identificador do grupo
  categoria: string; // 'moda' | 'beleza' | 'casa' | etc
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

// --- Configuration & Secrets ---

const CONFIG = {
  APP_ID: process.env.SHOPEE_APP_ID || '',
  APP_SECRET: process.env.SHOPEE_APP_SECRET || '',
  BOT_URL: process.env.WHATSAPP_WEBHOOK_URL || 'https://httpbin.org/post', // URL do seu Robô de WhatsApp
};

// --- Helper: Mapeamento de Categorias ---

const CATEGORY_KEYWORDS: Record<string, string> = {
  'moda': 'moda roupas feminina',
  'beleza': 'maquiagem beleza skincare',
  'casa': 'casa decoração organização',
  'cozinha': 'utensilios cozinha eletroportateis',
  'esportes': 'esporte fitness academia',
  'eletronicos': 'eletronicos fone celular',
  'brinquedos': 'brinquedos infantil jogos',
  'pet': 'pet shop cachorro gato',
  'geral': 'ofertas promoção',
};

// --- 1. Database Simulation (Server Side) ---

async function getActiveGroupsWithCategory(): Promise<Grupo[]> {
  // Em produção, você faria: await sql`SELECT * FROM grupos WHERE ativo = true`
  return [
    {
      id: 'grp_01',
      nome: 'Ofertas Moda VIP',
      linkWhatsapp: process.env.WHATSAPP_GROUP_ID || '120363025225@g.us', // Use ID real aqui
      categoria: 'moda',
      ativo: true
    },
    {
      id: 'grp_02',
      nome: 'Promoções Tech',
      linkWhatsapp: 'fake_group_id_tech', 
      categoria: 'eletronicos',
      ativo: true
    },
    {
      id: 'grp_03',
      nome: 'Achadinhos de Casa',
      linkWhatsapp: 'fake_group_id_home',
      categoria: 'casa',
      ativo: true
    }
  ];
}

async function getMessageTemplate(): Promise<string> {
  return `🔥 A SHÓ TÁ DEMAISSSS 😭🔥

🎁 {{titulo}}

⚠️ De: R$ {{precoOriginal}}
🔥 Por: R$ {{preco}}
📉 Desconto: {{desconto}} OFF

🛒 Compre aqui:
{{link}}

🎫 Pegue Cupons: https://shopee.com.br/m/cupom`;
}

// --- 2. Shopee API Logic ---

function generateSignature(payload: string, timestamp: number): string {
  const rawString = `${CONFIG.APP_ID}${timestamp}${payload}${CONFIG.APP_SECRET}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

async function fetchShopeeOffersByCategory(categoryKey: string): Promise<ShopeeProduct[]> {
  const keyword = CATEGORY_KEYWORDS[categoryKey] || 'ofertas';
  console.log(`📡 Fetching Shopee for category: [${categoryKey}] -> keyword: "${keyword}"`);

  if (!CONFIG.APP_ID || !CONFIG.APP_SECRET) {
    console.warn("⚠️ Shopee App ID/Secret not configured.");
    return [];
  }

  const timestamp = Math.floor(Date.now() / 1000);
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
          ratingStar
        }
      }
    }
  `;

  const payload = JSON.stringify({ query });
  const signature = generateSignature(payload, timestamp);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `SHA256 Credential=${CONFIG.APP_ID},Timestamp=${timestamp},Signature=${signature}`
  };

  try {
    const response = await fetch(endpoint, { method: 'POST', headers, body: payload });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.errors) return [];

    const nodes = json.data?.productOfferV2?.nodes || [];

    return nodes.map((node: any, idx: number) => {
      const precoAtual = node.price || node.priceMin || 0;
      const precoOrig = node.priceMax && node.priceMax > precoAtual ? node.priceMax : (precoAtual * 1.4); 
      const descontoVal = precoOrig > 0 ? Math.round(((precoOrig - precoAtual) / precoOrig) * 100) : 0;

      return {
        id: `shp_${Date.now()}_${idx}`,
        titulo: node.productName || 'Oferta Shopee',
        precoPromocional: precoAtual,
        precoOriginal: precoOrig,
        desconto: `${descontoVal}%`,
        descontoValor: descontoVal,
        imagem: node.imageUrl || '',
        linkAfiliado: node.offerLink || ''
      };
    });

  } catch (err: any) {
    console.error(`❌ Error fetching category ${categoryKey}:`, err.message);
    return [];
  }
}

// --- 3. Filtering Logic ---

function filterProducts(products: ShopeeProduct[]): ShopeeProduct[] {
  return products.filter(p => {
    const hasGoodDiscount = p.descontoValor >= 30;
    const hasMinPrice = p.precoPromocional >= 10;
    const isValid = p.linkAfiliado && p.imagem;
    return hasGoodDiscount && hasMinPrice && isValid;
  });
}

// --- 4. Message Building ---

function buildMessage(template: string, product: ShopeeProduct): string {
  let msg = template;
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  msg = msg.replace(/{{titulo}}/g, product.titulo);
  msg = msg.replace(/{{preco}}/g, formatMoney(product.precoPromocional));
  msg = msg.replace(/{{precoOriginal}}/g, formatMoney(product.precoOriginal));
  msg = msg.replace(/{{desconto}}/g, product.desconto);
  msg = msg.replace(/{{link}}/g, product.linkAfiliado);
  return msg;
}

// --- 5. Dispatch Logic (UPDATED) ---

async function dispatchOffersByGroups(
  productsByCategory: Map<string, ShopeeProduct[]>,
  groups: Grupo[],
  template: string
): Promise<{ sent: number; errors: any[] }> {
  
  let sentCount = 0;
  const errors: any[] = [];

  for (const group of groups) {
    const categoryKey = group.categoria || 'geral';
    const products = productsByCategory.get(categoryKey) || productsByCategory.get('geral') || [];

    if (products.length === 0) continue;

    // Pick top product
    const productToSend = products[0]; 
    const messageBody = buildMessage(template, productToSend);

    try {
      let success = false;
      if (CONFIG.BOT_URL.includes('httpbin')) {
        console.log(`[SIMULADO] Enviando para ${group.nome}: ${productToSend.titulo.substring(0, 30)}...`);
        success = true;
      } else {
        const payload = {
          groupId: group.linkWhatsapp,
          message: messageBody,
          imageUrl: productToSend.imagem
        };
        const res = await fetch(CONFIG.BOT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) success = true;
        else errors.push({ local: `WhatsApp ${group.nome}`, msg: `HTTP ${res.status}` });
      }

      if (success) {
        sentCount++;
        // --- LOGGING ---
        try {
          await saveMessageLog({
            grupoId: group.id,
            grupoNome: group.nome,
            whatsappLink: group.linkWhatsapp,
            categoria: group.categoria,
            produtoId: productToSend.id,
            titulo: productToSend.titulo,
            precoOriginal: productToSend.precoOriginal,
            preco: productToSend.precoPromocional,
            descontoPercentual: productToSend.descontoValor,
            linkAfiliado: productToSend.linkAfiliado,
            mensagemEnviada: messageBody,
            enviadoEm: new Date().toISOString()
          });
        } catch (logErr) {
          console.error("Failed to save log:", logErr);
        }
        // --- END LOGGING ---
      }
    } catch (e: any) {
      errors.push({ local: `WhatsApp ${group.nome}`, msg: e.message });
    }
  }

  return { sent: sentCount, errors };
}

// --- MAIN HANDLER ---

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
    const activeGroups = await getActiveGroupsWithCategory();
    if (activeGroups.length === 0) {
      result.ok = true;
      return res.status(200).json(result);
    }

    const uniqueCategories = Array.from(new Set(activeGroups.map(g => g.categoria || 'geral')));
    const productsMap = new Map<string, ShopeeProduct[]>();

    for (const cat of uniqueCategories) {
      const rawOffers = await fetchShopeeOffersByCategory(cat);
      result.totalFound += rawOffers.length;
      const filtered = filterProducts(rawOffers);
      result.totalFiltered += filtered.length;
      if (filtered.length > 0) productsMap.set(cat, filtered);
    }

    const template = await getMessageTemplate();
    const dispatchResult = await dispatchOffersByGroups(productsMap, activeGroups, template);
    
    result.messagesSent = dispatchResult.sent;
    result.errors = [...result.errors, ...dispatchResult.errors];
    result.ok = true;

    return res.status(200).json(result);

  } catch (error: any) {
    console.error("Critical error:", error);
    result.errors.push({ local: 'General', msg: error.message });
    return res.status(500).json(result);
  }
}
