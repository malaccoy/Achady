require('dotenv').config();
const path = require('path');

// Set default DATABASE_URL for Prisma if not provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(__dirname, 'dev.db')}`;
}

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
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
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_prod';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://app.achady.com.br';
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

// Automation constants
const DEFAULT_KEYWORDS = ['promoção', 'oferta', 'casa', 'cozinha'];
const AUTOMATION_DELAY_MS = 5000;      // Delay between groups in scheduled automation
const MANUAL_RUN_DELAY_MS = 2000;      // Shorter delay for manual run

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// SECURITY
app.set('trust proxy', 1);
app.use(cors({
  origin: true, // Allow frontend origin
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Strict on auth
  message: { error: 'Muitas tentativas. Aguarde um pouco.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300
});

// =======================
// CRYPTO HELPERS (Shopee Secret)
// =======================
const ALGORITHM = 'aes-256-gcm';
function getMasterKey() {
  if (!process.env.MASTER_KEY) {
      // Fallback key if not in env, but ideally should be in .env
      return crypto.scryptSync('default_fallback_secret', 'achady_salt', 32);
  }
  return crypto.scryptSync(process.env.MASTER_KEY, 'achady_salt', 32);
}
function encrypt(text) {
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
  } catch (e) {
    console.error("Encrypt error:", e);
    return null;
  }
}
function decrypt(text) {
  if (!text || !text.startsWith('enc:')) return text;
  try {
    const key = getMasterKey();
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
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
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
    this.sessions = new Map(); // userId -> { client, status, qr, initializing }
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
    });

    client.on('ready', () => {
      session.status = 'ready';
      session.qr = null;
      console.log(`[BOT ${userId}] Pronto.`);
    });

    client.on('disconnected', () => {
      session.status = 'disconnected';
      session.qr = null;
      this.sessions.delete(userId);
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
    // Lazy Load: Se não estiver rodando, tenta iniciar agora
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
      // Clean up files
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
    const existing = await prisma.user.findUnique({ 
        where: { email },
        select: { id: true }
    });
    if (existing) return res.status(400).json({ error: 'Email já cadastrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create User + Default Settings
    // Using select to avoid errors with columns that might not exist in current DB
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        settings: {
            create: {
                template: `🔥 Oferta Shopee! (por tempo limitado)\n\n🛍️ {{titulo}}\n\n💸 De: ~{{precoOriginal}}~ \n🔥 Agora: {{preco}}  ({{desconto}} OFF)\n\n🛒 Link: {{link}}\n\n*O preço e a disponibilidade do produto podem variar.`
            }
        }
      },
      select: { id: true, email: true }
    });

    res.json({ message: 'Conta criada! Faça login.' });
  } catch (e) {
    console.error("Register Error:", e);
    res.status(400).json({ error: e.errors ? e.errors[0].message : e.message });
  }
});

AuthRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  
  // Seleciona campos específicos para evitar erro de coluna inexistente
  const user = await prisma.user.findUnique({ 
    where: { email },
    select: { id: true, email: true, passwordHash: true }
  });
  
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: { id: true }
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // Start Bot Session
  botManager.initializeClient(user.id).catch(console.error);

  res.json({ ok: true, user: { email: user.email, isVerified: false } });
});

AuthRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

AuthRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ 
    where: { id: req.userId },
    select: { email: true }
  });
  if(!user) return res.status(401).json({error: 'User not found'});
  res.json({ email: user.email, isVerified: false });
});

AuthRouter.post('/request-reset', authLimiter, async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if(user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry },
            select: { id: true }
        });
        // Send Email
        console.log(`[RESET] Token para ${email}: ${resetToken}`); // Log for dev
        if(process.env.SMTP_USER) {
            sendEmail(email, 'Redefinir Senha ACHADY', `Seu token: ${resetToken}`);
        }
    }
    // Always return ok to prevent enumeration
    res.json({ message: 'Se o email existir, enviamos instruções.' });
});

