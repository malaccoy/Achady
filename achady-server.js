require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'achady_db.json');

// =======================
// PERSISTENCE LAYER (JSON DB)
// =======================

// Default DB State
const defaultState = {
  groups: [], // { id, name, link, active, chatId, keywords: [], negativeKeywords: [] }
  logs: [],   // { id, when, group, title, price, status, error? }
  template: `🔥 Oferta Shopee!\n\n{{titulo}}\n\n💰 De {{precoOriginal}} por apenas {{preco}}\n⚡ {{desconto}} OFF\n\n🛒 Compre aqui: {{link}}`,
  automationConfig: {
    active: false,
    intervalMinutes: 60,
    keywords: ['promoção', 'casa', 'cozinha', 'celular', 'beleza', 'moda', 'tech']
  },
  shopeeConfig: {
    appId: process.env.SHOPEE_APP_ID || '',
    secret: process.env.SHOPEE_APP_SECRET || ''
  },
  sentOffers: {} // { groupId: [ { itemId, timestamp, keyword } ] }
};

// Ensure Data Directory Exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load DB
let db = { ...defaultState };
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const loaded = JSON.parse(raw);
    db = { ...defaultState, ...loaded };
    
    // Merge deeper objects carefully
    db.automationConfig = { ...defaultState.automationConfig, ...loaded.automationConfig };
    db.shopeeConfig = { ...defaultState.shopeeConfig, ...loaded.shopeeConfig };
    db.sentOffers = { ...defaultState.sentOffers, ...loaded.sentOffers };
  } catch (e) {
    console.error('[DB] Erro ao carregar banco de dados, usando padrao:', e.message);
  }
}

// Save DB Helper
function saveDb() {
  try {
    // Prune logs (keep last 200)
    if (db.logs.length > 200) db.logs = db.logs.slice(-200);
    
    // Prune sentOffers (older than 72h) to keep DB size small but allow re-send after 3 days
    const now = Date.now();
    const THREE_DAYS = 72 * 60 * 60 * 1000;
    
    for (const groupId in db.sentOffers) {
      if (Array.isArray(db.sentOffers[groupId])) {
        db.sentOffers[groupId] = db.sentOffers[groupId].filter(item => (now - item.timestamp) < THREE_DAYS);
      }
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('[DB] Erro ao salvar banco:', e.message);
  }
}

// =======================
// SHOPEE API CLIENT
// =======================
class ShopeeClient {
  constructor(appId, secret) {
    this.appId = appId;
    this.secret = secret;
    this.endpoint = 'https://open-api.affiliate.shopee.com.br/graphql';
  }

  // Assinatura correta: SHA256(AppId + Timestamp + Payload + Secret)
  generateSignature(payloadString, timestamp) {
    const factor = this.appId + timestamp + payloadString + this.secret;
    return crypto.createHash('sha256').update(factor).digest('hex');
  }

  async request(query, variables = {}) {
    if (!this.appId || !this.secret) {
      throw new Error('Credenciais da Shopee não configuradas.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const body = { query, variables };
    
    // IMPORTANTE: Stringify APENAS UMA VEZ para garantir consistência entre assinatura e envio
    const payloadString = JSON.stringify(body);
    const signature = this.generateSignature(payloadString, timestamp);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `SHA256 Credential=${this.appId}, Timestamp=${timestamp}, Signature=${signature}`
    };

    try {
      // Timeout de 15s
      const { data } = await axios.post(this.endpoint, payloadString, { headers, timeout: 15000 });
      
      if (data.errors) {
        const errorMsg = data.errors.map(e => e.message).join(', ');
        throw new Error(`Shopee GraphQL Error: ${errorMsg}`);
      }
      return data.data;
    } catch (error) {
      if (error.response) {
        const errDetail = error.response.data && error.response.data.errors 
            ? JSON.stringify(error.response.data.errors) 
            : error.message;
        throw new Error(`Shopee API Error (${error.response.status}): ${errDetail}`);
      }
      throw error;
    }
  }

  async searchOffers(keyword, limit = 10) {
    // sortType 5 = COMMISSION_RATE_DESC
    // IMPORTANTE: Campo correto é productName, não name
    const query = `
      query($keyword: String, $limit: Int, $sortType: Int) {
        productOfferV2(keyword: $keyword, limit: $limit, sortType: $sortType) {
          nodes {
            itemId
            productName
            imageUrl
            price
            priceMin
            priceMax
            offerLink
            commissionRate
            sales
          }
        }
      }
    `;
    const result = await this.request(query, { keyword, limit, sortType: 5 });
    return result?.productOfferV2?.nodes || [];
  }

  async generateShortLink(originUrl) {
    const query = `
      mutation($originUrl: String!) {
        generateShortLink(input: { originUrl: $originUrl }) {
          shortLink
        }
      }
    `;
    const result = await this.request(query, { originUrl });
    return result?.generateShortLink?.shortLink;
  }
}

// Helper para formatar oferta para o template
function formatOfferData(node, shortLink) {
  let priceDisplay = node.price ? `R$ ${node.price}` : '';
  
  // Lógica de range de preço
  if (node.priceMin && node.priceMax && node.priceMin !== node.priceMax) {
      priceDisplay = `R$ ${node.priceMin} - R$ ${node.priceMax}`;
  } else if (node.priceMin) {
      priceDisplay = `R$ ${node.priceMin}`;
  }
  
  const originalPrice = node.priceMax ? `R$ ${(Number(node.priceMax) * 1.2).toFixed(2)}` : ''; 

  return {
    title: node.productName || node.name || 'Produto Shopee', // Fallback para productName
    price: priceDisplay,
    precoOriginal: originalPrice, // compatibilidade com template antigo
    originalPrice: originalPrice,
    discount: node.commissionRate ? `Até ${Math.floor(Number(node.commissionRate) * 100)}% Cashback` : 'Oferta Top',
    link: shortLink || node.offerLink,
    imageUrl: node.imageUrl
  };
}

// =======================
// WHATSAPP CLIENT
// =======================
let whatsappStatus = 'disconnected'; 
let lastQrString = null;
let clientInitialized = false;

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'achady_persist', dataPath: DATA_DIR }),
  puppeteer: {
    headless: true,
    // Argumentos críticos para rodar em VPS/Docker
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
    ],
  },
});

