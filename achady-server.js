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
  groups: [], // { id, name, link, active, chatId? }
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
      // Timeout de 10s para evitar travar o job
      const { data } = await axios.post(this.endpoint, payloadString, { headers, timeout: 10000 });
      
      if (data.errors) {
        const errorMsg = data.errors.map(e => e.message).join(', ');
        throw new Error(`Shopee GraphQL Error: ${errorMsg}`);
      }
      return data.data;
    } catch (error) {
      if (error.response) {
        // Tratamento de erros comuns
        if (error.response.data && error.response.data.errors) {
             throw new Error(`Shopee API Error: ${JSON.stringify(error.response.data.errors)}`);
        }
        throw new Error(`Shopee API Error (${error.response.status}): ${error.message}`);
      }
      throw error;
    }
  }

  async searchOffers(keyword, limit = 10) {
    // sortType 5 = COMMISSION_RATE_DESC (High commission first)
    // sortType 2 = POPULARITY
    const query = `
      query($keyword: String, $limit: Int, $sortType: Int) {
        productOfferV2(keyword: $keyword, limit: $limit, sortType: $sortType) {
          nodes {
            itemId
            name
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
    // We fetch a bit more (10) to have candidates for deduplication logic
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
  
  // Se preço original não vem da API, simulamos algo ou deixamos vazio
  // A API V2 nem sempre retorna originalPrice
  const originalPrice = node.priceMax ? `R$ ${(node.priceMax * 1.2).toFixed(2)}` : ''; 

  return {
    title: node.name,
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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
    client.initialize();
    clientInitialized = true;
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
    console.log('[JOB] Nenhum grupo ativo configurado.');
    return;
  }

  const shopee = new ShopeeClient(db.shopeeConfig.appId, db.shopeeConfig.secret);
  
  // Lista de keywords para rotacionar
  const keywords = db.automationConfig.keywords || ['oferta'];
  
  // Strategy: 1 offer per group per run
  for (const group of activeGroups) {
    try {
      // Pick a random keyword for variety
      const keyword = keywords[Math.floor(Math.random() * keywords.length)];
      console.log(`[JOB] Grupo "${group.name}": buscando por "${keyword}"...`);

      // Search candidates
      const candidates = await shopee.searchOffers(keyword, 20);
      
      // DEDUPLICATION: Filter out items sent in the last 72h
      const sentHistory = db.sentOffers[group.id] || [];
      const sentIds = new Set(sentHistory.map(h => String(h.itemId)));
      
      const newOffers = candidates.filter(node => !sentIds.has(String(node.itemId)));

      if (newOffers.length === 0) {
        console.log(`[JOB] Grupo "${group.name}": Nenhuma oferta inédita encontrada para "${keyword}".`);
        continue;
      }

      // Pick the best one (first one is best ranked by commission due to sortType=5)
      const selectedNode = newOffers[0];
      
      // Generate Short Link
      let finalLink = selectedNode.offerLink;
      try {
        const short = await shopee.generateShortLink(selectedNode.offerLink);
        if (short) finalLink = short;
      } catch (err) {
        console.error('[JOB] Erro ao gerar shortlink (usando original):', err.message);
      }

      // Render
      const offerData = formatOfferData(selectedNode, finalLink);
      const messageBody = renderMessage(db.template, offerData);
      
      // Send logic
      if (whatsappStatus === 'ready') {
          // Download Image
          let media = null;
          if (offerData.imageUrl) {
             try {
               const imgRes = await axios.get(offerData.imageUrl, { responseType: 'arraybuffer', timeout: 5000 });
               const b64 = Buffer.from(imgRes.data, 'binary').toString('base64');
               media = new MessageMedia('image/jpeg', b64, 'oferta.jpg');
             } catch(err) {
               console.warn('[JOB] Falha ao baixar imagem, enviando apenas texto.');
             }
          }

          if (media) {
             await client.sendMessage(group.chatId, media, { caption: messageBody });
          } else {
             await client.sendMessage(group.chatId, messageBody);
          }
          
          console.log(`[JOB] ENVIADO para ${group.name}: ${offerData.title}`);

          // Update DB (Logs + History)
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

          // Wait a bit between groups to act human
          await new Promise(r => setTimeout(r, 2000));

      } else {
         console.warn('[JOB] WhatsApp desconectado. Pulando envio.');
         break; // If whatsapp is down, stop processing groups
      }

    } catch (e) {
      console.error(`[JOB] Erro ao processar grupo ${group.name}:`, e.message);
      db.logs.push({
         id: Date.now().toString(),
         when: new Date().toISOString(),
         group: group.name,
         productTitle: 'Erro de Processamento',
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

// --- WhatsApp Routes ---
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

// --- Groups Routes ---
router.get('/groups', (req, res) => res.json(db.groups));

router.post('/groups', (req, res) => {
  const { link, name } = req.body;
  if (!link) return res.status(400).json({ error: 'Link obrigatório' });
  const newGroup = {
    id: Date.now().toString(),
    link,
    name: name || 'Novo Grupo',
    active: true,
    chatId: null
  };
  db.groups.push(newGroup);
  saveDb();
  res.json(newGroup);
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
    // Regex para pegar código do convite
    const codeMatch = group.link.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{20,})/);
    if (!codeMatch) throw new Error('Link inválido. Use formato https://chat.whatsapp.com/...');
    
    const inviteCode = codeMatch[1];
    
    // Tenta entrar
    let chatId;
    try {
        const result = await client.acceptInvite(inviteCode);
        // O result pode ser string (chatId) ou objeto dependendo da versão da lib
        chatId = typeof result === 'string' ? result : (result?.id?._serialized || result?._serialized);
    } catch (e) {
        if (e.message?.includes('already')) {
            // Se ja esta no grupo, tentamos descobrir o ID via inviteInfo
             const metadata = await client.getInviteInfo(inviteCode);
             if (metadata?.id) chatId = metadata.id._serialized;
        } else {
            throw e;
        }
    }

    if (!chatId) throw new Error('Bot entrou mas não foi possível obter ID do grupo.');

    group.chatId = chatId;
    // Tenta atualizar nome
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

// --- Automation & Config Routes ---
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
  // Roda em background para nao travar request
  processAutomationRun().catch(e => console.error(e));
  res.json({ ok: true });
});

// --- Shopee Config & Test ---
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
    const offers = await shopee.searchOffers('test', 1);
    res.json({ 
        ok: true, 
        message: 'Conexão bem sucedida!', 
        count: offers.length,
        // Retorna sample para debug visual
        sample: offers[0] ? { name: offers[0].name, price: offers[0].price } : null
    });
  } catch (e) {
    console.error('Shopee Test Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- Template & Logs ---
router.get('/template', (req, res) => res.json({ template: db.template }));
router.post('/template', (req, res) => {
  db.template = req.body.template;
  saveDb();
  res.json({ ok: true });
});

router.get('/logs', (req, res) => {
    // Retorna logs mais recentes primeiro
    res.json([...db.logs].reverse());
});

router.post('/test/send', async (req, res) => {
  processAutomationRun().catch(e => console.error(e));
  res.json({ ok: true });
});


// Init
app.use('/api', router);

// Fallback para rotas raiz (retrocompatibilidade)
app.use('/', router);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ACHADY Server rodando na porta ${PORT}`);
  ensureClientInitialized();
  startScheduler();
});