AuthRouter.post('/reset-password', authLimiter, async (req, res) => {
    const { email, token, newPassword } = req.body;
    const user = await prisma.user.findFirst({
        where: { 
            email, 
            resetToken: token,
            resetTokenExpiry: { gt: new Date() }
        },
        select: { id: true }
    });

    if(!user) return res.status(400).json({ error: 'Token inválido ou expirado' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, resetToken: null, resetTokenExpiry: null },
        select: { id: true }
    });

    res.json({ message: 'Senha alterada com sucesso.' });
});

AuthRouter.delete('/account', requireAuth, async (req, res) => {
    const { password, confirmation } = req.body;
    if (confirmation !== 'EXCLUIR') return res.status(400).json({ error: 'Confirmação incorreta' });
    
    const user = await prisma.user.findUnique({ 
        where: { id: req.userId },
        select: { id: true, passwordHash: true }
    });
    
    if (!await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ error: 'Senha incorreta' });
    
    // Cleanup Bot
    await botManager.stopClient(req.userId);
    
    // Cascade delete via Prisma handles groups, settings, logs
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
            if (data.errors && data.errors.length > 0) {
                const errorMessage = data.errors[0]?.message || JSON.stringify(data.errors);
                throw new Error(`Shopee API Error: ${errorMessage}`);
            }
            return data.data;
        } catch (e) {
            // Preserve axios error details for better debugging
            if (e.response) {
                throw new Error(`Shopee API HTTP Error ${e.response.status}: ${e.response.data?.message || e.message}`);
            }
            throw new Error(e.message || 'Unknown Shopee API error');
        }
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
    // Safely get price values, defaulting to 0 if undefined/null
    const priceValue = offer.priceMin || offer.price || 0;
    const price = typeof priceValue === 'number' ? priceValue : parseFloat(priceValue) || 0;
    const maxPrice = offer.priceMax || price;
    const original = maxPrice ? (maxPrice * 1.2).toFixed(2) : (price * 1.2).toFixed(2);
    
    return text
        .replace(/{{\s*titulo\s*}}/gi, offer.productName || 'Produto')
        .replace(/{{\s*preco\s*}}/gi, `R$ ${price.toFixed(2)}`)
        .replace(/{{\s*precoOriginal\s*}}/gi, `R$ ${original}`)
        .replace(/{{\s*desconto\s*}}/gi, offer.commissionRate ? `${Math.floor(offer.commissionRate * 100)}% CB` : 'Oferta')
        .replace(/{{\s*link\s*}}/gi, offer.shortLink || offer.offerLink || '');
}

// =======================
// AUTOMATION HELPERS
// =======================
function isWithinTimeWindow(startHour, endHour) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;
    
    const [startH, startM] = startHour.split(':').map(Number);
    const [endH, endM] = endHour.split(':').map(Number);
    const start = startH + startM / 60;
    const end = endH + endM / 60;
    
    return currentTime >= start && currentTime <= end;
}

async function hasReachedDailyLimit(userId, groupId, maxOffersPerDay) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const sentTodayCount = await prisma.sentOffer.count({
        where: {
            userId,
            groupId,
            sentAt: { gte: startOfToday }
        }
    });
    
    return sentTodayCount >= maxOffersPerDay;
}

function areSimilarOffers(offer1, offer2) {
    if (!offer1 || !offer2) return false;
    
    // Check if titles are very similar (using simple word overlap)
    const title1 = offer1.productName.toLowerCase();
    const title2 = offer2.productName.toLowerCase();
    
    // If titles are exactly the same
    if (title1 === title2) return true;
    
    // Check price similarity (within 10%)
    const price1 = offer1.priceMin || offer1.price || 0;
    const price2 = offer2.priceMin || offer2.price || 0;
    
    if (price1 > 0 && price2 > 0) {
        const priceDiff = Math.abs(price1 - price2) / Math.max(price1, price2);
        
        // If prices are very similar and titles share many words
        if (priceDiff < 0.1) {
            const words1 = new Set(title1.split(/\s+/).filter(w => w.length > 3));
            const words2 = new Set(title2.split(/\s+/).filter(w => w.length > 3));
            const commonWords = [...words1].filter(w => words2.has(w));
            const similarity = commonWords.length / Math.min(words1.size, words2.size);
            
            if (similarity > 0.5) return true;
        }
    }
    
    return false;
}

