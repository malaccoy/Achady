// server.js
// Servidor WhatsApp + Shopee + SQLite + Robô Anti-ban

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import crypto from "crypto";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const { Client, LocalAuth } = pkg;

// =====================================================================
// APP EXPRESS
// =====================================================================
const app = express();
app.use(cors());
app.use(express.json());

// =====================================================================
// SESSÕES WHATSAPP EM MEMÓRIA
// sessions[userId] = { client, qr, status, groups: [...] }
// =====================================================================
let sessions = {};

// =====================================================================
// BANCO DE DADOS (SQLite)
// Arquivo: achady.db
// =====================================================================
let db;

async function initDb() {
  db = await open({
    filename: "./achady.db",
    driver: sqlite3.Database,
  });

  await db.exec("PRAGMA foreign_keys = ON");

  // Config do robô + Shopee por usuário
  await db.exec(`
    CREATE TABLE IF NOT EXISTS robot_config (
      userId TEXT PRIMARY KEY,
      appId TEXT,
      secret TEXT,
      keyword TEXT,
      intervalMinutes INTEGER DEFAULT 15,
      template TEXT,
      isActive INTEGER DEFAULT 0,
      lastRun INTEGER
    );
  `);

  // Grupos cadastrados por usuário
  await db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      chatId TEXT,
      name TEXT,
      invite TEXT,
      UNIQUE(userId, chatId)
    );
  `);

  // Histórico de disparos
  await db.exec(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      groupId INTEGER,
      itemId TEXT,
      offerLink TEXT,
      productName TEXT,
      sentAt INTEGER,
      FOREIGN KEY(groupId) REFERENCES groups(id)
    );
  `);

  console.log("✅ SQLite inicializado (achady.db)");
}