client.on('qr', (qr) => {
  whatsappStatus = 'qr';
  lastQrString = qr;
  console.log('[WHATSAPP] Novo QR Code gerado.');
});

client.on('ready', () => {
  whatsappStatus = 'ready';
  lastQrString = null;
  console.log('[WHATSAPP] Cliente conectado e pronto.');
});

client.on('authenticated', () => {
  console.log('[WHATSAPP] Autenticado com sucesso.');
});

client.on('auth_failure', (msg) => {
  whatsappStatus = 'auth_failure';
  console.error('[WHATSAPP] Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  whatsappStatus = 'disconnected';
  console.log('[WHATSAPP] Desconectado:', reason);
});

function ensureClientInitialized() {
  if (!clientInitialized) {
    console.log('[WHATSAPP] Inicializando cliente...');
    try {
        client.initialize().catch(err => {
            console.error('[WHATSAPP] Erro fatal na inicialização do Puppeteer:', err.message);
            console.error('[DICA] Execute no terminal: sudo apt-get update && sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libnss3 libgbm1');
        });
        clientInitialized = true;
    } catch (e) {
        console.error('[WHATSAPP] Erro síncrono init:', e);
    }
  }
}

// =======================
// AUTOMATION CORE
// =======================
let automationTimer = null;

function renderMessage(template, offer) {
  return template
    .replace(/{{\s*titulo\s*}}/gi, offer.title || '')
    .replace(/{{\s*preco\s*}}/gi, offer.price || '')
    .replace(/{{\s*precoOriginal\s*}}/gi, offer.originalPrice || '')
    .replace(/{{\s*desconto\s*}}/gi, offer.discount || '')
    .replace(/{{\s*link\s*}}/gi, offer.link || '');
}

async function processAutomationRun() {
  console.log(`[JOB ${new Date().toLocaleTimeString()}] Iniciando rodada de automação...`);
  
  if (!db.shopeeConfig.appId || !db.shopeeConfig.secret) {
    console.log('[JOB] Abortando: Credenciais Shopee não configuradas.');
    return;
  }

  const activeGroups = db.groups.filter(g => g.active && g.chatId);
  if (activeGroups.length === 0) {
    console.log('[JOB] Nenhum grupo ativo configurado ou bot não entrou nos grupos.');
    return;
  }

  const shopee = new ShopeeClient(db.shopeeConfig.appId, db.shopeeConfig.secret);
  // Default Global Keywords if group specific ones are missing
  const globalKeywords = db.automationConfig.keywords || ['oferta'];
  
  for (const group of activeGroups) {
    try {
      // 1. Determine Keyword
      let pool = group.keywords && group.keywords.length > 0 ? group.keywords : globalKeywords;
      // Filter out empty strings
      pool = pool.filter(k => k && k.trim().length > 0);
      if(pool.length === 0) pool = ['promoção']; // Ultimate fallback

      const keyword = pool[Math.floor(Math.random() * pool.length)];
      console.log(`[JOB] Grupo "${group.name}": buscando por "${keyword}"...`);

      const candidates = await shopee.searchOffers(keyword, 30); // Search 30 to have room for filtering
      
      const sentHistory = db.sentOffers[group.id] || [];
      const sentIds = new Set(sentHistory.map(h => String(h.itemId)));
      
      // 2. Filter (Dedupe AND Blacklist)
      const negativeKeywords = (group.negativeKeywords || []).map(k => k.toLowerCase());
      
      const newOffers = candidates.filter(node => {
        // Check Dedupe
        if (sentIds.has(String(node.itemId))) return false;
        
        // Check Blacklist
        const title = (node.productName || node.name || '').toLowerCase();
        const isBlacklisted = negativeKeywords.some(badWord => title.includes(badWord));
        
        if (isBlacklisted) {
           console.log(`[JOB] Filtrado (Blacklist): "${title}" contém "${negativeKeywords.find(k => title.includes(k))}"`);
           return false;
        }

        return true;
      });

      if (newOffers.length === 0) {
        console.log(`[JOB] Grupo "${group.name}": Nenhuma oferta válida (ou não enviada) encontrada para "${keyword}".`);
        continue;
      }

      const selectedNode = newOffers[0];
      
      let finalLink = selectedNode.offerLink;
      try {
        const short = await shopee.generateShortLink(selectedNode.offerLink);
        if (short) finalLink = short;
      } catch (err) {
        console.error('[JOB] Erro shortlink:', err.message);
      }

      const offerData = formatOfferData(selectedNode, finalLink);
      const messageBody = renderMessage(db.template, offerData);
      
      if (whatsappStatus === 'ready') {
          let media = null;
          if (offerData.imageUrl) {
             try {
               const imgRes = await axios.get(offerData.imageUrl, { responseType: 'arraybuffer', timeout: 5000 });
               const b64 = Buffer.from(imgRes.data, 'binary').toString('base64');
               media = new MessageMedia('image/jpeg', b64, 'oferta.jpg');
             } catch(err) {
               console.warn('[JOB] Falha imagem:', err.message);
             }
          }

          if (media) {
             await client.sendMessage(group.chatId, media, { caption: messageBody });
          } else {
             await client.sendMessage(group.chatId, messageBody);
          }
          
          console.log(`[JOB] ENVIADO para ${group.name} (${offerData.title})`);

          db.logs.push({
             id: Date.now().toString(),
             when: new Date().toISOString(),
             group: group.name,
             productTitle: offerData.title,
             price: offerData.price,
             status: 'SENT'
          });

          if (!db.sentOffers[group.id]) db.sentOffers[group.id] = [];
          db.sentOffers[group.id].push({
             itemId: String(selectedNode.itemId),
             timestamp: Date.now(),
             keyword: keyword
          });
          
          saveDb();
          await new Promise(r => setTimeout(r, 2000));

      } else {
         console.warn('[JOB] WhatsApp desconectado. Pulando envio.');
         break;
      }

    } catch (e) {
      console.error(`[JOB] Erro no grupo ${group.name}:`, e.message);
      db.logs.push({
         id: Date.now().toString(),
         when: new Date().toISOString(),
         group: group.name,
         productTitle: 'Erro',
         price: '-',
         status: 'ERROR',
         errorMessage: e.message
      });
      saveDb();
    }
  }
}

function startScheduler() {
  if (automationTimer) clearInterval(automationTimer);
  
  if (!db.automationConfig.active) {
    console.log('[SCHEDULER] Automação pausada.');
    return;
  }

  const minutes = db.automationConfig.intervalMinutes || 60;
  console.log(`[SCHEDULER] Agendado para rodar a cada ${minutes} minutos.`);
  
  automationTimer = setInterval(processAutomationRun, minutes * 60 * 1000);
}


// =======================
// ROUTES
// =======================
const router = express.Router();

router.get('/whatsapp/qr', async (req, res) => {
  ensureClientInitialized();
  if (!lastQrString) return res.json({ status: whatsappStatus, qr: null });
  try {
    const url = await qrcode.toDataURL(lastQrString);
    res.json({ status: whatsappStatus, qr: url });
  } catch (e) {
    res.status(500).json({ error: 'Erro QR' });
  }
});

router.get('/whatsapp/status', (req, res) => {
  res.json({ status: whatsappStatus });
});

router.get('/groups', (req, res) => res.json(db.groups));

router.post('/groups', (req, res) => {
  const { link, name } = req.body;
  if (!link) return res.status(400).json({ error: 'Link obrigatório' });
  const newGroup = {
    id: Date.now().toString(),
    link,
    name: name || 'Novo Grupo',
    active: true,
    chatId: null,
    keywords: [],
    negativeKeywords: []
  };
  db.groups.push(newGroup);
  saveDb();
  res.json(newGroup);
});

router.put('/groups/:id', (req, res) => {
    const group = db.groups.find(g => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });
    
    // Update allowed fields
    if (req.body.name) group.name = req.body.name;
    if (req.body.keywords) group.keywords = req.body.keywords;
    if (req.body.negativeKeywords) group.negativeKeywords = req.body.negativeKeywords;
    
    saveDb();
    res.json(group);
});

