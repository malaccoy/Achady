const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

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
const { resolveShopeeCategoryId } = require('./src/config/shopeeCategories');

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
const INTERVAL_BUFFER_SECONDS = 5;    // Buffer for interval checks to account for timing variations

// Meta Business Login constants (Instagram via Facebook OAuth)
// App ID 1400700461730372 has redirect URIs configured in Facebook Login settings
const META_FB_APP_ID = '1400700461730372';
const META_IG_REDIRECT_URI = 'https://www.achady.com.br/api/meta/auth/instagram/callback';

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

// OAuth rate limiter - more permissive but still protected
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Allow some retries for OAuth flow
  message: { error: 'Muitas tentativas de integração. Aguarde alguns minutos.' }
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
                template: `🔥 Oferta Shopee! (por tempo limitado)\n\n🛍️ {{titulo}}\n\n💸 De: ~{{precoOriginal}}~\n🔥 Agora: {{preco}}\n\n🛒 Link: {{link}}\n\n*O preço e a disponibilidade do produto podem variar.`
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
    
    /**
     * Search offers using productOfferV2 API with advanced filtering
     * @param {Object} options - Search options
     * @param {string} [options.keyword] - Optional keyword to search
     * @param {number} [options.productCatId] - Optional category ID
     * @param {number} [options.sortType=2] - Sort type (1=RELEVANCE, 2=ITEM_SOLD, 3=PRICE_DESC, 4=PRICE_ASC, 5=COMMISSION)
     * @param {number} [options.page=1] - Page number
     * @param {number} [options.limit=20] - Results per page
     * @param {number} [options.minDiscountPercent] - Filter: minimum discount percentage
     * @param {number} [options.minRating] - Filter: minimum rating
     * @param {number} [options.minSales] - Filter: minimum sales count
     * @returns {Promise<Array>} Array of product offers
     */
    async searchOffersV2(options = {}) {
        const {
            keyword,
            productCatId,
            sortType = 2,
            page = 1,
            limit = 20,
            minDiscountPercent,
            minRating,
            minSales
        } = options;
        
        // Build GraphQL query with all relevant fields
        const q = `query($keyword: String, $productCatId: Int, $limit: Int, $sortType: Int, $page: Int) { 
            productOfferV2(keyword: $keyword, productCatId: $productCatId, limit: $limit, sortType: $sortType, page: $page) { 
                nodes { 
                    itemId 
                    productName 
                    imageUrl 
                    price 
                    priceMin 
                    priceMax 
                    offerLink 
                    commissionRate
                    priceDiscountRate
                    ratingStar
                    sales
                } 
            } 
        }`;
        
        const variables = { sortType, limit, page };
        if (keyword) variables.keyword = keyword;
        if (productCatId) variables.productCatId = productCatId;
        
        const res = await this.request(q, variables);
        let offers = res?.productOfferV2?.nodes || [];
        const initialCount = offers.length;
        
        // Apply server-side filters
        if (minDiscountPercent !== undefined && minDiscountPercent !== null) {
            const beforeCount = offers.length;
            offers = offers.filter(offer => {
                const discount = offer.priceDiscountRate || 0;
                return discount >= minDiscountPercent;
            });
            if (offers.length < beforeCount) {
                console.log(`[SEARCH] Filtered ${beforeCount - offers.length} offers by minDiscountPercent (${minDiscountPercent}%)`);
            }
        }
        
        if (minRating !== undefined && minRating !== null) {
            const beforeCount = offers.length;
            offers = offers.filter(offer => {
                const rating = parseFloat(offer.ratingStar || '0');
                return rating >= minRating;
            });
            if (offers.length < beforeCount) {
                console.log(`[SEARCH] Filtered ${beforeCount - offers.length} offers by minRating (${minRating})`);
            }
        }
        
        if (minSales !== undefined && minSales !== null) {
            const beforeCount = offers.length;
            offers = offers.filter(offer => {
                const sales = offer.sales || 0;
                return sales >= minSales;
            });
            if (offers.length < beforeCount) {
                console.log(`[SEARCH] Filtered ${beforeCount - offers.length} offers by minSales (${minSales})`);
            }
        }
        
        // Log summary of filter results
        if (offers.length < initialCount) {
            console.log(`[SEARCH] Filter summary: ${initialCount} -> ${offers.length} offers after quality filters`);
        }
        
        return offers;
    }
    
    /**
     * Legacy method for backward compatibility
     * Uses keyword-only search with commission-based sorting
     */
    async searchOffers(keyword) {
        const q = `query($keyword: String, $limit: Int, $sortType: Int) { productOfferV2(keyword: $keyword, limit: $limit, sortType: $sortType) { nodes { itemId productName imageUrl price priceMin priceMax offerLink commissionRate priceDiscountRate ratingStar sales } } }`;
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
    
    // Use priceDiscountRate from Shopee API if available
    // priceDiscountRate is an Int representing the discount percentage (e.g., 25 = 25% off)
    let discountPercent = null;
    
    if (offer.priceDiscountRate !== undefined && offer.priceDiscountRate !== null && offer.priceDiscountRate > 0) {
        // Use the real discount rate from Shopee API
        discountPercent = offer.priceDiscountRate;
    } else {
        // Fallback: estimate from price difference (for backward compatibility)
        const original = maxPrice ? (maxPrice * 1.2).toFixed(2) : (price * 1.2).toFixed(2);
        const precoOriginalNumber = parseFloat(original);
        const precoNumber = price;
        
        if (
            Number.isFinite(precoOriginalNumber) &&
            Number.isFinite(precoNumber) &&
            precoOriginalNumber > 0 &&
            precoNumber > 0 &&
            precoNumber < precoOriginalNumber
        ) {
            const diff = precoOriginalNumber - precoNumber;
            discountPercent = Math.round((diff / precoOriginalNumber) * 100);
        }
    }
    
    // Calculate original price based on discount
    let original;
    if (discountPercent && discountPercent > 0) {
        // Calculate original price: price = original * (1 - discount/100)
        // So: original = price / (1 - discount/100)
        original = (price / (1 - discountPercent / 100)).toFixed(2);
    } else {
        // Fallback to maxPrice or estimate
        original = maxPrice ? (maxPrice * 1.2).toFixed(2) : (price * 1.2).toFixed(2);
    }
    
    // Build the desconto variable as a string (only the number, no "%")
    const descontoValue = discountPercent !== null && discountPercent > 0
        ? String(discountPercent)
        : '';
    
    return text
        .replace(/{{\s*titulo\s*}}/gi, offer.productName || 'Produto')
        .replace(/{{\s*preco\s*}}/gi, `R$ ${price.toFixed(2)}`)
        .replace(/{{\s*precoOriginal\s*}}/gi, `R$ ${original}`)
        .replace(/{{\s*desconto\s*}}/gi, descontoValue)
        .replace(/{{\s*link\s*}}/gi, offer.shortLink || offer.offerLink || '');
}

