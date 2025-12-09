require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// SECURITY: Trust Proxy para funcionar atrás do Nginx (Rate Limit e Logs corretos)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// SECURITY: Rate Limiter para rotas sensíveis
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // limite de 50 requisições por IP
  message: { error: 'Muitas tentativas. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'achady_db.json');

// =======================
// ENCRYPTION HELPERS (AES-256-GCM)
// =======================
const ALGORITHM = 'aes-256-gcm';

function getMasterKey() {
  if (!process.env.MASTER_KEY) return null;
  // Garante chave de 32 bytes via scrypt para robustez
  return crypto.scryptSync(process.env.MASTER_KEY, 'achady_salt', 32);
}

function encrypt(text) {
  const key = getMasterKey();
  if (!key) throw new Error('MASTER_KEY não configurada no servidor (.env)');
  
  const iv = crypto.randomBytes(12); // GCM recomenda 12 bytes IV
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Formato: enc:IV:AuthTag:EncryptedContent
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(text) {
  // Retrocompatibilidade: Se não começar com 'enc:', assume texto plano (legado)
  if (!text || !text.startsWith('enc:')) return text;

  const key = getMasterKey();
  if (!key) {
    console.error('[SECURITY] Tentativa de descriptografar sem MASTER_KEY.');
    return null; 
  }

  try {
    const parts = text.split(':');
    if (parts.length !== 4) throw new Error('Formato inválido');
    
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encryptedText = parts[3];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('[SECURITY] Falha na descriptografia:', e.message);
    return null; // Falha segura
  }
}

// =======================
// PERSISTENCE LAYER (JSON DB)
// =======================

// Default DB State
const defaultState = {
  groups: [], // { id, name, link, active, chatId, keywords: [], negativeKeywords: [] }
  logs: [],   // { id, when, group, title, price, status, error? }
  template: `🔥 Oferta Shopee! (por tempo limitado)

🛍️ {{titulo}}

💸 De: ~{{precoOriginal}}~
🔥 Agora: {{preco}}  ({{desconto}} OFF)

🛒 Link: {{link}}

*O preço e a disponibilidade do produto podem variar, pois as promoções são por tempo limitado.`,
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

    // Fallback if template is empty in DB
    if (!db.template || db.template.trim() === '') {
      db.template = defaultState.template;
    }
  } catch (e) {
    console.error('[DB] Erro ao carregar banco de dados, usando padrao:', e.message);
  }
}

// Save DB Helper
function saveDb() {
  try {
    // Prune logs (keep last 200)
    if (db.logs.length > 200) db.logs = db.logs.slice(-200);
    
    // Prune sentOffers (older than 72h)
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
    
    const payloadString = JSON.stringify(body);
    const signature = this.generateSignature(payloadString, timestamp);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `SHA256 Credential=${this.appId}, Timestamp=${timestamp}, Signature=${signature}`
    };

    try {
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
    // CORREÇÃO C: Query usando productName (não name) explicitamente
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

function formatOfferData(node, shortLink) {
  let priceDisplay = node.price ? `R$ ${node.price}` : '';
  
  if (node.priceMin && node.priceMax && node.priceMin !== node.priceMax) {
      priceDisplay = `R$ ${node.priceMin} - R$ ${node.priceMax}`;
  } else if (node.priceMin) {
      priceDisplay = `R$ ${node.priceMin}`;
  }
  
  const originalPrice = node.priceMax ? `R$ ${(Number(node.priceMax) * 1.2).toFixed(2)}` : ''; 

  // Validação para evitar "fake offer" ou undefined
  const title = node.productName || 'Oferta Shopee'; 

  return {
    title: title,
    price: priceDisplay,
    precoOriginal: originalPrice,
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
    // CORREÇÃO D: Args robustos para VPS Linux (Hostinger/DigitalOcean)
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-software-rasterizer'
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
// CORREÇÃO B: Lock para evitar dupla execução do Scheduler
let isJobRunning = false;

function renderMessage(template, offer) {
  return template
    .replace(/{{\s*titulo\s*}}/gi, offer.title || '')
    .replace(/{{\s*preco\s*}}/gi, offer.price || '')
    .replace(/{{\s*precoOriginal\s*}}/gi, offer.originalPrice || '')
    .replace(/{{\s*desconto\s*}}/gi, offer.discount || '')
    .replace(/{{\s*link\s*}}/gi, offer.link || '');
}

async function processAutomationRun() {
  // CORREÇÃO B: Lock check
  if (isJobRunning) {
      console.log(`[JOB ${new Date().toLocaleTimeString()}] Skip: Job anterior ainda rodando.`);
      return;
  }
  isJobRunning = true;

  try {
    console.log(`[JOB ${new Date().toLocaleTimeString()}] Iniciando rodada de automação...`);
    
    if (!db.shopeeConfig.appId || !db.shopeeConfig.secret) {
      console.log('[JOB] Abortando: Credenciais Shopee não configuradas.');
      return;
    }

    // Apenas grupos ativos que JÁ TEM chatId
    const activeGroups = db.groups.filter(g => g.active);
    
    if (activeGroups.length === 0) {
      console.log('[JOB] Nenhum grupo ativo configurado.');
      return;
    }

    // SECURITY: Descriptografar secret apenas em tempo de execução
    const plainSecret = decrypt(db.shopeeConfig.secret);
    if (!plainSecret) {
        console.error('[JOB] Falha ao descriptografar Secret Shopee. Verifique MASTER_KEY.');
        return;
    }

    const shopee = new ShopeeClient(db.shopeeConfig.appId, plainSecret);
    const globalKeywords = db.automationConfig.keywords || ['oferta'];
    
    for (const group of activeGroups) {
      // CORREÇÃO A: Guard clause para chatId ausente
      if (!group.chatId) {
          console.warn(`[JOB] Grupo "${group.name}" está ativo mas sem Chat ID (bot não conectado). Pulando.`);
          continue;
      }

      try {
        let pool = group.keywords && group.keywords.length > 0 ? group.keywords : globalKeywords;
        pool = pool.filter(k => k && k.trim().length > 0);
        if(pool.length === 0) pool = ['promoção'];

        const keyword = pool[Math.floor(Math.random() * pool.length)];
        console.log(`[JOB] Grupo "${group.name}": buscando por "${keyword}"...`);

        // Busca API
        const candidates = await shopee.searchOffers(keyword, 30);
        
        // Dedupe logic
        const sentHistory = db.sentOffers[group.id] || [];
        const sentIds = new Set(sentHistory.map(h => String(h.itemId)));
        const negativeKeywords = (group.negativeKeywords || []).map(k => k.toLowerCase());
        
        const newOffers = candidates.filter(node => {
          if (sentIds.has(String(node.itemId))) return false;
          
          const title = (node.productName || node.name || '').toLowerCase();
          // CORREÇÃO D: Evitar ofertas sem título (falha de API)
          if (!title || title.trim() === '') return false;

          const isBlacklisted = negativeKeywords.some(badWord => title.includes(badWord));
          if (isBlacklisted) return false;

          return true;
        });

        if (newOffers.length === 0) {
          console.log(`[JOB] Grupo "${group.name}": Sem ofertas novas para "${keyword}".`);
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
        
        // Verificação final antes do envio
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
            // Pequeno delay entre grupos para não floodar
            await new Promise(r => setTimeout(r, 2000));

        } else {
           console.warn('[JOB] WhatsApp desconectado/instável. Pulando envio.');
           break; 
        }

      } catch (e) {
        console.error(`[JOB] Erro no grupo ${group.name}:`, e.message);
        // Não salva log de erro para coisas triviais para não poluir
      }
    }
  } catch (err) {
      console.error('[JOB] Erro fatal no worker:', err);
  } finally {
      // CORREÇÃO B: Release lock
      isJobRunning = false;
  }
}

function startScheduler() {
  if (automationTimer) {
      clearInterval(automationTimer);
      automationTimer = null;
  }
  
  if (!db.automationConfig.active) {
    console.log('[SCHEDULER] Automação pausada.');
    return;
  }

  const minutes = Math.max(1, Number(db.automationConfig.intervalMinutes) || 60);
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
    let chatId = null;
    
    try {
        const result = await client.acceptInvite(inviteCode);
        
        // CORREÇÃO A: Guard clause para erro de _serialized
        if (!result) {
            console.warn('[JOIN] Accept invite retornou vazio. Tentando pegar ID via metadata...');
        } else {
             // Tenta extrair ID de várias formas possíveis que a lib retorna
             chatId = typeof result === 'string' ? result : (result?.id?._serialized || result?._serialized || result?.id);
        }

        if (!chatId) {
             // Fallback: tentar pegar ID via getInviteInfo
             const metadata = await client.getInviteInfo(inviteCode);
             if (metadata && metadata.id) {
                 chatId = metadata.id._serialized;
             }
        }
    } catch (e) {
        // Se erro for "already in group", tentamos pegar o ID igual
        if (e.message?.includes('already')) {
             try {
                const metadata = await client.getInviteInfo(inviteCode);
                if (metadata?.id) chatId = metadata.id._serialized;
             } catch(errMeta) {
                 console.error('Erro ao obter info do convite (already):', errMeta);
             }
        } else {
            throw e;
        }
    }

    if (!chatId) throw new Error('Não foi possível obter o Chat ID do grupo. Tente remover e adicionar novamente.');

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
  // Dispara sem await para não bloquear a resposta, mas o lock isJobRunning cuidará da concorrência
  processAutomationRun().catch(e => console.error(e));
  res.json({ ok: true });
});

router.get('/shopee/config', (req, res) => {
  const hasCreds = !!(db.shopeeConfig.appId && db.shopeeConfig.secret);
  const masked = hasCreds ? `${db.shopeeConfig.appId.slice(0,3)}****` : null;
  // SECURITY: Nunca retorne o secret, nem criptografado.
  res.json({ hasCredentials: hasCreds, appIdMasked: masked });
});

// SECURITY: Rate limit aplicado apenas nesta rota de configuração
router.post('/shopee/config', sensitiveLimiter, (req, res) => {
  const { appId, secret } = req.body;
  if (!appId || !secret) return res.status(400).json({ error: 'Dados inválidos' });
  
  // Validation
  if (String(appId).length < 5 || String(secret).length < 20) {
      return res.status(400).json({ error: 'Formato de AppID ou Secret inválido.' });
  }

  try {
    // SECURITY: Encrypt secret before saving
    const encryptedSecret = encrypt(secret.trim());
    db.shopeeConfig = { appId: appId.trim(), secret: encryptedSecret };
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    console.error('[CONFIG] Erro de criptografia:', e.message);
    res.status(500).json({ error: 'Erro ao salvar credenciais com segurança. Verifique MASTER_KEY no servidor.' });
  }
});

// SECURITY: Rate limit aplicado também na rota de teste
router.post('/shopee/test', sensitiveLimiter, async (req, res) => {
  if (!db.shopeeConfig.appId || !db.shopeeConfig.secret) {
    return res.status(400).json({ error: 'Credenciais não configuradas' });
  }
  
  try {
    // SECURITY: Decrypt
    const plainSecret = decrypt(db.shopeeConfig.secret);
    if (!plainSecret) throw new Error('Falha ao descriptografar credenciais.');

    const shopee = new ShopeeClient(db.shopeeConfig.appId, plainSecret);
    // CORREÇÃO C: Teste usa a mesma lógica segura do worker
    const offers = await shopee.searchOffers('teste', 1);
    
    if (offers.length === 0) {
        return res.json({ ok: true, message: 'Conexão OK, mas nenhuma oferta retornada para "teste".', count: 0 });
    }

    const item = offers[0];
    const safeItem = {
        name: item.productName || item.name || 'Sem nome', // Garante compatibilidade
        price: item.price
    };

    res.json({ 
        ok: true, 
        message: 'Conexão bem sucedida!', 
        count: offers.length,
        sample: safeItem
    });
  } catch (e) {
    // SECURITY: Não logar o secret no erro
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