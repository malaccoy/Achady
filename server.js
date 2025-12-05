// server.js
// ACHADY – WhatsApp + Shopee + Automação básica com SQLite

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import axios from "axios";
import sqlite3 from "sqlite3";
import crypto from "crypto";

const { Client, LocalAuth } = pkg;

// -----------------------------------------------------
// APP EXPRESS
// -----------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------
// BANCO SQLITE – CONFIG, GRUPOS, LOGS
// -----------------------------------------------------
const db = new sqlite3.Database("./achady.db");

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

db.serialize(() => {
  // Configuração por usuário (AppID, Secret, template, etc.)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      appId TEXT,
      appSecret TEXT,
      keyword TEXT,
      messageTemplate TEXT,
      intervalMinutes INTEGER DEFAULT 15,
      isActive INTEGER DEFAULT 0
    )
  `);

  // Grupos de destino
  // Added migration logic to ensure 'category' column exists
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      name TEXT,
      inviteLink TEXT,
      wid TEXT,            -- ID interno do WhatsApp (quando o bot entra)
      category TEXT
    )
  `, (err) => {
      if (!err) {
          // Migration: Attempt to add category column if it doesn't exist
          // This prevents errors on existing databases created before this update
          db.run("ALTER TABLE groups ADD COLUMN category TEXT", () => {
              // Ignore error if column already exists
          });
      }
  });

  // Logs de disparos
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      groupName TEXT,
      productName TEXT,
      offerLink TEXT,
      priceMin REAL,
      priceOriginal REAL,
      discountRate INTEGER,
      sentAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// -----------------------------------------------------
// WHATSAPP – MULTI-SESSÕES
// -----------------------------------------------------
let sessions = {}; // { [userId]: { client, qr, status } }
let automationTimers = {}; // { [userId]: NodeJS.Timeout }

// Cria ou recupera sessão
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

  client.on("disconnected", (reason) => {
    console.log(`❌ WhatsApp desconectado — USER ${userId}`, reason);
    sessions[userId].status = "disconnected";
  });

  client.initialize();

  return sessions[userId];
}

// -----------------------------------------------------
// SHOPEE – UTILITÁRIOS
// -----------------------------------------------------
const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

function buildShopeeAuthHeader(appId, appSecret, payload) {
  const timestamp = Math.floor(Date.now() / 1000); // segundos
  const factor = appId + timestamp + payload + appSecret;
  const signature = crypto
    .createHash("sha256")
    .update(factor)
    .digest("hex");

  const header = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
  return header;
}

// Buscar ofertas por palavra-chave na Shopee
async function fetchShopeeOffers(userConfig) {
  const { appId, appSecret, keyword } = userConfig;
  if (!appId || !appSecret || !keyword) {
    // Retorna mock se não configurado para não quebrar a demo
    console.log("⚠️ Config Shopee incompleta (appId, appSecret ou keyword ausente).");
    return [];
  }

  const body = {
    query: `
      query ProductOffer($keyword: String!, $page: Int!, $limit: Int!) {
        productOfferV2(
          keyword: $keyword,
          page: $page,
          limit: $limit,
          sortType: 2,        # ITEM_SOLD_DESC (mais vendidos)
          listType: 0         # ALL
        ) {
          nodes {
            itemId
            productName
            priceMin
            priceMax
            priceDiscountRate
            commissionRate
            productLink
            offerLink
            imageUrl
            sales
          }
          pageInfo {
            page
            limit
            hasNextPage
          }
        }
      }
    `,
    variables: {
      keyword: keyword,
      page: 1,
      limit: 5,
    },
    operationName: "ProductOffer",
  };

  const payload = JSON.stringify(body);
  const authHeader = buildShopeeAuthHeader(appId, appSecret, payload);

  try {
    const resp = await axios.post(SHOPEE_ENDPOINT, body, {
        headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        },
    });

    if (resp.data.errors && resp.data.errors.length > 0) {
        console.error("Erro Shopee:", resp.data.errors);
        return [];
    }

    const nodes = resp.data?.data?.productOfferV2?.nodes || [];
    return nodes;
  } catch (error) {
    console.error("Erro requisição Shopee:", error.message);
    return [];
  }
}

