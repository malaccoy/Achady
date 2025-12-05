// server.js
// ACHADY – BOT WHATSAPP + SHOPEE (MVP VALIDAÇÃO)
// Versão: JSON DB (Sem dependência de SQLite nativo)

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import axios from "axios";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
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
const DB_FILE = "./achady_db.json";

// 1 usuário padrão (MVP)
const DEFAULT_USER_ID = process.env.USER_ID_PADRAO || "1";

// Shopee Defaults
const SHOPEE_APP_ID = process.env.SHOPEE_APP_ID || "";
const SHOPEE_APP_SECRET = process.env.SHOPEE_APP_SECRET || "";

// Automação Defaults
const DEFAULT_KEYWORD = process.env.KEYWORD_PADRAO || "promoção relâmpago";
const DEFAULT_INTERVAL_MINUTES = Number(process.env.INTERVALO_MINUTOS || 5);

// ========================
// JSON DATABASE SYSTEM
// ========================
let dbData = {
  shopee_credentials: [], // { userId, appId, appSecret }
  groups: [],             // { id, userId, invite, name, groupId, category }
  automation: [],         // { userId, enabled, frequency, keyword, template }
  logs: []                // { id, userId, groupName, productName, ... }
};

// Carrega ou cria o banco de dados JSON
async function initDB() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    dbData = JSON.parse(data);
    
    // Garante estrutura
    if (!dbData.shopee_credentials) dbData.shopee_credentials = [];
    if (!dbData.groups) dbData.groups = [];
    if (!dbData.automation) dbData.automation = [];
    if (!dbData.logs) dbData.logs = [];
    
    console.log("📦 Banco de dados JSON carregado.");
    
    // Configura padrão se não existir
    await ensureDefaults();

  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("⚠️ DB não encontrado, criando novo...");
      await ensureDefaults();
      await saveDB();
    } else {
      console.error("❌ Erro ao ler DB:", err);
    }
  }
}

async function saveDB() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(dbData, null, 2));
  } catch (err) {
    console.error("❌ Erro ao salvar DB:", err);
  }
}

async function ensureDefaults() {
  // Automação Padrão
  const autoIndex = dbData.automation.findIndex(a => a.userId === DEFAULT_USER_ID);
  if (autoIndex === -1) {
    const defaultTemplate = `
🔥 OFERTA IMPERDÍVEL! 🔥

{{titulo}}

💰 Apenas: {{preco}}
❌ De: {{precoOriginal}}
🎯 Desconto: {{desconto}}

🛒 Compre aqui: {{link}}
    `.trim();

    dbData.automation.push({
      userId: DEFAULT_USER_ID,
      enabled: 0,
      frequency: DEFAULT_INTERVAL_MINUTES,
      keyword: DEFAULT_KEYWORD,
      template: defaultTemplate
    });
  }

  // Credenciais Shopee Padrão (se env vars existirem)
  if (SHOPEE_APP_ID && SHOPEE_APP_SECRET) {
    const credIndex = dbData.shopee_credentials.findIndex(c => c.userId === DEFAULT_USER_ID);
    if (credIndex === -1) {
      dbData.shopee_credentials.push({
        userId: DEFAULT_USER_ID,
        appId: SHOPEE_APP_ID,
        appSecret: SHOPEE_APP_SECRET
      });
    }
  }
  
  await saveDB();
}

// Inicializa DB ao arrancar
initDB();

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
  const cred = dbData.shopee_credentials.find(c => c.userId === userId);

  if (!cred) {
    console.error("❌ Credenciais Shopee não encontradas no DB.");
    return [];
  }

  const automation = dbData.automation.find(a => a.userId === userId);
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

  const authHeader = buildShopeeAuthHeader(cred.appId, cred.appSecret, payload);

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

