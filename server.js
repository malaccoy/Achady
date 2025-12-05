// server.js — ACHADY FINAL (Shopee REAL + WhatsApp + SQLite)
// -----------------------------------------------------------
// npm i express cors whatsapp-web.js qrcode node-fetch sqlite sqlite3 crypto
// -----------------------------------------------------------

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import fetch from "node-fetch";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";

const { Client, LocalAuth } = pkg;

// ==============================
// CONFIG
// ==============================
const PORT = process.env.PORT || 3000;
const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

const app = express();
app.use(cors());
app.use(express.json());

// ==============================
// SQLITE
// ==============================
let db;

async function initDb() {
  db = await open({ filename: "./achady.sqlite", driver: sqlite3.Database });
  await db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achady_user_id TEXT UNIQUE NOT NULL,
      shopee_app_id TEXT,
      shopee_app_secret TEXT,
      keyword TEXT DEFAULT 'promoção',
      robot_enabled INTEGER DEFAULT 0,
      interval_minutes INTEGER DEFAULT 15,
      message_template TEXT DEFAULT '🔥 OFERTA IMPERDÍVEL 🔥\\n\\n{{titulo}}\\n💰 A partir de: R$ {{preco}}\\n🏷️ Desconto: {{desconto}}\\n💸 Comissão: {{comissao}}\\n\\n🛒 Comprar:\\n{{link}}',
      last_run_at TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      invite_link TEXT,
      wa_chat_id TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      group_id INTEGER,
      offer_title TEXT,
      offer_link TEXT,
      payload_json TEXT,
      sent_at TEXT,
      status TEXT
    );
  `);
}

async function ensureUser(achadyUserId) {
  let user = await db.get(
    "SELECT * FROM users WHERE achady_user_id = ?",
    achadyUserId
  );
  if (!user) {
    await db.run(
      "INSERT INTO users (achady_user_id) VALUES (?)",
      achadyUserId
    );
    user = await db.get(
      "SELECT * FROM users WHERE achady_user_id = ?",
      achadyUserId
    );
  }
  return user;
}

// ==============================
// WHATSAPP SESSÕES
// ==============================
let sessions = {};

async function createSession(achadyUserId) {
  if (sessions[achadyUserId]) return sessions[achadyUserId];

  const client = new Client({
    puppeteer: { headless: true, args: ["--no-sandbox"] },
    authStrategy: new LocalAuth({ clientId: `achady-${achadyUserId}` })
  });

  sessions[achadyUserId] = { client, qr: null, status: "starting" };

  client.on("qr", async (qr) => {
    sessions[achadyUserId].qr = await qrcode.toDataURL(qr);
    sessions[achadyUserId].status = "qr";
  });

  client.on("ready", () => {
    sessions[achadyUserId].status = "ready";
    console.log(`✅ WhatsApp conectado — ${achadyUserId}`);
  });

  client.initialize();
  return sessions[achadyUserId];
}

// ==============================
// ROTAS WHATSAPP
// ==============================
app.post("/start/:userId", async (req, res) => {
  const { userId } = req.params;
  await ensureUser(userId);
  const s = await createSession(userId);
  res.json({ status: s.status });
});

app.get("/qr/:userId", (req, res) => {
  const s = sessions[req.params.userId];
  if (!s) return res.json({ qr: null, status: "not_started" });
  res.json({ qr: s.qr, status: s.status });
});

// ==============================
// ENTRAR EM GRUPO
// ==============================
app.post("/join/:userId", async (req, res) => {
  const { invite, name } = req.body;
  const { userId } = req.params;

  const s = sessions[userId];
  const user = await ensureUser(userId);

  const code = invite.replace("https://chat.whatsapp.com/", "");
  const chat = await s.client.acceptInvite(code);

  await db.run(
    "INSERT INTO groups (user_id, name, invite_link, wa_chat_id) VALUES (?, ?, ?, ?)",
    user.id,
    name || chat.name,
    invite,
    chat.id._serialized
  );

  res.json({ ok: true });
});

// ==============================
// CONFIG DO PAINEL
// ==============================
app.post("/config/shopee/:userId", async (req, res) => {
  const { appId, appSecret, keyword } = req.body;
  const user = await ensureUser(req.params.userId);

  await db.run(
    "UPDATE users SET shopee_app_id=?, shopee_app_secret=?, keyword=? WHERE id=?",
    appId,
    appSecret,
    keyword || "promoção",
    user.id
  );

  res.json({ ok: true });
});

app.post("/config/robot/:userId", async (req, res) => {
  const { enabled, interval, template } = req.body;
  const user = await ensureUser(req.params.userId);

  await db.run(
    "UPDATE users SET robot_enabled=?, interval_minutes=?, message_template=? WHERE id=?",
    enabled ? 1 : 0,
    interval || 15,
    template || user.message_template,
    user.id
  );

  res.json({ ok: true });
});

// ==============================
// SHOPEE AUTH
// ==============================
function generateShopeeAuthHeader(appId, appSecret, payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = appId + timestamp + payload + appSecret;

  const signature = crypto.createHash("sha256").update(raw).digest("hex");

  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

// ==============================
// BUSCAR OFERTAS POR PALAVRA-CHAVE
// ==============================
async function fetchShopeeOffersByKeyword(user) {
  const payloadObj = {
    operationName: "productOfferV2",
    variables: {
      keyword: user.keyword || "promoção",
      page: 1,
      limit: 10,
      sortType: 5, // maior comissão
      isAMSOffer: true,
      isKeySeller: true
    },
    query: `
      query productOfferV2(
        $keyword: String,
        $page: Int,
        $limit: Int,
        $sortType: Int,
        $isAMSOffer: Bool,
        $isKeySeller: Bool
      ) {
        productOfferV2(
          keyword: $keyword,
          page: $page,
          limit: $limit,
          sortType: $sortType,
          isAMSOffer: $isAMSOffer,
          isKeySeller: $isKeySeller
        ) {
          nodes {
            itemId
            productName
            imageUrl
            offerLink
            commissionRate
            commission
            priceMin
            priceMax
            priceDiscountRate
            shopName
          }
        }
      }
    `
  };

  const payload = JSON.stringify(payloadObj);
  const auth = generateShopeeAuthHeader(
    user.shopee_app_id,
    user.shopee_app_secret,
    payload
  );

  const r = await fetch(SHOPEE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": auth
    },
    body: payload
  });

  const json = await r.json();
  if (json.errors) return [];
  return json.data.productOfferV2.nodes;
}

// ==============================
// TEMPLATE
// ==============================
function render(template, o) {
  return template
    .replace(/{{titulo}}/g, o.productName)
    .replace(/{{preco}}/g, o.priceMin)
    .replace(/{{desconto}}/g, `${o.priceDiscountRate}%`)
    .replace(/{{comissao}}/g, o.commissionRate)
    .replace(/{{link}}/g, o.offerLink);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ==============================
// ROBÔ AUTOMÁTICO
// ==============================
async function runRobot() {
  const users = await db.all("SELECT * FROM users WHERE robot_enabled = 1");
  const now = new Date();

  for (const user of users) {
    if (user.last_run_at) {
      const diff = (now - new Date(user.last_run_at)) / 60000;
      if (diff < user.interval_minutes) continue;
    }

    const s = sessions[user.achady_user_id];
    if (!s || s.status !== "ready") continue;

    const offers = await fetchShopeeOffersByKeyword(user);
    if (offers.length === 0) continue;

    const offer = offers[0];
    const msg = render(user.message_template, offer);

    const groups = await db.all("SELECT * FROM groups WHERE user_id = ?", user.id);

    for (const g of groups) {
      const chat = await s.client.getChatById(g.wa_chat_id);
      await chat.sendMessage(msg);

      await db.run(
        "INSERT INTO send_logs (user_id, group_id, offer_title, offer_link, payload_json, sent_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        user.id,
        g.id,
        offer.productName,
        offer.offerLink,
        JSON.stringify(offer),
        new Date().toISOString(),
        "ok"
      );

      await sleep(3000); // delay natural
    }

    await db.run(
      "UPDATE users SET last_run_at=? WHERE id=?",
      new Date().toISOString(),
      user.id
    );
  }
}

setInterval(runRobot, 60000);

// ==============================
app.get("/", (req, res) => {
  res.send("✅ ACHADY ONLINE COM SHOPEE REAL");
});

(async () => {
  await initDb();
  app.listen(PORT, () => console.log("🚀 Servidor rodando na porta", PORT));
})();