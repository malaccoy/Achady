
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Interfaces & Types ---

interface ShopeeProduct {
  id: string;
  titulo: string;
  precoPromocional: number;
  precoOriginal: number;
  desconto: string;
  imagem: string;
  linkAfiliado: string;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  whatsappId: string; // ID used by the bot
}

interface ExecutionResult {
  ok: boolean;
  totalFound: number;
  totalFiltered: number;
  messagesSent: number;
  errors: string[];
  timestamp: string;
}

// --- Configuration ---
// In a real environment, these come from process.env
// We access the same keys that would be in your AppSettings
const CONFIG = {
  APP_ID: process.env.SHOPEE_APP_ID || '', 
  APP_SECRET: process.env.SHOPEE_APP_SECRET || '',
  // Use a real endpoint for your bot, or a request bin for testing
  BOT_URL: process.env.WHATSAPP_WEBHOOK_URL || 'https://httpbin.org/post',
};

// --- Core Logic Functions ---

/**
 * 1. Fetch Shopee Promotions
 * Connects to Shopee GraphQL API using configured credentials.
 */
async function fetchShopeePromotions(): Promise<ShopeeProduct[]> {
  console.log("📡 Fetching promotions from Shopee...");
  
  if (!CONFIG.APP_ID || !CONFIG.APP_SECRET) {
    console.warn("⚠️ Shopee Credentials (SHOPEE_APP_ID/SECRET) not found in env.");
    // Returning empty array to prevent crash, but logging warning
    return [];
  }

  const url = 'https://open-api.affiliate.shopee.com.br/graphql';
  const headers = {
    'Content-Type': 'application/json',
    'App-ID': CONFIG.APP_ID,
    'App-Secret': CONFIG.APP_SECRET
  };

  // Same query as client-side service
  const query = `
    {
      getOfferList(categoryId: 0, page: 1, size: 50) {
        productName
        offerPrice
        originalPrice
        discount
        image
        offerUrl
      }
    }
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Shopee API responded with status: ${response.status}`);
    }

    const json = await response.json();
    
    if (json.errors) {
      console.error("❌ Shopee GraphQL Errors:", json.errors);
      return [];
    }

    const rawList = json.data?.getOfferList || [];
    
    return rawList.map((item: any, index: number) => ({
      // Generates a pseudo-ID if none exists
      id: `shp_${index}_${Date.now()}`,
      titulo: item.productName || 'Oferta Shopee',
      precoPromocional: parseFloat(item.offerPrice) || 0,
      precoOriginal: parseFloat(item.originalPrice) || 0,
      desconto: item.discount || '0%',
      imagem: item.image || '',
      linkAfiliado: item.offerUrl || ''
    }));

  } catch (error) {
    console.error("❌ Network Error fetching Shopee:", error);
    return [];
  }
}

/**
 * 2. Filter Promotions
 * Applies rules: Discount > 30%
 */
function filterPromotions(products: ShopeeProduct[]): ShopeeProduct[] {
  return products.filter(p => {
    // Parse discount string (e.g. "40%" -> 40)
    const discountValue = parseFloat(p.desconto.replace('%', ''));
    
    // Rule: Must have at least 30% discount
    const isGoodDiscount = !isNaN(discountValue) && discountValue >= 30;
    
    // Optional Rule: Price must be valid
    const isValidPrice = p.precoPromocional > 0;

    return isGoodDiscount && isValidPrice;
  });
}

/**
 * 3. Save Promotions (Mock DB)
 * Since Serverless functions can't access localStorage, we mock this.
 * In production, replace with: await sql`INSERT INTO promotions ...`
 */
async function savePromotions(products: ShopeeProduct[]) {
  if (products.length === 0) return;
  console.log(`💾 Persisting ${products.length} offers to database... (Mocked)`);
  // TODO: Connect to Postgres/MongoDB here
}

/**
 * 4. Fetch Active Groups
 * Returns list of groups to receive messages.
 */