router.delete('/groups/:id', (req, res) => {
  db.groups = db.groups.filter(g => g.id !== req.params.id);
  saveDb();
  res.status(204).send();
});

router.patch('/groups/:id/toggle', (req, res) => {
  const g = db.groups.find(g => g.id === req.params.id);
  if (g) {
    g.active = !g.active;
    saveDb();
  }
  res.json(g || {});
});

router.post('/groups/:id/join', async (req, res) => {
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });
  if (whatsappStatus !== 'ready') return res.status(400).json({ error: 'WhatsApp desconectado' });

  try {
    const codeMatch = group.link.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{20,})/);
    if (!codeMatch) throw new Error('Link inválido.');
    
    const inviteCode = codeMatch[1];
    let chatId;
    try {
        const result = await client.acceptInvite(inviteCode);
        // Proteção extra contra result undefined/null
        if (!result) throw new Error('Falha ao entrar: resposta vazia do WhatsApp.');
        
        chatId = typeof result === 'string' ? result : (result?.id?._serialized || result?._serialized);
    } catch (e) {
        if (e.message?.includes('already')) {
             try {
                const metadata = await client.getInviteInfo(inviteCode);
                if (metadata?.id) chatId = metadata.id._serialized;
             } catch(errMeta) {
                 console.error('Erro ao obter info do convite:', errMeta);
             }
        } else {
            throw e;
        }
    }

    if (!chatId) throw new Error('Falha ao obter ID do grupo (ChatId indefinido).');

    group.chatId = chatId;
    try {
        const chat = await client.getChatById(chatId);
        if (chat && chat.name) group.name = chat.name;
    } catch(e) {}
    
    saveDb();
    
    res.json({ ok: true, name: group.name, chatId });
  } catch (e) {
    console.error('Join error:', e);
    res.status(500).json({ error: e.message || 'Erro ao entrar no grupo' });
  }
});

