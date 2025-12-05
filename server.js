// server.js
// ACHADY – SERVIDOR DE AUTOMAÇÃO WHATSAPP + SHOPEE
// Arquitetura: Node.js | JSON DB | whatsapp-web.js | Shopee GraphQL

import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import axios from "axios";
import crypto from "crypto";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config();

const { Client, LocalAuth } = pkg;

// ========================
// CONFIGURAÇÕES GERAIS
// ========================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const DB_FILE = "./achady_db.json";
const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

// ========================
// JSON DATABASE (Persistência em Arquivo)
// ========================
// Estrutura em memória
let dbData = {
  configs: [], // { userId, appId, appSecret, keyword, intervalMinutes, messageTemplate, isActive }
  groups: [],  // { id, userId, invite, name, groupId, category }
  logs: []     // { id, userId, sentAt, groupName, productName, price, discount, link }
};

// Carregar DB
async function initDB() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    dbData = JSON.parse(data);
    
    // Garantir arrays
    if (!dbData.configs) dbData.configs = [];
    if (!dbData.groups) dbData.groups = [];
    if (!dbData.logs) dbData.logs = [];

    console.log("📦 Banco de dados carregado com sucesso.");
  } catch (err) {
    console.log("⚠️ Banco de dados não encontrado, criando novo arquivo vazio.");
    await saveDB();
  }
}

// Salvar DB
async function saveDB() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(dbData, null, 2));
  } catch (err) {
    console.error("❌ Erro ao salvar banco de dados:", err);
  }
}

initDB();

// Helpers de DB
const getUserConfig = (userId) => dbData.configs.find(c => c.userId === userId);
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
// GERENCIADOR WHATSAPP
// ========================
const sessions = {}; // { [userId]: { client, status, qr } }

const getSession = (userId) => sessions[userId];

const createSession = async (userId) => {
  if (sessions[userId]) return sessions[userId];

  console.log(`🔄 Iniciando sessão WhatsApp para User ${userId}...`);

  const client = new Client({
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    },
    authStrategy: new LocalAuth({ clientId: `achady-${userId}` })
  });

  sessions[userId] = {
    client,
    status: 'starting',
    qr: null
  };

  client.on('qr', async (qr) => {
    console.log(`📌 QR Code recebido para User ${userId}`);
    sessions[userId].qr = await qrcode.toDataURL(qr);
    sessions[userId].status = 'qr';
  });

  client.on('ready', () => {
    console.log(`✅ WhatsApp User ${userId} está ONLINE/READY!`);
    sessions[userId].status = 'ready';
    sessions[userId].qr = null;
  });

  client.on('authenticated', () => {
    console.log(`🔐 WhatsApp User ${userId} autenticado.`);
    sessions[userId].status = 'authenticated';
  });

  client.on('disconnected', (reason) => {
    console.log(`❌ WhatsApp User ${userId} desconectado:`, reason);
    sessions[userId].status = 'offline';
  });

  try {
    await client.initialize();
  } catch (e) {
    console.error(`Erro ao inicializar cliente ${userId}:`, e);
    sessions[userId].status = 'error';
  }

  return sessions[userId];
};

// ========================
// SHOPEE API CLIENT
// ========================
function generateShopeeSignature(appId, appSecret, payload, timestamp) {
  const factor = appId + timestamp + payload + appSecret;
  return crypto.createHash('sha256').update(factor).digest('hex');
}

