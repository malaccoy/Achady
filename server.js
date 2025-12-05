// server.js
// -----------------------------------------------
// npm install express cors whatsapp-web.js qrcode node-fetch sqlite sqlite3
// -----------------------------------------------

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import fetch from "node-fetch";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const { Client, LocalAuth } = pkg;

// ===============================================
// CONFIG BÁSICA
// ===============================================
const PORT = process.env.PORT || 3000;
const SHOPEE_GRAPHQL_ENDPOINT =
  process.env.SHOPEE_GRAPHQL_ENDPOINT ||
  "https://affiliate.shopee.com.br/api/v3/gql?q=productOfferLinks"; // endpoint real que você achou

const app = express();
app.use(cors());
app.use(express.json());

// ===============================================
// SQLITE – BANCO LOCAL
// ===============================================
let db;

async function initDb() {
  db = await open({
    filename: "./achady.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achady_user_id TEXT UNIQUE NOT NULL,
      shopee_app_id TEXT,
      shopee_app_secret TEXT,
      robot_enabled INTEGER NOT NULL DEFAULT 0,
      interval_minutes INTEGER NOT NULL DEFAULT 15,
      message_template TEXT NOT NULL DEFAULT '🔥 OFERTA IMPERDÍVEL!\\n\\n{{titulo}}\\nApenas: {{preco}}\\nDe: {{preco_original}}\\nDesconto: {{desconto}}\\n\\nCompre aqui: {{link}}',
      last_run_at TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      invite_link TEXT,
      wa_chat_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      group_id INTEGER,
      offer_title TEXT,
      offer_link TEXT,
      payload_json TEXT,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );
  `);
}

async function ensureUser(achadyUserId) {
  let user = await db.get(
    "SELECT * FROM users WHERE achady_user_id = ?",
    achadyUserId
  );
  if (!user) {
    await db.run("INSERT INTO users (achady_user_id) VALUES (?)", achadyUserId);
    user = await db.get(
      "SELECT * FROM users WHERE achady_user_id = ?",
      achadyUserId
    );
  }
  return user;
}

// ===============================================
// WHATSAPP – MULTI-SESSÃO
// ===============================================
let sessions = {}; // { [achadyUserId]: { client, qr, status } }

async function createSession(achadyUserId) {
  if (sessions[achadyUserId]) {
    return sessions[achadyUserId];
  }

  console.log("➡️ Criando sessão para USER:", achadyUserId);

  const client = new Client({
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    authStrategy: new LocalAuth({
      clientId: `achady-session-${achadyUserId}`,
    }),
  });

  sessions[achadyUserId] = {
    client,
    qr: null,
    status: "starting",
  };

  client.on("qr", async (qr) => {
    console.log(`📌 QR CODE GERADO PARA USER: ${achadyUserId}`);
    const qrImage = await qrcode.toDataURL(qr);
    sessions[achadyUserId].qr = qrImage;
    sessions[achadyUserId].status = "qr";
  });

  client.on("ready", () => {
    console.log(`✅ WhatsApp conectado — USER ${achadyUserId}`);
    sessions[achadyUserId].status = "ready";
  });

  client.on("disconnected", (reason) => {
    console.log(`⚠️ WhatsApp desconectado — USER ${achadyUserId}`, reason);
    sessions[achadyUserId].status = "disconnected";
  });

  client.initialize();

  return sessions[achadyUserId];
}

// ===============================================
// ROTAS WHATSAPP – START / QR / STATUS
// ===============================================
app.post("/start/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId é obrigatório" });
    }

    await ensureUser(userId);
    const session = await createSession(userId);

    return res.json({
      message: "Sessão iniciada",
      userId,
      status: session.status,
    });
  } catch (err) {
    console.error("Erro em /start/:userId", err);
    return res.status(500).json({ error: "Erro ao iniciar sessão" });
  }
});

app.get("/qr/:userId", async (req, res) => {
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

app.get("/status/:userId", async (req, res) => {
  const { userId } = req.params;
  const session = sessions[userId];

  if (!session) {
    return res.status(404).json({ status: "not_started" });
  }

  return res.json({ status: session.status });
});

// ===============================================
// ENTRAR AUTOMATICAMENTE NO GRUPO VIA LINK
// ===============================================
app.post("/join/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { invite, name } = req.body;

    if (!invite) {
      return res.status(400).json({ error: "invite (link do grupo) é obrigatório" });
    }

    const session = sessions[userId];
    if (!session || session.status !== "ready") {
      return res.status(400).json({ error: "Sessão WhatsApp não está pronta" });
    }

    const inviteCode = invite
      .replace("https://chat.whatsapp.com/", "")
      .split(/[? ]/)[0];

    console.log(`➡️ USER ${userId} entrando no grupo com código: ${inviteCode}`);

    const chat = await session.client.acceptInvite(inviteCode); // whatsapp-web.js

    const user = await ensureUser(userId);

    await db.run(
      `
      INSERT INTO groups (user_id, name, invite_link, wa_chat_id, active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, wa_chat_id) DO UPDATE SET
        invite_link = excluded.invite_link,
        active = 1
    `,
      user.id,
      chat.name || name || "Grupo",
      invite,
      chat.id._serialized
    );

    return res.json({
      ok: true,
      chatId: chat.id._serialized,
      name: chat.name,
    });
  } catch (err) {
    console.error("Erro em /join/:userId", err);
    return res.status(500).json({ error: "Erro ao entrar no grupo" });
  }
});

// ===============================================
// CONFIGURAÇÕES VINDAS DO PAINEL ACHADY
// ===============================================

// Salvar credenciais Shopee do usuário
app.post("/config/shopee/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { appId, appSecret } = req.body;

    if (!appId || !appSecret) {
      return res
        .status(400)
        .json({ error: "appId e appSecret da Shopee são obrigatórios" });
    }

    const user = await ensureUser(userId);

    await db.run(
      `
      UPDATE users
      SET shopee_app_id = ?, shopee_app_secret = ?
      WHERE id = ?
    `,
      appId.trim(),
      appSecret.trim(),
      user.id
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro em /config/shopee/:userId", err);
    return res.status(500).json({ error: "Erro ao salvar config Shopee" });
  }
});

// Ativar robô + frequência + template
app.post("/config/robot/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled, intervalMinutes, template } = req.body;

    const user = await ensureUser(userId);

    const safeInterval = Math.max(5, Number(intervalMinutes) || 15); // mínimo 5 min

    await db.run(
      `
      UPDATE users
      SET robot_enabled = ?, interval_minutes = ?, message_template = ?
      WHERE id = ?
    `,
      enabled ? 1 : 0,
      safeInterval,
      template || user.message_template,
      user.id
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro em /config/robot/:userId", err);
    return res.status(500).json({ error: "Erro ao salvar config do robô" });
  }
});

// ===============================================
// SHOPEE – FUNÇÕES AUXILIARES
// ===============================================

// ⚠️ IMPORTANTE:
// 1) Você vai precisar ajustar "buildShopeeGraphQLBody" com o mesmo JSON
//    que aparece na aba Network (Request Payload) quando você clica em "Pesquisar ofertas".
// 2) Depois, olhar o JSON de resposta no console e ajustar "normalizeShopeeResponse".

function buildShopeeGraphQLBody(user) {
  // EXEMPLO DE ESTRUTURA – Ajuste com o payload REAL da sua aba Network
  // Normalmente é algo assim:
  //
  // {
  //   "operationName": "productOfferLinks",
  //   "variables": { ... },
  //   "query": "query productOfferLinks(...) { ... }"
  // }
  //
  // Copie exatamente o "Request Payload" da requisição graphql q=productOfferLinks
  // e cole aqui, talvez só mexendo em filtros (categoria, ordenação, etc).

  return {
    operationName: "productOfferLinks",
    variables: {
      // TODO: substituir pelos mesmos campos que você viu no Network
      page: 1,
      pageSize: 20,
      // filtros de exemplo, ajuste conforme sua conta:
      // category: null,
      // sortType: "commission_desc"
    },
    query: `
      query productOfferLinks($page: Int, $pageSize: Int) {
        productOfferLinks(page: $page, pageSize: $pageSize) {
          edges {
            node {
              id
              title
              offerLink
              price
              originalPrice
              discount
            }
          }
        }
      }
    `,
  };
}

// Mapeia o JSON da Shopee → formato genérico usado no template
function normalizeShopeeResponse(raw) {
  // ⚠️ ESSA PARTE DEPENDE DO JSON REAL.
  // Depois do primeiro teste, faça um console.log(JSON.stringify(raw, null, 2))
  // e ajuste os caminhos abaixo.

  const edges =
    raw?.data?.productOfferLinks?.edges ||
    raw?.data?.product_offer_links?.edges ||
    [];

  const offers = edges.map((edge) => {
    const n = edge.node || edge;
    const preco = Number(n.price || n.discounted_price || 0) / 100;
    const precoOriginal = Number(n.originalPrice || n.original_price || 0) / 100;
    const desconto =
      n.discount ||
      (precoOriginal > 0
        ? Math.round(100 - (preco / precoOriginal) * 100)
        : null);

    return {
      id: n.id,
      titulo: n.title || n.name || "Oferta Shopee",
      preco: preco > 0 ? `R$ ${preco.toFixed(2)}` : "",
      preco_original:
        precoOriginal > 0 ? `R$ ${precoOriginal.toFixed(2)}` : "",
      desconto: desconto != null ? `${desconto}% OFF` : "",
      link: n.offerLink || n.link || "",
    };
  });

  return offers;
}

async function fetchShopeeOffersForUser(user) {
  if (!user.shopee_app_id || !user.shopee_app_secret) {
    console.warn(
      `Usuário ${user.achady_user_id} sem credenciais Shopee – pulando.`
    );
    return [];
  }

  const body = buildShopeeGraphQLBody(user);

  const res = await fetch(SHOPEE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // ⚠️ Esses headers podem mudar – confira na aba Network
      "x-affiliate-appid": user.shopee_app_id,
      "x-affiliate-secret": user.shopee_app_secret,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      `Erro Shopee (${res.status}) para user ${user.achady_user_id}:`,
      text
    );
    return [];
  }

  const json = await res.json();
  // Descomente abaixo no primeiro teste para enxergar o formato REAL
  // console.log("Shopee JSON:", JSON.stringify(json, null, 2));
  return normalizeShopeeResponse(json);
}

// ===============================================
// TEMPLATE + ANTI-BAN
// ===============================================

function renderTemplate(template, offer) {
  return template
    .replace(/{{titulo}}/g, offer.titulo || "")
    .replace(/{{preco}}/g, offer.preco || "")
    .replace(/{{precooriginal}}/gi, offer.preco_original || "")
    .replace(/{{preco_original}}/g, offer.preco_original || "")
    .replace(/{{desconto}}/g, offer.desconto || "")
    .replace(/{{link}}/g, offer.link || "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Estratégia simples anti-ban:
// - Nunca dispara mais de 1 "rodada" por usuário dentro do intervalo configurado
// - Delay aleatório entre mensagens dentro do mesmo grupo
// - Pequena pausa entre usuários

async function runRobotCycle() {
  try {
    const now = new Date();
    const users = await db.all(
      "SELECT * FROM users WHERE robot_enabled = 1"
    );

    for (const user of users) {
      // Checa intervalo
      if (user.last_run_at) {
        const last = new Date(user.last_run_at);
        const diffMin = (now - last) / 60000;
        if (diffMin < user.interval_minutes) {
          continue;
        }
      }

      const session = sessions[user.achady_user_id];
      if (!session || session.status !== "ready") {
        console.warn(
          `Robô: sessão de ${user.achady_user_id} não está pronta – pulando.`
        );
        continue;
      }

      const offers = await fetchShopeeOffersForUser(user);
      if (!offers || offers.length === 0) {
        console.warn(`Robô: nenhuma oferta retornada para ${user.achady_user_id}`);
        await db.run(
          "UPDATE users SET last_run_at = ? WHERE id = ?",
          now.toISOString(),
          user.id
        );
        continue;
      }

      // Por enquanto, vamos pegar só a primeira oferta da lista
      const offer = offers[0];

      const groups = await db.all(
        "SELECT * FROM groups WHERE user_id = ? AND active = 1",
        user.id
      );

      for (const group of groups) {
        const message = renderTemplate(user.message_template, offer);

        try {
          const chat = await session.client.getChatById(group.wa_chat_id);
          await chat.sendMessage(message);

          await db.run(
            `
            INSERT INTO send_logs (
              user_id, group_id, offer_title, offer_link, payload_json, sent_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            user.id,
            group.id,
            offer.titulo,
            offer.link,
            JSON.stringify(offer),
            new Date().toISOString(),
            "ok"
          );

          // Delay anti-ban entre mensagens
          await sleep(2000 + randomInt(1000, 3000));
        } catch (err) {
          console.error(
            `Erro ao enviar mensagem para grupo ${group.wa_chat_id}:`,
            err
          );
          await db.run(
            `
            INSERT INTO send_logs (
              user_id, group_id, offer_title, offer_link, payload_json, sent_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            user.id,
            group.id,
            offer.titulo,
            offer.link,
            JSON.stringify({ offer, error: String(err) }),
            new Date().toISOString(),
            "error"
          );
        }
      }

      await db.run(
        "UPDATE users SET last_run_at = ? WHERE id = ?",
        new Date().toISOString(),
        user.id
      );

      // Pausa entre usuários (anti-ban)
      await sleep(3000 + randomInt(1000, 4000));
    }
  } catch (err) {
    console.error("Erro no ciclo do robô:", err);
  }
}

// roda a cada 60 segundos para checar se algum usuário já está no horário
setInterval(runRobotCycle, 60 * 1000);

// ===============================================
// ROTA DE TESTE
// ===============================================
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Achady está rodando. 🚀");
});

// ===============================================
// INICIAR SERVIDOR
// ===============================================
(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
  });
})();