router.get('/automation', (req, res) => res.json(db.automationConfig));

router.patch('/automation/status', (req, res) => {
  db.automationConfig.active = req.body.ativo;
  saveDb();
  startScheduler();
  res.json(db.automationConfig);
});

router.patch('/automation/interval', (req, res) => {
  db.automationConfig.intervalMinutes = Number(req.body.intervalMinutes);
  saveDb();
  startScheduler();
  res.json(db.automationConfig);
});

router.post('/automation/run-once', async (req, res) => {
  processAutomationRun().catch(e => console.error(e));
  res.json({ ok: true });
});

router.get('/shopee/config', (req, res) => {
  const hasCreds = !!(db.shopeeConfig.appId && db.shopeeConfig.secret);
  const masked = hasCreds ? `${db.shopeeConfig.appId.slice(0,3)}****` : null;
  res.json({ hasCredentials: hasCreds, appIdMasked: masked });
});

router.post('/shopee/config', (req, res) => {
  const { appId, secret } = req.body;
  if (!appId || !secret) return res.status(400).json({ error: 'Dados inválidos' });
  db.shopeeConfig = { appId, secret };
  saveDb();
  res.json({ ok: true });
});

router.post('/shopee/test', async (req, res) => {
  if (!db.shopeeConfig.appId || !db.shopeeConfig.secret) {
    return res.status(400).json({ error: 'Credenciais não configuradas' });
  }
  
  try {
    const shopee = new ShopeeClient(db.shopeeConfig.appId, db.shopeeConfig.secret);
    const offers = await shopee.searchOffers('teste', 1);
    res.json({ 
        ok: true, 
        message: 'Conexão bem sucedida!', 
        count: offers.length,
        sample: offers[0] ? { name: offers[0].productName || offers[0].name, price: offers[0].price } : null
    });
  } catch (e) {
    console.error('Shopee Test Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/template', (req, res) => res.json({ template: db.template }));
router.post('/template', (req, res) => {
  db.template = req.body.template;
  saveDb();
  res.json({ ok: true });
});

router.get('/logs', (req, res) => res.json([...db.logs].reverse()));

router.post('/test/send', async (req, res) => {
  processAutomationRun().catch(e => console.error(e));
  res.json({ ok: true });
});

app.use('/api', router);
app.use('/', router);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ACHADY Server rodando na porta ${PORT}`);
  ensureClientInitialized();
  startScheduler();
});