// server.js
// ACHADY – Servidor WhatsApp + Shopee + Histórico + Anti-ban

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import sqlite3 from "sqlite3";
import axios from "axios";

const { Client, LocalAuth } = pkg;

// =====================================================
// CONFIG BÁSICA
// =====================================================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// =====================================================
// BANCO DE DADOS (SQLite)
// Arquivo: achady.db na raiz do projeto
// =====================================================
const db = new sqlite3.Database("./achady.db");

// Cria tabelas se não existirem
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY,
      shopee_app_id TEXT,
      shopee_secret TEXT,
      interval_minutes INTEGER DEFAULT 15,
      template TEXT,
      bot_active INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      invite TEXT,
      joined INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      group_invite TEXT,
      product_title TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT,
      error TEXT
    )
  `);
});

// Helpers DB (promisificados)
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// =====================================================
// SESSÕES WHATSAPP – UMA POR USER_ID DO ACHADY
// =====================================================
const sessions = {};         // { userId: { client, qr, status } }
const schedulers = {};       // agendadores por usuário (intervalos)

// Função de espera (anti-ban)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    status: "starting", // starting | qr | ready | error
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
    console.log(`⚠️ WhatsApp desconectou — USER ${userId}`, reason);
    sessions[userId].status = "error";
  });

  client.initialize();
  return sessions[userId];
}

// =====================================================
// SHOPEE – BUSCAR OFERTAS (GraphQL)
// =====================================================

// ⚠️ CONFIGURE AQUI:
//  - URL da API GraphQL da Shopee Open API
//  - Query GraphQL que retorna as ofertas
//
// Leia a documentação da Shopee para pegar:
//  - endpoint correto (por ex: https://affiliate.shopee.com.br/open_api/graphql)
//  - o formato da query/mutation
const SHOPEE_GRAPHQL_ENDPOINT = process.env.SHOPEE_GRAPHQL_ENDPOINT || ""; // coloque sua URL aqui

// Exemplo de função genérica para buscar 1 oferta
async function getShopeeOffers({ appId, secret }) {
  if (!SHOPEE_GRAPHQL_ENDPOINT) {
    throw new Error(
      "SHOPEE_GRAPHQL_ENDPOINT não configurado. Defina a URL oficial da Shopee em env ou no código."
    );
  }

  // ⚠️ EXEMPLO DE QUERY – você deve trocar pelo modelo real da Shopee
  const query = `
    query ExampleOffers {
      # TODO: substitua pelos campos reais da sua API Shopee
      # Por exemplo: affiliateProducts(...) { items { title, price, originalPrice, discount, link } }
    }
  `;

  try {
    const resp = await axios.post(
      SHOPEE_GRAPHQL_ENDPOINT,
      {
        query,
        variables: {}, // ajuste se precisar
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-APP-ID": appId,
          "X-APP-SECRET": secret,
        },
      }
    );

    const data = resp.data;

    // TODO: mapeie o caminho correto até as ofertas
    // Abaixo é APENAS um exemplo de mapeamento.
    const items = (data.data && data.data.affiliateProducts && data.data.affiliateProducts.items) || [];

    // Normalizar para o formato usado pelo template
    const ofertas = items.map((p) => ({
      titulo: p.title,
      preco: p.price,
      precoOriginal: p.originalPrice,
      desconto: p.discount,
      link: p.link,
    }));

    return ofertas;
  } catch (err) {
    console.error("Erro ao buscar ofertas na Shopee:", err.message);
    throw err;
  }
}

// =====================================================
// TEMPLATE DE MENSAGEM (usado pelo painel Achady)
// Placeholders: {{titulo}}, {{preco}}, {{precooriginal}}, {{desconto}}, {{link}}
// =====================================================
const DEFAULT_TEMPLATE = `
🔥 OFERTA IMPERDÍVEL! 🔥

{{titulo}}
Apenas: {{preco}}
De: {{precooriginal}}
Desconto: {{desconto}}

