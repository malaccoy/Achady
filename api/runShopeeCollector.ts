
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
  
  // WPPConnect Configuration (Ngrok ou URL fixa)
  WPP_BASE_URL: 'https://carmel-liturgical-degressively.ngrok-free.dev',
  WPP_SESSION: 'Caio', 
  WPP_TOKEN: process.env.WPP_TOKEN || '$2b$10$EnDJPCLWDLfyLFwN_8jvmuNZl_x34JO66c1Xw_iQIngx3EBuubJwO', 
};

// --- Helpers de Segurança de Tipos ---

const toNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const direct = Number(val);
  if (!isNaN(direct)) return direct;
  if (typeof val === 'string') {
    const clean = val.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const formatMoney = (val: any): string => {
  const num = toNumber(val);
  return num.toFixed(2).replace('.', ',');
};

// --- Map categorias -> keywords Shopee ---
// Define o que buscar para cada categoria de grupo
const CATEGORY_KEYWORDS: Record<string, string> = {
  moda: 'moda feminina roupas vestido',
  beleza: 'maquiagem skincare perfume',
  casa: 'utilidades domesticas organizacao',
  eletronicos: 'fone bluetooth smartwach celular',
  brinquedos: 'brinquedos educativos jogos',
  pet: 'acessorios pet cachorro gato',
  cozinha: 'eletroportateis airfryer panela',
  esportes: 'roupa academia suplemento',
  geral: 'ofertas relampago promoção'
};

// --- Mock DB Groups ---
// Em produção, isso viria do seu banco de dados real
async function getActiveGroupsWithCategory(): Promise<Grupo[]> {
  return [
    {
      id: 'grp_moda_01',
      nome: 'Ofertas Moda VIP',
      linkWhatsapp: process.env.WHATSAPP_GROUP_ID || '120363025225@g.us',
      categoria: 'moda',
      ativo: true
    },
    {
      id: 'grp_eletr_01',
      nome: 'Tech Promoções',
      linkWhatsapp: '120363025226@g.us', // Exemplo
      categoria: 'eletronicos',
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

  console.log(`🔎 [Shopee] Buscando categoria: "${category}" (Keyword: "${keyword}")`);

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
      const price = toNumber(n.price);
      const priceMin = toNumber(n.priceMin);
      const priceMax = toNumber(n.priceMax);

      // Lógica de Preço
      let precoAtual = 0;
      if (price > 0) precoAtual = price;
      else if (priceMin > 0) precoAtual = priceMin;
      else if (priceMax > 0) precoAtual = priceMax;

      // Simula "De" se não houver lógica melhor
      const precoOrig = (priceMax > precoAtual) ? priceMax : (precoAtual * 1.4);
      
      let descontoVal = 0;
      if (precoOrig > 0 && precoAtual > 0) {
        descontoVal = Math.round(((precoOrig - precoAtual) / precoOrig) * 100);
      }

      return {
        id: `prod_${Date.now()}_${i}`,
        titulo: n.productName || 'Produto Shopee',
        precoPromocional: precoAtual,
        precoOriginal: precoOrig,
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
  // Filtra ofertas com pelo menos 20% de desconto e imagem válida
  return products.filter(p =>
    p.descontoValor >= 20 &&
    p.precoPromocional > 0 &&
    p.imagem &&
    p.linkAfiliado
  );
}

// --- Montar Mensagem ---
function buildMessage(template: string, p: ShopeeProduct): string {
  const titulo = p.titulo || 'Oferta Imperdível';
  const precoFormatado = formatMoney(p.precoPromocional); 
  const precoOriginalFormatado = formatMoney(p.precoOriginal);
  const desconto = p.desconto || '0%';
  const link = p.linkAfiliado || '';

  return template
    .replace(/{{titulo}}/g, titulo)
    .replace(/{{preco}}/g, precoFormatado)
    .replace(/{{precoOriginal}}/g, precoOriginalFormatado)
    .replace(/{{desconto}}/g, String(desconto))
    .replace(/{{link}}/g, link);
}

// --- Enviar para Grupos (WPPConnect) ---
async function dispatchOffers(groups: Grupo[], products: ShopeeProduct[], template: string) {
  let sent = 0;
  const errors: any[] = [];

  // Pega a melhor oferta da lista (a primeira pós-filtro)
  const product = products[0];
  
  if (!product) {
    return { sent: 0, errors: [] };
  }

  for (const g of groups) {
    try {
      const message = buildMessage(template, product);
    
      console.log(`🔵 Enviando oferta "${product.titulo}" para grupo ${g.nome} (Cat: ${g.categoria})...`);

      const hasImage = !!product.imagem;
      const route = hasImage ? 'send-image' : 'send-message';
      const url = `${CONFIG.WPP_BASE_URL}/api/${CONFIG.WPP_SESSION}/${route}`;

      const payload = hasImage 
        ? {
            phone: g.linkWhatsapp,
            path: product.imagem,
            caption: message,
            isGroup: true,
            filename: 'oferta.jpg'
          }
        : {
            phone: g.linkWhatsapp,
            message: message,
            isGroup: true
          };

      // Disparo real
      if (CONFIG.WPP_BASE_URL.includes("ngrok") || !url.includes("httpbin")) {
        const response = await fetch(url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.WPP_TOKEN}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
           const errText = await response.text();
           throw new Error(`WPPConnect Error ${response.status}: ${errText}`);
        }
      } else {
        console.log(`[DRY RUN] Mensagem simulada para ${g.nome}`);
      }

      sent++;

      // Salva log unificado no banco
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
        imagem: product.imagem,
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

    // 1. Identificar quais categorias precisamos processar
    // (Baseado nos grupos que o usuário tem cadastrado)
    const uniqueCategories = [...new Set(groups.map(g => g.categoria || 'geral'))];
    
    console.log(`📋 Categorias ativas para processamento: ${uniqueCategories.join(', ')}`);
    
    const template = await getMessageTemplate();

    // 2. Loop por Categoria (Nicho)
    for (const category of uniqueCategories) {
        
        // 2.1 Buscar ofertas ESPECÍFICAS para essa categoria
        const productsRaw = await fetchShopeeOffersByCategory(category);
        result.totalFound += productsRaw.length;

        // 2.2 Filtrar melhores ofertas
        const products = filterProducts(productsRaw);
        result.totalFiltered += products.length;

        if (products.length === 0) {
            console.log(`⚠️ Nenhuma oferta boa encontrada para categoria: ${category}`);
            continue;
        }

        // 2.3 Selecionar apenas grupos que pertencem a essa categoria
        const targetGroups = groups.filter(g => (g.categoria || 'geral') === category);

        if (targetGroups.length > 0) {
            console.log(`🚀 Disparando oferta de [${category}] para ${targetGroups.length} grupos.`);
            
            // 2.4 Enviar (Dispatch)
            // A função dispatchOffers vai pegar a melhor oferta e enviar para esses grupos
            const dispatch = await dispatchOffers(targetGroups, products, template);
            
            result.messagesSent += dispatch.sent;
            result.errors.push(...dispatch.errors);
        }
    }

    result.ok = true;
    return res.json(result);

  } catch (err: any) {
    console.error("Critical error in handler:", err);
    result.errors.push({ local: "general", msg: err.message });
    return res.status(500).json(result);
  }
}
