// server.js
// ACHADY – BOT WHATSAPP + SHOPEE (MVP VALIDAÇÃO)

// ========================
// IMPORTS
// ========================
import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import axios from "axios";
import crypto from "crypto";
import sqlite3 from "sqlite3";
import { open } from "sqlite"; // MÉTODO CORRETO
import dotenv from "dotenv";

dotenv.config();

const { Client, LocalAuth } = pkg;

// ========================
// CONFIG BÁSICA
// ========================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// 1 usuário padrão (MVP)
const DEFAULT_USER_ID = process.env.USER_ID_PADRAO || "1";

// Shopee – credenciais via .env (MVP)
const SHOPEE_APP_ID = process.env.SHOPEE_APP_ID || "";
const SHOPEE_APP_SECRET = process.env.SHOPEE_APP_SECRET || "";

// Automações
const DEFAULT_KEYWORD = process.env.KEYWORD_PADRAO || "promoção relâmpago";
const DEFAULT_INTERVAL_MINUTES = Number(process.env.INTERVALO_MINUTOS || 5);

// ========================
// BANCO – SQLITE (achady.db)
// ========================

// Inicialização do Banco com Wrapper Promise-based
let db;

(async () => {
  try {
    db = await open({
      filename: './achady.db',
      driver: sqlite3.Database
    });

    console.log("📦 Banco de dados SQLite conectado.");

    // Cria tabelas
    await db.exec(`
      CREATE TABLE IF NOT EXISTS shopee_credentials (
        user_id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        app_secret TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        group_invite TEXT,
        group_name TEXT,
        group_id TEXT,
        category TEXT
      );

      CREATE TABLE IF NOT EXISTS automation (
        user_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL,
        frequency_minutes INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        template TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        group_name TEXT, 
        product_title TEXT,
        product_link TEXT,
        price REAL,
        original_price REAL,
        discount_percent REAL,
        sent_at INTEGER NOT NULL
      );
    `);

    // Configuração Inicial Padrão
    const defaultTemplate = `
🔥 OFERTA IMPERDÍVEL! 🔥

{{titulo}}

💰 Apenas: {{preco}}
❌ De: {{precoOriginal}}
🎯 Desconto: {{desconto}}

🛒 Compre aqui: {{link}}
    `.trim();

    await db.run(
      `INSERT OR IGNORE INTO automation (user_id, enabled, frequency_minutes, keyword, template) VALUES (?, ?, ?, ?, ?)`,
      [DEFAULT_USER_ID, 0, DEFAULT_INTERVAL_MINUTES, DEFAULT_KEYWORD, defaultTemplate]
    );

    if (SHOPEE_APP_ID && SHOPEE_APP_SECRET) {
      await db.run(
        `INSERT OR REPLACE INTO shopee_credentials (user_id, app_id, app_secret) VALUES (?, ?, ?)`,
        [DEFAULT_USER_ID, SHOPEE_APP_ID, SHOPEE_APP_SECRET]
      );
    }

  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
  }
})();

// Helpers de compatibilidade (usando o objeto db inicializado)
const dbGet = async (sql, params) => db.get(sql, params);
const dbAll = async (sql, params) => db.all(sql, params);
const dbRun = async (sql, params) => db.run(sql, params);


// ========================
// MULTI-SESSÕES WHATSAPP
// ========================
let sessions = {};
let automationTimers = {};

async function createSession(userId) {
  if (sessions[userId]) return sessions[userId];

  console.log("➡️ Criando sessão para USER:", userId);

  const client = new Client({
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
    authStrategy: new LocalAuth({
      clientId: `achady-session-${userId}`,
    }),
  });

  sessions[userId] = {
    client,
    qr: null,
    status: "starting",
    groupId: null,
  };

  client.on("qr", async (qr) => {
    console.log(`📌 QR CODE GERADO PARA USER: ${userId}`);
    const qrImage = await qrcode.toDataURL(qr);
    sessions[userId].qr = qrImage;
    sessions[userId].status = "qr";
  });

  client.on("ready", () => {
    console.log(`✅ WhatsApp conectado — USER ${userId}`);
    sessions[userId].status = "ready";
  });

  client.on("disconnected", () => {
    console.log(`⚠️ WhatsApp desconectado — USER ${userId}`);
    sessions[userId].status = "offline";
  });

  client.initialize();
  return sessions[userId];
}

// ========================
// FUNÇÕES SHOPEE
// ========================
const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