🛒 Compre aqui: {{link}}
`.trim();

function aplicarTemplate(template, oferta) {
  let msg = template || DEFAULT_TEMPLATE;

  msg = msg.replace(/{{titulo}}/g, oferta.titulo || "");
  msg = msg.replace(/{{preco}}/g, oferta.preco || "");
  msg = msg.replace(/{{precooriginal}}/g, oferta.precoOriginal || "");
  msg = msg.replace(/{{desconto}}/g, oferta.desconto || "");
  msg = msg.replace(/{{link}}/g, oferta.link || "");

  return msg;
}

// =====================================================
// GRUPOS – ENTRAR POR LINK E ENVIAR MENSAGEM
// =====================================================
async function joinGroupIfNeeded(client, inviteLink, userId) {
  const row = await dbGet(
    "SELECT joined FROM groups WHERE user_id = ? AND invite = ?",
    [userId, inviteLink]
  );

  if (row && row.joined) {
    return; // já entrou antes
  }

  const code = inviteLink.split("/").pop();
  console.log(`🔗 USER ${userId} entrando no grupo com código: ${code}`);

  try {
    await client.acceptInvite(code);
    await dbRun(
      "INSERT OR IGNORE INTO groups (user_id, invite, joined) VALUES (?, ?, 1)",
      [userId, inviteLink]
    );
    await dbRun(
      "UPDATE groups SET joined = 1 WHERE user_id = ? AND invite = ?",
      [userId, inviteLink]
    );
    console.log(`✅ USER ${userId} entrou no grupo`);
  } catch (err) {
    console.error("Erro ao entrar no grupo:", err.message);
    throw err;
  }
}

async function enviarMensagemGrupo(client, inviteLink, mensagem, userId, productTitle) {
  try {
    await joinGroupIfNeeded(client, inviteLink, userId);

    const code = inviteLink.split("/").pop();
    const chat = await client.getChatById(`${code}@g.us`).catch(() => null);

    if (!chat) {
      console.log("Não foi possível encontrar o chat do grupo via ID. Tentando por invite…");
      // fallback: aceitar invite de novo (já faz parte do joinGroupIfNeeded)
    }

    // Envio da mensagem
    const targetChat = chat || (await client.getChatById(`${code}@g.us`));
    await targetChat.sendMessage(mensagem);

    await dbRun(
      "INSERT INTO send_logs (user_id, group_invite, product_title, status, error) VALUES (?, ?, ?, ?, ?)",
      [userId, inviteLink, productTitle || "", "ok", ""]
    );

    console.log(`✅ Mensagem enviada para grupo (user ${userId})`);
  } catch (err) {
    console.error("Erro ao enviar mensagem para grupo:", err.message);
    await dbRun(
      "INSERT INTO send_logs (user_id, group_invite, product_title, status, error) VALUES (?, ?, ?, ?, ?)",
      [userId, inviteLink, productTitle || "", "error", err.message]
    );
  }
}

// =====================================================
// CICLO AUTOMÁTICO – BUSCAR OFERTAS E DISPARAR
// =====================================================
async function runUserCycle(userId) {
  try {
    const settings = await dbGet("SELECT * FROM settings WHERE user_id = ?", [userId]);
    if (!settings || !settings.bot_active) {
      return; // robô desativado
    }

    const session = await createSession(userId);
    if (session.status !== "ready") {
      console.log(`USER ${userId} ainda não está ready (status: ${session.status}), pulando ciclo.`);
      return;
    }

    const groups = await dbAll("SELECT invite FROM groups WHERE user_id = ?", [userId]);
    if (!groups.length) {
      console.log(`USER ${userId} não tem grupos cadastrados.`);
      return;
    }

    const { shopee_app_id, shopee_secret, template } = settings;

    if (!shopee_app_id || !shopee_secret) {
      console.log(`USER ${userId} sem credenciais Shopee, pulando ciclo.`);
      return;
    }

    console.log(`🔍 Buscando ofertas Shopee para USER ${userId}…`);
    const ofertas = await getShopeeOffers({
      appId: shopee_app_id,
      secret: shopee_secret,
    });

    if (!ofertas.length) {
      console.log(`USER ${userId} – nenhuma oferta retornada pela Shopee.`);
      return;
    }

    // Simples: pega a primeira oferta da lista para este ciclo
    const oferta = ofertas[0];
    const mensagem = aplicarTemplate(template || DEFAULT_TEMPLATE, oferta);

    // Limite anti-ban: máximo N grupos por ciclo
    const MAX_GRUPOS_POR_CICLO = 3;
    const client = session.client;

    for (let i = 0; i < groups.length && i < MAX_GRUPOS_POR_CICLO; i++) {
      const g = groups[i];
      await enviarMensagemGrupo(client, g.invite, mensagem, userId, oferta.titulo);

      // Delay aleatório entre 5 e 15s entre grupos (anti-ban básico)
      const delay = 5000 + Math.floor(Math.random() * 10000);
      await sleep(delay);
    }

    console.log(`✅ Ciclo concluído para USER ${userId}`);
  } catch (err) {
    console.error(`Erro no ciclo automático do USER ${userId}:`, err.message);
  }
}

// =====================================================
// AGENDADORES POR USUÁRIO
// =====================================================
function scheduleForUser(userId) {
  // limpa se já tiver
  if (schedulers[userId]) {
    clearInterval(schedulers[userId]);
    delete schedulers[userId];
  }

  dbGet("SELECT interval_minutes, bot_active FROM settings WHERE user_id = ?", [userId])
    .then((row) => {
      if (!row || !row.bot_active) {
        console.log(`⏸️ Robô desativado para USER ${userId}, nenhum agendamento criado.`);
        return;
      }

      const minutes = row.interval_minutes || 15;
      const intervalMs = minutes * 60 * 1000;

      console.log(
        `⏱️ Agendador criado para USER ${userId} – a cada ${minutes} minuto(s).`
      );

      schedulers[userId] = setInterval(() => {
        runUserCycle(userId);
      }, intervalMs);
    })
    .catch((err) => console.error("Erro ao agendar usuário:", err.message));
}

// Na inicialização, recria agendadores para quem estiver ativo
async function bootstrapSchedulers() {
  const rows = await dbAll("SELECT user_id FROM settings WHERE bot_active = 1");
  rows.forEach((r) => scheduleForUser(r.user_id));
}

bootstrapSchedulers();

// =====================================================
// ROTAS HTTP – INTEGRAÇÃO COM O PAINEL ACHADY
// =====================================================

// 1) Iniciar sessão / mostrar QR
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

// 2) Buscar QR atual
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

// 3) Status da sessão
app.get("/status/:userId", (req, res) => {
  const { userId } = req.params;
  const session = sessions[userId];

  if (!session) {
    return res.status(404).json({
      status: "not_started",
      qr: null,
    });
  }

  return res.json({
    status: session.status,
    hasQr: !!session.qr,
  });
});

// 4) Configuração vinda do painel Achady
// Body esperado:
// {
//   "shopeeAppId": "...",
//   "shopeeSecret": "...",
//   "intervalMinutes": 5,
//   "template": "texto com {{titulo}}...",
//   "botActive": true,
//   "groups": ["https://chat.whatsapp.com/AAAA", "..."]
// }
app.post("/config/:userId", async (req, res) => {
  const { userId } = req.params;
  const {
    shopeeAppId,
    shopeeSecret,
    intervalMinutes,
    template,
    botActive,
    groups,
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId é obrigatório" });
  }

  try {
    await dbRun(
      `
      INSERT INTO settings (user_id, shopee_app_id, shopee_secret, interval_minutes, template, bot_active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        shopee_app_id = excluded.shopee_app_id,
        shopee_secret = excluded.shopee_secret,
        interval_minutes = excluded.interval_minutes,
        template = excluded.template,
        bot_active = excluded.bot_active
    `,
      [
        userId,
        shopeeAppId || null,
        shopeeSecret || null,
        intervalMinutes || 15,
        template || DEFAULT_TEMPLATE,
        botActive ? 1 : 0,
      ]
    );

    if (Array.isArray(groups)) {
      // limpa grupos antigos e recria
      await dbRun("DELETE FROM groups WHERE user_id = ?", [userId]);
      for (const g of groups) {
        if (!g) continue;
        await dbRun(
          "INSERT INTO groups (user_id, invite, joined) VALUES (?, ?, 0)",
          [userId, g]
        );
      }
    }

    // Atualiza agendador
    scheduleForUser(userId);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar config:", err.message);
    return res.status(500).json({ error: "Erro ao salvar config" });
  }
});

// 5) Histórico de disparos (para tela de Logs do Achady)
app.get("/history/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const rows = await dbAll(
      `
      SELECT id, group_invite, product_title, sent_at, status, error
      FROM send_logs
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT 100
    `,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar histórico:", err.message);
    return res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// =====================================================
// ROTA DE TESTE (homepage)
// =====================================================
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Achady está rodando. 🚀");
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================
app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});