// -----------------------------------------------------
// MENSAGENS – TEMPLATE DO PAINEL
// -----------------------------------------------------
function formatBRL(valueStr) {
  if (!valueStr) return "";
  const num = Number(valueStr);
  if (Number.isNaN(num)) return valueStr;
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fillTemplate(template, offer) {
  if (!template) {
    // fallback simples
    template = `
🔥 OFERTA IMPERDÍVEL! 🔥

{{titulo}}

💰 Apenas: {{preco}}
↘️ De: {{precoOriginal}}
✂️ Desconto: {{desconto}}

🛒 Compre aqui: {{link}}
`.trim();
  }

  const priceMin = offer.priceMin || offer.price;
  const priceOriginal = offer.priceMax || priceMin;
  const discountRate = offer.priceDiscountRate || 0;

  const map = {
    "{{titulo}}": offer.productName || "",
    "{{preco}}": formatBRL(priceMin),
    "{{precoOriginal}}": formatBRL(priceOriginal),
    "{{desconto}}": discountRate ? `${discountRate}% OFF` : "",
    "{{link}}": offer.offerLink || offer.productLink || "",
  };

  let msg = template;
  for (const [key, val] of Object.entries(map)) {
    msg = msg.split(key).join(val);
  }
  return msg;
}

// -----------------------------------------------------
// AUTOMATIZAÇÃO – DISPARO PERIÓDICO
// -----------------------------------------------------
function clearAutomation(userId) {
  if (automationTimers[userId]) {
    clearInterval(automationTimers[userId]);
    delete automationTimers[userId];
  }
}

async function startAutomation(userId) {
  clearAutomation(userId);

  const user = await getAsync(
    "SELECT * FROM users WHERE id = ?",
    [userId]
  );
  if (!user || !user.isActive) {
    console.log(`⏹ Robô desativado para user ${userId}`);
    return;
  }

  const intervalMs = (user.intervalMinutes || 15) * 60 * 1000;

  console.log(
    `🤖 Iniciando automação para user ${userId} a cada ${user.intervalMinutes} min`
  );

  automationTimers[userId] = setInterval(async () => {
    try {
      await runCycle(userId);
    } catch (err) {
      console.error("Erro ciclo automação user", userId, err.message);
    }
  }, intervalMs);
}

// Um ciclo de envio: pega ofertas e manda pros grupos
async function runCycle(userId) {
  const sess = sessions[userId];
  if (!sess || sess.status !== "ready") {
    console.log(`⚠️ Sessão WhatsApp não está READY para user ${userId}`);
    return;
  }
  const client = sess.client;

  const user = await getAsync(
    "SELECT * FROM users WHERE id = ?",
    [userId]
  );
  if (!user || !user.isActive) {
    console.log(`⚠️ User ${userId} inativo, pulando ciclo`);
    return;
  }

  const groups = await allAsync(
    "SELECT * FROM groups WHERE userId = ?",
    [userId]
  );
  if (groups.length === 0) {
    console.log(`⚠️ Nenhum grupo cadastrado para user ${userId}`);
    return;
  }

  console.log(`🔎 Buscando ofertas Shopee para user ${userId} (${user.keyword})`);
  const offers = await fetchShopeeOffers(user);
  if (offers.length === 0) {
    console.log("⚠️ Nenhuma oferta retornada");
    return;
  }

  // Vamos mandar 1 oferta por ciclo (pode aumentar depois)
  const offer = offers[0];

  for (const group of groups) {
    const msg = fillTemplate(user.messageTemplate, offer);

    // Delay anti-ban: entre 20 e 40 segundos entre grupos
    const delayMs = 20000 + Math.floor(Math.random() * 20000);

    setTimeout(async () => {
      try {
        let chatId = group.wid;
        if (!chatId) {
          // tenta pegar pelo link (caso não tenha salvo ainda)
          const inviteCode = group.inviteLink.split("/").pop();
          try {
              const chat = await client.acceptInvite(inviteCode);
              chatId = chat.id._serialized;
    
              await runAsync(
                "UPDATE groups SET wid = ? WHERE id = ?",
                [chatId, group.id]
              );
          } catch(e) {
              console.log("Erro ao entrar no grupo via invite:", e.message);
          }
        }

        if (chatId) {
            console.log(
            `📤 Enviando oferta para grupo "${group.name}" (user ${userId})`
            );
            await client.sendMessage(chatId, msg);
    
            await runAsync(
            `INSERT INTO logs
                (userId, groupName, productName, offerLink, priceMin, priceOriginal, discountRate)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                group.name,
                offer.productName || "",
                offer.offerLink || offer.productLink || "",
                Number(offer.priceMin || 0),
                Number(offer.priceMax || 0),
                offer.priceDiscountRate || 0,
            ]
            );
        }
      } catch (err) {
        console.error(
          `Erro ao enviar oferta para grupo ${group.name}:`,
          err.message
        );
      }
    }, delayMs);
  }
}

// -----------------------------------------------------
// ROTAS HTTP
// -----------------------------------------------------

// ROTA: iniciar sessão WhatsApp
app.post("/start/:userId", async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao iniciar sessão" });
  }
});

// QR code da sessão
app.get("/qr/:userId", async (req, res) => {
  const { userId } = req.params;
  const session = sessions[userId];

  if (!session) {
    return res.status(404).json({
      qr: null,
      status: "not_started",
    });
  }

  return res.json({
    qr: session.qr,
    status: session.status,
  });
});

// Status global (para o painel saber se está online)
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

// Entrar automaticamente no grupo pelo link de convite
app.post("/join/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { invite, name, category } = req.body;

    if (!invite) {
      return res.status(400).json({ error: "invite (link do grupo) é obrigatório" });
    }
    
    // VALIDACAO DO LINK NO BACKEND
    const linkRegex = /chat\.whatsapp\.com\/[A-Za-z0-9]{5,}/;
    if (!linkRegex.test(invite)) {
        return res.status(400).json({ error: "Link inválido. Forneça um link de convite do WhatsApp (chat.whatsapp.com/CÓDIGO)." });
    }

    const sess = sessions[userId];
    const groupName = name || "Grupo Novo";
    // Recebe categoria do body ou usa default "geral"
    const groupCategory = category || "geral";

    // Insere no banco primeiro
    await runAsync(
      `INSERT INTO groups (userId, name, inviteLink, wid, category)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, groupName, invite, null, groupCategory]
    );
    
    // Tenta entrar se a sessão estiver pronta
    if (sess && sess.status === "ready") {
        try {
            const client = sess.client;
            const inviteCode = invite.split("/").pop();
            const chat = await client.acceptInvite(inviteCode);
    
            const wid = chat.id._serialized;
            const realName = chat.name || groupName;
    
            await runAsync(
                "UPDATE groups SET wid = ?, name = ? WHERE inviteLink = ?",
                [wid, realName, invite]
            );
        } catch (e) {
            console.log("Ainda não foi possível entrar no grupo (ou já está dentro).", e.message);
        }
    }

    res.json({
      ok: true,
      message: "Grupo salvo",
      groupName,
    });
  } catch (err) {
    console.error("Erro /join:", err.message);
    res.status(500).json({ error: "Erro ao entrar no grupo" });
  }
});

// Configuração geral do robô (Shopee + template + frequência + grupos)
// Essa rota é a “ponte” com o painel Achady.
app.post("/config/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      appId,
      appSecret,
      keyword,
      messageTemplate,
      intervalMinutes,
      isActive,
      groups, // opcional: [{ inviteLink, name, category }]
    } = req.body;

    // Garante linha do usuário
    const exists = await getAsync("SELECT id FROM users WHERE id = ?", [userId]);
    if (!exists) {
      await runAsync(
        "INSERT INTO users (id, appId, appSecret, keyword, messageTemplate, intervalMinutes, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          userId,
          appId || null,
          appSecret || null,
          keyword || null,
          messageTemplate || null,
          intervalMinutes || 15,
          isActive ? 1 : 0,
        ]
      );
    } else {
        // Update parcial
        const current = exists;
        await runAsync(
            `UPDATE users
            SET appId = ?, appSecret = ?, keyword = ?, messageTemplate = ?, intervalMinutes = ?, isActive = ?
            WHERE id = ?`,
            [
            appId !== undefined ? appId : current.appId,
            appSecret !== undefined ? appSecret : current.appSecret,
            keyword !== undefined ? keyword : current.keyword,
            messageTemplate !== undefined ? messageTemplate : current.messageTemplate,
            intervalMinutes !== undefined ? intervalMinutes : current.intervalMinutes,
            isActive !== undefined ? (isActive ? 1 : 0) : current.isActive,
            userId,
            ]
        );
    }

    // Se vier lista de grupos do painel, atualiza (bem simples: apaga e recria)
    if (Array.isArray(groups)) {
      await runAsync("DELETE FROM groups WHERE userId = ?", [userId]);
      for (const g of groups) {
        await runAsync(
          `INSERT INTO groups (userId, name, inviteLink, category)
           VALUES (?, ?, ?, ?)`,
          [
            userId,
            g.name || "Grupo",
            g.inviteLink,
            g.category || "geral",
          ]
        );
      }
    }

    // Reinicia automação conforme isActive
    // Busca user atualizado
    const updated = await getAsync("SELECT * FROM users WHERE id = ?", [userId]);
    if (updated.isActive) {
      await startAutomation(userId);
    } else {
      clearAutomation(userId);
    }

    res.json({
      ok: true,
      config: updated,
    });
  } catch (err) {
    console.error("Erro /config:", err.message);
    res.status(500).json({ error: "Erro ao salvar configuração" });
  }
});