// =====================================================================
// FUNÇÕES AUXILIARES
// =====================================================================
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatPrice(brlStr) {
  if (!brlStr) return "";
  const num = Number(brlStr);
  if (Number.isNaN(num)) return brlStr;
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Monta a mensagem usando o template do painel
function buildMessage(template, offer) {
  const titulo = offer.productName || "";
  const preco = formatPrice(offer.priceMin || offer.priceMax);
  const precoOriginal = offer.priceMax ? formatPrice(offer.priceMax) : "";
  const desconto =
    offer.priceDiscountRate != null ? `${offer.priceDiscountRate}%` : "";
  const link = offer.offerLink || offer.productLink || "";

  let text =
    template ||
    [
      "🔥 OFERTA IMPERDÍVEL! 🔥",
      "",
      "{{titulo}}",
      "",
      "💰 Apenas: {{preco}}",
      "❌ De: {{precooriginal}}",
      "✅ Desconto: {{desconto}}",
      "",
      "👉 Compre aqui: {{link}}",
    ].join("\n");

  text = text.replace(/{{titulo}}/g, titulo);
  text = text.replace(/{{preco}}/g, preco);
  text = text.replace(/{{precooriginal}}/g, precoOriginal || preco);
  text = text.replace(/{{desconto}}/g, desconto || "");
  text = text.replace(/{{link}}/g, link);

  return text;
}

// =====================================================================
// CRIA OU RECUPERA SESSÃO WHATSAPP
// =====================================================================
async function createSession(userId) {
  if (sessions[userId]) {
    return sessions[userId];
  }

  console.log("➡️ Criando sessão para USER:", userId);

  const client = new Client({
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    authStrategy: new LocalAuth({
      clientId: `achady-session-${userId}`,
    }),
  });

  sessions[userId] = {
    client,
    qr: null,
    status: "starting",
    groups: [],
  };

  // Evento de QR
  client.on("qr", async (qr) => {
    console.log(`📌 QR CODE GERADO PARA USER: ${userId}`);
    const qrImage = await qrcode.toDataURL(qr);
    sessions[userId].qr = qrImage;
    sessions[userId].status = "qr";
  });

  // Evento autenticado
  client.on("ready", async () => {
    console.log(`✅ WhatsApp conectado — USER ${userId}`);
    sessions[userId].status = "ready";

    // Carrega grupos desse usuário do banco
    const rows = await db.all(
      "SELECT chatId, name FROM groups WHERE userId = ?",
      userId
    );
    sessions[userId].groups = rows.map((r) => ({
      chatId: r.chatId,
      name: r.name,
    }));
  });

  client.on("disconnected", (reason) => {
    console.log(`⚠️ WhatsApp desconectado — USER ${userId}`, reason);
    sessions[userId].status = "offline";
  });

  client.initialize();

  return sessions[userId];
}

// =====================================================================
// SHOPEE OPEN API (GraphQL)
// =====================================================================
const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

// Monta cabeçalho Authorization: SHA256 Credential=..., Timestamp=..., Signature=...
function buildShopeeAuthHeader(appId, secret, payload) {
  const ts = nowTs();
  const factor = appId + ts + payload + secret;
  const signature = crypto
    .createHash("sha256")
    .update(factor)
    .digest("hex");

  const header = `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${signature}`;
  return { header, ts };
}

// Busca ofertas reais na Shopee por palavra-chave
async function fetchShopeeOffers(config) {
  const { appId, secret, keyword } = config;
  if (!appId || !secret || !keyword) {
    console.log("⚠️ Shopee não configurado para user", config.userId);
    return [];
  }

  const query = `
    query ProductOffer($keyword: String!, $limit: Int!) {
      productOfferV2(keyword: $keyword, limit: $limit, sortType: 2, page: 1) {
        nodes {
          itemId
          productName
          offerLink
          productLink
          priceMin
          priceMax
          commissionRate
          sales
          ratingStar
          priceDiscountRate
          imageUrl
        }
      }
    }
  `;

  const variables = {
    keyword: keyword,
    limit: 20,
  };

  const payloadObj = {
    query,
    variables,
  };

  const payload = JSON.stringify(payloadObj);
  const { header } = buildShopeeAuthHeader(appId, secret, payload);

  const res = await fetch(SHOPEE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: header,
    },
    body: payload,
  });

  if (!res.ok) {
    console.error("❌ Erro HTTP Shopee:", res.status, await res.text());
    return [];
  }

  const json = await res.json();

  if (json.errors && json.errors.length) {
    console.error("❌ Erro GraphQL Shopee:", json.errors);
    return [];
  }

  const nodes = json?.data?.productOfferV2?.nodes || [];
  console.log(`🔍 Shopee retornou ${nodes.length} ofertas para`, keyword);
  return nodes;
}

// Verifica se já enviamos essa oferta antes
async function wasOfferSent(userId, itemId) {
  const row = await db.get(
    "SELECT id FROM send_logs WHERE userId = ? AND itemId = ? LIMIT 1",
    userId,
    String(itemId)
  );
  return !!row;
}