// =======================
// SCHEDULER (MULTI-USER)
// =======================
let isJobRunning = false;

// Helper function to check if current time is within the configured time window
function isWithinTimeWindow(startTime, endTime) {
    if (!startTime || !endTime) return true; // No restriction if not configured
    
    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        
        // Validate parsed values
        if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
            console.error('[TIME WINDOW] Invalid time format, allowing automation');
            return true;
        }
        
        const startTimeInMinutes = startHour * 60 + startMinute;
        const endTimeInMinutes = endHour * 60 + endMinute;
        
        // Handle case where window crosses midnight (e.g., 22:00 to 02:00)
        if (startTimeInMinutes < endTimeInMinutes) {
            return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
        } else {
            return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
        }
    } catch (e) {
        console.error('[TIME WINDOW] Error checking time window:', e.message);
        return true; // Allow automation on error to prevent blocking
    }
}

/**
 * Helper function to search for offers based on group configuration
 * Uses productOfferV2 API with category, filters, and sorting if configured
 * Falls back to keyword-only search for backward compatibility
 * @param {Object} shopee - ShopeeClient instance
 * @param {Object} group - Group configuration from database
 * @returns {Promise<Array>} Array of offers
 */
async function searchOffersForGroup(shopee, group) {
    // Parse productCatIds from JSON string if present
    let productCatIds = [];
    if (group.productCatIds) {
        try {
            const parsed = JSON.parse(group.productCatIds);
            // Validate that it's an array of positive numbers
            if (Array.isArray(parsed) && parsed.every(id => typeof id === 'number' && id > 0)) {
                productCatIds = parsed;
            } else {
                console.error(`[SEARCH] Invalid productCatIds format for group ${group.name}: expected array of positive numbers`);
            }
        } catch (e) {
            console.error(`[SEARCH] Failed to parse productCatIds for group ${group.name}:`, e.message);
        }
    }
    
    // Determine if we should use the new productOfferV2 with filters
    const useAdvancedSearch = productCatIds && productCatIds.length > 0;
    
    if (useAdvancedSearch) {
        // Use productOfferV2 with category ID and filters
        const productCatId = productCatIds[0]; // Use first category ID
        
        // Get keyword if available (optional for category search)
        let keywords = group.keywords ? group.keywords.split(',').filter(k=>k) : [];
        const keyword = keywords.length > 0 ? keywords[Math.floor(Math.random() * keywords.length)] : undefined;
        
        const options = {
            productCatId,
            keyword,
            sortType: group.sortType || 2, // Default to ITEM_SOLD_DESC
            limit: 20,
            page: 1
        };
        
        // Add filters if configured
        if (group.minDiscountPercent !== null && group.minDiscountPercent !== undefined) {
            options.minDiscountPercent = group.minDiscountPercent;
        }
        if (group.minRating !== null && group.minRating !== undefined) {
            options.minRating = group.minRating;
        }
        if (group.minSales !== null && group.minSales !== undefined) {
            options.minSales = group.minSales;
        }
        
        console.log(`[SEARCH] Using productOfferV2 with category ${productCatId} for group ${group.name}`);
        return await shopee.searchOffersV2(options);
    } else {
        // Fallback to keyword-only search (backward compatibility)
        let keywords = group.keywords ? group.keywords.split(',').filter(k=>k) : DEFAULT_KEYWORDS;
        if(keywords.length === 0) keywords = DEFAULT_KEYWORDS;
        const keyword = keywords[Math.floor(Math.random() * keywords.length)];
        
        console.log(`[SEARCH] Using keyword-only search for group ${group.name}`);
        return await shopee.searchOffers(keyword);
    }
}

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
            // Check time window only if scheduleEnabled is true
            const scheduleEnabled = user.settings?.scheduleEnabled !== undefined ? user.settings.scheduleEnabled : true;
            const startTime = user.settings?.startTime || "07:00";
            const endTime = user.settings?.endTime || "23:00";
            
            if (scheduleEnabled && !isWithinTimeWindow(startTime, endTime)) {
                console.log(`[JOB] Skipping User ${user.id} - outside time window (${startTime}-${endTime})`);
                continue;
            }
            
            // Check if enough time has passed since last automation run
            // Using a small buffer to account for timing variations (processing delays, clock drift)
            // This prevents race conditions when intervalMinutes matches the scheduler interval
            const intervalMinutes = user.settings?.intervalMinutes || 5;
            const lastRun = user.settings?.lastAutomationRun;
            if (lastRun) {
                const minutesSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60);
                const bufferMinutes = INTERVAL_BUFFER_SECONDS / 60;
                const intervalWithBuffer = intervalMinutes - bufferMinutes;
                if (minutesSinceLastRun < intervalWithBuffer) {
                    console.log(`[JOB] Skipping User ${user.id} - interval not reached (${minutesSinceLastRun.toFixed(1)}/${intervalMinutes} min, buffer: ${INTERVAL_BUFFER_SECONDS}s)`);
                    continue;
                }
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

            for (const group of user.groups) {
                if (!group.chatId) continue;
                
                // Check if this group was recently sent a message (within intervalMinutes)
                // This prevents sending multiple different offers to the same group too frequently
                if (group.lastMessageSent) {
                    const minutesSinceLastMessage = (Date.now() - new Date(group.lastMessageSent).getTime()) / (1000 * 60);
                    if (minutesSinceLastMessage < intervalMinutes) {
                        console.log(`[JOB] Skipping Group ${group.name} - sent message ${Math.floor(minutesSinceLastMessage)} min ago (interval: ${intervalMinutes} min)`);
                        continue;
                    }
                }
                
                // Dedupe: Check history for THIS group (same calendar day to prevent repeating offers)
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const recentOffers = await prisma.sentOffer.findMany({
                    where: { groupId: group.id, sentAt: { gte: todayStart } },
                    select: { itemId: true }
                });
                const sentIds = new Set(recentOffers.map(o => o.itemId));

                try {
                    // Use new searchOffersForGroup helper that handles both advanced and legacy search
                    const offers = await searchOffersForGroup(shopee, group);
                    
                    // Log API response count for debugging
                    console.log(`[JOB] API returned ${offers.length} offers for group ${group.name}`);
                    
                    if (offers.length === 0) {
                        console.log(`[JOB] No offers found from API for group ${group.name}. Check category ID or keywords configuration.`);
                        continue;
                    }
                    
                    const validOffers = offers.filter(o => !sentIds.has(String(o.itemId)));
                    
                    // Log duplicate filtering result
                    if (validOffers.length < offers.length) {
                        console.log(`[JOB] Filtered ${offers.length - validOffers.length} duplicate offers (already sent today) for group ${group.name}`);
                    }

                    // Blacklist
                    const blacklist = group.negativeKeywords ? group.negativeKeywords.split(',').map(s=>s.trim().toLowerCase()).filter(s=>s) : [];
                    const safeOffer = validOffers.find(o => {
                        const title = o.productName.toLowerCase();
                        return !blacklist.some(bad => title.includes(bad));
                    });
                    
                    if (!safeOffer) {
                        if (validOffers.length > 0) {
                            console.log(`[JOB] All ${validOffers.length} valid offers filtered by blacklist for group ${group.name}`);
                        } else {
                            console.log(`[JOB] No valid offers to send (all duplicates) for group ${group.name}`);
                        }
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

                        // Record - use descriptive marker for category search vs keyword search
                        // Use upsert to handle race conditions where same offer might be inserted concurrently
                        const keyword = group.productCatIds ? '[CATEGORY_SEARCH]' : (group.keywords || '[DEFAULT_KEYWORDS]');
                        await prisma.sentOffer.upsert({
                            where: {
                                userId_groupId_itemId: {
                                    userId: user.id,
                                    groupId: group.id,
                                    itemId: String(safeOffer.itemId)
                                }
                            },
                            update: { sentAt: new Date(), keyword },
                            create: { userId: user.id, groupId: group.id, itemId: String(safeOffer.itemId), keyword, sentAt: new Date() }
                        });
                        
                        await prisma.log.create({
                            data: { 
                                userId: user.id, groupName: group.name, productTitle: safeOffer.productName,
                                price: String(safeOffer.price || 0), status: 'SENT'
                            }
                        });
                        
                        // Update last message sent timestamp
                        await prisma.group.update({
                            where: { id: group.id },
                            data: { lastMessageSent: new Date() }
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
            
            // Update lastAutomationRun for this user (whether we sent messages or not)
            // This ensures the interval is respected even if no valid offers are found.
            // If we only updated on success, a user with no valid offers would run every minute.
            try {
                await prisma.userSettings.update({
                    where: { userId: user.id },
                    data: { lastAutomationRun: new Date() }
                });
            } catch (updateErr) {
                console.error(`[JOB] Failed to update lastAutomationRun for User ${user.id}:`, updateErr.message);
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
    res.json(groups.map(g => {
        // Parse productCatIds from JSON string
        let productCatIds = [];
        if (g.productCatIds) {
            try {
                productCatIds = JSON.parse(g.productCatIds);
            } catch (e) {
                console.error(`Failed to parse productCatIds for group ${g.id}:`, e.message);
            }
        }
        
        return {
            ...g, 
            keywords: g.keywords ? g.keywords.split(',') : [], 
            negativeKeywords: g.negativeKeywords ? g.negativeKeywords.split(',') : [],
            lastMessageSent: g.lastMessageSent ? g.lastMessageSent.toISOString() : null,
            productCatIds, // Return as array
            sortType: g.sortType || 2, // Default to ITEM_SOLD_DESC
            minDiscountPercent: g.minDiscountPercent,
            minRating: g.minRating,
            minSales: g.minSales
        };
    }));
});

ApiRouter.post('/groups', async (req, res) => {
    const { link, name, category } = req.body;
    const group = await prisma.group.create({
        data: { userId: req.userId, link, name: name || 'Novo Grupo', category: category || null }
    });
    res.json(group);
});

ApiRouter.put('/groups/:id', async (req, res) => {
    const { 
        keywords, 
        negativeKeywords, 
        category, 
        productCatIds, 
        sortType, 
        minDiscountPercent, 
        minRating, 
        minSales 
    } = req.body;
    
    const group = await prisma.group.findUnique({ where: { id: req.params.id, userId: req.userId } });
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

    const updateData = {};
    
    // Handle existing fields
    if (keywords !== undefined) {
        updateData.keywords = Array.isArray(keywords) ? keywords.join(',') : keywords;
    }
    if (negativeKeywords !== undefined) {
        updateData.negativeKeywords = Array.isArray(negativeKeywords) ? negativeKeywords.join(',') : negativeKeywords;
    }
    if (category !== undefined) {
        updateData.category = category;
    }
    
    // Handle new productOfferV2 fields with category name/ID resolution
    if (productCatIds !== undefined) {
        // Convert array to resolved numeric IDs
        let resolvedCategoryIds = [];
        if (Array.isArray(productCatIds)) {
            resolvedCategoryIds = productCatIds
                .map(item => {
                    // Handle both string and number inputs
                    const strValue = String(item);
                    return resolveShopeeCategoryId(strValue);
                })
                .filter(id => id !== null); // Remove invalid entries
        }
        
        // Convert to JSON string for storage, or null if empty
        updateData.productCatIds = resolvedCategoryIds.length > 0 
            ? JSON.stringify(resolvedCategoryIds) 
            : null;
    }
    if (sortType !== undefined) {
        updateData.sortType = sortType;
    }
    if (minDiscountPercent !== undefined) {
        updateData.minDiscountPercent = minDiscountPercent;
    }
    if (minRating !== undefined) {
        updateData.minRating = minRating;
    }
    if (minSales !== undefined) {
        updateData.minSales = minSales;
    }

    await prisma.group.update({
        where: { id: req.params.id },
        data: updateData
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

// Send test message to a specific group
ApiRouter.post('/groups/:id/test', async (req, res) => {
    const client = botManager.getClient(req.userId);
    if (!client) return res.status(400).json({ error: 'Bot desconectado. Conecte o QR Code.' });
    
    const group = await prisma.group.findUnique({ where: { id: req.params.id, userId: req.userId } });
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });
    if (!group.chatId) return res.status(400).json({ error: 'Bot não está no grupo. Clique em "Entrar" primeiro.' });

    try {
        const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
        if (!settings?.shopeeAppId || !settings?.shopeeSecret) {
            return res.status(400).json({ error: 'Configure as credenciais da Shopee primeiro.' });
        }

        const plainSecret = decrypt(settings.shopeeSecret);
        if (!plainSecret) return res.status(400).json({ error: 'Erro ao descriptografar credenciais.' });

        const shopee = new ShopeeClient(settings.shopeeAppId, plainSecret);
        
        // Use new searchOffersForGroup helper
        const offers = await searchOffersForGroup(shopee, group);
        if (!offers || offers.length === 0) {
            return res.status(404).json({ error: 'Nenhuma oferta encontrada com a configuração do grupo.' });
        }

        // Apply blacklist filter
        const blacklist = group.negativeKeywords ? group.negativeKeywords.split(',').map(s=>s.trim().toLowerCase()).filter(s=>s) : [];
        const safeOffer = offers.find(o => {
            const title = o.productName.toLowerCase();
            return !blacklist.some(bad => title.includes(bad));
        });

        if (!safeOffer) {
            return res.status(404).json({ error: 'Todas as ofertas foram filtradas pela blacklist.' });
        }

        // Generate short link
        const shortLink = await shopee.generateShortLink(safeOffer.offerLink);
        safeOffer.shortLink = shortLink;
        
        // Render message
        const msg = renderMessage(settings.template, safeOffer);
        
        // Send message
        if(safeOffer.imageUrl) {
            const media = await MessageMedia.fromUrl(safeOffer.imageUrl, { unsafeMime: true });
            await client.sendMessage(group.chatId, media, { caption: msg });
        } else {
            await client.sendMessage(group.chatId, msg);
        }

        // Update last message sent timestamp
        await prisma.group.update({
            where: { id: group.id },
            data: { lastMessageSent: new Date() }
        });

        // Log the test message
        await prisma.log.create({
            data: { 
                userId: req.userId, 
                groupName: group.name, 
                productTitle: `[TESTE] ${safeOffer.productName}`,
                price: String(safeOffer.price || 0), 
                status: 'SENT'
            }
        });

        res.json({ ok: true, productTitle: safeOffer.productName });
    } catch (e) {
        console.error(`[TEST Error Group ${group.name}]`, e.message);
        res.status(500).json({ error: 'Erro ao enviar teste: ' + e.message });
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
        startTime: settings?.startTime || "07:00",
        endTime: settings?.endTime || "23:00",
        scheduleEnabled: settings?.scheduleEnabled !== undefined ? settings.scheduleEnabled : true
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
    const { startTime, endTime, scheduleEnabled } = req.body;
    
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ error: 'Formato de horário inválido. Use HH:MM (00:00 - 23:59)' });
    }
    
    const updateData = { startTime, endTime };
    // Only update scheduleEnabled if it's explicitly provided
    if (scheduleEnabled !== undefined) {
        updateData.scheduleEnabled = scheduleEnabled;
    }
    
    await prisma.userSettings.upsert({
        where: { userId: req.userId },
        update: updateData,
        create: { userId: req.userId, startTime, endTime, scheduleEnabled: scheduleEnabled !== undefined ? scheduleEnabled : true }
    });
    res.json({ ok: true });
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
        let sentCount = 0;
        let errorCount = 0;
        
        // Get interval setting for duplicate prevention
        const intervalMinutes = user.settings?.intervalMinutes || 5;

        for (const group of user.groups) {
            if (!group.chatId) continue;
            
            // Check if this group was recently sent a message (within intervalMinutes)
            // This prevents sending multiple offers to the same group too frequently
            if (group.lastMessageSent) {
                const minutesSinceLastMessage = (Date.now() - new Date(group.lastMessageSent).getTime()) / (1000 * 60);
                if (minutesSinceLastMessage < intervalMinutes) {
                    console.log(`[RUN-ONCE] Skipping Group ${group.name} - sent message ${Math.floor(minutesSinceLastMessage)} min ago (interval: ${intervalMinutes} min)`);
                    continue;
                }
            }
            
            // Dedupe: Check history for THIS group (same calendar day to prevent repeating offers)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const recentOffers = await prisma.sentOffer.findMany({
                where: { groupId: group.id, sentAt: { gte: todayStart } },
                select: { itemId: true }
            });
            const sentIds = new Set(recentOffers.map(o => o.itemId));

            try {
                // Use new searchOffersForGroup helper
                const offers = await searchOffersForGroup(shopee, group);
                
                // Log API response count for debugging
                console.log(`[RUN-ONCE] API returned ${offers.length} offers for group ${group.name}`);
                
                if (offers.length === 0) {
                    console.log(`[RUN-ONCE] No offers found from API for group ${group.name}. Check category ID or keywords configuration.`);
                    continue;
                }
                
                const validOffers = offers.filter(o => !sentIds.has(String(o.itemId)));
                
                // Log duplicate filtering result
                if (validOffers.length < offers.length) {
                    console.log(`[RUN-ONCE] Filtered ${offers.length - validOffers.length} duplicate offers (already sent today) for group ${group.name}`);
                }

                // Blacklist
                const blacklist = group.negativeKeywords ? group.negativeKeywords.split(',').map(s=>s.trim().toLowerCase()).filter(s=>s) : [];
                const safeOffer = validOffers.find(o => {
                    const title = o.productName.toLowerCase();
                    return !blacklist.some(bad => title.includes(bad));
                });
                
                if (!safeOffer) {
                    if (validOffers.length > 0) {
                        console.log(`[RUN-ONCE] All ${validOffers.length} valid offers filtered by blacklist for group ${group.name}`);
                    } else {
                        console.log(`[RUN-ONCE] No valid offers to send (all duplicates) for group ${group.name}`);
                    }
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

                    // Record - use descriptive marker for category search vs keyword search
                    // Use upsert to handle race conditions where same offer might be inserted concurrently
                    const keyword = group.productCatIds ? '[CATEGORY_SEARCH]' : (group.keywords || '[DEFAULT_KEYWORDS]');
                    await prisma.sentOffer.upsert({
                        where: {
                            userId_groupId_itemId: {
                                userId: user.id,
                                groupId: group.id,
                                itemId: String(safeOffer.itemId)
                            }
                        },
                        update: { sentAt: new Date(), keyword },
                        create: { userId: user.id, groupId: group.id, itemId: String(safeOffer.itemId), keyword, sentAt: new Date() }
                    });
                    
                    await prisma.log.create({
                        data: { 
                            userId: user.id, groupName: group.name, productTitle: safeOffer.productName,
                            price: String(safeOffer.price || 0), status: 'SENT'
                        }
                    });
                    
                    // Update last message sent timestamp
                    await prisma.group.update({
                        where: { id: group.id },
                        data: { lastMessageSent: new Date() }
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

// =======================
// PUBLIC META WEBHOOK (No Auth - must be before protected API routes)
// =======================
// GET: Meta webhook verification (responds with hub.challenge when token matches)
app.get('/api/meta/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const receivedToken = String(req.query["hub.verify_token"] || "").trim();
  const challenge = req.query['hub.challenge'];

  const expectedToken = (process.env.META_IG_VERIFY_TOKEN || "").trim();

  // Ensure expectedToken is configured and token matches
  if (expectedToken && mode === 'subscribe' && receivedToken === expectedToken) {
    console.log('[META WEBHOOK] Verification successful');
    return res.status(200).send(String(challenge));
  }

  console.log('[META WEBHOOK] Verification failed');
  return res.sendStatus(403);
});

// POST: Meta webhook event receiver (acknowledge immediately)
app.post('/api/meta/webhook/instagram', express.json({ type: '*/*' }), (req, res) => {
  // Log only non-sensitive metadata
  const eventType = req.body?.object || 'unknown';
  console.log('[META WEBHOOK] Received event type:', eventType);
  // Acknowledge quickly - process async if needed in the future
  return res.status(200).json({ ok: true });
});

// =======================
// META INSTAGRAM OAUTH (requires authentication)
// =======================
// Helper function for Graph API requests
async function graphGet(url, accessToken) {
  try {
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}access_token=${accessToken}`;
    const response = await axios.get(fullUrl, { timeout: 15000 });
    return response.data;
  } catch (error) {
    // Log error without exposing tokens
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('[GRAPH API] Error:', errorMsg);
    throw new Error(`Graph API Error: ${errorMsg}`);
  }
}

// GET: Start Instagram OAuth flow - redirects to Meta Business Login via Facebook OAuth dialog
app.get('/api/meta/auth/instagram', oauthLimiter, requireAuth, (req, res) => {
  // Build Facebook OAuth URL for Meta Business Login (Instagram Business use case)
  const configId = process.env.META_IG_CONFIG_ID;
  
  // Scopes required for Instagram via Facebook Login (Graph API)
  // Removido: pages_read_engagement (estava causando invalid scope no OAuth)
  const scope = 'pages_show_list,instagram_basic,instagram_manage_comments,instagram_manage_messages';

  // Create signed state parameter containing userId for callback verification
  // This allows the callback to identify the user without requiring site auth token
  const statePayload = { userId: req.userId };
  const state = jwt.sign(statePayload, JWT_SECRET, { expiresIn: '15m' });

  // Build the Facebook OAuth dialog URL
  const oauthUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth');
  oauthUrl.searchParams.set('client_id', META_FB_APP_ID);
  oauthUrl.searchParams.set('redirect_uri', META_IG_REDIRECT_URI);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', scope);
  oauthUrl.searchParams.set('state', state);
  
  // Include config_id if provided (required for Meta Business Login)
  if (configId) {
    oauthUrl.searchParams.set('config_id', configId);
  }
  
  // Force re-authentication for security
  oauthUrl.searchParams.set('auth_type', 'rerequest');

  console.log('[INSTAGRAM OAUTH] AUTHORIZE redirect_uri =', META_IG_REDIRECT_URI);
  console.log('[INSTAGRAM OAUTH] Redirecting user to Facebook OAuth dialog for Meta Business Login');
  res.redirect(oauthUrl.toString());
});

// GET: OAuth callback - receives code and exchanges for tokens via Graph API
// NOTE: This route does NOT require site auth token - userId is extracted from signed state parameter
app.get('/api/meta/auth/instagram/callback', oauthLimiter, async (req, res) => {
  const META_APP_SECRET = process.env.META_APP_SECRET;
  const BASE_URL = process.env.APP_BASE_URL || 'https://www.achady.com.br';

  console.log('[INSTAGRAM OAUTH] EXCHANGE redirect_uri =', META_IG_REDIRECT_URI);

  const { code, error: oauthError, error_description, state } = req.query;

  // Handle OAuth errors from Facebook
  if (oauthError) {
    console.error('[INSTAGRAM OAUTH] OAuth error:', oauthError, error_description);
    return res.redirect(`${BASE_URL}/integracoes/instagram?status=error&reason=${encodeURIComponent(error_description || oauthError)}`);
  }

  // Validate code presence
  if (!code) {
    console.error('[INSTAGRAM OAUTH] No code received');
    return res.redirect(`${BASE_URL}/integracoes/instagram?status=error&reason=no_code`);
  }

  // Verify and extract userId from state parameter
  if (!state) {
    console.error('[INSTAGRAM OAUTH] Missing state parameter');
    return res.redirect(`${BASE_URL}/integracoes/instagram?status=error&reason=invalid_state`);
  }

  let userId;
  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    userId = decoded.userId;
    if (!userId) {
      throw new Error('Invalid state payload');
    }
  } catch (stateError) {
    console.error('[INSTAGRAM OAUTH] Invalid or expired state:', stateError.message);
    return res.redirect(`${BASE_URL}/integracoes/instagram?status=error&reason=invalid_state`);
  }

  // Validate server configuration
  if (!META_APP_SECRET) {
    console.error('[INSTAGRAM OAUTH] Missing server configuration (META_APP_SECRET)');
    return res.redirect(`${BASE_URL}/integracoes/instagram?status=error&reason=server_config`);
  }

  try {
    // --- DIAGNÓSTICO SEGURO (não vaza segredo/código) ---
    console.log(JSON.stringify({
      tag: "META_OAUTH_DEBUG",
      timestamp: new Date().toISOString(),
      appIdLast4: META_FB_APP_ID ? META_FB_APP_ID.slice(-4) : null,
      secretLength: META_APP_SECRET ? META_APP_SECRET.length : 0,
      redirectUri: META_IG_REDIRECT_URI,
      hasCode: Boolean(code),
    }));
    // --- fim diagnóstico seguro ---

    // Step 1: Exchange code for short-lived access token via Graph API (GET request)
    console.log('[META OAUTH] Exchanging code for access token via Graph API');
    const tokenUrl = new URL('https://graph.facebook.com/v24.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', META_FB_APP_ID);
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', META_IG_REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await axios.get(tokenUrl.toString(), { timeout: 15000 });
    const shortLivedToken = tokenResponse.data.access_token;

    if (!shortLivedToken) {
      throw new Error('No access token received from Graph API');
    }

    // Step 2: Exchange short-lived token for long-lived token via Graph API
    console.log('[META OAUTH] Exchanging for long-lived token');
    const longLivedUrl = new URL('https://graph.facebook.com/v24.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', META_FB_APP_ID);
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);
    
    const longLivedResponse = await axios.get(longLivedUrl.toString(), { timeout: 15000 });
    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in;

    if (!longLivedToken) {
      throw new Error('No long-lived access token received from Graph API');
    }

    // Calculate expiration date with validation
    let expiresAt = null;
    if (typeof expiresIn === 'number' && expiresIn > 0 && expiresIn < 365 * 24 * 60 * 60) {
      // Valid range: between 1 second and 1 year
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    // Step 3: Get user's Facebook Pages with Instagram Business Account
    console.log('[META OAUTH] Fetching Pages with Instagram Business Account');
    const pagesData = await graphGet(
      'https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}',
      longLivedToken
    );

    // Find first page with Instagram Business Account
    const pageWithIG = pagesData.data?.find(page => page.instagram_business_account);

    if (!pageWithIG) {
      console.error('[META OAUTH] No Page with Instagram Business Account found');
      return res.redirect(`${BASE_URL}/integracoes/instagram?status=error&reason=no_instagram_business`);
    }

    const pageId = pageWithIG.id;
    const pageName = pageWithIG.name;
    const pageAccessToken = pageWithIG.access_token;
    const igBusinessId = pageWithIG.instagram_business_account?.id;
    const igUsername = pageWithIG.instagram_business_account?.username;

    console.log(`[META OAUTH] Found IG Business: @${igUsername} (Page: ${pageName})`);

    // Step 4: Save to database (encrypted tokens)
    await prisma.socialAccount.upsert({
      where: {
        userId_provider: {
          userId: userId,
          provider: 'instagram'
        }
      },
      update: {
        pageId,
        igBusinessId,
        igUsername,
        pageAccessToken: encrypt(pageAccessToken),
        userAccessToken: encrypt(longLivedToken),
        expiresAt,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        provider: 'instagram',
        pageId,
        igBusinessId,
        igUsername,
        pageAccessToken: encrypt(pageAccessToken),
        userAccessToken: encrypt(longLivedToken),
        expiresAt
      }
    });

    console.log(`[META OAUTH] Successfully saved integration for user ${userId}`);
    return res.redirect(`${BASE_URL}/integracoes/instagram?status=connected&username=${encodeURIComponent(igUsername || '')}`);

  } catch (error) {
    console.error('[INSTAGRAM OAUTH] Token exchange failed:', error?.response?.status, error?.response?.data || error.message);
    
    // In development, return JSON error for debugging
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: 'OAuth failed', details: error?.response?.data || error.message });
    }
    
    return res.redirect(`${BASE_URL}/integracoes/instagram?status=error&reason=${encodeURIComponent('token_exchange_failed')}`);
  }
});

// GET: Instagram integration status (DEV only shows full status, PROD shows minimal)
app.get('/api/meta/instagram/status', oauthLimiter, requireAuth, async (req, res) => {
  try {
    const integration = await prisma.socialAccount.findUnique({
      where: {
        userId_provider: {
          userId: req.userId,
          provider: 'instagram'
        }
      },
      select: {
        igUsername: true,
        igBusinessId: true,
        pageId: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!integration) {
      return res.json({ connected: false });
    }

    const isExpired = integration.expiresAt && new Date() > integration.expiresAt;

    res.json({
      connected: true,
      expired: isExpired,
      igUsername: integration.igUsername,
      igBusinessId: integration.igBusinessId,
      pageId: integration.pageId,
      expiresAt: integration.expiresAt?.toISOString() || null,
      connectedAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('[META STATUS] Error:', error.message);
    res.status(500).json({ error: 'Erro ao verificar integração' });
  }
});

// DELETE: Disconnect Instagram integration
app.delete('/api/meta/instagram/disconnect', oauthLimiter, requireAuth, async (req, res) => {
  try {
    await prisma.socialAccount.deleteMany({
      where: {
        userId: req.userId,
        provider: 'instagram'
      }
    });

    console.log(`[META OAUTH] Disconnected Instagram for user ${req.userId}`);
    res.json({ ok: true, message: 'Integração Instagram desconectada com sucesso' });
  } catch (error) {
    console.error('[META DISCONNECT] Error:', error.message);
    res.status(500).json({ error: 'Erro ao desconectar integração' });
  }
});

app.use('/api', ApiRouter);

// Serve static assets for the dashboard frontend
app.use(express.static(path.join(__dirname, 'dist')));

// =======================
// PUBLIC LEGAL PAGES (No Auth, No SPA Shell)
// =======================
const LEGAL_PAGE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; background: #f9f9f9; margin: 0; padding: 20px; }
  .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  h1 { color: #1a1a1a; margin-bottom: 10px; }
  h2 { color: #333; margin-top: 30px; }
  p, li { margin-bottom: 12px; }
  ul { padding-left: 20px; }
  .update-date { color: #666; font-size: 14px; margin-bottom: 30px; }
  a { color: #0066cc; }
`;

const LEGAL_DOMAIN = 'https://www.achady.com.br';
const LEGAL_EMAIL = 'suporte@achady.com.br';
const LEGAL_UPDATE_DATE = '12/12/2025';

// GET /politica-de-privacidade - Privacy Policy
app.get('/politica-de-privacidade', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidade - Achady</title>
  <style>${LEGAL_PAGE_STYLE}</style>
</head>
<body>
  <div class="container">
    <h1>Política de Privacidade</h1>
    <p class="update-date">Última atualização: ${LEGAL_UPDATE_DATE}</p>
    
    <p>A Achady ("nós", "nosso" ou "empresa"), acessível em <a href="${LEGAL_DOMAIN}">${LEGAL_DOMAIN}</a>, está comprometida em proteger a privacidade dos nossos usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais.</p>
    
    <h2>1. Informações que Coletamos</h2>
    <p>Podemos coletar os seguintes tipos de informações:</p>
    <ul>
      <li><strong>Dados de cadastro:</strong> nome, e-mail, senha (criptografada).</li>
      <li><strong>Dados de uso:</strong> informações sobre como você utiliza nossa plataforma, incluindo logs de acesso e interações.</li>
      <li><strong>Dados de integração:</strong> credenciais de API da Shopee e informações de grupos do WhatsApp que você configurar.</li>
      <li><strong>Cookies e tecnologias similares:</strong> para manter sua sessão e melhorar a experiência do usuário.</li>
    </ul>
    
    <h2>2. Como Usamos Suas Informações</h2>
    <p>Utilizamos suas informações para:</p>
    <ul>
      <li>Fornecer e manter nossos serviços de automação de ofertas.</li>
      <li>Autenticar sua conta e proteger contra acessos não autorizados.</li>
      <li>Enviar comunicações relacionadas ao serviço.</li>
      <li>Melhorar e personalizar sua experiência na plataforma.</li>
      <li>Cumprir obrigações legais.</li>
    </ul>
    
    <h2>3. Compartilhamento de Dados</h2>
    <p>Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto:</p>
    <ul>
      <li>Quando necessário para fornecer o serviço (ex: APIs da Shopee).</li>
      <li>Para cumprir obrigações legais ou ordens judiciais.</li>
      <li>Para proteger nossos direitos, privacidade, segurança ou propriedade.</li>
    </ul>
    
    <h2>4. Segurança dos Dados</h2>
    <p>Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações, incluindo:</p>
    <ul>
      <li>Criptografia de senhas e dados sensíveis.</li>
      <li>Uso de HTTPS em todas as comunicações.</li>
      <li>Limitação de acesso aos dados apenas a funcionários autorizados.</li>
    </ul>
    
    <h2>5. Retenção de Dados</h2>
    <p>Mantemos suas informações pessoais pelo tempo necessário para fornecer nossos serviços ou conforme exigido por lei. Você pode solicitar a exclusão de seus dados a qualquer momento.</p>
    
    <h2>6. Seus Direitos</h2>
    <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
    <ul>
      <li>Acessar seus dados pessoais.</li>
      <li>Corrigir dados incompletos ou desatualizados.</li>
      <li>Solicitar a exclusão de seus dados.</li>
      <li>Revogar o consentimento para o tratamento de dados.</li>
      <li>Solicitar a portabilidade dos dados.</li>
    </ul>
    
    <h2>7. Cookies</h2>
    <p>Utilizamos cookies essenciais para manter sua sessão autenticada. Não utilizamos cookies de rastreamento ou publicidade de terceiros.</p>
    
    <h2>8. Alterações nesta Política</h2>
    <p>Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações significativas através do e-mail cadastrado ou aviso na plataforma.</p>
    
    <h2>9. Contato</h2>
    <p>Para dúvidas, solicitações ou reclamações relacionadas à privacidade, entre em contato conosco:</p>
    <p>E-mail: <a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a></p>
    <p>Site: <a href="${LEGAL_DOMAIN}">${LEGAL_DOMAIN}</a></p>
  </div>
</body>
</html>`);
});

// GET /termos - Terms of Service
app.get('/termos', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Uso - Achady</title>
  <style>${LEGAL_PAGE_STYLE}</style>
</head>
<body>
  <div class="container">
    <h1>Termos de Uso</h1>
    <p class="update-date">Última atualização: ${LEGAL_UPDATE_DATE}</p>
    
    <p>Bem-vindo à Achady! Ao acessar ou utilizar nossa plataforma em <a href="${LEGAL_DOMAIN}">${LEGAL_DOMAIN}</a>, você concorda com estes Termos de Uso. Por favor, leia-os atentamente.</p>
    
    <h2>1. Aceitação dos Termos</h2>
    <p>Ao criar uma conta ou utilizar nossos serviços, você declara ter lido, compreendido e concordado com estes Termos de Uso e nossa Política de Privacidade.</p>
    
    <h2>2. Descrição do Serviço</h2>
    <p>A Achady é uma plataforma de automação que permite aos usuários:</p>
    <ul>
      <li>Realizar integrações solicitadas pelo usuário (Meta/Instagram) para mensagens e automação, dentro das permissões e políticas das plataformas.</li>
      <li>Configurar grupos e parâmetros de automação.</li>
      <li>Gerenciar templates de mensagens e filtros de produtos.</li>
    </ul>
    
    <h2>3. Requisitos de Uso</h2>
    <p>Para utilizar nossos serviços, você deve:</p>
    <ul>
      <li>Ter pelo menos 18 anos de idade.</li>
      <li>Fornecer informações verdadeiras e atualizadas no cadastro.</li>
      <li>Manter a confidencialidade de suas credenciais de acesso.</li>
      <li>Usar o serviço de acordo com as leis aplicáveis e políticas das plataformas integradas.</li>
    </ul>
    
    <h2>4. Responsabilidades do Usuário</h2>
    <p>Você é responsável por:</p>
    <ul>
      <li>Todo o conteúdo enviado através da plataforma.</li>
      <li>Garantir que possui autorização para enviar mensagens aos grupos configurados.</li>
      <li>Cumprir os Termos de Serviço das plataformas integradas.</li>
      <li>Não utilizar o serviço para spam, fraude ou atividades ilegais.</li>
    </ul>
    
    <h2>5. Limitações de Responsabilidade</h2>
    <p>A Achady não se responsabiliza por:</p>
    <ul>
      <li>Bloqueios ou restrições aplicados pelas plataformas integradas à sua conta.</li>
      <li>Indisponibilidade temporária dos serviços por manutenção ou problemas técnicos.</li>
      <li>Perdas ou danos resultantes do uso inadequado da plataforma.</li>
      <li>Alterações nas APIs ou políticas de terceiros que afetem a funcionalidade.</li>
    </ul>
    
    <h2>6. Propriedade Intelectual</h2>
    <p>Todo o conteúdo, código, design e marca da Achady são de propriedade exclusiva da empresa e protegidos por leis de propriedade intelectual. É proibida a reprodução, distribuição ou modificação sem autorização prévia.</p>
    
    <h2>7. Suspensão e Encerramento</h2>
    <p>Reservamo-nos o direito de suspender ou encerrar sua conta, sem aviso prévio, caso:</p>
    <ul>
      <li>Você viole estes Termos de Uso.</li>
      <li>Seu uso represente risco à segurança da plataforma ou outros usuários.</li>
      <li>Seja necessário para cumprir determinação legal.</li>
    </ul>
    
    <h2>8. Modificações nos Termos</h2>
    <p>Podemos modificar estes Termos de Uso a qualquer momento. Alterações significativas serão comunicadas por e-mail ou aviso na plataforma. O uso continuado após as alterações constitui aceitação dos novos termos.</p>
    
    <h2>9. Lei Aplicável e Foro</h2>
    <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será resolvida no foro da comarca de São Paulo, SP.</p>
    
    <h2>10. Contato</h2>
    <p>Para dúvidas sobre estes Termos de Uso, entre em contato:</p>
    <p>E-mail: <a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a></p>
    <p>Site: <a href="${LEGAL_DOMAIN}">${LEGAL_DOMAIN}</a></p>
  </div>
</body>
</html>`);
});

// GET /exclusao-de-dados - Data Deletion Instructions
app.get('/exclusao-de-dados', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exclusão de Dados - Achady</title>
  <style>${LEGAL_PAGE_STYLE}</style>
</head>
<body>
  <div class="container">
    <h1>Exclusão de Dados</h1>
    <p class="update-date">Última atualização: ${LEGAL_UPDATE_DATE}</p>
    
    <p>Na Achady, respeitamos seu direito à privacidade e oferecemos formas simples de solicitar a exclusão dos seus dados pessoais, conforme previsto na Lei Geral de Proteção de Dados (LGPD).</p>
    
    <h2>1. Como Solicitar a Exclusão dos Seus Dados</h2>
    <p>Você pode solicitar a exclusão dos seus dados de duas formas:</p>
    
    <h3>Opção 1: Exclusão pela Plataforma</h3>
    <p>Se você possui acesso à sua conta:</p>
    <ul>
      <li>Acesse <a href="${LEGAL_DOMAIN}">${LEGAL_DOMAIN}</a> e faça login.</li>
      <li>Navegue até as Configurações da sua conta.</li>
      <li>Selecione a opção "Excluir Conta".</li>
      <li>Confirme a exclusão digitando "EXCLUIR" e sua senha.</li>
    </ul>
    
    <h3>Opção 2: Exclusão por E-mail</h3>
    <p>Se você não consegue acessar sua conta ou prefere solicitar por e-mail:</p>
    <ul>
      <li>Envie um e-mail para <a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a>.</li>
      <li>Use o assunto: "Solicitação de Exclusão de Dados".</li>
      <li>Inclua no corpo do e-mail: seu nome completo e o e-mail cadastrado na plataforma.</li>
    </ul>
    
    <h2>2. Dados que Serão Excluídos</h2>
    <p>Ao solicitar a exclusão, removeremos permanentemente:</p>
    <ul>
      <li>Dados de cadastro (nome, e-mail, senha criptografada).</li>
      <li>Configurações da conta e preferências.</li>
      <li>Credenciais de integração (Shopee API).</li>
      <li>Grupos cadastrados e configurações de automação.</li>
      <li>Histórico de ofertas enviadas e logs de atividade.</li>
      <li>Sessões do WhatsApp associadas à conta.</li>
    </ul>
    
    <h2>3. Prazo para Exclusão</h2>
    <ul>
      <li><strong>Exclusão pela plataforma:</strong> imediata.</li>
      <li><strong>Exclusão por e-mail:</strong> até 15 dias úteis após confirmação da identidade.</li>
    </ul>
    
    <h2>4. Dados Retidos</h2>
    <p>Alguns dados podem ser retidos por períodos adicionais quando:</p>
    <ul>
      <li>Exigido por lei ou regulamentação aplicável.</li>
      <li>Necessário para exercício regular de direitos em processos judiciais.</li>
      <li>Anonimizados para fins estatísticos (sem identificação pessoal).</li>
    </ul>
    
    <h2>5. Consequências da Exclusão</h2>
    <p>Após a exclusão dos dados:</p>
    <ul>
      <li>Você perderá acesso permanente à sua conta.</li>
      <li>Todas as configurações e integrações serão removidas.</li>
      <li>Não será possível recuperar os dados excluídos.</li>
      <li>Você poderá criar uma nova conta a qualquer momento.</li>
    </ul>
    
    <h2>6. Contato</h2>
    <p>Para dúvidas sobre exclusão de dados ou exercício de outros direitos previstos na LGPD:</p>
    <p>E-mail: <a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a></p>
    <p>Site: <a href="${LEGAL_DOMAIN}">${LEGAL_DOMAIN}</a></p>
  </div>
</body>
</html>`);
});

// Catch-all route: serve index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`ACHADY Server running on port ${PORT}`);
  
  // Warn if META_IG_VERIFY_TOKEN is not configured
  if (!(process.env.META_IG_VERIFY_TOKEN || "").trim()) {
    console.warn("META_IG_VERIFY_TOKEN is empty - webhook verification will fail");
  }
});