// Logs de disparo (para a tela “Logs de envio” do painel)
app.get("/logs/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const rows = await allAsync(
      "SELECT * FROM logs WHERE userId = ? ORDER BY sentAt DESC LIMIT 100",
      [userId]
    );
    res.json({ ok: true, logs: rows });
  } catch (err) {
    console.error("Erro /logs:", err.message);
    res.status(500).json({ error: "Erro ao buscar logs" });
  }
});

// Rota manual de envio (para teste no painel e compatibilidade)
app.post("/send/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { number, message, groupId } = req.body;
    
    // Suporta number ou groupId
    const target = number || groupId;

    if (!target || !message) {
      return res.status(400).json({ error: "Número/Grupo e mensagem são obrigatórios" });
    }

    const sess = sessions[userId];
    if (!sess || sess.status !== "ready") {
      return res.status(400).json({ error: "Sessão WhatsApp não está pronta ou conectada." });
    }

    let chatId = target;
    // Se não tiver @, assume número pessoal BR
    if (!chatId.includes("@")) {
      chatId = `${chatId.replace(/\D/g, "")}@c.us`;
    }

    await sess.client.sendMessage(chatId, message);
    res.json({ ok: true, message: "Enviado com sucesso" });
  } catch (err) {
    console.error("Erro /send:", err);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

// Homepage de teste
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Achady está rodando. 🚀");
});

// -----------------------------------------------------
// INICIAR SERVIDOR
// -----------------------------------------------------
app.listen(3000, () => {
  console.log("🌐 Servidor rodando na porta 3000");
});