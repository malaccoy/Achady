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
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const { z } = require('zod');

const app = express();
const prisma = new PrismaClient();

// CONFIGURAÇÃO
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://app.achady.com.br';
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// SECURITY
app.set('trust proxy', 1);
app.use(cors({
  origin: true, // Permitir requisições do frontend (ajustar para produção se necessário)
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 tentativas de login/cadastro por 15min
  message: { error: 'Muitas tentativas. Aguarde um pouco.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300 // Uso geral da API
});

// =======================
// CRYPTO HELPERS
// =======================
const ALGORITHM = 'aes-256-gcm';
function getMasterKey() {
  if (!process.env.MASTER_KEY) return null;
  return crypto.scryptSync(process.env.MASTER_KEY, 'achady_salt', 32);
}
function encrypt(text) {
  const key = getMasterKey();
  if (!key) throw new Error('MASTER_KEY não configurada');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `enc:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
}
function decrypt(text) {
  if (!text || !text.startsWith('enc:')) return text;
  try {
    const key = getMasterKey();
    if (!key) return null;
    const parts = text.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(parts[1], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
    let decrypted = decipher.update(parts[3], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) { return null; }
}

// =======================
// EMAIL SERVICE
// =======================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER) {
    console.log('[EMAIL MOCK]', to, subject);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"ACHADY" <noreply@achady.com.br>',
    to, subject, html
  });
}

// =======================
// BOT MANAGER (MULTI-SESSION)
// =======================
class BotManager {
  constructor() {
    this.sessions = new Map(); // userId -> { client, status, qr }
  }

  getSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        client: null,
        status: 'disconnected',
        qr: null,
        initializing: false
      });
    }
    return this.sessions.get(userId);
  }

  async initializeClient(userId) {
    const session = this.getSession(userId);
    if (session.client || session.initializing) return;

    session.initializing = true;
    console.log(`[BOT] Inicializando sessão para User ${userId}...`);

    const client = new Client({
      authStrategy: new LocalAuth({ 
        clientId: userId, 
        dataPath: SESSIONS_DIR 
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
          '--single-process', '--disable-gpu'
        ]
      }
    });

    client.on('qr', (qr) => {
      session.status = 'qr';
      session.qr = qr;
      console.log(`[BOT ${userId}] QR Code gerado.`);
    });

    client.on('ready', () => {
      session.status = 'ready';
      session.qr = null;
      console.log(`[BOT ${userId}] Pronto.`);
    });

    client.on('disconnected', () => {
      session.status = 'disconnected';
      session.qr = null;
      this.sessions.delete(userId); // Limpa da memória ao desconectar
    });

    try {
      await client.initialize();
      session.client = client;
    } catch (e) {
      console.error(`[BOT ${userId}] Erro ao iniciar:`, e.message);
      session.status = 'error';
    } finally {
      session.initializing = false;
    }
  }

  async getClientStatus(userId) {
    const session = this.getSession(userId);
    // Se não estiver rodando, tenta iniciar (Lazy Loading)
    if (!session.client && !session.initializing) {
      this.initializeClient(userId).catch(console.error);
      return { status: 'initializing', qr: null };
    }
    return { status: session.status, qr: session.qr };
  }

  getClient(userId) {
    return this.sessions.get(userId)?.client;
  }
  
  async stopClient(userId) {
      const session = this.sessions.get(userId);
      if(session && session.client) {
          try { await session.client.destroy(); } catch(e) {}
          this.sessions.delete(userId);
      }
      // Remove folder
      const sessionPath = path.join(SESSIONS_DIR, `session-${userId}`);
      if(fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
      }
  }
}

const botManager = new BotManager();

// =======================
// MIDDLEWARE
// =======================
const requireAuth = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Sessão inválida' });
  }
};

// =======================
// AUTH CONTROLLER
// =======================
const AuthRouter = express.Router();

AuthRouter.post('/register', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

  try {
    const { email, password } = schema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email já cadastrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        verificationToken,
        settings: {
            create: {
                template: `🔥 Oferta Shopee! (por tempo limitado)\n\n🛍️ {{titulo}}\n\n💸 De: ~{{precoOriginal}}~\n🔥 Agora: {{preco}}  ({{desconto}} OFF)\n\n🛒 Link: {{link}}\n\n*O preço e a disponibilidade do produto podem variar.`
            }
        }
      }
    });

    const verifyLink = `${APP_BASE_URL}/verify-email?token=${verificationToken}`;
    sendEmail(email, 'Verifique sua conta ACHADY', `<a href="${verifyLink}">Clique aqui para verificar seu email</a>`).catch(console.error);

    res.json({ message: 'Conta criada! Verifique seu email.' });
  } catch (e) {
    res.status(400).json({ error: e.errors ? e.errors[0].message : e.message });
  }
});

AuthRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  });

  // Inicializa bot em background
  botManager.initializeClient(user.id).catch(console.error);

  res.json({ ok: true, user: { email: user.email, isVerified: user.isVerified } });
});

AuthRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

AuthRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ 
    where: { id: req.userId },
    select: { email: true, isVerified: true }
  });
  if(!user) return res.status(401).json({error: 'Usuario nao encontrado'});
  res.json(user);
});

AuthRouter.post('/verify-email', async (req, res) => {
    const { token } = req.body;
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) return res.status(400).json({ error: 'Token inválido' });
    
    await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, verificationToken: null }
    });
    res.json({ ok: true });
});

AuthRouter.delete('/account', requireAuth, async (req, res) => {
    const { password, confirmation } = req.body;
    if (confirmation !== 'EXCLUIR') return res.status(400).json({ error: 'Confirmação incorreta' });
    
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ error: 'Senha incorreta' });
    
    // Cleanup Bot
    await botManager.stopClient(req.userId);
    
    // Cascade delete via Prisma
    await prisma.user.delete({ where: { id: req.userId } });
    
    res.clearCookie('token');
    res.json({ ok: true });
});

// =======================
// SHOPEE & AUTOMATION LOGIC
// =======================
class ShopeeClient {
    constructor(appId, secret) {
        this.appId = appId;
        this.secret = secret;
        this.endpoint = 'https://open-api.affiliate.shopee.com.br/graphql';
    }
    generateSignature(payload, ts) {
        const factor = this.appId + ts + payload + this.secret;
        return crypto.createHash('sha256').update(factor).digest('hex');
    }
    async request(query, variables = {}) {
        const ts = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ query, variables });
        const sig = this.generateSignature(payload, ts);
        
        try {
            const { data } = await axios.post(this.endpoint, payload, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `SHA256 Credential=${this.appId}, Timestamp=${ts}, Signature=${sig}` },
                timeout: 15000
            });
            if (data.errors) throw new Error(data.errors[0].message);
            return data.data;
        } catch (e) { throw new Error(e.message); }
    }
    async searchOffers(keyword) {
        const q = `query($keyword: String, $limit: Int, $sortType: Int) { productOfferV2(keyword: $keyword, limit: $limit, sortType: $sortType) { nodes { itemId productName imageUrl price priceMin priceMax offerLink commissionRate } } }`;
        const res = await this.request(q, { keyword, limit: 20, sortType: 5 });
        return res?.productOfferV2?.nodes || [];
    }
    async generateShortLink(originUrl) {
        const q = `mutation($originUrl: String!) { generateShortLink(input: { originUrl: $originUrl }) { shortLink } }`;
        const res = await this.request(q, { originUrl });
        return res?.generateShortLink?.shortLink;
    }
}

function renderMessage(template, offer) {
    let text = template || '';
    const price = offer.priceMin || offer.price;
    const original = offer.priceMax ? (offer.priceMax * 1.2).toFixed(2) : (price * 1.2).toFixed(2);
    
    return text
        .replace(/{{\s*titulo\s*}}/gi, offer.productName)
        .replace(/{{\s*preco\s*}}/gi, `R$ ${price}`)
        .replace(/{{\s*precoOriginal\s*}}/gi, `R$ ${original}`)
        .replace(/{{\s*desconto\s*}}/gi, offer.commissionRate ? `${Math.floor(offer.commissionRate * 100)}% CB` : 'Oferta')
        .replace(/{{\s*link\s*}}/gi, offer.shortLink || offer.offerLink);
}

// =======================
// SCHEDULER (MULTI-USER)
// =======================
let isJobRunning = false;
async function runAutomation() {
    if (isJobRunning) return;
    isJobRunning = true;
    
    try {
        const users = await prisma.user.findMany({
            where: { settings: { automationActive: true } },
            include: { settings: true, groups: { where: { active: true } } }
        });

        for (const user of users) {
            // Check User Interval logic (simple version: run every tick if active, ideal needs separate timestamp check)
            // For production, check if (now - lastRun > interval)
            
            if (!user.settings.shopeeAppId || !user.settings.shopeeSecret) continue;
            const plainSecret = decrypt(user.settings.shopeeSecret);
            if (!plainSecret) continue;

            const client = botManager.getClient(user.id);
            if (!client) continue; // Bot offline

            const shopee = new ShopeeClient(user.settings.shopeeAppId, plainSecret);
            const globalKeywords = ['promoção', 'oferta', 'achadinho'];

            for (const group of user.groups) {
                if (!group.chatId) continue;
                
                // Dedupe Logic
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const recentOffers = await prisma.sentOffer.findMany({
                    where: { groupId: group.id, sentAt: { gt: oneDayAgo } },
                    select: { itemId: true }
                });
                const sentIds = new Set(recentOffers.map(o => o.itemId));

                // Keyword Logic
                let keywords = group.keywords ? group.keywords.split(',').filter(k=>k) : globalKeywords;
                if(keywords.length === 0) keywords = globalKeywords;
                const keyword = keywords[Math.floor(Math.random() * keywords.length)];

                try {
                    const offers = await shopee.searchOffers(keyword);
                    const validOffers = offers.filter(o => !sentIds.has(String(o.itemId)));
                    
                    if (validOffers.length > 0) {
                        const offer = validOffers[0];
                        const shortLink = await shopee.generateShortLink(offer.offerLink);
                        offer.shortLink = shortLink;
                        
                        const msg = renderMessage(user.settings.template, offer);
                        
                        // Envio WhatsApp
                        if(offer.imageUrl) {
                            const media = await MessageMedia.fromUrl(offer.imageUrl);
                            await client.sendMessage(group.chatId, media, { caption: msg });
                        } else {
                            await client.sendMessage(group.chatId, msg);
                        }

                        // Log & Dedupe
                        await prisma.sentOffer.create({
                            data: { userId: user.id, groupId: group.id, itemId: String(offer.itemId), keyword }
                        });
                        
                        await prisma.log.create({
                            data: { 
                                userId: user.id, groupName: group.name, productTitle: offer.productName,
                                price: String(offer.price), status: 'SENT'
                            }
                        });
                        
                        console.log(`[JOB USER ${user.id}] Enviado para ${group.name}`);
                        await new Promise(r => setTimeout(r, 5000)); // Delay entre grupos
                    }
                } catch (e) {
                    console.error(`[JOB USER ${user.id}] Erro:`, e.message);
                }
            }
        }
    } catch (e) { console.error('Scheduler Error:', e); }
    finally { isJobRunning = false; }
}

setInterval(runAutomation, 60 * 1000); // Roda a cada minuto (verifica quem deve rodar)

// =======================
// PROTECTED API ROUTES
// =======================
app.use('/auth', AuthRouter);

const ApiRouter = express.Router();
ApiRouter.use(requireAuth);

ApiRouter.get('/whatsapp/status', async (req, res) => {
    const status = await botManager.getClientStatus(req.userId);
    if(status.qr) status.qr = await qrcode.toDataURL(status.qr);
    res.json(status);
});

ApiRouter.get('/groups', async (req, res) => {
    const groups = await prisma.group.findMany({ where: { userId: req.userId } });
    res.json(groups.map(g => ({...g, keywords: g.keywords ? g.keywords.split(',') : [], negativeKeywords: g.negativeKeywords ? g.negativeKeywords.split(',') : []})));
});

ApiRouter.post('/groups', async (req, res) => {
    const { link, name } = req.body;
    const group = await prisma.group.create({
        data: { userId: req.userId, link, name: name || 'Novo Grupo' }
    });
    res.json(group);
});

ApiRouter.post('/groups/:id/join', async (req, res) => {
    const client = botManager.getClient(req.userId);
    if (!client) return res.status(400).json({ error: 'Bot desconectado' });
    
    const group = await prisma.group.findUnique({ where: { id: req.params.id, userId: req.userId } });
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

    try {
        const code = group.link.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{20,})/)[1];
        const resId = await client.acceptInvite(code);
        
        let chatId = typeof resId === 'string' ? resId : (resId?._serialized || resId?.id?._serialized);
        // Fallback for already in group
        if(!chatId) {
            const info = await client.getInviteInfo(code);
            chatId = info.id._serialized;
        }

        await prisma.group.update({ where: { id: group.id }, data: { chatId } });
        res.json({ ok: true, chatId });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao entrar: ' + e.message });
    }
});

// Settings & Config
ApiRouter.get('/shopee/config', async (req, res) => {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    const hasCreds = !!(settings?.shopeeAppId && settings?.shopeeSecret);
    res.json({ hasCredentials: hasCreds, appIdMasked: hasCreds ? `${settings.shopeeAppId.substring(0,3)}***` : null });
});

ApiRouter.post('/shopee/config', async (req, res) => {
    const { appId, secret } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user.isVerified) return res.status(403).json({ error: 'Verifique seu email antes de configurar.' });

    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { shopeeAppId: appId, shopeeSecret: encrypt(secret) },
        create: { userId: req.userId, shopeeAppId: appId, shopeeSecret: encrypt(secret) }
    });
    res.json({ ok: true });
});

// Logs
ApiRouter.get('/logs', async (req, res) => {
    const logs = await prisma.log.findMany({ 
        where: { userId: req.userId }, 
        orderBy: { timestamp: 'desc' }, 
        take: 100 
    });
    res.json(logs);
});

app.use('/api', ApiRouter);

// =======================
// MIGRATION SCRIPT (AUTO RUN)
// =======================
async function runMigration() {
    const count = await prisma.user.count();
    if (count === 0 && fs.existsSync(path.join(DATA_DIR, 'achady_db.json'))) {
        console.log('[MIGRATION] Banco vazio. Importando JSON legado...');
        try {
            const raw = fs.readFileSync(path.join(DATA_DIR, 'achady_db.json'));
            const oldDb = JSON.parse(raw);
            
            // Create Admin
            const passwordHash = await bcrypt.hash('Mudar123!', 12);
            const user = await prisma.user.create({
                data: {
                    email: 'admin@achady.com',
                    passwordHash,
                    isVerified: true,
                    settings: {
                        create: {
                            shopeeAppId: oldDb.shopeeConfig?.appId,
                            shopeeSecret: oldDb.shopeeConfig?.secret, // Já está criptografado no JSON? Se sim, ok.
                            template: oldDb.template
                        }
                    }
                }
            });
            
            // Migrate Groups
            if(oldDb.groups) {
                for(const g of oldDb.groups) {
                    await prisma.group.create({
                        data: {
                            userId: user.id,
                            name: g.name,
                            link: g.link,
                            active: g.active,
                            chatId: g.chatId,
                            keywords: Array.isArray(g.keywords) ? g.keywords.join(',') : g.keywords
                        }
                    });
                }
            }
            console.log('[MIGRATION] Sucesso! Login: admin@achady.com / Mudar123!');
        } catch(e) { console.error('Migration failed:', e); }
    }
}

app.listen(PORT, async () => {
  console.log(`ACHADY Server running on port ${PORT}`);
  await runMigration();
});