async function fetchActiveGroups(): Promise<WhatsAppGroup[]> {
  // In production, fetch from DB: await db.groups.find({ status: 'active' })
  // Here we assume 1 demo group or read from ENV
  const groups: WhatsAppGroup[] = [];

  if (process.env.WHATSAPP_GROUP_ID) {
    groups.push({
      id: 'grp_env_1',
      name: 'Grupo Promoções (Env)',
      whatsappId: process.env.WHATSAPP_GROUP_ID
    });
  } else {
    // Fallback for testing logic flow
    groups.push({
      id: 'grp_demo_1',
      name: 'Grupo Demo',
      whatsappId: '120363025225@g.us'
    });
  }

  return groups;
}

/**
 * 5. Fetch Message Template
 * Retrieves the user configured template.
 */
async function fetchMessageTemplate(): Promise<string> {
  // Fallback template (same as db.ts default)
  return `🔥 A SHÓ TÁ DEMAISSSS 😭🔥

🎁 {{titulo}}

⚠️ De: R$ {{precoOriginal}}
🔥 Por: R$ {{preco}}

🛒 Compre aqui:
{{link}}

🎫 Cupons: https://shopee.com.br/m/cupom

*Promoção por tempo limitado.*`;
}

/**
 * 6. Build Message
 * Replaces placeholders with real product data.
 */
function buildMessageFromTemplate(template: string, product: ShopeeProduct): string {
  let msg = template;
  
  const formatMoney = (val: number) => 
    val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  msg = msg.replace(/{{titulo}}/g, product.titulo);
  msg = msg.replace(/{{preco}}/g, formatMoney(product.precoPromocional));
  msg = msg.replace(/{{precoOriginal}}/g, formatMoney(product.precoOriginal));
  msg = msg.replace(/{{desconto}}/g, product.desconto);
  msg = msg.replace(/{{link}}/g, product.linkAfiliado);
  
  return msg;
}

/**
 * 7. Send to WhatsApp Bot
 * Dispatches the message via HTTP request to the bot service.
 */
async function sendToWhatsAppBot(group: WhatsAppGroup, message: string, product: ShopeeProduct) {
  // If no bot URL configured, just log
  if (CONFIG.BOT_URL.includes('httpbin')) {
    console.log(`[SIMULATION] Sending to ${group.name}: ${product.titulo.substring(0, 20)}...`);
    return { success: true, simulated: true };
  }

  try {
    const payload = {
      groupId: group.whatsappId,
      message: message,
      imageUrl: product.imagem
    };

    const res = await fetch(CONFIG.BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Bot API error: ${res.status}`);
    
    return { success: true };

  } catch (error: any) {
    console.error(`❌ Failed to send to ${group.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

// --- Main Handler (The "Controller") ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log: string[] = [];
  const errors: string[] = [];
  let sentCount = 0;

  try {
    console.log("🚀 Starting runShopeeCollector...");
    
    // a) Fetch
    const allProducts = await fetchShopeePromotions();
    log.push(`Found ${allProducts.length} products on Shopee.`);

    // b) Filter
    const filteredProducts = filterPromotions(allProducts);
    log.push(`Filtered down to ${filteredProducts.length} best offers (>30% OFF).`);

    // c) Save
    await savePromotions(filteredProducts);

    // d) Get Groups
    const groups = await fetchActiveGroups();
    log.push(`Targeting ${groups.length} active groups.`);

    // e) Get Template
    const template = await fetchMessageTemplate();

    // f) & g) Generate & Send
    // Limit to top 3 products per run to avoid spamming while testing
    const productsToSend = filteredProducts.slice(0, 3);
    
    for (const product of productsToSend) {
      const message = buildMessageFromTemplate(template, product);
      
      for (const group of groups) {
        const result = await sendToWhatsAppBot(group, message, product);
        if (result.success) sentCount++;
        else errors.push(`Failed to send ${product.id} to ${group.name}`);
      }
    }

    const responseData: ExecutionResult = {
      ok: true,
      totalFound: allProducts.length,
      totalFiltered: filteredProducts.length,
      messagesSent: sentCount,
      errors,
      timestamp: new Date().toISOString()
    };

    console.log("✅ Collector finished.", responseData);
    return res.status(200).json(responseData);

  } catch (error: any) {
    console.error("🔥 Critical Error in Collector:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Unknown server error',
      timestamp: new Date().toISOString()
    });
  }
}