function buildShopeeAuthHeader(appId, appSecret, payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const factor = appId + timestamp + payload + appSecret;
  const signature = crypto.createHash("sha256").update(factor).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

async function fetchShopeeOffers(userId) {
  const cred = await dbGet(
    `SELECT app_id, app_secret FROM shopee_credentials WHERE user_id = ?`,
    [userId]
  );

  if (!cred) {
    console.error("❌ Credenciais Shopee não encontradas no banco.");
    return [];
  }

  const automation = await dbGet(
    `SELECT keyword FROM automation WHERE user_id = ?`,
    [userId]
  );
  const keyword = automation?.keyword || DEFAULT_KEYWORD;

  const query = `
    query productOffer($keyword: String!, $page: Int!, $limit: Int!) {
      productOfferV2(
        keyword: $keyword,
        page: $page,
        limit: $limit,
        sortType: 2
      ) {
        nodes {
          itemId
          productName
          offerLink
          priceMin
          priceMax
          priceDiscountRate
        }
      }
    }
  `;

  const payload = JSON.stringify({
    query,
    operationName: "productOffer",
    variables: { keyword, page: 1, limit: 5 },
  });

  const authHeader = buildShopeeAuthHeader(cred.app_id, cred.app_secret, payload);

  try {
    const response = await axios.post(SHOPEE_ENDPOINT, payload, {
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      timeout: 10000,
    });

    const nodes = response.data?.data?.productOfferV2?.nodes || [];
    return nodes.map((n) => {
      const price = Number(n.priceMin || 0);
      const discountPercent = Number(n.priceDiscountRate || 0);
      let originalPrice = price;
      if (discountPercent > 0 && discountPercent < 100) {
        originalPrice = price / (1 - discountPercent / 100);
      }
      return {
        itemId: n.itemId,
        title: n.productName,
        link: n.offerLink,
        price,
        originalPrice,
        discountPercent,
      };
    });
  } catch (err) {
    console.error("❌ Erro Shopee:", err?.response?.data || err.message);
    return [];
  }
}

// ========================
// AUTOMAÇÃO
// ========================
function formatPriceBRL(value) {
  if (value == null || isNaN(value)) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildMessageFromTemplate(userId, offer) {
  const config = await dbGet(
    `SELECT template FROM automation WHERE user_id = ?`,
    [userId]
  );

  const template = config?.template || `🔥 {{titulo}} por {{preco}}! Link: {{link}}`;
  
  return template
    .replace(/{{titulo}}/g, offer.title)
    .replace(/{{preco}}/g, formatPriceBRL(offer.price))
    .replace(/{{precoOriginal}}/g, formatPriceBRL(offer.originalPrice))
    .replace(/{{desconto}}/g, `${offer.discountPercent}%`)
    .replace(/{{link}}/g, offer.link);
}

async function runAutomationCycle(userId) {
  try {
    const session = sessions[userId];
    if (!session || session.status !== "ready") return;

    const automation = await dbGet(`SELECT * FROM automation WHERE user_id = ?`, [userId]);
    if (!automation || !automation.enabled) return;

    // Busca grupos
    const groups = await dbAll(`SELECT group_id, group_name FROM groups WHERE user_id = ?`, [userId]);
    if (!groups.length) {
       console.log("⚠️ Nenhum grupo cadastrado.");
       return;
    }

    const offers = await fetchShopeeOffers(userId);
    if (!offers.length) return;

    const offer = offers[0];
    const message = await buildMessageFromTemplate(userId, offer);

    for (const group of groups) {
      if (!group.group_id) continue;
      
      console.log(`📨 Enviando oferta para ${group.group_name} (${group.group_id})`);
      await session.client.sendMessage(group.group_id, message);

      await dbRun(
        `INSERT INTO logs (user_id, group_id, group_name, product_title, product_link, price, original_price, discount_percent, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, group.group_id, group.group_name, offer.title, offer.link, offer.price, offer.originalPrice, offer.discountPercent, Math.floor(Date.now() / 1000)]
      );

      await sleep(5000 + Math.random() * 5000); // Delay entre grupos
    }
  } catch (err) {
    console.error("❌ Erro ciclo automação:", err.message);
  }
}

async function startAutomationTimer(userId) {
  if (automationTimers[userId]) {
    clearInterval(automationTimers[userId]);
    delete automationTimers[userId];
  }

  const automation = await dbGet(`SELECT enabled, frequency_minutes FROM automation WHERE user_id = ?`, [userId]);
  if (!automation || !automation.enabled) return;

  const intervalMs = (automation.frequency_minutes || 5) * 60 * 1000;
  console.log(`⏱️ Automação iniciada (User ${userId}, cada ${automation.frequency_minutes} min)`);
  
  // Executa o primeiro ciclo imediatamente
  runAutomationCycle(userId);

  automationTimers[userId] = setInterval(() => runAutomationCycle(userId), intervalMs);
}

// ========================
// ROTAS HTTP
// ========================

app.get("/", (req, res) => res.send("Servidor WhatsApp Achady (SQLite + Promise) rodando. 🚀"));

app.get("/status", (req, res) => {
  const users = Object.keys(sessions);
  const status = users.length > 0 ? sessions[users[0]]?.status : "offline";
  res.json({ ok: true, status, users });
});

app.post("/start/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const session = await createSession(userId);
    res.json({ message: "Sessão iniciada", status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/qr/:userId", (req, res) => {
  const sess = sessions[req.params.userId];
  if (!sess) return res.status(404).json({ qr: null, status: "not_started" });
  res.json({ qr: sess.qr, status: sess.status });
});

app.post("/join/:userId", async (req, res) => {
  const { userId } = req.params;
  const { invite, name, category } = req.body;

  if (!invite) return res.status(400).json({ error: "Invite obrigatório" });

  const sess = sessions[userId];
  if (!sess || sess.status !== "ready") return res.status(400).json({ error: "WhatsApp não conectado" });

  try {
    const chat = await sess.client.acceptInvite(invite);
    const groupId = chat.id._serialized;
    const groupName = name || chat.name || "Grupo Achady";

    await dbRun(
      `INSERT INTO groups (user_id, group_invite, group_name, group_id, category) VALUES (?, ?, ?, ?, ?)`,
      [userId, invite, groupName, groupId, category || 'geral']
    );

    res.json({ ok: true, message: "Grupo adicionado", groupId });
  } catch (err) {
    res.status(500).json({ error: "Falha ao entrar no grupo: " + err.message });
  }
});

// COMPATIBILIDADE: Rota unificada de Configuração (usada pelo Dashboard)
app.post("/config/:userId", async (req, res) => {
    const { userId } = req.params;
    const { 
        appId, appSecret, // Credenciais Shopee
        keyword, messageTemplate, intervalMinutes, isActive // Automação
    } = req.body;

    try {
        // Atualiza Credenciais se fornecidas
        if (appId !== undefined || appSecret !== undefined) {
            const current = await dbGet("SELECT * FROM shopee_credentials WHERE user_id = ?", [userId]);
            await dbRun(
                `INSERT OR REPLACE INTO shopee_credentials (user_id, app_id, app_secret) VALUES (?, ?, ?)`,
                [userId, appId || current?.app_id || "", appSecret || current?.app_secret || ""]
            );
        }

        // Atualiza Automação se fornecidos
        if (keyword !== undefined || messageTemplate !== undefined || intervalMinutes !== undefined || isActive !== undefined) {
             const currentAuto = await dbGet("SELECT * FROM automation WHERE user_id = ?", [userId]);
             
             const newEnabled = isActive !== undefined ? (isActive ? 1 : 0) : (currentAuto?.enabled || 0);
             const newFreq = intervalMinutes || currentAuto?.frequency_minutes || 15;
             const newKw = keyword || currentAuto?.keyword || DEFAULT_KEYWORD;
             const newTpl = messageTemplate || currentAuto?.template || "";

             await dbRun(
                 `INSERT OR REPLACE INTO automation (user_id, enabled, frequency_minutes, keyword, template) VALUES (?, ?, ?, ?, ?)`,
                 [userId, newEnabled, newFreq, newKw, newTpl]
             );

             // Reinicia timer se o status mudou ou frequencia mudou
             if (newEnabled) {
                 await startAutomationTimer(userId);
             } else {
                 if (automationTimers[userId]) {
                     clearInterval(automationTimers[userId]);
                     delete automationTimers[userId];
                 }
             }
        }

        res.json({ ok: true, message: "Configurações salvas" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro ao salvar config" });
    }
});

// Rota Manual de Envio (Dashboard Test Button)
app.post("/send/:userId", async (req, res) => {
    const { userId } = req.params;
    const { number, groupId, message } = req.body;
    const target = number || groupId;

    const sess = sessions[userId];
    if (!sess || sess.status !== "ready") return res.status(400).json({ error: "Sessão não pronta" });

    try {
        let chatId = target.includes("@") ? target : `${target.replace(/\D/g,"")}@c.us`;
        await sess.client.sendMessage(chatId, message);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/logs/:userId", async (req, res) => {
  try {
    const logs = await dbAll(`SELECT * FROM logs WHERE user_id = ? ORDER BY sent_at DESC LIMIT 100`, [req.params.userId]);
    res.json({ ok: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});