async function fetchShopeeOffers(userId) {
  const config = getUserConfig(userId);
  if (!config || !config.appId || !config.appSecret) {
    throw new Error("Credenciais da Shopee não configuradas.");
  }

  const keyword = config.keyword || "promoção";
  
  const query = `
    query {
      productOfferV2(
        keyword: "${keyword}",
        page: 1,
        limit: 5,
        sortType: 2
      ) {
        nodes {
          productName
          offerLink
          priceMin
          priceMax
          priceDiscountRate
          imageUrl
        }
      }
    }
  `;

  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateShopeeSignature(config.appId, config.appSecret, payload, timestamp);

  try {
    const response = await axios.post(SHOPEE_ENDPOINT, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${config.appId}, Timestamp=${timestamp}, Signature=${signature}`
      },
      timeout: 15000
    });

    if (response.data.errors) {
      console.error("Erro GraphQL Shopee:", response.data.errors);
      throw new Error("Erro na API da Shopee (GraphQL)");
    }

    return response.data?.data?.productOfferV2?.nodes || [];
  } catch (error) {
    console.error("Falha na requisição Shopee:", error.message);
    return [];
  }
}

// ========================
// MOTOR DE AUTOMAÇÃO (ROBÔ)
// ========================
const automationTimers = {};

function formatCurrency(val) {
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildMessage(template, offer) {
  const titulo = offer.productName || "Oferta";
  const preco = formatCurrency(offer.priceMin || 0);
  const precoOriginal = formatCurrency(offer.priceMax || (offer.priceMin * 1.2));
  const desconto = offer.priceDiscountRate ? `${offer.priceDiscountRate}% OFF` : "";
  const link = offer.offerLink;

  let msg = template || `🔥 {{titulo}}\n💰 {{preco}}\n🛒 {{link}}`;
  
  msg = msg.replace(/{{titulo}}/g, titulo)
           .replace(/{{preco}}/g, preco)
           .replace(/{{precoOriginal}}/g, precoOriginal)
           .replace(/{{desconto}}/g, desconto)
           .replace(/{{link}}/g, link);
           
  return msg;
}

async function runAutomationCycle(userId) {
  try {
    // 1. Verificar Estado
    const config = getUserConfig(userId);
    const session = getSession(userId);

    if (!config || !config.isActive) {
      console.log(`⏸️ Robô User ${userId} está pausado.`);
      return;
    }
    if (!session || session.status !== 'ready') {
      console.log(`⚠️ Robô User ${userId}: WhatsApp não está pronto.`);
      return;
    }

    // 2. Buscar Grupos
    const groups = dbData.groups.filter(g => g.userId === userId);
    if (groups.length === 0) {
      console.log(`⚠️ Robô User ${userId}: Sem grupos cadastrados.`);
      return;
    }

    // 3. Buscar Ofertas
    console.log(`🔎 Buscando ofertas Shopee para User ${userId}...`);
    const offers = await fetchShopeeOffers(userId);
    
    if (!offers || offers.length === 0) {
      console.log(`⚠️ Nenhuma oferta encontrada.`);
      return;
    }

    // Seleciona a primeira oferta (MVP)
    const offer = offers[0]; 
    const message = buildMessage(config.messageTemplate, offer);

    // 4. Enviar para Grupos
    for (const group of groups) {
      // Tenta enviar se tiver groupId, se não, ignora
      if (group.groupId) {
        console.log(`📤 Enviando oferta para ${group.name}...`);
        
        try {
          await session.client.sendMessage(group.groupId, message);
          
          // 5. Logar Envio
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
          
          // Manter log limpo (Max 200)
          if (dbData.logs.length > 200) dbData.logs.pop();
          await saveDB();

          // Delay anti-ban (5 a 15 seg)
          await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000));

        } catch (sendErr) {
          console.error(`❌ Falha ao enviar para ${group.name}:`, sendErr.message);
        }
      }
    }

  } catch (err) {
    console.error(`❌ Erro no ciclo de automação User ${userId}:`, err.message);
  }
}

async function startAutomationTimer(userId) {
  // Limpar anterior
  if (automationTimers[userId]) {
    clearInterval(automationTimers[userId]);
    delete automationTimers[userId];
  }

  const config = getUserConfig(userId);
  if (config && config.isActive) {
    const minutes = config.intervalMinutes || 15;
    console.log(`⏱️ Timer iniciado para User ${userId}: Ciclo a cada ${minutes} minutos.`);
    
    // Executa imediatamente uma vez
    runAutomationCycle(userId);
    
    // Agenda próximos
    automationTimers[userId] = setInterval(() => {
      runAutomationCycle(userId);
    }, minutes * 60 * 1000);
  } else {
    console.log(`⏹️ Timer parado para User ${userId}.`);
  }
}

// ========================
// ROTAS DA API
// ========================

// 1. SESSÃO WHATSAPP
app.post("/start/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const session = await createSession(userId);
    res.json({ status: session.status, message: "Sessão iniciada/recuperada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/qr/:userId", (req, res) => {
  const sess = getSession(req.params.userId);
  if (!sess) return res.status(404).json({ status: "not_started", qr: null });
  res.json({ status: sess.status, qr: sess.qr });
});

app.get("/status", (req, res) => {
  // Status global simples
  res.json({ online: true, timestamp: Date.now() });
});

// 2. GESTÃO DE GRUPOS
app.post("/join/:userId", async (req, res) => {
  const { userId } = req.params;
  const { invite, name, category } = req.body;
  
  const sess = getSession(userId);
  if (!sess || sess.status !== 'ready') {
    return res.status(400).json({ error: "WhatsApp não está conectado (Ready)" });
  }

  try {
    // Aceita convite
    const inviteCode = invite.replace('https://chat.whatsapp.com/', '');
    const chatId = await sess.client.acceptInvite(inviteCode);
    
    // O retorno do acceptInvite pode ser apenas o ID ou um objeto, depende da versão da lib
    // Geralmente retorna o ID do grupo (ex: 123... @g.us)
    
    // Vamos buscar informações do chat para garantir
    // Nota: Às vezes demora um pouco para o chat aparecer na lista
    
    const newGroup = {
      id: Date.now(),
      userId,
      invite,
      name: name || "Grupo Novo",
      groupId: typeof chatId === 'object' ? chatId._serialized : chatId, 
      category: category || "geral"
    };

    dbData.groups.push(newGroup);
    await saveDB();

    res.json({ success: true, groupName: newGroup.name, groupId: newGroup.groupId });
  } catch (err) {
    console.error("Erro /join:", err);
    res.status(500).json({ error: "Falha ao entrar no grupo. Verifique o link." });
  }
});

// 3. CONFIGURAÇÃO (Shopee + Robô)
app.post("/config/:userId", async (req, res) => {
  const { userId } = req.params;
  const body = req.body; // appId, appSecret, keyword, intervalMinutes, messageTemplate, isActive

  try {
    const newConfig = await setUserConfig(userId, body);
    
    // Se mudou isActive ou interval, reiniciar timer
    if (body.isActive !== undefined || body.intervalMinutes !== undefined) {
      await startAutomationTimer(userId);
    }

    res.json({ success: true, config: newConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota auxiliar para o Frontend carregar dados iniciais
app.get("/config/:userId", (req, res) => {
  const config = getUserConfig(req.params.userId);
  // Retorna config ou objeto vazio seguro
  res.json(config || {
    appId: "", appSecret: "", keyword: "", 
    intervalMinutes: 15, isActive: false, 
    messageTemplate: "" 
  });
});

// 4. LOGS
app.get("/logs/:userId", (req, res) => {
  const { userId } = req.params;
  // Filtra logs do usuário e ordena decrescente
  const logs = dbData.logs
    .filter(l => l.userId === userId)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    .slice(0, 100);

  res.json({ logs });
});

// 5. TESTE DE ENVIO (Botão Dashboard)
app.post("/send/:userId", async (req, res) => {
  const { userId } = req.params;
  const { message, number } = req.body; // number pode ser ID de grupo ou telefone

  const sess = getSession(userId);
  if (!sess || sess.status !== 'ready') return res.status(400).json({ error: "Sessão não conectada" });

  try {
    // Formata ID se for número comum
    let target = number;
    if (!target.includes('@')) {
        target = `${target.replace(/\D/g, '')}@c.us`;
    }
    
    await sess.client.sendMessage(target, message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INICIAR
app.listen(PORT, () => {
  console.log(`🚀 Achady Server rodando na porta ${PORT}`);
});