// =======================
// SCHEDULER (MULTI-USER)
// =======================
let isJobRunning = false;
async function runAutomation() {
    if (isJobRunning) return;
    isJobRunning = true;
    
    try {
        // Find users who have automation enabled
        // Usar select para evitar erro com colunas inexistentes no DB
        const users = await prisma.user.findMany({
            where: { settings: { automationActive: true } },
            select: {
                id: true,
                settings: true,
                groups: { where: { active: true } }
            }
        });

        for (const user of users) {
            // Check time window
            const sendHourStart = user.settings.sendHourStart || "08:00";
            const sendHourEnd = user.settings.sendHourEnd || "22:00";
            if (!isWithinTimeWindow(sendHourStart, sendHourEnd)) {
                console.log(`[JOB] User ${user.id} fora da janela de horário (${sendHourStart}-${sendHourEnd})`);
                continue;
            }

            // Check credentials
            if (!user.settings.shopeeAppId || !user.settings.shopeeSecret) continue;
            const plainSecret = decrypt(user.settings.shopeeSecret);
            if (!plainSecret) continue;

            const client = botManager.getClient(user.id);
            if (!client) {
                // If bot died, try to revive
                botManager.initializeClient(user.id).catch(e => console.error(`[JOB] Init Fail User ${user.id}`));
                continue; 
            }

            const shopee = new ShopeeClient(user.settings.shopeeAppId, plainSecret);
            const maxOffersPerDay = user.settings.maxOffersPerDay || 10;
            const smartMode = user.settings.smartMode || false;

            for (const group of user.groups) {
                if (!group.chatId) continue;
                
                // Check daily limit per group
                if (await hasReachedDailyLimit(user.id, group.id, maxOffersPerDay)) {
                    console.log(`[JOB] Grupo ${group.name} atingiu limite diário (${maxOffersPerDay})`);
                    continue;
                }
                
                // Dedupe: Check history for THIS group
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const recentOffers = await prisma.sentOffer.findMany({
                    where: { groupId: group.id, sentAt: { gt: oneDayAgo } },
                    select: { itemId: true, keyword: true }
                });
                const sentIds = new Set(recentOffers.map(o => o.itemId));
                
                // Get last sent offer for smart mode
                let lastSentOffer = null;
                if (smartMode) {
                    const lastOffer = await prisma.sentOffer.findFirst({
                        where: { groupId: group.id },
                        orderBy: { sentAt: 'desc' },
                        select: { itemId: true }
                    });
                    if (lastOffer) {
                        // We'll need to get the offer details from recent search
                        // For now, we'll track it during the send process
                    }
                }

                // Keyword Strategy
                let keywords = group.keywords ? group.keywords.split(',').filter(k=>k) : DEFAULT_KEYWORDS;
                if(keywords.length === 0) keywords = DEFAULT_KEYWORDS;
                const keyword = keywords[Math.floor(Math.random() * keywords.length)];

                try {
                    const offers = await shopee.searchOffers(keyword);
                    const validOffers = offers.filter(o => !sentIds.has(String(o.itemId)));

                    // Blacklist
                    const blacklist = group.negativeKeywords ? group.negativeKeywords.split(',').map(s=>s.trim().toLowerCase()).filter(s=>s) : [];
                    
                    // Get last sent offer for smart mode comparison
                    let lastSentOfferData = null;
                    if (smartMode) {
                        const lastSent = await prisma.sentOffer.findFirst({
                            where: { groupId: group.id },
                            orderBy: { sentAt: 'desc' },
                            take: 1
                        });
                        // Store the last sent itemId to compare with current offers
                        if (lastSent) {
                            // Try to find it in recent offers to get full data
                            const recentSearches = await shopee.searchOffers(lastSent.keyword || keyword);
                            lastSentOfferData = recentSearches.find(o => String(o.itemId) === lastSent.itemId);
                        }
                    }
                    
                    let blacklistCount = 0;
                    let safeOffer = null;
                    
                    for (const offer of validOffers) {
                        const title = offer.productName.toLowerCase();
                        
                        // Check blacklist
                        if (blacklist.some(bad => title.includes(bad))) {
                            blacklistCount++;
                            continue;
                        }
                        
                        // Check smart mode - avoid similar offers
                        if (smartMode && lastSentOfferData && areSimilarOffers(offer, lastSentOfferData)) {
                            continue;
                        }
                        
                        // Found a good offer
                        safeOffer = offer;
                        break;
                    }
                    
                    // Log blacklisted offers
                    if (blacklistCount > 0) {
                        await prisma.log.create({
                            data: { 
                                userId: user.id, 
                                groupName: group.name, 
                                productTitle: `${blacklistCount} ofertas filtradas`,
                                price: '-', 
                                status: 'ERROR',
                                errorMessage: 'blacklist'
                            }
                        });
                    }
                    
                    if (safeOffer) {
                        const shortLink = await shopee.generateShortLink(safeOffer.offerLink);
                        safeOffer.shortLink = shortLink;
                        
                        const msg = renderMessage(user.settings.template, safeOffer);
                        
                        // Send
                        if(safeOffer.imageUrl) {
                            const media = await MessageMedia.fromUrl(safeOffer.imageUrl, { unsafeMime: true });
                            await client.sendMessage(group.chatId, media, { caption: msg });
                        } else {
                            await client.sendMessage(group.chatId, msg);
                        }

                        // Record
                        await prisma.sentOffer.create({
                            data: { userId: user.id, groupId: group.id, itemId: String(safeOffer.itemId), keyword }
                        });
                        
                        await prisma.log.create({
                            data: { 
                                userId: user.id, groupName: group.name, productTitle: safeOffer.productName,
                                price: String(safeOffer.price || 0), status: 'SENT'
                            }
                        });
                        
                        console.log(`[JOB] Enviado User ${user.id} -> Grupo ${group.name}`);
                        await new Promise(r => setTimeout(r, AUTOMATION_DELAY_MS));
                    }
                } catch (e) {
                    console.error(`[JOB Error User ${user.id} Group ${group.name}]`, e.message);
                    // Log the error to the database for visibility in the UI
                    try {
                        await prisma.log.create({
                            data: { 
                                userId: user.id, 
                                groupName: group.name, 
                                productTitle: 'Erro ao buscar/enviar oferta',
                                price: '-', 
                                status: 'ERROR',
                                errorMessage: e.message
                            }
                        });
                    } catch (logErr) {
                        console.error(`[JOB] Failed to log error:`, logErr.message);
                    }
                }
            }
        }
    } catch (e) { console.error('Scheduler Fatal:', e); }
    finally { isJobRunning = false; }
}

