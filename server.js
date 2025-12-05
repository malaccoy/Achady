// server.js
// ACHADY – SERVIDOR UNIFICADO (WhatsApp + Shopee)
// Suporta API Oficial e Scraping via shopee.js

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import fs from "fs/promises";
import dotenv from "dotenv";
import { buscarOfertas } from "./shopee.js"; // Importa lógica de busca unificada

dotenv.config();

const { Client, LocalAuth } = pkg;
const app = express();

// Configurações
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_FILE = "./achady_db.json";

// ========================
// 📦 JSON DATABASE
// ========================
let dbData = { configs: [], groups: [], logs: [] };

async function initDB() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    dbData = JSON.parse(data);
    // Garantir estrutura
    if (!dbData.configs) dbData.configs = [];
    if (!dbData.groups) dbData.groups = [];
    if (!dbData.logs) dbData.logs = [];
    console.log("📦 Banco de dados carregado.");
  } catch (err) {
    console.log("⚠️ Criando novo banco de dados local.");
    await saveDB();
  }
}

async function saveDB() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(dbData, null, 2));
  } catch (err) {
    console.error("❌ Erro ao salvar DB:", err);
  }
}

initDB();

// Helpers de DB
const getUserConfig = (userId) => dbData.configs.find(c => c.userId === userId) || {};
const setUserConfig = async (userId, data) => {
  const idx = dbData.configs.findIndex(c => c.userId === userId);
  if (idx > -1) {
    dbData.configs[idx] = { ...dbData.configs[idx], ...data };
  } else {
    dbData.configs.push({ userId, ...data });
  }
  await saveDB();
  return getUserConfig(userId);
};

// ========================
// 🤖 WHATSAPP MANAGER
// ========================
const sessions = {}; // Armazena clientes em memória

const getSession = (userId) => sessions[userId];

const createSession = async (userId) => {
  if (sessions[userId]) return sessions[userId];

  console.log(`🔄 Criando sessão WhatsApp para User ${userId}...`);

  const client = new Client({
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    },
    authStrategy: new LocalAuth({ clientId: `achady-${userId}` })
  });

  sessions[userId] = { client, status: 'starting', qr: null };

  client.on('qr', async (qr) => {
    console.log(`📌 QR Code gerado para User ${userId}`);
    sessions[userId].qr = await qrcode.toDataURL(qr);
    sessions[userId].status = 'qr';
  });

  client.on('ready', () => {
    console.log(`✅ WhatsApp User ${userId} CONECTADO!`);
    sessions[userId].status = 'ready';
    sessions[userId].qr = null;
  });

  client.on('disconnected', (reason) => {
    console.log(`❌ WhatsApp User ${userId} Desconectado:`, reason);
    sessions[userId].status = 'offline';
  });

  try {
    await client.initialize();
  } catch (e) {
    console.error(`Erro ao inicializar WhatsApp ${userId}:`, e.message);
    sessions[userId].status = 'error';
  }

  return sessions[userId];
};

// ========================
// ⚡ AUTOMAÇÃO E MENSAGENS
// ========================
const automationTimers = {};