function buildMessageFromTemplate(userId, offer) {
  const config = dbData.automation.find(a => a.userId === userId);
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

    const automation = dbData.automation.find(a => a.userId === userId);
    if (!automation || !automation.enabled) return;

    // Busca grupos
    const groups = dbData.groups.filter(g => g.userId === userId);
    if (!groups.length) {
       console.log("⚠️ Nenhum grupo cadastrado.");
       return;
    }

    const offers = await fetchShopeeOffers(userId);
    if (!offers.length) return;

    const offer = offers[0];
    const message = buildMessageFromTemplate(userId, offer);

    for (const group of groups) {
      if (!group.groupId) continue;
      
      console.log(`📨 Enviando oferta para ${group.name} (${group.groupId})`);
      await session.client.sendMessage(group.groupId, message);

      // Save Log
      dbData.logs.unshift({
        id: Date.now(),
        userId,
        groupName: group.name,
        productName: offer.title,
        offerLink: offer.link,
        priceMin: offer.price,
        priceOriginal: offer.originalPrice,
        discountRate: offer.discountPercent,
        sentAt: Math.floor(Date.now() / 1000) // timestamp seconds
      });
      
      // Limita logs a 100
      if (dbData.logs.length > 200) dbData.logs = dbData.logs.slice(0, 200);
      
      await saveDB();

      await sleep(5000 + Math.random() * 5000); // Delay
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

  const automation = dbData.automation.find(a => a.userId === userId);
  if (!automation || !automation.enabled) return;

  const intervalMs = (automation.frequency || 5) * 60 * 1000;
  console.log(`⏱️ Automação iniciada (User ${userId}, cada ${automation.frequency} min)`);
  
  // Executa o primeiro ciclo imediatamente
  runAutomationCycle(userId);

  automationTimers[userId] = setInterval(() => runAutomationCycle(userId), intervalMs);
}

// ========================
// ROTAS HTTP
// ========================

app.get("/", (req, res) => res.send("Servidor WhatsApp Achady (JSON DB) rodando. 🚀"));

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

    // Adiciona grupo ao DB
    const newGroup = {
      id: Date.now(),
      userId,
      invite,
      name: groupName,
      groupId,
      category: category || 'geral'
    };
    
    dbData.groups.push(newGroup);
    await saveDB();

    res.json({ ok: true, message: "Grupo adicionado", groupId });
  } catch (err) {
    res.status(500).json({ error: "Falha ao entrar no grupo: " + err.message });
  }
});

// Configuração Geral (Dashboard)
app.post("/config/:userId", async (req, res) => {
    const { userId } = req.params;
    const { 
        appId, appSecret, // Credenciais Shopee
        keyword, messageTemplate, intervalMinutes, isActive // Automação
    } = req.body;

    try {
        // 1. Atualiza Credenciais
        if (appId !== undefined || appSecret !== undefined) {
            const index = dbData.shopee_credentials.findIndex(c => c.userId === userId);
            if (index > -1) {
                if (appId) dbData.shopee_credentials[index].appId = appId;
                if (appSecret) dbData.shopee_credentials[index].appSecret = appSecret;
            } else {
                dbData.shopee_credentials.push({ userId, appId: appId || "", appSecret: appSecret || "" });
            }
        }

        // 2. Atualiza Automação
        if (keyword !== undefined || messageTemplate !== undefined || intervalMinutes !== undefined || isActive !== undefined) {
             const index = dbData.automation.findIndex(a => a.userId === userId);
             
             if (index > -1) {
                const auto = dbData.automation[index];
                if (isActive !== undefined) auto.enabled = isActive ? 1 : 0;
                if (intervalMinutes !== undefined) auto.frequency = intervalMinutes;
                if (keyword !== undefined) auto.keyword = keyword;
                if (messageTemplate !== undefined) auto.template = messageTemplate;
                
                dbData.automation[index] = auto;
             } else {
                dbData.automation.push({
                   userId,
                   enabled: isActive ? 1 : 0,
                   frequency: intervalMinutes || 15,
                   keyword: keyword || DEFAULT_KEYWORD,
                   template: messageTemplate || ""
                });
             }

             // Reinicia Timer
             const auto = dbData.automation.find(a => a.userId === userId);
             if (auto.enabled) {
                 await startAutomationTimer(userId);
             } else {
                 if (automationTimers[userId]) {
                     clearInterval(automationTimers[userId]);
                     delete automationTimers[userId];
                 }
             }
        }

        await saveDB();
        res.json({ ok: true, message: "Configurações salvas" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro ao salvar config" });
    }
});

// Envio Manual (Botão Teste)
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
    const userLogs = dbData.logs
      .filter(l => l.userId === req.params.userId)
      .sort((a, b) => b.sentAt - a.sentAt) // Mais recente primeiro
      .slice(0, 100);

    // Mapeamento para garantir compatibilidade com frontend se necessário
    // Mas as chaves já foram salvas compativeis (productName, etc)
    res.json({ ok: true, logs: userLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});