// Run every minute (checks active users)
setInterval(runAutomation, 60 * 1000);

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

ApiRouter.get('/whatsapp/qr', async (req, res) => {
    const status = await botManager.getClientStatus(req.userId);
    const qr = status.qr ? await qrcode.toDataURL(status.qr) : null;
    res.json({ status: status.status, qr });
});

ApiRouter.get('/system/diagnostics', async (req, res) => {
    try {
        // Get WhatsApp status
        const whatsappStatus = await botManager.getClientStatus(req.userId);
        
        // Get Shopee API config
        const settings = await prisma.userSettings.findUnique({ 
            where: { userId: req.userId },
            select: { shopeeAppId: true, shopeeSecret: true, automationActive: true }
        });
        const shopeeConfigured = !!(settings?.shopeeAppId && settings?.shopeeSecret);
        
        // Get last message sent from logs
        const lastLog = await prisma.log.findFirst({
            where: { userId: req.userId, status: 'SENT' },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true, groupName: true }
        });
        
        res.json({
            whatsappConnected: whatsappStatus.status === 'ready',
            shopeeConfigured,
            automationActive: settings?.automationActive || false,
            lastMessageSent: lastLog ? {
                timestamp: lastLog.timestamp.toISOString(),
                groupName: lastLog.groupName
            } : null,
            lastStatusCheck: new Date().toISOString()
        });
    } catch (e) {
        console.error('[DIAGNOSTICS ERROR]', e);
        res.status(500).json({ error: 'Erro ao buscar diagnósticos' });
    }
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

ApiRouter.put('/groups/:id', async (req, res) => {
    const { keywords, negativeKeywords } = req.body;
    const group = await prisma.group.findUnique({ where: { id: req.params.id, userId: req.userId } });
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

    await prisma.group.update({
        where: { id: req.params.id },
        data: {
            keywords: Array.isArray(keywords) ? keywords.join(',') : keywords,
            negativeKeywords: Array.isArray(negativeKeywords) ? negativeKeywords.join(',') : negativeKeywords
        }
    });
    res.json({ ok: true });
});

ApiRouter.patch('/groups/:id/toggle', async (req, res) => {
    const group = await prisma.group.findUnique({ where: { id: req.params.id, userId: req.userId } });
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

    await prisma.group.update({ where: { id: group.id }, data: { active: !group.active } });
    res.json({ ok: true });
});

ApiRouter.delete('/groups/:id', async (req, res) => {
    await prisma.group.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ ok: true });
});