// Loga envio
async function logSend(userId, groupId, offer) {
  await db.run(
    `
    INSERT INTO send_logs (userId, groupId, itemId, offerLink, productName, sentAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    userId,
    groupId,
    String(offer.itemId),
    offer.offerLink || offer.productLink || "",
    offer.productName || "",
    nowTs()
  );
}

// =====================================================================
// ROBÔ: RODA A CADA X MINUTOS POR USUÁRIO
// =====================================================================
async function runRobotForUser(config) {
  const { userId } = config;

  const session = sessions[userId];
  if (!session || session.status !== "ready") {
    console.log("⚠️ Sessão não está pronta para user", userId);
    return;
  }

  // Carrega grupos desse usuário
  const groups = await db.all(
    "SELECT id, chatId, name FROM groups WHERE userId = ?",
    userId
  );
  if (!groups.length) {
    console.log("⚠️ Nenhum grupo cadastrado para user", userId);
    return;
  }

  // Busca ofertas na Shopee
  const offers = await fetchShopeeOffers(config);
  if (!offers.length) return;

  // Escolhe primeira oferta ainda não enviada
  let chosen = null;
  for (const offer of offers) {
    const already = await wasOfferSent(userId, offer.itemId);
    if (!already) {
      chosen = offer;
      break;
    }
  }

  if (!chosen) {
    console.log("ℹ️ Todas ofertas retornadas já foram enviadas antes.");
    return;
  }

  const text = buildMessage(config.template, chosen);

  console.log(
    `🚀 Enviando oferta "${chosen.productName}" para ${groups.length} grupo(s) do user ${userId}`
  );

  // Anti-ban: delay aleatório entre envios + limite de grupos por rodada
  const MAX_GROUPS_PER_RUN = 5;

  let sentCount = 0;
  for (const g of groups) {
    if (sentCount >= MAX_GROUPS_PER_RUN) break;

    try {
      const waitMs = randomInt(10_000, 30_000); // 10–30s
      console.log(
        `⏳ Aguardando ${waitMs}ms antes de enviar para grupo "${g.name}"`
      );
      await delay(waitMs);

      await session.client.sendMessage(g.chatId, text);
      await logSend(userId, g.id, chosen);
      sentCount++;

      console.log(`✅ Mensagem enviada para grupo "${g.name}"`);
    } catch (err) {
      console.error("❌ Erro ao enviar para grupo", g.name, err);
    }
  }
}

// Laço global: verifica quais robôs devem rodar agora
async function robotSchedulerTick() {
  try {
    const configs = await db.all(
      "SELECT * FROM robot_config WHERE isActive = 1"
    );
    const nowMs = Date.now();

    for (const cfg of configs) {
      const intervalMs = (cfg.intervalMinutes || 15) * 60 * 1000;
      const lastRunMs = cfg.lastRun || 0;

      if (nowMs - lastRunMs >= intervalMs) {
        console.log("🕒 Rodando robô para user", cfg.userId);
        await runRobotForUser(cfg);
        await db.run(
          "UPDATE robot_config SET lastRun = ? WHERE userId = ?",
          nowMs,
          cfg.userId
        );
      }
    }
  } catch (err) {
    console.error("❌ Erro no scheduler:", err);
  }
}

function startScheduler() {
  // roda a cada 60 segundos
  setInterval(robotSchedulerTick, 60 * 1000);
  console.log("⏱️ Scheduler do robô iniciado (tick a cada 60s)");
}

// =====================================================================
// ROTAS HTTP
// =====================================================================

// ---------- SESSÃO WHATSAPP ----------

// Iniciar sessão (gera QR)
app.post("/start/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: "userId é obrigatório" });
  }

  const session = await createSession(userId);

  return res.json({
    message: "Sessão iniciada",
    userId,
    status: session.status,
  });
});

// Obter QR
app.get("/qr/:userId", (req, res) => {
  const { userId } = req.params;
  const session = sessions[userId];

  if (!session) {
    return res.status(404).json({ qr: null, status: "not_started" });
  }

  return res.json({
    qr: session.qr,
    status: session.status,
  });
});

// Status global
app.get("/status", (req, res) => {
  const users = Object.keys(sessions);
  let status = "offline";

  if (users.length > 0) {
    const userId = users[0];
    status = sessions[userId]?.status || "offline";
  }

  res.json({
    ok: true,
    status,
    users,
  });
});

// ---------- ENTRAR AUTOMATICAMENTE NO GRUPO ----------

app.post("/join/:userId", async (req, res) => {
  const { userId } = req.params;
  const { invite, name } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId é obrigatório" });
  }
  if (!invite) {
    return res.status(400).json({ error: "invite (link do grupo) é obrigatório" });
  }

  const session = sessions[userId];
  if (!session || session.status !== "ready") {
    return res
      .status(400)
      .json({ error: "Sessão não encontrada ou não está pronta" });
  }

  try {
    // Pega só o código da URL: .../JU4Q9geE7yMIb5OXNSz2If
    const code = invite.split("/").pop();
    const chat = await session.client.acceptInvite(code);

    const chatId = chat.id._serialized;
    const groupName = name || chat.name || "Grupo";

    // Salva no banco
    await db.run(
      `
      INSERT OR IGNORE INTO groups (userId, chatId, name, invite)
      VALUES (?, ?, ?, ?)
    `,
      userId,
      chatId,
      groupName,
      invite
    );

    // Atualiza em memória
    session.groups.push({ chatId, name: groupName });

    return res.json({
      ok: true,
      message: "Entrou no grupo com sucesso",
      chatId,
      name: groupName,
    });
  } catch (err) {
    console.error("❌ Erro ao entrar no grupo:", err);
    return res.status(500).json({ error: "Falha ao entrar no grupo" });
  }
});

// ---------- CONFIGURAÇÕES DO ROBÔ / SHOPEE / TEMPLATE ----------

// Salvar credenciais Shopee + palavra-chave + intervalo
// body: { userId, appId, secret, keyword, intervalMinutes }
app.post("/config/shopee", async (req, res) => {
  const { userId, appId, secret, keyword, intervalMinutes } = req.body;

  if (!userId || !appId || !secret) {
    return res
      .status(400)
      .json({ error: "userId, appId e secret são obrigatórios" });
  }

  const interval = Number(intervalMinutes) || 15;

  await db.run(
    `
    INSERT INTO robot_config (userId, appId, secret, keyword, intervalMinutes, isActive)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(userId) DO UPDATE SET
      appId = excluded.appId,
      secret = excluded.secret,
      keyword = excluded.keyword,
      intervalMinutes = excluded.intervalMinutes
  `,
    userId,
    appId,
    secret,
    keyword || "",
    interval
  );

  res.json({
    ok: true,
    message: "Configuração Shopee salva com sucesso",
  });
});

// Salvar template de mensagem
// body: { userId, template }
app.post("/config/template", async (req, res) => {
  const { userId, template } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId é obrigatório" });
  }

  await db.run(
    `
    INSERT INTO robot_config (userId, template)
    VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET
      template = excluded.template
  `,
    userId,
    template || ""
  );

  res.json({
    ok: true,
    message: "Template salvo com sucesso",
  });
});

// Ativar / desativar robô
// body: { userId, active, intervalMinutes?, keyword? }
app.post("/robot/toggle", async (req, res) => {
  const { userId, active, intervalMinutes, keyword } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId é obrigatório" });
  }

  const isActive = active ? 1 : 0;
  const interval = intervalMinutes ? Number(intervalMinutes) : null;

  await db.run(
    `
    INSERT INTO robot_config (userId, isActive, intervalMinutes, keyword)
    VALUES (?, ?, COALESCE(?, 15), COALESCE(?, ""))
    ON CONFLICT(userId) DO UPDATE SET
      isActive = excluded.isActive,
      intervalMinutes = COALESCE(excluded.intervalMinutes, robot_config.intervalMinutes),
      keyword = COALESCE(excluded.keyword, robot_config.keyword)
  `,
    userId,
    isActive,
    interval,
    keyword
  );

  res.json({
    ok: true,
    message: isActive ? "Robô ativado" : "Robô desativado",
  });
});

// Histórico de disparos
app.get("/logs/:userId", async (req, res) => {
  const { userId } = req.params;

  const rows = await db.all(
    `
    SELECT s.id, s.productName, s.offerLink, s.sentAt, g.name as groupName
    FROM send_logs s
    LEFT JOIN groups g ON g.id = s.groupId
    WHERE s.userId = ?
    ORDER BY s.sentAt DESC
    LIMIT 100
  `,
    userId
  );

  res.json({
    ok: true,
    logs: rows,
  });
});

// =====================================================================
// ROTA HOME
// =====================================================================
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Achady está rodando. 🚀");
});

// =====================================================================
// INICIAR TUDO
// =====================================================================
const PORT = 3000;

(async () => {
  await initDb();

  app.listen(PORT, () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
  });

  startScheduler();
})();