function formatarMensagem(template, offer) {
  const titulo = offer.productName || "Oferta Imperdível";
  const preco = Number(offer.priceMin || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const precoOriginal = Number(offer.priceMax || (offer.priceMin * 1.3)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const desconto = offer.priceDiscountRate ? `${offer.priceDiscountRate}% OFF` : "";
  const link = offer.offerLink || "https://shopee.com.br";

  let msg = template || `🔥 *{{titulo}}*\n\n💰 Por apenas: {{preco}}\n❌ De: {{precoOriginal}}\n\n🛒 Compre agora:\n{{link}}`;

  return msg
    .replace(/{{titulo}}/g, titulo)
    .replace(/{{preco}}/g, preco)
    .replace(/{{precoOriginal}}/g, precoOriginal)
    .replace(/{{desconto}}/g, desconto)
    .replace(/{{link}}/g, link);
}

async function runAutomationCycle(userId) {
  const config = getUserConfig(userId);
  const session = getSession(userId);

  // Verificações básicas
  if (!config?.isActive) return;
  if (!session || session.status !== 'ready') {
    console.log(`⏸️ Automação User ${userId}: WhatsApp não está pronto.`);
    return;
  }

  const groups = dbData.groups.filter(g => g.userId === userId);
  if (groups.length === 0) {
    console.log(`⚠️ Automação User ${userId}: Nenhum grupo cadastrado.`);
    return;
  }

  // 1. Buscar Ofertas (Usa shopee.js - API ou Scraping)
  const keyword = config.keyword || "promoção";
  console.log(`🔎 Buscando ofertas para User ${userId} (${keyword})...`);
  
  const offers = await buscarOfertas(keyword, {
    appId: config.appId,
    appSecret: config.appSecret
  });

  if (!offers || offers.length === 0) {
    console.log("⚠️ Nenhuma oferta encontrada neste ciclo.");
    return;
  }

  // 2. Preparar Mensagem (Pega a 1ª oferta)
  const offer = offers[0];
  const message = formatarMensagem(config.messageTemplate, offer);

  // 3. Enviar para Grupos
  for (const group of groups) {
    if (group.groupId) {
      try {
        console.log(`📤 Enviando oferta para grupo: ${group.name}`);
        await session.client.sendMessage(group.groupId, message);
        
        // Log
        dbData.logs.unshift({
          id: Date.now(),
          userId,
          groupName: group.name,
          productName: offer.productName,
          price: offer.priceMin,
          discount: offer.priceDiscountRate,
          offerLink: offer.offerLink,
          sentAt: new Date().toISOString()
        });
        
        // Limita tamanho do log
        if (dbData.logs.length > 100) dbData.logs.pop();
        await saveDB();

        // Delay anti-flood
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.error(`Erro ao enviar para ${group.name}:`, e.message);
      }
    }
  }
}

function startAutomation(userId) {
  if (automationTimers[userId]) clearInterval(automationTimers[userId]);
  
  const config = getUserConfig(userId);
  if (config && config.isActive) {
    const minutes = config.intervalMinutes || 15;
    console.log(`⏱️ Automação INICIADA para User ${userId} (Intervalo: ${minutes} min)`);
    
    // Executa a primeira vez imediatamente (opcional, pode comentar se preferir esperar)
    runAutomationCycle(userId);

    automationTimers[userId] = setInterval(() => {
      runAutomationCycle(userId);
    }, minutes * 60 * 1000);
  } else {
    console.log(`⏹️ Automação PARADA para User ${userId}`);
  }
}

// ========================
// 🌐 API ROUTES
// ========================

app.get("/", (req, res) => res.send("Achady Server Online 🚀"));

// 1. WhatsApp Status/Start/QR
app.post("/start/:userId", async (req, res) => {
  try {
    const session = await createSession(req.params.userId);
    res.json({ status: session.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/qr/:userId", (req, res) => {
  const session = getSession(req.params.userId);
  res.json({
    status: session?.status || "not_started",
    qr: session?.qr || null
  });
});

// 2. Grupos (Entrar via Link)
app.post("/join/:userId", async (req, res) => {
  const { invite, name, category } = req.body;
  const session = getSession(req.params.userId);

  if (!session || session.status !== 'ready') {
    return res.status(400).json({ error: "WhatsApp não está conectado/pronto." });
  }

  try {
    const code = invite.replace('https://chat.whatsapp.com/', '');
    const chat = await session.client.acceptInvite(code);
    
    // Tenta pegar o ID de várias formas (wwebjs varia versões)
    const groupId = chat.id?._serialized || chat.id || chat;

    const newGroup = {
      id: Date.now().toString(),
      userId: req.params.userId,
      invite,
      name: name || chat.name || "Grupo",
      category: category || "geral",
      groupId
    };

    dbData.groups.push(newGroup);
    await saveDB();

    res.json({ success: true, groupName: newGroup.name, groupId });
  } catch (e) {
    console.error("Erro Join Group:", e);
    res.status(500).json({ error: "Falha ao entrar no grupo. Verifique o link." });
  }
});

// 3. Configurações & Automação
app.post("/config/:userId", async (req, res) => {
  const { userId } = req.params;
  const newConfig = await setUserConfig(userId, req.body);
  
  // Se mudou status de automação, reinicia timer
  if (req.body.isActive !== undefined || req.body.intervalMinutes !== undefined) {
    startAutomation(userId);
  }
  
  res.json({ success: true, config: newConfig });
});

app.get("/config/:userId", (req, res) => {
  res.json(getUserConfig(req.params.userId));
});

// 4. Logs
app.get("/logs/:userId", (req, res) => {
  const userLogs = dbData.logs.filter(l => l.userId === req.params.userId);
  res.json({ logs: userLogs });
});

// 5. Envio Manual (Teste)
app.post("/send/:userId", async (req, res) => {
  const session = getSession(req.params.userId);
  if (!session || session.status !== 'ready') {
    return res.status(400).json({ error: "WhatsApp Offline" });
  }

  try {
    const { number, groupId, message } = req.body;
    let target = groupId || number;
    
    // Formata número se não for ID de grupo
    if (target && !target.includes('@')) {
      target = `${target.replace(/\D/g, '')}@c.us`;
    }

    if (!target) throw new Error("Destino (número ou grupo) inválido");

    await session.client.sendMessage(target, message);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Achady rodando na porta ${PORT}`);
});