ApiRouter.post('/groups/:id/join', async (req, res) => {
    const client = botManager.getClient(req.userId);
    if (!client) return res.status(400).json({ error: 'Bot desconectado. Conecte o QR Code.' });
    
    const group = await prisma.group.findUnique({ where: { id: req.params.id, userId: req.userId } });
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

    try {
        const code = group.link.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{20,})/)[1];
        let chatId;
        try {
            const resId = await client.acceptInvite(code);
            chatId = typeof resId === 'string' ? resId : (resId?._serialized || resId?.id?._serialized);
        } catch(e) {
            const info = await client.getInviteInfo(code);
            chatId = info.id._serialized;
        }

        if(chatId) {
            await prisma.group.update({ where: { id: group.id }, data: { chatId } });
            res.json({ ok: true, chatId });
        } else {
            throw new Error('Não foi possível obter ID');
        }
    } catch (e) {
        res.status(500).json({ error: 'Erro ao entrar: ' + e.message });
    }
});

// Settings Endpoints
ApiRouter.get('/shopee/config', async (req, res) => {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    const hasCreds = !!(settings?.shopeeAppId && settings?.shopeeSecret);
    res.json({ hasCredentials: hasCreds, appIdMasked: hasCreds ? `${settings.shopeeAppId.substring(0,3)}***` : null });
});

ApiRouter.post('/shopee/config', async (req, res) => {
    const { appId, secret } = req.body;
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { shopeeAppId: appId, shopeeSecret: encrypt(secret) },
        create: { userId: req.userId, shopeeAppId: appId, shopeeSecret: encrypt(secret) }
    });
    res.json({ ok: true });
});

ApiRouter.post('/shopee/test', async (req, res) => {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    if (!settings?.shopeeAppId || !settings?.shopeeSecret) return res.status(400).json({ error: 'Configure as credenciais.' });

    const plainSecret = decrypt(settings.shopeeSecret);
    const shopee = new ShopeeClient(settings.shopeeAppId, plainSecret);
    try {
        const offers = await shopee.searchOffers('teste');
        res.json({ count: offers.length });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

ApiRouter.get('/automation', async (req, res) => {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    res.json({ 
        active: settings?.automationActive || false, 
        intervalMinutes: settings?.intervalMinutes || 60,
        sendHourStart: settings?.sendHourStart || "08:00",
        sendHourEnd: settings?.sendHourEnd || "22:00",
        maxOffersPerDay: settings?.maxOffersPerDay || 10,
        smartMode: settings?.smartMode || false
    });
});

ApiRouter.patch('/automation/status', async (req, res) => {
    const { ativo } = req.body;
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { automationActive: ativo },
        create: { userId: req.userId, automationActive: ativo }
    });
    res.json({ ok: true });
});

ApiRouter.patch('/automation/interval', async (req, res) => {
    const { intervalMinutes } = req.body;
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { intervalMinutes },
        create: { userId: req.userId, intervalMinutes }
    });
    res.json({ ok: true });
});

ApiRouter.patch('/automation/time-window', async (req, res) => {
    const { sendHourStart, sendHourEnd } = req.body;
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { sendHourStart, sendHourEnd },
        create: { userId: req.userId, sendHourStart, sendHourEnd }
    });
    res.json({ ok: true });
});

ApiRouter.patch('/automation/max-offers', async (req, res) => {
    const { maxOffersPerDay } = req.body;
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { maxOffersPerDay },
        create: { userId: req.userId, maxOffersPerDay }
    });
    res.json({ ok: true });
});

ApiRouter.patch('/automation/smart-mode', async (req, res) => {
    const { smartMode } = req.body;
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { smartMode },
        create: { userId: req.userId, smartMode }
    });
    res.json({ ok: true });
});

ApiRouter.get('/automation/stats', async (req, res) => {
    try {
        // Get offers sent today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const offersSentToday = await prisma.sentOffer.count({
            where: {
                userId: req.userId,
                sentAt: { gte: startOfToday }
            }
        });

        // Get active groups count
        const activeGroups = await prisma.group.count({
            where: {
                userId: req.userId,
                active: true
            }
        });

        // Get offers ignored by blacklist today (from error logs)
        const offersIgnoredByBlacklist = await prisma.log.count({
            where: {
                userId: req.userId,
                status: 'ERROR',
                errorMessage: { contains: 'blacklist' },
                timestamp: { gte: startOfToday }
            }
        });

        res.json({
            offersSentToday,
            activeGroups,
            offersIgnoredByBlacklist
        });
    } catch (e) {
        console.error('[AUTOMATION STATS ERROR]', e);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

ApiRouter.post('/automation/run-once', async (req, res) => {
    try {
        // Get user with settings and active groups
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                id: true,
                settings: true,
                groups: { where: { active: true } }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Check credentials
        if (!user.settings?.shopeeAppId || !user.settings?.shopeeSecret) {
            return res.status(400).json({ error: 'Configure as credenciais da Shopee primeiro.' });
        }
        
        const plainSecret = decrypt(user.settings.shopeeSecret);
        if (!plainSecret) {
            return res.status(400).json({ error: 'Erro ao descriptografar credenciais.' });
        }

        const client = botManager.getClient(user.id);
        if (!client) {
            // Try to initialize the bot
            botManager.initializeClient(user.id).catch(e => console.error(`[RUN-ONCE] Init Fail User ${user.id}`));
            return res.status(400).json({ error: 'Bot WhatsApp desconectado. Conecte via QR Code.' });
        }

        const shopee = new ShopeeClient(user.settings.shopeeAppId, plainSecret);
        const maxOffersPerDay = user.settings.maxOffersPerDay || 10;
        const smartMode = user.settings.smartMode || false;
        let sentCount = 0;
        let errorCount = 0;

        for (const group of user.groups) {
            if (!group.chatId) continue;
            
            // Check daily limit per group
            if (await hasReachedDailyLimit(user.id, group.id, maxOffersPerDay)) {
                console.log(`[RUN-ONCE] Grupo ${group.name} atingiu limite diário (${maxOffersPerDay})`);
                continue;
            }
            
            // Dedupe: Check history for THIS group
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentOffers = await prisma.sentOffer.findMany({
                where: { groupId: group.id, sentAt: { gt: oneDayAgo } },
                select: { itemId: true, keyword: true }
            });
            const sentIds = new Set(recentOffers.map(o => o.itemId));

            // Keyword Strategy
            let keywords = group.keywords ? group.keywords.split(',').filter(k=>k) : DEFAULT_KEYWORDS;
            if(keywords.length === 0) keywords = DEFAULT_KEYWORDS;
            const keyword = keywords[Math.floor(Math.random() * keywords.length)];

            try {
                const offers = await shopee.searchOffers(keyword);
                const validOffers = offers.filter(o => !sentIds.has(String(o.itemId)));

                // Blacklist
                const blacklist = group.negativeKeywords ? group.negativeKeywords.split(',').map(s=>s.trim().toLowerCase()).filter(s=>s) : [];
                
                // Get last sent offer for smart mode comparison
                let lastSentOfferData = null;
                if (smartMode) {
                    const lastSent = await prisma.sentOffer.findFirst({
                        where: { groupId: group.id },
                        orderBy: { sentAt: 'desc' },
                        take: 1
                    });
                    if (lastSent) {
                        const recentSearches = await shopee.searchOffers(lastSent.keyword || keyword);
                        lastSentOfferData = recentSearches.find(o => String(o.itemId) === lastSent.itemId);
                    }
                }
                
                let safeOffer = null;
                
                for (const offer of validOffers) {
                    const title = offer.productName.toLowerCase();
                    
                    // Check blacklist
                    if (blacklist.some(bad => title.includes(bad))) {
                        continue;
                    }
                    
                    // Check smart mode - avoid similar offers
                    if (smartMode && lastSentOfferData && areSimilarOffers(offer, lastSentOfferData)) {
                        continue;
                    }
                    
                    // Found a good offer
                    safeOffer = offer;
                    break;
                }
                
                if (safeOffer) {
                    const shortLink = await shopee.generateShortLink(safeOffer.offerLink);
                    safeOffer.shortLink = shortLink;
                    
                    const msg = renderMessage(user.settings.template, safeOffer);
                    
                    // Send
                    if(safeOffer.imageUrl) {
                        const media = await MessageMedia.fromUrl(safeOffer.imageUrl, { unsafeMime: true });
                        await client.sendMessage(group.chatId, media, { caption: msg });
                    } else {
                        await client.sendMessage(group.chatId, msg);
                    }

                    // Record
                    await prisma.sentOffer.create({
                        data: { userId: user.id, groupId: group.id, itemId: String(safeOffer.itemId), keyword }
                    });
                    
                    await prisma.log.create({
                        data: { 
                            userId: user.id, groupName: group.name, productTitle: safeOffer.productName,
                            price: String(safeOffer.price || 0), status: 'SENT'
                        }
                    });
                    
                    console.log(`[RUN-ONCE] Enviado User ${user.id} -> Grupo ${group.name}`);
                    sentCount++;
                    await new Promise(r => setTimeout(r, MANUAL_RUN_DELAY_MS));
                }
            } catch (e) {
                console.error(`[RUN-ONCE Error User ${user.id} Group ${group.name}]`, e.message);
                errorCount++;
                // Log the error to the database for visibility in the UI
                try {
                    await prisma.log.create({
                        data: { 
                            userId: user.id, 
                            groupName: group.name, 
                            productTitle: 'Erro ao buscar/enviar oferta',
                            price: '-', 
                            status: 'ERROR',
                            errorMessage: e.message
                        }
                    });
                } catch (logErr) {
                    console.error(`[RUN-ONCE] Failed to log error:`, logErr.message);
                }
            }
        }

        res.json({ ok: true, sent: sentCount, errors: errorCount });
    } catch (e) {
        console.error('[RUN-ONCE Fatal]', e);
        res.status(500).json({ error: 'Erro interno ao executar automação: ' + e.message });
    }
});

ApiRouter.get('/template', async (req, res) => {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    res.json({ template: settings?.template || '' });
});

ApiRouter.post('/template', async (req, res) => {
    const { template } = req.body;
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: { template },
        create: { userId: req.userId, template }
    });
    res.json({ ok: true });
});

ApiRouter.get('/logs', async (req, res) => {
    const logs = await prisma.log.findMany({ 
        where: { userId: req.userId }, 
        orderBy: { timestamp: 'desc' }, 
        take: 100 
    });
    res.json(logs);
});

app.use('/api', ApiRouter);

// Serve static files from dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`ACHADY Server running on port ${PORT}`);
});